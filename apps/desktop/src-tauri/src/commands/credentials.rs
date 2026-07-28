use tauri::State;

use crate::error::AppError;
use crate::services::credentials;
use crate::state::CoreState;

#[tauri::command]
pub fn plugin_credential_set(
    _state: State<'_, CoreState>,
    plugin_id: String,
    key: String,
    value: String,
) -> Result<(), AppError> {
    credentials::set(&plugin_id, &key, &value)
}

#[tauri::command]
pub fn plugin_credential_has(
    _state: State<'_, CoreState>,
    plugin_id: String,
    key: String,
) -> Result<bool, AppError> {
    credentials::has(&plugin_id, &key)
}

#[tauri::command]
pub fn plugin_credential_remove(
    _state: State<'_, CoreState>,
    plugin_id: String,
    key: String,
) -> Result<(), AppError> {
    credentials::remove(&plugin_id, &key)
}
