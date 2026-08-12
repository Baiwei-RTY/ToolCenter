use std::collections::{HashMap, HashSet};

use serde::Deserialize;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use crate::error::AppError;
use crate::services::widgets::{
    self, CreateWidgetInstance, UpdateWidgetInstance, WidgetDisplayMode, WidgetHostState,
    WidgetInstance, WidgetMonitor,
};
use crate::state::CoreState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostQuery {
    monitor_id: String,
    display_mode: WidgetDisplayMode,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetRegion {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    #[serde(default)]
    radius: f64,
}

#[tauri::command]
pub fn widget_instances_list(state: State<'_, CoreState>) -> Result<Vec<WidgetInstance>, AppError> {
    widgets::list(&state)
}

#[tauri::command]
pub fn widget_host_instances(
    state: State<'_, CoreState>,
    host_state: State<'_, WidgetHostState>,
    query: HostQuery,
) -> Result<Vec<WidgetInstance>, AppError> {
    widgets::list_for_host(&state, &host_state, &query.monitor_id, &query.display_mode)
}

#[tauri::command]
pub fn widget_monitors_list(app: AppHandle) -> Result<Vec<WidgetMonitor>, AppError> {
    widgets::monitors(&app)
}

#[tauri::command]
pub async fn widget_instance_create(
    app: AppHandle,
    state: State<'_, CoreState>,
    host_state: State<'_, WidgetHostState>,
    input: CreateWidgetInstance,
) -> Result<WidgetInstance, AppError> {
    let instance = widgets::create(&app, &state, input)?;
    sync_hosts(&app, &state, &host_state)?;
    Ok(instance)
}

#[tauri::command]
pub async fn widget_instance_update(
    app: AppHandle,
    state: State<'_, CoreState>,
    host_state: State<'_, WidgetHostState>,
    input: UpdateWidgetInstance,
) -> Result<WidgetInstance, AppError> {
    let instance = widgets::update(&app, &state, input)?;
    sync_hosts(&app, &state, &host_state)?;
    Ok(instance)
}

#[tauri::command]
pub async fn widget_instances_reorder(
    app: AppHandle,
    state: State<'_, CoreState>,
    host_state: State<'_, WidgetHostState>,
    instance_ids: Vec<String>,
) -> Result<Vec<WidgetInstance>, AppError> {
    let instances = widgets::reorder(&state, &instance_ids)?;
    sync_hosts(&app, &state, &host_state)?;
    Ok(instances)
}

#[tauri::command]
pub async fn widget_instance_remove(
    app: AppHandle,
    state: State<'_, CoreState>,
    host_state: State<'_, WidgetHostState>,
    instance_id: String,
) -> Result<(), AppError> {
    widgets::remove(&state, &instance_id)?;
    sync_hosts(&app, &state, &host_state)
}

#[tauri::command]
pub async fn widget_instance_reset_position(
    app: AppHandle,
    state: State<'_, CoreState>,
    host_state: State<'_, WidgetHostState>,
    instance_id: String,
) -> Result<WidgetInstance, AppError> {
    let instance = widgets::reset_position(&app, &state, &instance_id)?;
    sync_hosts(&app, &state, &host_state)?;
    Ok(instance)
}

#[tauri::command]
pub async fn widget_hosts_sync(
    app: AppHandle,
    state: State<'_, CoreState>,
    host_state: State<'_, WidgetHostState>,
    enabled_plugin_ids: Vec<String>,
) -> Result<(), AppError> {
    host_state.set_enabled(&enabled_plugin_ids)?;
    sync_hosts(&app, &state, &host_state)
}

#[tauri::command]
pub fn widget_host_set_regions(
    window: WebviewWindow,
    regions: Option<Vec<WidgetRegion>>,
) -> Result<(), AppError> {
    if !window.label().starts_with("widget-host-") {
        return Err(AppError::invalid_input(
            "Only a widget host can update its interactive region.",
        ));
    }
    set_window_regions(&window, regions.as_deref())
}

fn sync_hosts(
    app: &AppHandle,
    state: &CoreState,
    host_state: &WidgetHostState,
) -> Result<(), AppError> {
    let instances = widgets::reconcile(app, state)?;
    let monitors = widgets::monitors(app)?;
    let monitor_map = monitors
        .iter()
        .map(|monitor| (monitor.id.as_str(), monitor))
        .collect::<HashMap<_, _>>();
    let mut desired = HashSet::new();

    for instance in instances.iter().filter(|instance| {
        instance.visible && host_state.is_enabled(&instance.plugin_id).unwrap_or(false)
    }) {
        let Some(monitor) = monitor_map.get(instance.monitor_id.as_str()) else {
            continue;
        };
        let label = widgets::host_label(&instance.monitor_id, &instance.display_mode);
        desired.insert(label.clone());
        ensure_host_window(app, &label, monitor, &instance.display_mode)?;
    }

    for (label, window) in app.webview_windows() {
        if !label.starts_with("widget-host-") {
            continue;
        }
        if desired.contains(&label) {
            window
                .emit("toolcenter://widgets-changed", ())
                .map_err(|error| AppError::new("widgets.emit-failed", error.to_string()))?;
        } else {
            window
                .close()
                .map_err(|error| AppError::new("widgets.window-failed", error.to_string()))?;
        }
    }
    Ok(())
}

fn ensure_host_window(
    app: &AppHandle,
    label: &str,
    monitor: &WidgetMonitor,
    display_mode: &WidgetDisplayMode,
) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window(label) {
        configure_host_window(&window, monitor, display_mode)?;
        return Ok(());
    }

    let url = format!(
        "index.html?surface=widget-host&monitorId={}&displayMode={}",
        monitor.id,
        match display_mode {
            WidgetDisplayMode::Desktop => "desktop",
            WidgetDisplayMode::AlwaysOnTop => "always-on-top",
        }
    );
    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title("ToolCenter Widget Host")
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .skip_taskbar(true)
        .resizable(false)
        .always_on_top(matches!(display_mode, WidgetDisplayMode::AlwaysOnTop))
        .focused(false)
        .visible(false)
        .inner_size(200.0, 120.0)
        .build()
        .map_err(|error| AppError::new("widgets.window-failed", error.to_string()))?;
    configure_host_window(&window, monitor, display_mode)?;
    set_window_regions(&window, Some(&[]))?;
    window
        .show()
        .map_err(|error| AppError::new("widgets.window-failed", error.to_string()))
}

