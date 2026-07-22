use std::fs;

use serde_json::Value;

use crate::error::AppError;
use crate::services::{read_json, validate_segment, write_json};
use crate::state::CoreState;

pub fn read(state: &CoreState, plugin_id: &str, key: &str) -> Result<Option<Value>, AppError> {
    validate_segment(plugin_id, "plugin id")?;
    validate_segment(key, "storage key")?;
    let _guard = state.lock_io()?;
    read_json(&storage_path(state, plugin_id, key))
}

pub fn write(state: &CoreState, plugin_id: &str, key: &str, value: &Value) -> Result<(), AppError> {
    validate_segment(plugin_id, "plugin id")?;
    validate_segment(key, "storage key")?;
    let _guard = state.lock_io()?;
    write_json(&storage_path(state, plugin_id, key), value)
}

pub fn remove(state: &CoreState, plugin_id: &str, key: &str) -> Result<(), AppError> {
    validate_segment(plugin_id, "plugin id")?;
    validate_segment(key, "storage key")?;
    let _guard = state.lock_io()?;
    let path = storage_path(state, plugin_id, key);
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

pub fn list(state: &CoreState, plugin_id: &str) -> Result<Vec<String>, AppError> {
    validate_segment(plugin_id, "plugin id")?;
    let _guard = state.lock_io()?;
    let directory = state
        .app_directory
        .join("plugins")
        .join(plugin_id)
        .join("storage");
    let mut keys = Vec::new();
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(keys),
        Err(error) => return Err(error.into()),
    };
    for entry in entries {
        let entry = entry?;
        if entry.file_type()?.is_file()
            && let Some(stem) = entry.path().file_stem().and_then(|value| value.to_str())
        {
            keys.push(stem.to_string());
        }
    }
    keys.sort();
    Ok(keys)
}

fn storage_path(state: &CoreState, plugin_id: &str, key: &str) -> std::path::PathBuf {
    state
        .app_directory
        .join("plugins")
        .join(plugin_id)
        .join("storage")
        .join(format!("{key}.json"))
}
