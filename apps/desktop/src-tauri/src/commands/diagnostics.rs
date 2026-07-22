use crate::services::diagnostics::{self, HostDiagnostics};

#[tauri::command]
pub fn diagnostics_get() -> HostDiagnostics {
    diagnostics::get()
}