fn configure_host_window(
    window: &WebviewWindow,
    monitor: &WidgetMonitor,
    display_mode: &WidgetDisplayMode,
) -> Result<(), AppError> {
    window
        .set_position(PhysicalPosition::new(monitor.x, monitor.y))
        .map_err(|error| AppError::new("widgets.window-failed", error.to_string()))?;
    window
        .set_size(PhysicalSize::new(monitor.width, monitor.height))
        .map_err(|error| AppError::new("widgets.window-failed", error.to_string()))?;
    window
        .set_always_on_top(matches!(display_mode, WidgetDisplayMode::AlwaysOnTop))
        .map_err(|error| AppError::new("widgets.window-failed", error.to_string()))
}

#[cfg(windows)]
fn set_window_regions(
    window: &WebviewWindow,
    regions: Option<&[WidgetRegion]>,
) -> Result<(), AppError> {
    use windows::Win32::Graphics::Gdi::{
        CombineRgn, CreateRectRgn, CreateRoundRectRgn, DeleteObject, HGDIOBJ, RGN_OR, SetWindowRgn,
    };

    let hwnd = window
        .hwnd()
        .map_err(|error| AppError::new("widgets.window-failed", error.to_string()))?;
    let Some(regions) = regions else {
        // SAFETY: The HWND belongs to this Tauri window. A null region restores the full window.
        unsafe { SetWindowRgn(hwnd, None, true) };
        return Ok(());
    };
    let scale = window
        .scale_factor()
        .map_err(|error| AppError::new("widgets.window-failed", error.to_string()))?;
    // SAFETY: GDI region handles are created and released according to SetWindowRgn ownership rules.
    unsafe {
        let combined = CreateRectRgn(0, 0, 0, 0);
        if combined.is_invalid() {
            return Err(AppError::new(
                "widgets.region-failed",
                "Unable to create the widget hit-test region.",
            ));
        }
        for region in regions {
            if !region.x.is_finite()
                || !region.y.is_finite()
                || !region.width.is_finite()
                || !region.height.is_finite()
                || !region.radius.is_finite()
                || region.width <= 0.0
                || region.height <= 0.0
                || region.radius < 0.0
            {
                let _ = DeleteObject(HGDIOBJ(combined.0));
                return Err(AppError::invalid_input("Widget region is invalid."));
            }
            let left = (region.x * scale).round() as i32;
            let top = (region.y * scale).round() as i32;
            let right = ((region.x + region.width) * scale).round() as i32;
            let bottom = ((region.y + region.height) * scale).round() as i32;
            let corner_radius = region
                .radius
                .min(region.width / 2.0)
                .min(region.height / 2.0);
            let corner_diameter = (corner_radius * 2.0 * scale).round() as i32;
            let widget_region = if corner_diameter > 0 {
                CreateRoundRectRgn(left, top, right, bottom, corner_diameter, corner_diameter)
            } else {
                CreateRectRgn(left, top, right, bottom)
            };
            if widget_region.is_invalid() {
                let _ = DeleteObject(HGDIOBJ(combined.0));
                return Err(AppError::new(
                    "widgets.region-failed",
                    "Unable to create a widget hit-test region.",
                ));
            }
            let _ = CombineRgn(Some(combined), Some(combined), Some(widget_region), RGN_OR);
            let _ = DeleteObject(HGDIOBJ(widget_region.0));
        }
        if SetWindowRgn(hwnd, Some(combined), true) == 0 {
            let _ = DeleteObject(HGDIOBJ(combined.0));
            return Err(AppError::new(
                "widgets.region-failed",
                "Unable to apply the widget hit-test region.",
            ));
        }
    }
    Ok(())
}

#[cfg(not(windows))]
fn set_window_regions(
    _window: &WebviewWindow,
    _regions: Option<&[WidgetRegion]>,
) -> Result<(), AppError> {
    Ok(())
}
