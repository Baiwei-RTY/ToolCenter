use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DisplaySummary {
    pub id: String,
    pub name: String,
    pub source_name: String,
    pub primary: bool,
    pub hdr_supported: bool,
    pub hdr_enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct TargetKey {
    adapter_low: u32,
    adapter_high: i32,
    target_id: u32,
}

pub fn list_displays() -> Result<Vec<DisplaySummary>, AppError> {
    platform::list_displays()
}

pub fn set_hdr_enabled(display_id: &str, enabled: bool) -> Result<(), AppError> {
    validate_display_id(display_id)?;
    platform::set_hdr_enabled(display_id, enabled)
}

fn validate_display_id(display_id: &str) -> Result<(), AppError> {
    let valid = display_id.len() == 33
        && display_id.starts_with('d')
        && display_id[1..]
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase());
    if valid {
        Ok(())
    } else {
        Err(display_error(
            "display.target-unavailable",
            "The display id is invalid or no longer available.",
            "显示器标识已失效，请刷新显示器列表后重新选择。",
            true,
            None,
        ))
    }
}

fn opaque_display_id(
    key: TargetKey,
    source_name: &str,
    monitor_device_path: &str,
    connector_instance: u32,
) -> String {
    let mut first = 0xcbf29ce484222325_u64;
    let mut second = 0x84222325cbf29ce4_u64;
    for bytes in [
        key.adapter_low.to_le_bytes().as_slice(),
        key.adapter_high.to_le_bytes().as_slice(),
        key.target_id.to_le_bytes().as_slice(),
        connector_instance.to_le_bytes().as_slice(),
        source_name.as_bytes(),
        monitor_device_path.as_bytes(),
    ] {
        hash_bytes(&mut first, bytes, 0x100000001b3);
        hash_bytes(&mut second, bytes, 0x100000001b7);
        hash_bytes(&mut first, &[0xff], 0x100000001b3);
        hash_bytes(&mut second, &[0x7f], 0x100000001b7);
    }
    format!("d{first:016x}{second:016x}")
}

fn hash_bytes(hash: &mut u64, bytes: &[u8], prime: u64) {
    for byte in bytes {
        *hash ^= u64::from(*byte);
        *hash = hash.wrapping_mul(prime);
    }
}

fn display_error(
    code: &str,
    message: impl Into<String>,
    user_message: &str,
    recoverable: bool,
    win32_code: Option<u32>,
) -> AppError {
    AppError {
        code: code.to_string(),
        message: message.into(),
        user_message: user_message.to_string(),
        recoverable,
        details: win32_code.map(|code| json!({ "win32Code": code })),
    }
}

#[cfg(windows)]
mod platform {
    use std::collections::HashSet;
    use std::mem::size_of;
    use std::ptr;

    use windows::Win32::Devices::Display::{
        DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO,
        DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME, DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
        DISPLAYCONFIG_DEVICE_INFO_HEADER, DISPLAYCONFIG_DEVICE_INFO_SET_ADVANCED_COLOR_STATE,
        DISPLAYCONFIG_DEVICE_INFO_TYPE, DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO,
        DISPLAYCONFIG_MODE_INFO, DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE,
        DISPLAYCONFIG_SOURCE_DEVICE_NAME, DISPLAYCONFIG_TARGET_DEVICE_NAME,
        DisplayConfigGetDeviceInfo, DisplayConfigSetDeviceInfo, GetDisplayConfigBufferSizes,
        QDC_ONLY_ACTIVE_PATHS, QDC_VIRTUAL_MODE_AWARE, QueryDisplayConfig,
    };
    use windows::Win32::Foundation::{
        ERROR_ACCESS_DENIED, ERROR_INSUFFICIENT_BUFFER, ERROR_INVALID_PARAMETER,
        ERROR_NOT_SUPPORTED, ERROR_SUCCESS, LUID,
    };
    use windows::Win32::Graphics::Gdi::{
        DISPLAY_DEVICE_PRIMARY_DEVICE, DISPLAY_DEVICEW, EnumDisplayDevicesW,
    };
    use windows::core::PCWSTR;

    use super::{
        AppError, DisplaySummary, TargetKey, display_error, opaque_display_id, validate_display_id,
    };

