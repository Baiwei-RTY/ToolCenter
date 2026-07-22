use serde_json::Value;
use tauri::State;

use crate::error::AppError;
use crate::services::storage;
use crate::state::CoreState;

#[tauri::command]
pub fn plugin_storage_read(
    state: State<'_, CoreState>,
    plugin_id: String,
    key: String,
) -> Result<Option<Value>, AppError> {
    storage::read(&state, &plugin_id, &key)
}

#[tauri::command]
pub fn plugin_storage_write(
    state: State<'_, CoreState>,
    plugin_id: String,
    key: String,
    value: Value,
) -> Result<(), AppError> {
    storage::write(&state, &plugin_id, &key, &value)
}

#[tauri::command]
pub fn plugin_storage_remove(
    state: State<'_, CoreState>,
    plugin_id: String,
    key: String,
) -> Result<(), AppError> {
    storage::remove(&state, &plugin_id, &key)
}

#[tauri::command]
pub fn plugin_storage_list(
    state: State<'_, CoreState>,
    plugin_id: String,
) -> Result<Vec<String>, AppError> {
    storage::list(&state, &plugin_id)
}
