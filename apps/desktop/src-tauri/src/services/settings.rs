use serde_json::{Value, json};

use crate::error::AppError;
use crate::services::{read_json, write_json};
use crate::state::CoreState;

pub fn load(state: &CoreState) -> Result<Value, AppError> {
    let _guard = state.lock_io()?;
    Ok(read_json(&state.app_directory.join("app/settings.json"))?.unwrap_or_else(|| json!({})))
}

pub fn save(state: &CoreState, settings: &Value) -> Result<(), AppError> {
    let _guard = state.lock_io()?;
    let settings_path = state.app_directory.join("app/settings.json");
    let backup_path = state
        .app_directory
        .join("app/settings.pre-material3-v1.json");
    let material3_settings = settings
        .get("uiRevision")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        >= 1;
    if material3_settings
        && read_json(&backup_path)?.is_none()
        && let Some(previous_settings) = read_json(&settings_path)?
        && previous_settings.get("uiRevision").is_none()
    {
        write_json(&backup_path, &previous_settings)?;
    }
    write_json(&settings_path, settings)
}