    const DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO_2: DISPLAYCONFIG_DEVICE_INFO_TYPE =
        DISPLAYCONFIG_DEVICE_INFO_TYPE(15);
    const DISPLAYCONFIG_DEVICE_INFO_SET_HDR_STATE: DISPLAYCONFIG_DEVICE_INFO_TYPE =
        DISPLAYCONFIG_DEVICE_INFO_TYPE(16);
    const ADVANCED_COLOR_SUPPORTED: u32 = 1 << 0;
    const ADVANCED_COLOR_ENABLED: u32 = 1 << 1;
    const WIDE_COLOR_ENFORCED: u32 = 1 << 2;
    const HDR_SUPPORTED: u32 = 1 << 4;
    const HDR_USER_ENABLED: u32 = 1 << 5;
    const WINDOWS_10_HDR_MIN_BUILD: u32 = 16_299;
    const WINDOWS_11_MIN_BUILD: u32 = 22_000;
    const DISPLAY_CONFIG_RETRIES: usize = 4;

    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    struct DisplayConfigGetAdvancedColorInfo2 {
        header: DISPLAYCONFIG_DEVICE_INFO_HEADER,
        value: u32,
        color_encoding: i32,
        bits_per_color_channel: u32,
        active_color_mode: i32,
    }

    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    struct DisplayConfigSetHdrState {
        header: DISPLAYCONFIG_DEVICE_INFO_HEADER,
        value: u32,
    }

    #[repr(C)]
    struct RtlOsVersionInfo {
        size: u32,
        major: u32,
        minor: u32,
        build: u32,
        platform_id: u32,
        service_pack: [u16; 128],
    }

    impl Default for RtlOsVersionInfo {
        fn default() -> Self {
            Self {
                size: size_of::<Self>() as u32,
                major: 0,
                minor: 0,
                build: 0,
                platform_id: 0,
                service_pack: [0; 128],
            }
        }
    }

