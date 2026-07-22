use std::fs::{self, OpenOptions};
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use serde_json::Value;

use crate::error::AppError;
use crate::services::validate_segment;
use crate::state::CoreState;

const MAXIMUM_LOG_SIZE: u64 = 2 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LogRecord<'a> {
    timestamp: String,
    level: &'a str,
    plugin_id: Option<&'a str>,
    message: &'a str,
    details: Option<&'a Value>,
}

pub fn write(
    state: &CoreState,
    plugin_id: Option<&str>,
    level: &str,
    message: &str,
    details: Option<&Value>,
) -> Result<(), AppError> {
    if let Some(plugin_id) = plugin_id {
        validate_segment(plugin_id, "plugin id")?;
    }
    if !matches!(level, "debug" | "info" | "warn" | "error") {
        return Err(AppError::invalid_input("Unknown log level."));
    }

    let _guard = state.lock_io()?;
    let directory = state.app_directory.join("logs");
    fs::create_dir_all(&directory)?;
    let path = directory.join("app.jsonl");
    if fs::metadata(&path)
        .map(|metadata| metadata.len())
        .unwrap_or(0)
        >= MAXIMUM_LOG_SIZE
    {
        let backup = directory.join("app.1.jsonl");
        let _ = fs::remove_file(&backup);
        fs::rename(&path, backup)?;
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| AppError::new("time.failed", error.to_string()))?
        .as_millis()
        .to_string();
    let record = LogRecord {
        timestamp,
        level,
        plugin_id,
        message,
        details,
    };
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    serde_json::to_writer(&mut file, &record)?;
    file.write_all(b"\n")?;
    Ok(())
}

pub fn list(state: &CoreState, limit: usize) -> Result<Vec<Value>, AppError> {
    let _guard = state.lock_io()?;
    let path = state.app_directory.join("logs/app.jsonl");
    let contents = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.into()),
    };
    Ok(contents
        .lines()
        .rev()
        .take(limit.min(1000))
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect())
}
