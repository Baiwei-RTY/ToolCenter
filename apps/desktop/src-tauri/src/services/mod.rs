pub mod audio;
pub mod credentials;
pub mod diagnostics;
pub mod display;
pub mod logs;
pub mod network;
pub mod permissions;
pub mod settings;
pub mod storage;
pub mod widgets;

use std::fs;
use std::path::Path;

use serde_json::Value;

use crate::error::AppError;

pub fn read_json(path: &Path) -> Result<Option<Value>, AppError> {
    match fs::read(path) {
        Ok(contents) => Ok(Some(serde_json::from_slice(&contents)?)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

pub fn write_json(path: &Path, value: &Value) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temporary_path = path.with_extension("tmp");
    fs::write(&temporary_path, serde_json::to_vec_pretty(value)?)?;
    fs::copy(&temporary_path, path)?;
    fs::remove_file(temporary_path)?;
    Ok(())
}

pub fn validate_segment(value: &str, label: &str) -> Result<(), AppError> {
    let valid = !value.is_empty()
        && value.len() <= 128
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_')
        });
    if valid {
        Ok(())
    } else {
        Err(AppError::invalid_input(format!(
            "{label} contains unsupported characters."
        )))
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use serde_json::json;

    use super::{read_json, validate_segment};
    use crate::services::{permissions, settings, storage};
    use crate::state::CoreState;

    #[test]
    fn validates_safe_logical_path_segments() {
        assert!(validate_segment("toolcenter.example-1", "plugin id").is_ok());
        assert!(validate_segment("../escape", "plugin id").is_err());
        assert!(validate_segment("contains space", "plugin id").is_err());
    }

    #[test]
    fn persists_settings_and_plugin_namespaces() {
        let directory = temporary_test_directory("storage");
        let state = CoreState::new(directory.clone());

        settings::save(&state, &json!({ "theme": "system" })).expect("settings should save");
        assert_eq!(
            settings::load(&state).expect("settings should load"),
            json!({ "theme": "system" })
        );

        storage::write(&state, "toolcenter.one", "value", &json!(1))
            .expect("first plugin value should save");
        storage::write(&state, "toolcenter.two", "value", &json!(2))
            .expect("second plugin value should save");
        assert_eq!(
            storage::read(&state, "toolcenter.one", "value").expect("value should load"),
            Some(json!(1))
        );
        assert_eq!(
            storage::read(&state, "toolcenter.two", "value").expect("value should load"),
            Some(json!(2))
        );

        fs::remove_dir_all(directory).expect("temporary test directory should be removable");
    }

    #[test]
    fn backs_up_legacy_settings_before_material3_migration() {
        let directory = temporary_test_directory("settings-migration");
        let state = CoreState::new(directory.clone());
        let legacy = json!({
            "defaultRoute": "/",
            "theme": "system",
            "enabledPluginIds": ["toolcenter.audio-device-switcher"]
        });

        settings::save(&state, &legacy).expect("legacy settings should save");
        settings::save(
            &state,
            &json!({
                "uiRevision": 1,
                "defaultRoute": "/tools",
                "theme": "light",
                "enabledPluginIds": ["toolcenter.audio-device-switcher"]
            }),
        )
        .expect("Material 3 settings should save");

        let backup = read_json(&directory.join("app").join("settings.pre-material3-v1.json"))
            .expect("settings backup should be readable");
        assert_eq!(backup, Some(legacy));

        fs::remove_dir_all(directory).expect("temporary test directory should be removable");
    }

    #[test]
    fn records_permission_decisions_per_plugin() {
        let directory = temporary_test_directory("permissions");
        let state = CoreState::new(directory.clone());

        assert_eq!(
            permissions::status(&state, "toolcenter.example", "clipboard.read")
                .expect("permission status should load"),
            "prompt"
        );
        assert!(
            permissions::require(&state, "toolcenter.example", "clipboard.read").is_err(),
            "prompt permissions must not authorize protected commands"
        );
        permissions::set(&state, "toolcenter.example", "clipboard.read", "granted")
            .expect("permission decision should save");
        assert_eq!(
            permissions::status(&state, "toolcenter.example", "clipboard.read")
                .expect("permission status should load"),
            "granted"
        );
        assert!(
            permissions::require(&state, "toolcenter.example", "clipboard.read").is_ok(),
            "only granted permissions authorize protected commands"
        );

        fs::remove_dir_all(directory).expect("temporary test directory should be removable");
    }

    fn temporary_test_directory(label: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be valid")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "toolcenter-{label}-{}-{unique}",
            std::process::id()
        ))
    }
}