    #[link(name = "ntdll")]
    unsafe extern "system" {
        fn RtlGetVersion(version: *mut RtlOsVersionInfo) -> i32;
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum HdrApi {
        Windows10AdvancedColor,
        Windows11Hdr,
    }

    #[derive(Debug, Clone, Copy)]
    struct HdrState {
        supported: bool,
        enabled: bool,
        api: HdrApi,
    }

    struct ActiveTarget {
        key: TargetKey,
        display_id: String,
        source_name: String,
        name: String,
        primary: bool,
        hdr: HdrState,
    }

    pub(super) fn list_displays() -> Result<Vec<DisplaySummary>, AppError> {
        Ok(enumerate_targets()?
            .into_iter()
            .map(|target| DisplaySummary {
                id: target.display_id,
                name: target.name,
                source_name: target.source_name,
                primary: target.primary,
                hdr_supported: target.hdr.supported,
                hdr_enabled: target.hdr.enabled,
            })
            .collect())
    }

    pub(super) fn set_hdr_enabled(display_id: &str, enabled: bool) -> Result<(), AppError> {
        validate_display_id(display_id)?;
        let targets = enumerate_targets()?;
        let target = targets
            .iter()
            .find(|target| target.display_id == display_id)
            .ok_or_else(target_unavailable)?;

        ensure_hdr_supported(target.hdr.supported)?;

        if target.hdr.enabled != enabled {
            set_target_hdr(target.key, target.hdr.api, enabled)?;
        }

        let refreshed = enumerate_targets()?;
        let refreshed_target = refreshed
            .iter()
            .find(|target| target.display_id == display_id)
            .ok_or_else(target_unavailable)?;
        ensure_hdr_state_matches(enabled, refreshed_target.hdr.enabled)
    }

    fn enumerate_targets() -> Result<Vec<ActiveTarget>, AppError> {
        let build = windows_build()?;
        let paths = active_paths()?;
        if paths.is_empty() {
            return Err(display_error(
                "display.no-active-target",
                "No active display target is available.",
                "当前没有可用的活动显示器。",
                true,
                None,
            ));
        }

        let mut display_ids = HashSet::new();
        let mut targets = Vec::with_capacity(paths.len());
        for path in paths {
            let key = TargetKey {
                adapter_low: path.targetInfo.adapterId.LowPart,
                adapter_high: path.targetInfo.adapterId.HighPart,
                target_id: path.targetInfo.id,
            };
            let source_name = source_name(path.sourceInfo.adapterId, path.sourceInfo.id)?;
            let target_name = target_name(path.targetInfo.adapterId, path.targetInfo.id)?;
            let display_id = opaque_display_id(
                key,
                &source_name,
                &target_name.monitor_device_path,
                target_name.connector_instance,
            );
            if !display_ids.insert(display_id.clone()) {
                return Err(display_error(
                    "display.hdr-state-unknown",
                    "Two active display targets produced the same opaque id.",
                    "无法可靠区分当前显示器，请断开并重新连接显示器后重试。",
                    true,
                    None,
                ));
            }
            let name = if target_name.friendly_name.is_empty() {
                fallback_display_name(&source_name)
            } else {
                target_name.friendly_name
            };
            targets.push(ActiveTarget {
                key,
                display_id,
                primary: is_primary_source(&source_name),
                hdr: query_hdr_state(path.targetInfo.adapterId, path.targetInfo.id, build)?,
                source_name,
                name,
            });
        }
        Ok(targets)
    }

    fn active_paths() -> Result<Vec<DISPLAYCONFIG_PATH_INFO>, AppError> {
        let flags = QDC_ONLY_ACTIVE_PATHS | QDC_VIRTUAL_MODE_AWARE;
        for _ in 0..DISPLAY_CONFIG_RETRIES {
            let mut path_count = 0_u32;
            let mut mode_count = 0_u32;
            let result =
                unsafe { GetDisplayConfigBufferSizes(flags, &mut path_count, &mut mode_count) };
            ensure_query_success(result.0)?;

            let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); path_count as usize];
            let mut modes = vec![DISPLAYCONFIG_MODE_INFO::default(); mode_count as usize];
            let result = unsafe {
                QueryDisplayConfig(
                    flags,
                    &mut path_count,
                    paths.as_mut_ptr(),
                    &mut mode_count,
                    modes.as_mut_ptr(),
                    None,
                )
            };
            if result == ERROR_INSUFFICIENT_BUFFER {
                continue;
            }
            ensure_query_success(result.0)?;
            paths.truncate(path_count as usize);
            return Ok(paths);
        }
        Err(display_error(
            "display.topology-changed",
            "The display topology changed repeatedly while it was being read.",
            "显示器连接状态正在变化，请稍后刷新重试。",
            true,
            Some(ERROR_INSUFFICIENT_BUFFER.0),
        ))
    }

    struct TargetName {
        friendly_name: String,
        monitor_device_path: String,
        connector_instance: u32,
    }

    fn source_name(adapter_id: LUID, source_id: u32) -> Result<String, AppError> {
        let mut packet = DISPLAYCONFIG_SOURCE_DEVICE_NAME {
            header: header(
                DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME,
                size_of::<DISPLAYCONFIG_SOURCE_DEVICE_NAME>(),
                adapter_id,
                source_id,
            ),
            ..Default::default()
        };
        let result = unsafe { DisplayConfigGetDeviceInfo(&mut packet.header) };
        ensure_device_query_success(result as u32)?;
        let name = wide_string(&packet.viewGdiDeviceName);
        if name.is_empty() {
            Err(display_error(
                "display.target-unavailable",
                "Windows returned an empty display source name.",
                "无法读取显示器来源名称，请刷新后重试。",
                true,
                None,
            ))
        } else {
            Ok(name)
        }
    }

    fn target_name(adapter_id: LUID, target_id: u32) -> Result<TargetName, AppError> {
        let mut packet = DISPLAYCONFIG_TARGET_DEVICE_NAME {
            header: header(
                DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
                size_of::<DISPLAYCONFIG_TARGET_DEVICE_NAME>(),
                adapter_id,
                target_id,
            ),
            ..Default::default()
        };
        let result = unsafe { DisplayConfigGetDeviceInfo(&mut packet.header) };
        ensure_device_query_success(result as u32)?;
        Ok(TargetName {
            friendly_name: wide_string(&packet.monitorFriendlyDeviceName),
            monitor_device_path: wide_string(&packet.monitorDevicePath),
            connector_instance: packet.connectorInstance,
        })
    }

    fn query_hdr_state(adapter_id: LUID, target_id: u32, build: u32) -> Result<HdrState, AppError> {
        let mut packet = DisplayConfigGetAdvancedColorInfo2 {
            header: header(
                DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO_2,
                size_of::<DisplayConfigGetAdvancedColorInfo2>(),
                adapter_id,
                target_id,
            ),
            ..Default::default()
        };
        let result = unsafe { DisplayConfigGetDeviceInfo(&mut packet.header) };
        if result == ERROR_SUCCESS.0 as i32 {
            let supported = packet.value & HDR_SUPPORTED != 0;
            let enabled = packet.value & HDR_USER_ENABLED != 0;
            if enabled && !supported {
                return Err(display_error(
                    "display.hdr-state-unknown",
                    "Windows reported HDR enabled for a target without HDR support.",
                    "Windows 返回了不一致的 HDR 状态，请更新显示驱动后重试。",
                    true,
                    None,
                ));
            }
            return Ok(HdrState {
                supported,
                enabled,
                api: HdrApi::Windows11Hdr,
            });
        }
        let code = result as u32;
        if code == ERROR_ACCESS_DENIED.0 {
            return Err(access_denied(code));
        }
        if build >= WINDOWS_11_MIN_BUILD {
            return Err(display_error(
                "display.hdr-state-unknown",
                format!(
                    "Windows 11 did not provide HDR-specific display state (Win32 error {code})."
                ),
                "Windows 无法可靠区分 HDR 与其他高级颜色状态，请更新显示驱动后重试。",
                true,
                Some(code),
            ));
        }
        query_windows_10_hdr_state(adapter_id, target_id, build)
    }

    fn query_windows_10_hdr_state(
        adapter_id: LUID,
        target_id: u32,
        build: u32,
    ) -> Result<HdrState, AppError> {
        if build < WINDOWS_10_HDR_MIN_BUILD {
            return Err(display_error(
                "display.unavailable",
                format!("Windows build {build} does not expose the required HDR display API."),
                "当前 Windows 版本不提供所需的 HDR 显示器接口。",
                false,
                None,
            ));
        }
        let mut packet = DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO {
            header: header(
                DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO,
                size_of::<DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO>(),
                adapter_id,
                target_id,
            ),
            ..Default::default()
        };
        let result = unsafe { DisplayConfigGetDeviceInfo(&mut packet.header) };
        ensure_hdr_query_success(result as u32)?;
        let value = unsafe { packet.Anonymous.value };
        if value & WIDE_COLOR_ENFORCED != 0 {
            return Err(display_error(
                "display.hdr-state-unknown",
                "Windows reported enforced wide color without an HDR-specific state.",
                "当前系统只报告了宽色域状态，无法将其安全识别为 HDR。",
                true,
                None,
            ));
        }
        Ok(HdrState {
            supported: value & ADVANCED_COLOR_SUPPORTED != 0,
            enabled: value & ADVANCED_COLOR_ENABLED != 0,
            api: HdrApi::Windows10AdvancedColor,
        })
    }

    fn set_target_hdr(key: TargetKey, api: HdrApi, enabled: bool) -> Result<(), AppError> {
        let adapter_id = LUID {
            LowPart: key.adapter_low,
            HighPart: key.adapter_high,
        };
        let result = match api {
            HdrApi::Windows11Hdr => {
                let packet = DisplayConfigSetHdrState {
                    header: header(
                        DISPLAYCONFIG_DEVICE_INFO_SET_HDR_STATE,
                        size_of::<DisplayConfigSetHdrState>(),
                        adapter_id,
                        key.target_id,
                    ),
                    value: u32::from(enabled),
                };
                unsafe { DisplayConfigSetDeviceInfo(&packet.header) }
            }
            HdrApi::Windows10AdvancedColor => {
                let mut packet = DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE {
                    header: header(
                        DISPLAYCONFIG_DEVICE_INFO_SET_ADVANCED_COLOR_STATE,
                        size_of::<DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE>(),
                        adapter_id,
                        key.target_id,
                    ),
                    ..Default::default()
                };
                packet.Anonymous.value = u32::from(enabled);
                unsafe { DisplayConfigSetDeviceInfo(&packet.header) }
            }
        };
        ensure_set_success(result as u32)
    }

    fn header(
        packet_type: DISPLAYCONFIG_DEVICE_INFO_TYPE,
        size: usize,
        adapter_id: LUID,
        id: u32,
    ) -> DISPLAYCONFIG_DEVICE_INFO_HEADER {
        DISPLAYCONFIG_DEVICE_INFO_HEADER {
            r#type: packet_type,
            size: size as u32,
            adapterId: adapter_id,
            id,
        }
    }

    fn windows_build() -> Result<u32, AppError> {
        let mut version = RtlOsVersionInfo::default();
        let status = unsafe { RtlGetVersion(&mut version) };
        if status < 0 {
            Err(display_error(
                "display.unavailable",
                format!("RtlGetVersion failed with NTSTATUS {status}."),
                "无法确认当前 Windows 版本，显示器 HDR 服务不可用。",
                false,
                None,
            ))
        } else {
            Ok(version.build)
        }
    }

    fn is_primary_source(source_name: &str) -> bool {
        for index in 0..64 {
            let mut device = DISPLAY_DEVICEW {
                cb: size_of::<DISPLAY_DEVICEW>() as u32,
                ..Default::default()
            };
            let found = unsafe {
                EnumDisplayDevicesW(PCWSTR(ptr::null()), index, &mut device, 0).as_bool()
            };
            if !found {
                break;
            }
            if wide_string(&device.DeviceName).eq_ignore_ascii_case(source_name) {
                return device.StateFlags.0 & DISPLAY_DEVICE_PRIMARY_DEVICE.0 != 0;
            }
        }
        false
    }

    fn fallback_display_name(source_name: &str) -> String {
        let number = source_name
            .chars()
            .rev()
            .take_while(|character| character.is_ascii_digit())
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>();
        if number.is_empty() {
            "显示器".to_string()
        } else {
            format!("显示器 {number}")
        }
    }

    fn wide_string(value: &[u16]) -> String {
        let length = value
            .iter()
            .position(|character| *character == 0)
            .unwrap_or(value.len());
        String::from_utf16_lossy(&value[..length])
    }

    fn ensure_query_success(code: u32) -> Result<(), AppError> {
        if code == ERROR_SUCCESS.0 {
            Ok(())
        } else if code == ERROR_ACCESS_DENIED.0 {
            Err(access_denied(code))
        } else if code == ERROR_INSUFFICIENT_BUFFER.0 {
            Err(display_error(
                "display.topology-changed",
                "The active display topology changed during enumeration.",
                "显示器连接状态发生变化，请刷新后重试。",
                true,
                Some(code),
            ))
        } else {
            Err(display_error(
                "display.unavailable",
                format!("Display configuration enumeration failed with Win32 error {code}."),
                "Windows 显示器服务当前不可用，请检查显示驱动或会话状态。",
                false,
                Some(code),
            ))
        }
    }

    fn ensure_device_query_success(code: u32) -> Result<(), AppError> {
        if code == ERROR_SUCCESS.0 {
            Ok(())
        } else if code == ERROR_ACCESS_DENIED.0 {
            Err(access_denied(code))
        } else if code == ERROR_INVALID_PARAMETER.0 {
            Err(target_unavailable())
        } else {
            Err(display_error(
                "display.target-unavailable",
                format!("Display target information query failed with Win32 error {code}."),
                "显示器信息已变化，请刷新列表后重试。",
                true,
                Some(code),
            ))
        }
    }

    fn ensure_hdr_query_success(code: u32) -> Result<(), AppError> {
        if code == ERROR_SUCCESS.0 {
            Ok(())
        } else if code == ERROR_ACCESS_DENIED.0 {
            Err(access_denied(code))
        } else if code == ERROR_INVALID_PARAMETER.0 || code == ERROR_NOT_SUPPORTED.0 {
            Err(display_error(
                "display.hdr-state-unknown",
                format!("Windows could not report HDR state (Win32 error {code})."),
                "Windows 或显示驱动无法报告可靠的 HDR 状态。",
                true,
                Some(code),
            ))
        } else {
            Err(display_error(
                "display.hdr-state-unknown",
                format!("HDR state query failed with Win32 error {code}."),
                "读取 HDR 状态失败，请刷新或更新显示驱动后重试。",
                true,
                Some(code),
            ))
        }
    }

    fn ensure_set_success(code: u32) -> Result<(), AppError> {
        if code == ERROR_SUCCESS.0 {
            Ok(())
        } else if code == ERROR_ACCESS_DENIED.0 {
            Err(access_denied(code))
        } else if code == ERROR_INVALID_PARAMETER.0 {
            Err(display_error(
                "display.topology-changed",
                "The display topology changed before HDR could be updated.",
                "显示器连接状态已变化，请刷新后重新选择。",
                true,
                Some(code),
            ))
        } else {
            Err(display_error(
                "display.hdr-set-failed",
                format!("Windows rejected the HDR state update with Win32 error {code}."),
                "Windows 或显示驱动拒绝了 HDR 切换，请刷新状态后重试。",
                true,
                Some(code),
            ))
        }
    }

    fn access_denied(code: u32) -> AppError {
        display_error(
            "display.access-denied",
            "The process cannot access the current console display session.",
            "当前会话无法访问本机显示器；远程会话下可能无法使用此功能。",
            true,
            Some(code),
        )
    }

    fn target_unavailable() -> AppError {
        display_error(
            "display.target-unavailable",
            "The selected display is no longer an active target.",
            "所选显示器已断开或停用，请刷新后重新选择。",
            true,
            None,
        )
    }

    fn ensure_hdr_supported(supported: bool) -> Result<(), AppError> {
        if supported {
            Ok(())
        } else {
            Err(display_error(
                "display.hdr-unsupported",
                "The selected display does not support Windows HDR.",
                "所选显示器不支持 Windows HDR，请选择其他显示器。",
                true,
                None,
            ))
        }
    }

    fn ensure_hdr_state_matches(expected: bool, actual: bool) -> Result<(), AppError> {
        if expected == actual {
            Ok(())
        } else {
            Err(display_error(
                "display.hdr-state-mismatch",
                format!(
                    "Windows reported a successful HDR update, but the refreshed state was {actual}."
                ),
                "Windows 已接收切换请求，但实际 HDR 状态不一致，请刷新后重试。",
                true,
                None,
            ))
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn queries_real_windows_displays_without_changing_state() {
            let displays = list_displays().expect("active Windows displays should be queryable");
            assert!(
                !displays.is_empty(),
                "the current desktop session should expose an active display"
            );
            assert!(
                displays.iter().any(|display| display.primary),
                "one active display should be marked as primary"
            );
            assert!(displays.iter().all(|display| {
                validate_display_id(&display.id).is_ok() && !display.source_name.is_empty()
            }));
        }

        #[test]
        fn maps_access_denied_without_exposing_target_details() {
            let error = ensure_device_query_success(ERROR_ACCESS_DENIED.0)
                .expect_err("access denied must remain an error");
            assert_eq!(error.code, "display.access-denied");
            assert_eq!(error.details, Some(serde_json::json!({ "win32Code": 5 })));
        }

        #[test]
        fn maps_changed_targets_to_recoverable_errors() {
            let error = ensure_set_success(ERROR_INVALID_PARAMETER.0)
                .expect_err("a changed target must not be treated as success");
            assert_eq!(error.code, "display.topology-changed");
            assert!(error.recoverable);
        }

        #[test]
        fn rejects_missing_unsupported_and_mismatched_targets() {
            assert_eq!(target_unavailable().code, "display.target-unavailable");
            assert_eq!(
                ensure_hdr_supported(false)
                    .expect_err("unsupported HDR must remain an error")
                    .code,
                "display.hdr-unsupported"
            );
            assert_eq!(
                ensure_hdr_state_matches(true, false)
                    .expect_err("a mismatched refreshed state must remain an error")
                    .code,
                "display.hdr-state-mismatch"
            );
            assert!(ensure_hdr_state_matches(true, true).is_ok());
        }
    }
}

