use std::collections::{BTreeMap, BTreeSet};
use std::mem::size_of;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use reqwest::{Client, Response, Url};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::json;
use windows::Win32::Foundation::ERROR_INSUFFICIENT_BUFFER;
use windows::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, MIB_TCPROW_OWNER_PID, TCP_TABLE_OWNER_PID_LISTENER,
};
use windows::Win32::Networking::WinSock::AF_INET;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    INPUT, INPUT_0, INPUT_KEYBOARD, KEYBD_EVENT_FLAGS, KEYBDINPUT, KEYEVENTF_KEYUP, SendInput,
    VIRTUAL_KEY, VK_CONTROL, VK_F12, VK_MENU, VK_SHIFT,
};

use crate::error::AppError;
use crate::services::{permissions, validate_segment};
use crate::state::CoreState;

const CONTROLLER_ORIGIN: &str = "http://127.0.0.1:19090";
const MAX_RESPONSE_BYTES: u64 = 4 * 1_048_576;
const HOTKEY_DISPLAY: &str = "Ctrl+Alt+Shift+F12";
const STATUS_POLL_ATTEMPTS: usize = 20;
const STATUS_POLL_INTERVAL: Duration = Duration::from_millis(150);

pub struct ProxyClientState {
    client: Client,
    last_mixed_port: Mutex<Option<u16>>,
}

impl ProxyClientState {
    pub fn new() -> Result<Self, AppError> {
        let client = Client::builder()
            .connect_timeout(Duration::from_millis(800))
            .timeout(Duration::from_secs(3))
            .redirect(reqwest::redirect::Policy::none())
            .user_agent("ToolCenter/0.1 flclash-toolcenter-control")
            .build()
            .map_err(|_| {
                AppError::new(
                    "proxy.client-failed",
                    "The local proxy controller client could not be initialized.",
                )
            })?;
        Ok(Self {
            client,
            last_mixed_port: Mutex::new(None),
        })
    }

    async fn get_json<T: DeserializeOwned>(&self, path: &str) -> Result<T, AppError> {
        let url = controller_url(path)?;
        let response = self.client.get(url).send().await.map_err(|_| {
            controller_error("The local proxy controller did not accept the request.")
        })?;
        decode_json(response).await
    }

