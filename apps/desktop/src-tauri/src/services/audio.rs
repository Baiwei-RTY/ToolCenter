use std::sync::{Mutex, mpsc};
use std::thread::{self, JoinHandle};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::error::AppError;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AudioDeviceKind {
    Input,
    Output,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum AudioDeviceState {
    Active,
    Disabled,
    Unplugged,
    NotPresent,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AudioDefaultRole {
    Console,
    Multimedia,
    Communications,
}

impl AudioDefaultRole {
    pub const ALL: [Self; 3] = [Self::Console, Self::Multimedia, Self::Communications];
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub kind: AudioDeviceKind,
    pub state: AudioDeviceState,
    pub default_roles: Vec<AudioDefaultRole>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AudioDeviceChangeKind {
    Added,
    Removed,
    StateChanged,
    DefaultChanged,
    PropertyChanged,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceChange {
    pub kind: AudioDeviceChangeKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_kind: Option<AudioDeviceKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<AudioDeviceState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<AudioDefaultRole>,
}

pub struct AudioState {
    worker: Mutex<Option<AudioWorker>>,
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            worker: Mutex::new(None),
        }
    }

    pub fn list_devices(
        &self,
        app: &AppHandle,
        kind: Option<AudioDeviceKind>,
    ) -> Result<Vec<AudioDevice>, AppError> {
        let sender = self.sender(app)?;
        let (response_sender, response_receiver) = mpsc::channel();
        sender
            .send(AudioRequest::ListDevices {
                kind,
                respond: response_sender,
            })
            .map_err(worker_stopped)?;
        response_receiver
            .recv()
            .map_err(worker_stopped)?
            .map_err(audio_error)
    }

    pub fn default_device(
        &self,
        app: &AppHandle,
        kind: AudioDeviceKind,
        role: AudioDefaultRole,
    ) -> Result<Option<AudioDevice>, AppError> {
        let sender = self.sender(app)?;
        let (response_sender, response_receiver) = mpsc::channel();
        sender
            .send(AudioRequest::DefaultDevice {
                kind,
                role,
                respond: response_sender,
            })
            .map_err(worker_stopped)?;
        response_receiver
            .recv()
            .map_err(worker_stopped)?
            .map_err(audio_error)
    }

    pub fn set_default_device(
        &self,
        app: &AppHandle,
        device_id: String,
        roles: Vec<AudioDefaultRole>,
    ) -> Result<(), AppError> {
        validate_device_id(&device_id)?;
        let sender = self.sender(app)?;
        let (response_sender, response_receiver) = mpsc::channel();
        sender
            .send(AudioRequest::SetDefaultDevice {
                device_id,
                roles,
                respond: response_sender,
            })
            .map_err(worker_stopped)?;
        response_receiver
            .recv()
            .map_err(worker_stopped)?
            .map_err(audio_error)
    }

    pub fn ensure_notifications(&self, app: &AppHandle) -> Result<(), AppError> {
        self.sender(app).map(|_| ())
    }

    fn sender(&self, app: &AppHandle) -> Result<mpsc::Sender<AudioRequest>, AppError> {
        let mut worker = self.worker.lock().map_err(|_| {
            AppError::new(
                "audio.state-poisoned",
                "Audio service state is unavailable.",
            )
        })?;
        if worker.is_none() {
            *worker = Some(AudioWorker::start(app.clone())?);
        }
        Ok(worker
            .as_ref()
            .expect("audio worker should be initialized")
            .sender
            .clone())
    }
}

impl Drop for AudioState {
    fn drop(&mut self) {
        let Ok(worker) = self.worker.get_mut() else {
            return;
        };
        if let Some(mut worker) = worker.take() {
            let _ = worker.sender.send(AudioRequest::Shutdown);
            if let Some(handle) = worker.handle.take() {
                let _ = handle.join();
            }
        }
    }
}

struct AudioWorker {
    sender: mpsc::Sender<AudioRequest>,
    handle: Option<JoinHandle<()>>,
}

impl AudioWorker {
    fn start(app: AppHandle) -> Result<Self, AppError> {
        let (sender, receiver) = mpsc::channel();
        let (ready_sender, ready_receiver) = mpsc::channel();
        let handle = thread::Builder::new()
            .name("toolcenter-audio-com".to_string())
            .spawn(move || run_audio_worker(app, receiver, ready_sender))
            .map_err(|error| AppError::new("audio.worker-start-failed", error.to_string()))?;
        match ready_receiver.recv().map_err(worker_stopped)? {
            Ok(()) => Ok(Self {
                sender,
                handle: Some(handle),
            }),
            Err(message) => {
                let _ = handle.join();
                Err(audio_error(message))
            }
        }
    }
}

enum AudioRequest {
    ListDevices {
        kind: Option<AudioDeviceKind>,
        respond: mpsc::Sender<Result<Vec<AudioDevice>, String>>,
    },
    DefaultDevice {
        kind: AudioDeviceKind,
        role: AudioDefaultRole,
        respond: mpsc::Sender<Result<Option<AudioDevice>, String>>,
    },
    SetDefaultDevice {
        device_id: String,
        roles: Vec<AudioDefaultRole>,
        respond: mpsc::Sender<Result<(), String>>,
    },
    Shutdown,
}

#[cfg(windows)]
fn run_audio_worker(
    app: AppHandle,
    receiver: mpsc::Receiver<AudioRequest>,
    ready: mpsc::Sender<Result<(), String>>,
) {
    let backend = match platform::AudioBackend::new(app) {
        Ok(backend) => {
            let _ = ready.send(Ok(()));
            backend
        }
        Err(error) => {
            let _ = ready.send(Err(error.to_string()));
            return;
        }
    };

    while let Ok(request) = receiver.recv() {
        match request {
            AudioRequest::ListDevices { kind, respond } => {
                let _ = respond.send(
                    backend
                        .list_devices(kind)
                        .map_err(|error| error.to_string()),
                );
            }
            AudioRequest::DefaultDevice {
                kind,
                role,
                respond,
            } => {
                let _ = respond.send(
                    backend
                        .default_device(kind, role)
                        .map_err(|error| error.to_string()),
                );
            }
            AudioRequest::SetDefaultDevice {
                device_id,
                roles,
                respond,
            } => {
                let _ = respond.send(
                    backend
                        .set_default_device(&device_id, &roles)
                        .map_err(|error| error.to_string()),
                );
            }
            AudioRequest::Shutdown => break,
        }
    }
}

#[cfg(not(windows))]
fn run_audio_worker(
    _app: AppHandle,
    _receiver: mpsc::Receiver<AudioRequest>,
    ready: mpsc::Sender<Result<(), String>>,
) {
    let _ = ready.send(Err(
        "Windows Core Audio is unavailable on this operating system.".to_string(),
    ));
}

fn validate_device_id(device_id: &str) -> Result<(), AppError> {
    if device_id.is_empty() || device_id.len() > 4096 || device_id.contains('\0') {
        Err(AppError::invalid_input("Audio device id is invalid."))
    } else {
        Ok(())
    }
}

fn worker_stopped(error: impl std::fmt::Display) -> AppError {
    AppError::new("audio.worker-stopped", error.to_string())
}

fn audio_error(message: String) -> AppError {
    AppError::new("audio.operation-failed", message)
}

#[cfg(windows)]
mod platform {
    use std::ffi::c_void;
    use std::sync::Arc;

    use tauri::{AppHandle, Emitter};
    use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
    use windows::Win32::Media::Audio::{
        DEVICE_STATE, DEVICE_STATE_ACTIVE, DEVICE_STATE_DISABLED, DEVICE_STATE_NOTPRESENT,
        DEVICE_STATE_UNPLUGGED, EDataFlow, ERole, IMMDevice, IMMDeviceEnumerator,
        IMMNotificationClient, IMMNotificationClient_Impl, MMDeviceEnumerator, eCapture,
        eCommunications, eConsole, eMultimedia, eRender,
    };
    use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
    use windows::Win32::System::Com::{
        CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx, CoTaskMemFree,
        CoUninitialize, STGM_READ,
    };
    use windows::core::{
        BSTR, GUID, HRESULT, IUnknown, IUnknown_Vtbl, Interface, PCWSTR, PWSTR, Result, implement,
    };

    use super::{
        AudioDefaultRole, AudioDevice, AudioDeviceChange, AudioDeviceChangeKind, AudioDeviceKind,
        AudioDeviceState,
    };

    pub struct AudioBackend {
        enumerator: IMMDeviceEnumerator,
        notification: Option<IMMNotificationClient>,
        _apartment: ComApartment,
    }

    impl AudioBackend {
        pub fn new(app: AppHandle) -> Result<Self> {
            let apartment = ComApartment::new()?;
            // SAFETY: COM is initialized for this dedicated thread and the CLSID/IID are fixed.
            let enumerator: IMMDeviceEnumerator =
                unsafe { CoCreateInstance(&MMDeviceEnumerator, None::<&IUnknown>, CLSCTX_ALL)? };
            let notification: IMMNotificationClient = NotificationClient {
                sink: Arc::new(TauriAudioEventSink { app }),
            }
            .into();
            // SAFETY: The callback is retained until it is unregistered in Drop.
            unsafe { enumerator.RegisterEndpointNotificationCallback(&notification)? };
            Ok(Self {
                enumerator,
                notification: Some(notification),
                _apartment: apartment,
            })
        }

        #[cfg(test)]
        pub(super) fn new_for_test() -> Result<Self> {
            let apartment = ComApartment::new()?;
            let enumerator: IMMDeviceEnumerator =
                unsafe { CoCreateInstance(&MMDeviceEnumerator, None::<&IUnknown>, CLSCTX_ALL)? };
            let notification: IMMNotificationClient = NotificationClient {
                sink: Arc::new(NoopAudioEventSink),
            }
            .into();
            unsafe { enumerator.RegisterEndpointNotificationCallback(&notification)? };
            Ok(Self {
                enumerator,
                notification: Some(notification),
                _apartment: apartment,
            })
        }

        #[cfg(test)]
        pub(super) fn probe_default_setter() -> Result<()> {
            let _apartment = ComApartment::new()?;
            policy_config::probe()
        }

        pub fn list_devices(&self, kind: Option<AudioDeviceKind>) -> Result<Vec<AudioDevice>> {
            let mut devices = Vec::new();
            match kind {
                Some(kind) => self.append_devices(kind, &mut devices)?,
                None => {
                    self.append_devices(AudioDeviceKind::Output, &mut devices)?;
                    self.append_devices(AudioDeviceKind::Input, &mut devices)?;
                }
            }
            Ok(devices)
        }

        pub fn default_device(
            &self,
            kind: AudioDeviceKind,
            role: AudioDefaultRole,
        ) -> Result<Option<AudioDevice>> {
            let flow = flow_for(kind);
            // AUDCLNT_E_DEVICE_INVALIDATED and "not found" both mean no current endpoint here.
            let device = match unsafe {
                self.enumerator
                    .GetDefaultAudioEndpoint(flow, role_for(role))
            } {
                Ok(device) => device,
                Err(_) => return Ok(None),
            };
            self.describe_device(&device, kind).map(Some)
        }

        pub fn set_default_device(
            &self,
            device_id: &str,
            roles: &[AudioDefaultRole],
        ) -> Result<()> {
            let wide = wide_string(device_id);
            // Validate the opaque id against the official enumerator before using the policy shim.
            unsafe { self.enumerator.GetDevice(PCWSTR(wide.as_ptr()))? };
            policy_config::set_default_endpoint(device_id, roles)
        }

        fn append_devices(
            &self,
            kind: AudioDeviceKind,
            output: &mut Vec<AudioDevice>,
        ) -> Result<()> {
            let state_mask = DEVICE_STATE(
                DEVICE_STATE_ACTIVE.0
                    | DEVICE_STATE_DISABLED.0
                    | DEVICE_STATE_NOTPRESENT.0
                    | DEVICE_STATE_UNPLUGGED.0,
            );
            // SAFETY: The enumerator is used only on its owning COM thread.
            let collection = unsafe {
                self.enumerator
                    .EnumAudioEndpoints(flow_for(kind), state_mask)?
            };
            let count = unsafe { collection.GetCount()? };
            for index in 0..count {
                let device = unsafe { collection.Item(index)? };
                output.push(self.describe_device(&device, kind)?);
            }
            Ok(())
        }

        fn describe_device(
            &self,
            device: &IMMDevice,
            kind: AudioDeviceKind,
        ) -> Result<AudioDevice> {
            let id = owned_pwstr(unsafe { device.GetId()? })?;
            let state = state_from(unsafe { device.GetState()? });
            let friendly_name = friendly_name(device).unwrap_or_else(|| "未知音频设备".to_string());
            let mut default_roles = Vec::new();
            for role in AudioDefaultRole::ALL {
                if self.default_id(kind, role).as_deref() == Some(id.as_str()) {
                    default_roles.push(role);
                }
            }
            Ok(AudioDevice {
                id,
                name: friendly_name,
                kind,
                state,
                default_roles,
            })
        }

        fn default_id(&self, kind: AudioDeviceKind, role: AudioDefaultRole) -> Option<String> {
            let device = unsafe {
                self.enumerator
                    .GetDefaultAudioEndpoint(flow_for(kind), role_for(role))
            }
            .ok()?;
            owned_pwstr(unsafe { device.GetId().ok()? }).ok()
        }
    }

    impl Drop for AudioBackend {
        fn drop(&mut self) {
            // SAFETY: The same enumerator/callback pair is unregistered on the owning COM thread.
            if let Some(notification) = &self.notification {
                let _ = unsafe {
                    self.enumerator
                        .UnregisterEndpointNotificationCallback(notification)
                };
            }
        }
    }

    struct ComApartment;

    impl ComApartment {
        fn new() -> Result<Self> {
            // SAFETY: This is called once on the dedicated audio worker thread.
            unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).ok()? };
            Ok(Self)
        }
    }

    impl Drop for ComApartment {
        fn drop(&mut self) {
            // SAFETY: Balances the successful CoInitializeEx call on the same thread.
            unsafe { CoUninitialize() };
        }
    }

    #[implement(IMMNotificationClient)]
    struct NotificationClient {
        sink: Arc<dyn AudioEventSink>,
    }

    trait AudioEventSink: Send + Sync {
        fn emit(&self, change: AudioDeviceChange);
    }

    struct TauriAudioEventSink {
        app: AppHandle,
    }

    impl AudioEventSink for TauriAudioEventSink {
        fn emit(&self, change: AudioDeviceChange) {
            let _ = self.app.emit("toolcenter://audio-device-change", change);
        }
    }

    #[cfg(test)]
    struct NoopAudioEventSink;

    #[cfg(test)]
    impl AudioEventSink for NoopAudioEventSink {
        fn emit(&self, _change: AudioDeviceChange) {}
    }

    #[allow(non_snake_case)]
    impl IMMNotificationClient_Impl for NotificationClient_Impl {
        fn OnDeviceStateChanged(&self, device_id: &PCWSTR, new_state: DEVICE_STATE) -> Result<()> {
            self.emit(AudioDeviceChange {
                kind: AudioDeviceChangeKind::StateChanged,
                device_id: borrowed_pcwstr(device_id),
                device_kind: None,
                state: Some(state_from(new_state)),
                role: None,
            });
            Ok(())
        }

        fn OnDeviceAdded(&self, device_id: &PCWSTR) -> Result<()> {
            self.emit(AudioDeviceChange {
                kind: AudioDeviceChangeKind::Added,
                device_id: borrowed_pcwstr(device_id),
                device_kind: None,
                state: None,
                role: None,
            });
            Ok(())
        }

        fn OnDeviceRemoved(&self, device_id: &PCWSTR) -> Result<()> {
            self.emit(AudioDeviceChange {
                kind: AudioDeviceChangeKind::Removed,
                device_id: borrowed_pcwstr(device_id),
                device_kind: None,
                state: None,
                role: None,
            });
            Ok(())
        }

        fn OnDefaultDeviceChanged(
            &self,
            flow: EDataFlow,
            role: ERole,
            device_id: &PCWSTR,
        ) -> Result<()> {
            self.emit(AudioDeviceChange {
                kind: AudioDeviceChangeKind::DefaultChanged,
                device_id: borrowed_pcwstr(device_id),
                device_kind: kind_from_flow(flow),
                state: None,
                role: role_from(role),
            });
            Ok(())
        }

        fn OnPropertyValueChanged(
            &self,
            device_id: &PCWSTR,
            _key: &windows::Win32::Foundation::PROPERTYKEY,
        ) -> Result<()> {
            self.emit(AudioDeviceChange {
                kind: AudioDeviceChangeKind::PropertyChanged,
                device_id: borrowed_pcwstr(device_id),
                device_kind: None,
                state: None,
                role: None,
            });
            Ok(())
        }
    }

    impl NotificationClient_Impl {
        fn emit(&self, change: AudioDeviceChange) {
            self.sink.emit(change);
        }
    }

    fn flow_for(kind: AudioDeviceKind) -> EDataFlow {
        match kind {
            AudioDeviceKind::Input => eCapture,
            AudioDeviceKind::Output => eRender,
        }
    }

    fn kind_from_flow(flow: EDataFlow) -> Option<AudioDeviceKind> {
        match flow {
            value if value == eCapture => Some(AudioDeviceKind::Input),
            value if value == eRender => Some(AudioDeviceKind::Output),
            _ => None,
        }
    }

    fn role_for(role: AudioDefaultRole) -> ERole {
        match role {
            AudioDefaultRole::Console => eConsole,
            AudioDefaultRole::Multimedia => eMultimedia,
            AudioDefaultRole::Communications => eCommunications,
        }
    }

    fn role_from(role: ERole) -> Option<AudioDefaultRole> {
        match role {
            value if value == eConsole => Some(AudioDefaultRole::Console),
            value if value == eMultimedia => Some(AudioDefaultRole::Multimedia),
            value if value == eCommunications => Some(AudioDefaultRole::Communications),
            _ => None,
        }
    }

    fn state_from(state: DEVICE_STATE) -> AudioDeviceState {
        if state.0 & DEVICE_STATE_ACTIVE.0 != 0 {
            AudioDeviceState::Active
        } else if state.0 & DEVICE_STATE_DISABLED.0 != 0 {
            AudioDeviceState::Disabled
        } else if state.0 & DEVICE_STATE_UNPLUGGED.0 != 0 {
            AudioDeviceState::Unplugged
        } else {
            AudioDeviceState::NotPresent
        }
    }

    fn friendly_name(device: &IMMDevice) -> Option<String> {
        let properties = unsafe { device.OpenPropertyStore(STGM_READ) }.ok()?;
        let value: PROPVARIANT = unsafe { properties.GetValue(&PKEY_Device_FriendlyName) }.ok()?;
        BSTR::try_from(&value).ok().map(|name| name.to_string())
    }

    fn borrowed_pcwstr(value: &PCWSTR) -> Option<String> {
        if value.is_null() {
            None
        } else {
            unsafe { value.to_string().ok() }
        }
    }

    fn owned_pwstr(value: PWSTR) -> Result<String> {
        // SAFETY: MMDevice returns a CoTaskMem-allocated null-terminated string.
        let string = unsafe { value.to_string() };
        unsafe { CoTaskMemFree(Some(value.0.cast::<c_void>())) };
        Ok(string?)
    }

    fn wide_string(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(Some(0)).collect()
    }

    mod policy_config {
        use super::*;

        const CLSID_POLICY_CONFIG_CLIENT: GUID =
            GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

        #[repr(transparent)]
        #[derive(Clone, PartialEq, Eq)]
        struct IPolicyConfig(IUnknown);

        unsafe impl Interface for IPolicyConfig {
            type Vtable = IPolicyConfig_Vtbl;
            const IID: GUID = GUID::from_u128(0xf8679f50_850a_41cf_9c72_430f290290c8);
        }

        #[repr(C)]
        #[allow(non_snake_case)]
        struct IPolicyConfig_Vtbl {
            base__: IUnknown_Vtbl,
            GetMixFormat: usize,
            GetDeviceFormat: usize,
            ResetDeviceFormat: usize,
            SetDeviceFormat: usize,
            GetProcessingPeriod: usize,
            SetProcessingPeriod: usize,
            GetShareMode: usize,
            SetShareMode: usize,
            GetPropertyValue: usize,
            SetPropertyValue: usize,
            SetDefaultEndpoint: unsafe extern "system" fn(*mut c_void, PCWSTR, ERole) -> HRESULT,
            SetEndpointVisibility: usize,
        }

        impl IPolicyConfig {
            unsafe fn set_default_endpoint(&self, device_id: PCWSTR, role: ERole) -> Result<()> {
                unsafe {
                    (Interface::vtable(self).SetDefaultEndpoint)(
                        Interface::as_raw(self),
                        device_id,
                        role,
                    )
                    .ok()
                }
            }
        }

        pub fn set_default_endpoint(device_id: &str, roles: &[AudioDefaultRole]) -> Result<()> {
            // This interface is intentionally isolated: Windows does not expose a supported public
            // API for changing the system default endpoint. Failures are surfaced to the plugin.
            let policy: IPolicyConfig = unsafe {
                CoCreateInstance(&CLSID_POLICY_CONFIG_CLIENT, None::<&IUnknown>, CLSCTX_ALL)?
            };
            let wide = wide_string(device_id);
            for role in roles {
                unsafe {
                    policy.set_default_endpoint(PCWSTR(wide.as_ptr()), role_for(*role))?;
                }
            }
            Ok(())
        }

        #[cfg(test)]
        pub fn probe() -> Result<()> {
            let _: IPolicyConfig = unsafe {
                CoCreateInstance(&CLSID_POLICY_CONFIG_CLIENT, None::<&IUnknown>, CLSCTX_ALL)?
            };
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{AudioDefaultRole, AudioDeviceKind, validate_device_id};

    #[test]
    fn default_roles_cover_all_windows_routing_roles() {
        assert_eq!(AudioDefaultRole::ALL.len(), 3);
    }

    #[test]
    fn treats_device_ids_as_opaque_but_rejects_unsafe_values() {
        assert!(validate_device_id("{0.0.0.00000000}.opaque-device-id").is_ok());
        assert!(validate_device_id("").is_err());
        assert!(validate_device_id("bad\0id").is_err());
    }

    #[cfg(windows)]
    #[test]
    fn queries_real_windows_audio_endpoints_without_changing_state() {
        std::thread::spawn(|| {
            let backend = super::platform::AudioBackend::new_for_test()
                .expect("Core Audio should initialize on its dedicated COM thread");
            backend
                .list_devices(Some(AudioDeviceKind::Output))
                .expect("Windows audio endpoints should be queryable");
            backend
                .list_devices(Some(AudioDeviceKind::Input))
                .expect("Windows microphone endpoints should be queryable");
            backend
                .default_device(AudioDeviceKind::Output, AudioDefaultRole::Multimedia)
                .expect("the default output endpoint should be queryable");
            backend
                .default_device(AudioDeviceKind::Input, AudioDefaultRole::Multimedia)
                .expect("the default input endpoint should be queryable");
            super::platform::AudioBackend::probe_default_setter()
                .expect("the isolated default-endpoint compatibility interface should exist");
        })
        .join()
        .expect("audio test thread should complete");
    }
}