#[cfg(not(windows))]
mod platform {
    use super::{AppError, DisplaySummary, display_error};

    pub(super) fn list_displays() -> Result<Vec<DisplaySummary>, AppError> {
        Err(unavailable())
    }

    pub(super) fn set_hdr_enabled(_display_id: &str, _enabled: bool) -> Result<(), AppError> {
        Err(unavailable())
    }

    fn unavailable() -> AppError {
        display_error(
            "display.unavailable",
            "Windows display HDR services are unavailable on this operating system.",
            "显示器 HDR 功能仅在受支持的 Windows 本地桌面会话中可用。",
            false,
            None,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::{TargetKey, opaque_display_id, validate_display_id};

    #[test]
    fn creates_stable_opaque_ids_without_exposing_windows_fields() {
        let key = TargetKey {
            adapter_low: 42,
            adapter_high: -3,
            target_id: 7,
        };
        let first = opaque_display_id(key, r"\\.\DISPLAY1", r"\\?\DISPLAY#opaque", 1);
        let repeated = opaque_display_id(key, r"\\.\DISPLAY1", r"\\?\DISPLAY#opaque", 1);
        let other = opaque_display_id(key, r"\\.\DISPLAY2", r"\\?\DISPLAY#other", 2);

        assert_eq!(first, repeated);
        assert_ne!(first, other);
        assert!(validate_display_id(&first).is_ok());
        assert!(!first.contains("DISPLAY"));
    }

    #[test]
    fn rejects_malformed_or_parseable_display_ids() {
        assert!(validate_display_id("").is_err());
        assert!(validate_display_id("d0123456789abcdef").is_err());
        assert!(validate_display_id("d0123456789ABCDEF0123456789ABCDEF").is_err());
        assert!(validate_display_id(r"adapter:1:target:2").is_err());
    }
}
