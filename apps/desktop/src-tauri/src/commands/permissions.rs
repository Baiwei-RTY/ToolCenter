use serde_json::Value;
use tauri::State;

use crate::error::AppError;
use crate::services::permissions;
use crate::state::CoreState;

#[tauri::command]
pub fn permission_status(
    state: State<'_, CoreState>,
    plugin_id: String,
    permission: String,
) -> Result<String, AppError> {
    permissions::status(&state, &plugin_id, &permission)
}

#[tauri::command]
pub fn permission_set(
    state: State<'_, CoreState>,
    plugin_id: String,
    permission: String,
    decision: String,
) -> Result<(), AppError> {
    permissions::set(&state, &plugin_id, &permission, &decision)
}

#[tauri::command]
pub fn permissions_list(state: State<'_, CoreState>) -> Result<Value, AppError> {
    permissions::all(&state)
}
