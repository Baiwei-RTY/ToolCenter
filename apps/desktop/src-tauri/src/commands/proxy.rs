use tauri::State;

use crate::error::AppError;
use crate::services::proxy::{self, ProxyClientState, ProxyClientStatus, ProxyGroupSummary};
use crate::state::CoreState;

#[tauri::command]
pub async fn proxy_client_status(
    proxy_state: State<'_, ProxyClientState>,
    core_state: State<'_, CoreState>,
    plugin_id: String,
) -> Result<ProxyClientStatus, AppError> {
    proxy::status(&proxy_state, &core_state, &plugin_id).await
}

#[tauri::command]
pub async fn proxy_groups_list(
    proxy_state: State<'_, ProxyClientState>,
    core_state: State<'_, CoreState>,
    plugin_id: String,
) -> Result<Vec<ProxyGroupSummary>, AppError> {
    proxy::list_groups(&proxy_state, &core_state, &plugin_id).await
}

#[tauri::command]
pub async fn proxy_group_select(
    proxy_state: State<'_, ProxyClientState>,
    core_state: State<'_, CoreState>,
    plugin_id: String,
    group_name: String,
    proxy_name: String,
) -> Result<(), AppError> {
    proxy::select_proxy(
        &proxy_state,
        &core_state,
        &plugin_id,
        &group_name,
        &proxy_name,
    )
    .await
}

#[tauri::command]
pub async fn proxy_client_set_enabled(
    proxy_state: State<'_, ProxyClientState>,
    core_state: State<'_, CoreState>,
    plugin_id: String,
    enabled: bool,
) -> Result<(), AppError> {
    proxy::set_proxy_enabled(&proxy_state, &core_state, &plugin_id, enabled).await
}
