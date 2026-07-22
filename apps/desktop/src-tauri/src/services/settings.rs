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
    write_json(&state.app_directory.join("app/settings.json"), settings)
}