    fn resolve_mixed_port(&self, reported: Option<u16>) -> Result<Option<u16>, AppError> {
        let mut cached = self.last_mixed_port.lock().map_err(|_| {
            AppError::new(
                "proxy.port-cache-failed",
                "The remembered FlClash mixed port is unavailable.",
            )
        })?;
        let resolved = resolve_mixed_port(reported, *cached);
        if resolved.is_some() {
            *cached = resolved;
        }
        Ok(resolved)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyClientStatus {
    controller_available: bool,
    version: Option<String>,
    mode: Option<String>,
    mixed_port: Option<u16>,
    proxy_enabled: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyGroupSummary {
    name: String,
    selected: String,
    all: Vec<String>,
    nodes: Vec<ProxyNodeSummary>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProxyNodeSummary {
    name: String,
    delay_ms: Option<u32>,
    latency_status: ProxyNodeLatencyStatus,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
enum ProxyNodeLatencyStatus {
    Available,
    Unavailable,
    Untested,
    Automatic,
    Direct,
}

#[derive(Debug, Deserialize)]
struct VersionResponse {
    version: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ConfigResponse {
    #[serde(rename = "mixed-port")]
    mixed_port: Option<u16>,
    mode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProxiesResponse {
    proxies: BTreeMap<String, ProxyEntry>,
}

#[derive(Debug, Deserialize)]
struct ConnectionsResponse {
    #[serde(default)]
    connections: Vec<ConnectionEntry>,
}

#[derive(Debug, Deserialize)]
struct RulesResponse {
    #[serde(default)]
    rules: Vec<RuleEntry>,
}

#[derive(Debug, Deserialize)]
struct RuleEntry {
    proxy: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ConnectionEntry {
    id: String,
    #[serde(default)]
    chains: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ProxyEntry {
    name: Option<String>,
    #[serde(rename = "type")]
    kind: Option<String>,
    now: Option<String>,
    all: Option<Vec<String>>,
    alive: Option<bool>,
    #[serde(default)]
    history: Vec<ProxyDelaySample>,
    #[serde(default)]
    hidden: bool,
}

#[derive(Debug, Deserialize)]
struct ProxyDelaySample {
    delay: u32,
}

pub async fn status(
    proxy: &ProxyClientState,
    core: &CoreState,
    plugin_id: &str,
) -> Result<ProxyClientStatus, AppError> {
    validate_segment(plugin_id, "plugin id")?;
    permissions::require(core, plugin_id, "proxy.read")?;

    let version = match proxy.get_json::<VersionResponse>("version").await {
        Ok(version) => version,
        Err(_) => {
            return Ok(ProxyClientStatus {
                controller_available: false,
                version: None,
                mode: None,
                mixed_port: None,
                proxy_enabled: false,
            });
        }
    };
    let config = proxy.get_json::<ConfigResponse>("configs").await?;
    let mixed_port = proxy.resolve_mixed_port(config.mixed_port)?;
    let proxy_enabled = mixed_port
        .map(is_tcp_port_listening)
        .transpose()?
        .unwrap_or(false);

    Ok(ProxyClientStatus {
        controller_available: true,
        version: version.version,
        mode: config.mode,
        mixed_port,
        proxy_enabled,
    })
}

pub async fn list_groups(
    proxy: &ProxyClientState,
    core: &CoreState,
    plugin_id: &str,
) -> Result<Vec<ProxyGroupSummary>, AppError> {
    validate_segment(plugin_id, "plugin id")?;
    permissions::require(core, plugin_id, "proxy.read")?;
    let response = proxy.get_json::<ProxiesResponse>("proxies").await?;
    let config = proxy.get_json::<ConfigResponse>("configs").await?;
    let rules = proxy.get_json::<RulesResponse>("rules").await?;
    Ok(effective_selectable_groups(
        response,
        config.mode.as_deref(),
        rules,
    ))
}

pub async fn select_proxy(
    proxy: &ProxyClientState,
    core: &CoreState,
    plugin_id: &str,
    group_name: &str,
    proxy_name: &str,
) -> Result<(), AppError> {
    validate_segment(plugin_id, "plugin id")?;
    permissions::require(core, plugin_id, "proxy.control")?;
    validate_proxy_label(group_name, "proxy group")?;
    validate_proxy_label(proxy_name, "proxy name")?;

    let response = proxy.get_json::<ProxiesResponse>("proxies").await?;
    let config = proxy.get_json::<ConfigResponse>("configs").await?;
    let rules = proxy.get_json::<RulesResponse>("rules").await?;
    let groups = effective_selectable_groups(response, config.mode.as_deref(), rules);
    let group = groups
        .iter()
        .find(|group| group.name == group_name)
        .ok_or_else(|| AppError {
            code: "proxy.group-not-effective".to_string(),
            message: "The selected proxy group is not effective in the current outbound mode."
                .to_string(),
            user_message: "当前出站模式不会使用这个代理组，请刷新小组件后选择实际生效的组。"
                .to_string(),
            recoverable: true,
            details: None,
        })?;
    if !group.all.iter().any(|name| name == proxy_name) {
        return Err(AppError::invalid_input(
            "The selected proxy does not belong to the requested group.",
        ));
    }

    let url = proxy_group_url(group_name)?;
    let response = proxy
        .client
        .put(url)
        .json(&json!({ "name": proxy_name }))
        .send()
        .await
        .map_err(|_| controller_error("The proxy selection request could not be sent."))?;
    expect_success(response).await?;
    close_group_connections(proxy, group_name).await
}

async fn close_group_connections(
    proxy: &ProxyClientState,
    group_name: &str,
) -> Result<(), AppError> {
    let response = proxy.get_json::<ConnectionsResponse>("connections").await?;
    for connection_id in connection_ids_for_group(response, group_name) {
        let url = connection_url(&connection_id)?;
        let response = proxy.client.delete(url).send().await.map_err(|_| {
            controller_error("An existing proxy connection could not be refreshed.")
        })?;
        if !response.status().is_success() && response.status().as_u16() != 404 {
            return Err(AppError {
                code: "proxy.connection-refresh-failed".to_string(),
                message: format!(
                    "The local proxy controller returned status {} while refreshing a connection.",
                    response.status()
                ),
                user_message: "节点已切换，但旧连接未能全部刷新，请再试一次。".to_string(),
                recoverable: true,
                details: None,
            });
        }
    }
    Ok(())
}

pub async fn set_proxy_enabled(
    proxy: &ProxyClientState,
    core: &CoreState,
    plugin_id: &str,
    enabled: bool,
) -> Result<(), AppError> {
    validate_segment(plugin_id, "plugin id")?;
    permissions::require(core, plugin_id, "proxy.control")?;

    let config = proxy.get_json::<ConfigResponse>("configs").await?;
    let mut port = proxy.resolve_mixed_port(config.mixed_port)?;
    let currently_enabled = port
        .map(is_tcp_port_listening)
        .transpose()?
        .unwrap_or(false);
    if currently_enabled == enabled {
        return Ok(());
    }

    tauri::async_runtime::spawn_blocking(send_flclash_toggle_hotkey)
        .await
        .map_err(|_| {
            AppError::new(
                "proxy.hotkey-task-failed",
                "The FlClash hotkey task stopped unexpectedly.",
            )
        })??;

    for _ in 0..STATUS_POLL_ATTEMPTS {
        wait_for_status_poll().await?;
        if port.is_none() {
            let config = proxy.get_json::<ConfigResponse>("configs").await?;
            port = proxy.resolve_mixed_port(config.mixed_port)?;
        }
        if let Some(port) = port
            && is_tcp_port_listening(port)? == enabled
        {
            return Ok(());
        }
    }

    Err(AppError {
        code: "proxy.flclash-hotkey-not-configured".to_string(),
        message: format!(
            "FlClash did not change its listener state after {HOTKEY_DISPLAY} was sent."
        ),
        user_message: format!(
            "没有检测到 FlClash 主开关状态变化。请在 FlClash 的全局快捷键中，把“启动”设置为 {HOTKEY_DISPLAY} 后重试。"
        ),
        recoverable: true,
        details: None,
    })
}

async fn wait_for_status_poll() -> Result<(), AppError> {
    tauri::async_runtime::spawn_blocking(|| thread::sleep(STATUS_POLL_INTERVAL))
        .await
        .map_err(|_| {
            AppError::new(
                "proxy.status-poll-failed",
                "The FlClash status poll stopped unexpectedly.",
            )
        })
}

fn selectable_groups(response: ProxiesResponse) -> Vec<ProxyGroupSummary> {
    response
        .proxies
        .iter()
        .filter_map(|(key, entry)| {
            if entry.hidden || entry.kind.as_deref() != Some("Selector") {
                return None;
            }
            let all = entry.all.as_ref()?.clone();
            let selected = entry.now.as_ref()?.clone();
            if all.is_empty() || !all.iter().any(|name| name == &selected) {
                return None;
            }
            let nodes = all
                .iter()
                .map(|name| proxy_node_summary(name, response.proxies.get(name)))
                .collect();
            Some(ProxyGroupSummary {
                name: entry
                    .name
                    .as_ref()
                    .filter(|name| !name.is_empty())
                    .cloned()
                    .unwrap_or_else(|| key.clone()),
                selected,
                all,
                nodes,
            })
        })
        .collect()
}

fn proxy_node_summary(name: &str, entry: Option<&ProxyEntry>) -> ProxyNodeSummary {
    let Some(entry) = entry else {
        return ProxyNodeSummary {
            name: name.to_string(),
            delay_ms: None,
            latency_status: ProxyNodeLatencyStatus::Untested,
        };
    };
    let kind = entry.kind.as_deref().unwrap_or_default();
    if kind.eq_ignore_ascii_case("direct") {
        return ProxyNodeSummary {
            name: name.to_string(),
            delay_ms: None,
            latency_status: ProxyNodeLatencyStatus::Direct,
        };
    }
    if ["selector", "urltest", "fallback", "loadbalance"]
        .iter()
        .any(|candidate| kind.eq_ignore_ascii_case(candidate))
    {
        return ProxyNodeSummary {
            name: name.to_string(),
            delay_ms: None,
            latency_status: ProxyNodeLatencyStatus::Automatic,
        };
    }
    let latest_delay = entry.history.last().map(|sample| sample.delay);
    if entry.alive == Some(false) || latest_delay == Some(0) {
        return ProxyNodeSummary {
            name: name.to_string(),
            delay_ms: None,
            latency_status: ProxyNodeLatencyStatus::Unavailable,
        };
    }
    match latest_delay {
        Some(delay_ms) => ProxyNodeSummary {
            name: name.to_string(),
            delay_ms: Some(delay_ms),
            latency_status: ProxyNodeLatencyStatus::Available,
        },
        None => ProxyNodeSummary {
            name: name.to_string(),
            delay_ms: None,
            latency_status: ProxyNodeLatencyStatus::Untested,
        },
    }
}

fn effective_selectable_groups(
    response: ProxiesResponse,
    mode: Option<&str>,
    rules: RulesResponse,
) -> Vec<ProxyGroupSummary> {
    let groups = selectable_groups(response);
    match mode.unwrap_or("rule").to_ascii_lowercase().as_str() {
        "global" => groups
            .into_iter()
            .filter(|group| group.name.eq_ignore_ascii_case("GLOBAL"))
            .collect(),
        "direct" => Vec::new(),
        _ => {
            let referenced_groups: BTreeSet<String> = rules
                .rules
                .into_iter()
                .filter_map(|rule| rule.proxy)
                .collect();
            groups
                .into_iter()
                .filter(|group| referenced_groups.contains(&group.name))
                .collect()
        }
    }
}

fn validate_proxy_label(value: &str, label: &str) -> Result<(), AppError> {
    if value.is_empty()
        || value.len() > 512
        || value
            .chars()
            .any(|character| matches!(character, '\r' | '\n' | '\0'))
        || value.trim() != value
    {
        return Err(AppError::invalid_input(format!(
            "The {label} is empty or contains unsupported characters."
        )));
    }
    Ok(())
}

fn controller_url(path: &str) -> Result<Url, AppError> {
    Url::parse(&format!("{CONTROLLER_ORIGIN}/{path}")).map_err(|_| {
        AppError::new(
            "proxy.url-invalid",
            "The fixed local proxy controller URL could not be created.",
        )
    })
}

fn proxy_group_url(group_name: &str) -> Result<Url, AppError> {
    let mut url = controller_url("proxies")?;
    url.path_segments_mut()
        .map_err(|_| AppError::invalid_input("The proxy group URL is invalid."))?
        .push(group_name);
    Ok(url)
}

fn connection_url(connection_id: &str) -> Result<Url, AppError> {
    validate_proxy_label(connection_id, "connection id")?;
    let mut url = controller_url("connections")?;
    url.path_segments_mut()
        .map_err(|_| AppError::invalid_input("The connection URL is invalid."))?
        .push(connection_id);
    Ok(url)
}

fn connection_ids_for_group(response: ConnectionsResponse, group_name: &str) -> Vec<String> {
    response
        .connections
        .into_iter()
        .filter(|connection| connection.chains.iter().any(|chain| chain == group_name))
        .map(|connection| connection.id)
        .collect()
}

async fn decode_json<T: DeserializeOwned>(response: Response) -> Result<T, AppError> {
    let response = successful_response(response)?;
    if response
        .content_length()
        .is_some_and(|size| size > MAX_RESPONSE_BYTES)
    {
        return Err(AppError::new(
            "proxy.response-too-large",
            "The local proxy controller response exceeds the 4 MiB limit.",
        ));
    }
    let bytes = response.bytes().await.map_err(|_| {
        AppError::new(
            "proxy.response-failed",
            "The local proxy controller response could not be read.",
        )
    })?;
    if bytes.len() as u64 > MAX_RESPONSE_BYTES {
        return Err(AppError::new(
            "proxy.response-too-large",
            "The local proxy controller response exceeds the 4 MiB limit.",
        ));
    }
    serde_json::from_slice(&bytes).map_err(|_| {
        AppError::new(
            "proxy.json-invalid",
            "The local proxy controller returned invalid JSON.",
        )
    })
}

async fn expect_success(response: Response) -> Result<(), AppError> {
    successful_response(response).map(|_| ())
}

fn successful_response(response: Response) -> Result<Response, AppError> {
    if response.status().is_success() {
        Ok(response)
    } else {
        Err(AppError::new(
            "proxy.http-error",
            format!(
                "The local proxy controller returned status {}.",
                response.status()
            ),
        ))
    }
}

fn controller_error(message: impl Into<String>) -> AppError {
    AppError {
        code: "proxy.controller-unavailable".to_string(),
        message: message.into(),
        user_message: "无法连接 FlClash。请确认程序正在运行，并在高级设置中开启“外部控制”。"
            .to_string(),
        recoverable: true,
        details: None,
    }
}

fn is_tcp_port_listening(port: u16) -> Result<bool, AppError> {
    Ok(tcp_listener_rows()?
        .iter()
        .any(|row| decode_tcp_port(row.dwLocalPort) == port))
}

fn tcp_listener_rows() -> Result<Vec<MIB_TCPROW_OWNER_PID>, AppError> {
    let mut byte_size = 0_u32;
    let status = unsafe {
        GetExtendedTcpTable(
            None,
            &mut byte_size,
            false,
            u32::from(AF_INET.0),
            TCP_TABLE_OWNER_PID_LISTENER,
            0,
        )
    };
    if status != ERROR_INSUFFICIENT_BUFFER.0 && status != 0 {
        return Err(AppError::new(
            "proxy.listener-state-failed",
            format!("Unable to determine the TCP listener table size ({status})."),
        ));
    }
    if byte_size == 0 {
        return Ok(Vec::new());
    }

    let mut buffer = vec![0_u8; byte_size as usize];
    let status = unsafe {
        GetExtendedTcpTable(
            Some(buffer.as_mut_ptr().cast()),
            &mut byte_size,
            false,
            u32::from(AF_INET.0),
            TCP_TABLE_OWNER_PID_LISTENER,
            0,
        )
    };
    if status != 0 {
        return Err(AppError::new(
            "proxy.listener-state-failed",
            format!("Unable to read the TCP listener table ({status})."),
        ));
    }
    if buffer.len() < size_of::<u32>() {
        return Err(AppError::new(
            "proxy.listener-state-invalid",
            "The TCP listener table is truncated.",
        ));
    }

    let count = unsafe { std::ptr::read_unaligned(buffer.as_ptr().cast::<u32>()) } as usize;
    let row_size = size_of::<MIB_TCPROW_OWNER_PID>();
    let available = (buffer.len() - size_of::<u32>()) / row_size;
    if count > available {
        return Err(AppError::new(
            "proxy.listener-state-invalid",
            "The TCP listener table contains an invalid row count.",
        ));
    }

    let rows_start = unsafe { buffer.as_ptr().add(size_of::<u32>()) };
    Ok((0..count)
        .map(|index| unsafe { std::ptr::read_unaligned(rows_start.add(index * row_size).cast()) })
        .collect())
}

fn decode_tcp_port(network_order_port: u32) -> u16 {
    u16::from_be((network_order_port & u32::from(u16::MAX)) as u16)
}

fn resolve_mixed_port(reported: Option<u16>, cached: Option<u16>) -> Option<u16> {
    reported.filter(|port| *port > 0).or(cached)
}

fn send_flclash_toggle_hotkey() -> Result<(), AppError> {
    let inputs = build_hotkey_inputs();
    let sent = unsafe { SendInput(&inputs, size_of::<INPUT>() as i32) };
    if sent as usize == inputs.len() {
        return Ok(());
    }

    let releases = [
        keyboard_input(VK_F12, KEYEVENTF_KEYUP),
        keyboard_input(VK_SHIFT, KEYEVENTF_KEYUP),
        keyboard_input(VK_MENU, KEYEVENTF_KEYUP),
        keyboard_input(VK_CONTROL, KEYEVENTF_KEYUP),
    ];
    unsafe {
        SendInput(&releases, size_of::<INPUT>() as i32);
    }
    Err(AppError {
        code: "proxy.hotkey-send-failed".to_string(),
        message: format!(
            "Windows accepted {sent} of {} FlClash hotkey input events.",
            inputs.len()
        ),
        user_message:
            "无法发送 FlClash 启动快捷键。请确认 FlClash 与 ToolCenter 使用相同权限级别。"
                .to_string(),
        recoverable: true,
        details: None,
    })
}

fn build_hotkey_inputs() -> [INPUT; 8] {
    [
        keyboard_input(VK_CONTROL, KEYBD_EVENT_FLAGS::default()),
        keyboard_input(VK_MENU, KEYBD_EVENT_FLAGS::default()),
        keyboard_input(VK_SHIFT, KEYBD_EVENT_FLAGS::default()),
        keyboard_input(VK_F12, KEYBD_EVENT_FLAGS::default()),
        keyboard_input(VK_F12, KEYEVENTF_KEYUP),
        keyboard_input(VK_SHIFT, KEYEVENTF_KEYUP),
        keyboard_input(VK_MENU, KEYEVENTF_KEYUP),
        keyboard_input(VK_CONTROL, KEYEVENTF_KEYUP),
    ]
}

fn keyboard_input(key: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                dwFlags: flags,
                ..Default::default()
            },
        },
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use windows::Win32::UI::Input::KeyboardAndMouse::{KEYEVENTF_KEYUP, VK_F12};

    use super::{
        ConnectionEntry, ConnectionsResponse, ProxiesResponse, ProxyDelaySample, ProxyEntry,
        ProxyNodeLatencyStatus, RuleEntry, RulesResponse, build_hotkey_inputs,
        connection_ids_for_group, connection_url, decode_tcp_port, effective_selectable_groups,
        proxy_group_url, proxy_node_summary, resolve_mixed_port, selectable_groups,
        validate_proxy_label,
    };

    #[test]
    fn keeps_only_visible_selectable_groups() {
        let response = ProxiesResponse {
            proxies: BTreeMap::from([
                (
                    "Main".to_string(),
                    ProxyEntry {
                        name: Some("Main".to_string()),
                        kind: Some("Selector".to_string()),
                        now: Some("Node B".to_string()),
                        all: Some(vec!["Node A".to_string(), "Node B".to_string()]),
                        alive: None,
                        history: Vec::new(),
                        hidden: false,
                    },
                ),
                (
                    "Auto".to_string(),
                    ProxyEntry {
                        name: Some("Auto".to_string()),
                        kind: Some("URLTest".to_string()),
                        now: Some("Node A".to_string()),
                        all: Some(vec!["Node A".to_string()]),
                        alive: Some(true),
                        history: Vec::new(),
                        hidden: false,
                    },
                ),
            ]),
        };

        let groups = selectable_groups(response);

        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].name, "Main");
        assert_eq!(groups[0].selected, "Node B");
        assert_eq!(groups[0].nodes.len(), 2);
        assert_eq!(
            groups[0].nodes[0].latency_status,
            ProxyNodeLatencyStatus::Untested
        );
    }

    #[test]
    fn exposes_the_latest_flclash_latency_for_each_node() {
        let available = ProxyEntry {
            name: Some("Japan 01".to_string()),
            kind: Some("Vless".to_string()),
            now: None,
            all: None,
            alive: Some(true),
            history: vec![
                ProxyDelaySample { delay: 180 },
                ProxyDelaySample { delay: 126 },
            ],
            hidden: false,
        };
        let measured = proxy_node_summary("Japan 01", Some(&available));
        assert_eq!(measured.delay_ms, Some(126));
        assert_eq!(measured.latency_status, ProxyNodeLatencyStatus::Available);

        let unavailable = ProxyEntry {
            alive: Some(false),
            history: vec![ProxyDelaySample { delay: 0 }],
            ..available
        };
        let failed = proxy_node_summary("Japan 01", Some(&unavailable));
        assert_eq!(failed.delay_ms, None);
        assert_eq!(failed.latency_status, ProxyNodeLatencyStatus::Unavailable);
    }

    #[test]
    fn returns_only_groups_effective_in_the_current_mode() {
        fn response() -> ProxiesResponse {
            ProxiesResponse {
                proxies: BTreeMap::from([
                    (
                        "GLOBAL".to_string(),
                        ProxyEntry {
                            name: Some("GLOBAL".to_string()),
                            kind: Some("Selector".to_string()),
                            now: Some("Node A".to_string()),
                            all: Some(vec!["Node A".to_string()]),
                            alive: None,
                            history: Vec::new(),
                            hidden: false,
                        },
                    ),
                    (
                        "Main".to_string(),
                        ProxyEntry {
                            name: Some("Main".to_string()),
                            kind: Some("Selector".to_string()),
                            now: Some("Node B".to_string()),
                            all: Some(vec!["Node B".to_string()]),
                            alive: None,
                            history: Vec::new(),
                            hidden: false,
                        },
                    ),
                ]),
            }
        }

        let rules = || RulesResponse {
            rules: vec![RuleEntry {
                proxy: Some("Main".to_string()),
            }],
        };
        let rule_groups = effective_selectable_groups(response(), Some("rule"), rules());
        assert_eq!(rule_groups.len(), 1);
        assert_eq!(rule_groups[0].name, "Main");

        let global_groups = effective_selectable_groups(response(), Some("global"), rules());
        assert_eq!(global_groups.len(), 1);
        assert_eq!(global_groups[0].name, "GLOBAL");

        assert!(effective_selectable_groups(response(), Some("direct"), rules()).is_empty());
    }

    #[test]
    fn encodes_proxy_group_names_as_one_path_segment() {
        let url = proxy_group_url("节点 组/一").expect("group URL should be valid");
        assert_eq!(
            url.as_str(),
            "http://127.0.0.1:19090/proxies/%E8%8A%82%E7%82%B9%20%E7%BB%84%2F%E4%B8%80"
        );
    }

    #[test]
    fn refreshes_only_connections_routed_through_the_selected_group() {
        let response = ConnectionsResponse {
            connections: vec![
                ConnectionEntry {
                    id: "old-node".to_string(),
                    chains: vec!["Japan 01".to_string(), "节点选择".to_string()],
                },
                ConnectionEntry {
                    id: "direct".to_string(),
                    chains: vec!["DIRECT".to_string()],
                },
                ConnectionEntry {
                    id: "other-group".to_string(),
                    chains: vec!["Media 01".to_string(), "流媒体".to_string()],
                },
            ],
        };

        assert_eq!(
            connection_ids_for_group(response, "节点选择"),
            vec!["old-node"]
        );
    }

    #[test]
    fn encodes_connection_ids_as_one_path_segment() {
        let url = connection_url("connection/id 1").expect("connection URL should be valid");
        assert_eq!(
            url.as_str(),
            "http://127.0.0.1:19090/connections/connection%2Fid%201"
        );
    }

    #[test]
    fn rejects_unsafe_or_oversized_proxy_labels() {
        assert!(validate_proxy_label("Main", "group").is_ok());
        assert!(validate_proxy_label("\nInjected", "group").is_err());
        assert!(validate_proxy_label(&"x".repeat(513), "group").is_err());
    }

    #[test]
    fn decodes_windows_listener_ports() {
        assert_eq!(decode_tcp_port(0x0000_e245), 17890);
    }

    #[test]
    fn keeps_the_last_verified_mixed_port_while_flclash_is_stopped() {
        assert_eq!(resolve_mixed_port(Some(17890), None), Some(17890));
        assert_eq!(resolve_mixed_port(None, Some(17890)), Some(17890));
        assert_eq!(resolve_mixed_port(Some(0), Some(17890)), Some(17890));
        assert_eq!(resolve_mixed_port(Some(0), None), None);
    }

    #[test]
    fn hotkey_sequence_releases_the_trigger_key() {
        let inputs = build_hotkey_inputs();
        let trigger_down = unsafe { inputs[3].Anonymous.ki };
        let trigger_up = unsafe { inputs[4].Anonymous.ki };
        assert_eq!(trigger_down.wVk, VK_F12);
        assert_eq!(trigger_up.wVk, VK_F12);
        assert_eq!(trigger_up.dwFlags, KEYEVENTF_KEYUP);
    }
}
