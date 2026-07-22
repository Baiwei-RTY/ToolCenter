use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::services::audio::{AudioDefaultRole, AudioDevice, AudioDeviceKind, AudioState};
use crate::services::permissions;
use crate::state::CoreState;

#[tauri::command]
pub fn audio_devices_list(
    app: AppHandle,
    state: State<'_, CoreState>,
    audio: State<'_, AudioState>,
    plugin_id: String,
    kind: Option<AudioDeviceKind>,
) -> Result<Vec<AudioDevice>, AppError> {
    permissions::require(&state, &plugin_id, "audio.read")?;
    audio.list_devices(&app, kind)
}

#[tauri::command]
pub fn audio_default_device_get(
    app: AppHandle,
    state: State<'_, CoreState>,
    audio: State<'_, AudioState>,
    plugin_id: String,
    kind: AudioDeviceKind,
    role: Option<AudioDefaultRole>,
) -> Result<Option<AudioDevice>, AppError> {
    permissions::require(&state, &plugin_id, "audio.read")?;
    audio.default_device(&app, kind, role.unwrap_or(AudioDefaultRole::Multimedia))
}

#[tauri::command]
pub fn audio_device_changes_subscribe(
    app: AppHandle,
    state: State<'_, CoreState>,
    audio: State<'_, AudioState>,
    plugin_id: String,
) -> Result<(), AppError> {
    permissions::require(&state, &plugin_id, "audio.read")?;
    audio.ensure_notifications(&app)
}

#[tauri::command]
pub fn audio_default_device_set(
    app: AppHandle,
    state: State<'_, CoreState>,
    audio: State<'_, AudioState>,
    plugin_id: String,
    device_id: String,
    roles: Option<Vec<AudioDefaultRole>>,
) -> Result<(), AppError> {
    permissions::require(&state, &plugin_id, "audio.control")?;
    let roles = roles
        .filter(|roles| !roles.is_empty())
        .unwrap_or_else(|| AudioDefaultRole::ALL.to_vec());
    audio.set_default_device(&app, device_id, roles)
}
