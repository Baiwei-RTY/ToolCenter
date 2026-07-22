use serde_json::Value;
use tauri::State;

use crate::error::AppError;
use crate::services::settings;
use crate::state::CoreState;

#[tauri::command]
pub fn settings_load(state: State<'_, CoreState>) -> Result<Value, AppError> {
    settings::load(&state)
}

#[tauri::command]
pub fn settings_save(state: State<'_, CoreState>, settings: Value) -> Result<(), AppError> {
    settings::save(&state, &settings)
}
