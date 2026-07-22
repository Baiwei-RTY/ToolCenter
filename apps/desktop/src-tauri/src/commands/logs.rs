use serde_json::Value;
use tauri::State;

use crate::error::AppError;
use crate::services::logs;
use crate::state::CoreState;

#[tauri::command]
pub fn log_write(
    state: State<'_, CoreState>,
    plugin_id: Option<String>,
    level: String,
    message: String,
    details: Option<Value>,
) -> Result<(), AppError> {
    logs::write(
        &state,
        plugin_id.as_deref(),
        &level,
        &message,
        details.as_ref(),
    )
}

#[tauri::command]
pub fn log_list(state: State<'_, CoreState>, limit: usize) -> Result<Vec<Value>, AppError> {
    logs::list(&state, limit)
}
