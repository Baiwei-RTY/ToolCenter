use serde_json::{Map, Value, json};

use crate::error::AppError;
use crate::services::{read_json, validate_segment, write_json};
use crate::state::CoreState;

pub fn status(state: &CoreState, plugin_id: &str, permission: &str) -> Result<String, AppError> {
    validate_segment(plugin_id, "plugin id")?;
    validate_permission(permission)?;
    let _guard = state.lock_io()?;
    let permissions =
        read_json(&state.app_directory.join("app/permissions.json"))?.unwrap_or_else(|| json!({}));
    Ok(permissions
        .get(plugin_id)
        .and_then(|plugin| plugin.get(permission))
        .and_then(Value::as_str)
        .unwrap_or("prompt")
        .to_string())
}

pub fn set(
    state: &CoreState,
    plugin_id: &str,
    permission: &str,
    decision: &str,
) -> Result<(), AppError> {
    validate_segment(plugin_id, "plugin id")?;
    validate_permission(permission)?;
    if !matches!(decision, "prompt" | "granted" | "denied") {
        return Err(AppError::invalid_input("Unknown permission decision."));
    }

    let _guard = state.lock_io()?;
    let path = state.app_directory.join("app/permissions.json");
    let mut permissions = read_json(&path)?.unwrap_or_else(|| json!({}));
    let root = permissions.as_object_mut().ok_or_else(|| {
        AppError::new(
            "permissions.invalid",
            "Permission storage is not an object.",
        )
    })?;
    let plugin = root
        .entry(plugin_id.to_string())
        .or_insert_with(|| Value::Object(Map::new()))
        .as_object_mut()
        .ok_or_else(|| {
            AppError::new(
                "permissions.invalid",
                "Plugin permissions are not an object.",
            )
        })?;
    plugin.insert(permission.to_string(), Value::String(decision.to_string()));
    write_json(&path, &permissions)
}

pub fn all(state: &CoreState) -> Result<Value, AppError> {
    let _guard = state.lock_io()?;
    Ok(read_json(&state.app_directory.join("app/permissions.json"))?.unwrap_or_else(|| json!({})))
}

pub fn require(state: &CoreState, plugin_id: &str, permission: &str) -> Result<(), AppError> {
    let decision = status(state, plugin_id, permission)?;
    if decision == "granted" {
        Ok(())
    } else {
        Err(AppError::new(
            "permission.denied",
            format!("Plugin \"{plugin_id}\" is not allowed to use permission \"{permission}\"."),
        ))
    }
}

fn validate_permission(permission: &str) -> Result<(), AppError> {
    validate_segment(permission, "permission")
}
