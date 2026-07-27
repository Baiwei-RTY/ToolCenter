use serde_json::Value;
use tauri::State;

use crate::error::AppError;
use crate::services::network::{self, NetworkJsonRequest, NetworkState};
use crate::state::CoreState;

#[tauri::command]
pub async fn network_get_json(
    network_state: State<'_, NetworkState>,
    core_state: State<'_, CoreState>,
    plugin_id: String,
    request: NetworkJsonRequest,
) -> Result<Value, AppError> {
    network::get_json(&network_state, &core_state, &plugin_id, request).await
}
