use std::fmt::{Display, Formatter};

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub user_message: String,
    pub recoverable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            user_message: "操作未能完成，请查看诊断日志。".to_string(),
            recoverable: true,
            details: None,
        }
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self {
            code: "input.invalid".to_string(),
            message: message.into(),
            user_message: "输入内容不符合要求。".to_string(),
            recoverable: true,
            details: None,
        }
    }
}

impl Display for AppError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::new("io.failed", error.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self::new("json.failed", error.to_string())
    }
}
