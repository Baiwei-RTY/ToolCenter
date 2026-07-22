use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostDiagnostics {
    platform: &'static str,
    architecture: &'static str,
    app_version: &'static str,
    process_id: u32,
}

pub fn get() -> HostDiagnostics {
    HostDiagnostics {
        platform: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
        app_version: env!("CARGO_PKG_VERSION"),
        process_id: std::process::id(),
    }
}
