use std::collections::HashSet;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::{AppHandle, Monitor};

use crate::error::AppError;
use crate::services::{read_json, validate_segment, write_json};
use crate::state::CoreState;

static INSTANCE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum WidgetSize {
    Small,
    Medium,
    Wide,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum WidgetDisplayMode {
    Desktop,
    AlwaysOnTop,
}

impl WidgetDisplayMode {
    pub fn label_suffix(&self) -> &'static str {
        match self {
            Self::Desktop => "desktop",
            Self::AlwaysOnTop => "top",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedPosition {
    pub x: f64,
    pub y: f64,
}

impl NormalizedPosition {
    fn validated(self) -> Result<Self, AppError> {
        if self.x.is_finite() && self.y.is_finite() {
            Ok(Self {
                x: self.x.clamp(0.0, 1.0),
                y: self.y.clamp(0.0, 1.0),
            })
        } else {
            Err(AppError::invalid_input(
                "Widget coordinates must be finite numbers.",
            ))
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WidgetDimensions {
    pub width: f64,
    pub height: f64,
}

impl WidgetDimensions {
    fn validated(self) -> Result<Self, AppError> {
        if self.width.is_finite()
            && self.height.is_finite()
            && (96.0..=1600.0).contains(&self.width)
            && (72.0..=1200.0).contains(&self.height)
        {
            Ok(self)
        } else {
            Err(AppError::invalid_input(
                "Widget dimensions are outside the supported range.",
            ))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WidgetInstance {
    pub instance_id: String,
    pub plugin_id: String,
    pub widget_id: String,
    pub size: WidgetSize,
    pub visible: bool,
    pub locked: bool,
    pub display_mode: WidgetDisplayMode,
    pub monitor_id: String,
    pub position: NormalizedPosition,
    pub last_valid_position: NormalizedPosition,
    pub dimensions: WidgetDimensions,
    pub scale_factor: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWidgetInstance {
    pub plugin_id: String,
    pub widget_id: String,
    pub size: WidgetSize,
    pub visible: bool,
    pub dimensions: WidgetDimensions,
    pub monitor_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWidgetInstance {
    pub instance_id: String,
    pub size: Option<WidgetSize>,
    pub visible: Option<bool>,
    pub locked: Option<bool>,
    pub display_mode: Option<WidgetDisplayMode>,
    pub monitor_id: Option<String>,
    pub position: Option<NormalizedPosition>,
    pub dimensions: Option<WidgetDimensions>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetMonitor {
    pub id: String,
    pub name: String,
    pub primary: bool,
    pub scale_factor: f64,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

pub struct WidgetHostState {
    enabled_plugin_ids: Mutex<HashSet<String>>,
}

impl WidgetHostState {
    pub fn new() -> Self {
        Self {
            enabled_plugin_ids: Mutex::new(HashSet::new()),
        }
    }

    pub fn set_enabled(&self, plugin_ids: &[String]) -> Result<(), AppError> {
        for plugin_id in plugin_ids {
            validate_segment(plugin_id, "plugin id")?;
        }
        let mut enabled = self.lock_enabled()?;
        enabled.clear();
        enabled.extend(plugin_ids.iter().cloned());
        Ok(())
    }

    pub fn is_enabled(&self, plugin_id: &str) -> Result<bool, AppError> {
        Ok(self.lock_enabled()?.contains(plugin_id))
    }

    fn lock_enabled(&self) -> Result<MutexGuard<'_, HashSet<String>>, AppError> {
        self.enabled_plugin_ids.lock().map_err(|_| {
            AppError::new(
                "widgets.state-poisoned",
                "Widget host state is unavailable.",
            )
        })
    }
}

pub fn list(state: &CoreState) -> Result<Vec<WidgetInstance>, AppError> {
    let _guard = state.lock_io()?;
    load_unlocked(state)
}

pub fn list_for_host(
    state: &CoreState,
    host_state: &WidgetHostState,
    monitor_id: &str,
    display_mode: &WidgetDisplayMode,
) -> Result<Vec<WidgetInstance>, AppError> {
    validate_segment(monitor_id, "monitor id")?;
    Ok(list(state)?
        .into_iter()
        .filter(|instance| {
            instance.visible
                && instance.monitor_id == monitor_id
                && &instance.display_mode == display_mode
                && host_state.is_enabled(&instance.plugin_id).unwrap_or(false)
        })
        .collect())
}

pub fn create(
    app: &AppHandle,
    state: &CoreState,
    input: CreateWidgetInstance,
) -> Result<WidgetInstance, AppError> {
    validate_segment(&input.plugin_id, "plugin id")?;
    validate_segment(&input.widget_id, "widget id")?;
    let dimensions = input.dimensions.validated()?;
    let monitors = monitors(app)?;
    let selected = select_monitor(&monitors, input.monitor_id.as_deref())?;
    let position = next_position(state)?;
    let instance = WidgetInstance {
        instance_id: new_instance_id(),
        plugin_id: input.plugin_id,
        widget_id: input.widget_id,
        size: input.size,
        visible: input.visible,
        locked: false,
        display_mode: WidgetDisplayMode::Desktop,
        monitor_id: selected.id.clone(),
        position,
        last_valid_position: position,
        dimensions,
        scale_factor: selected.scale_factor,
    };

    let _guard = state.lock_io()?;
    let mut instances = load_unlocked(state)?;
    instances.push(instance.clone());
    save_unlocked(state, &instances)?;
    Ok(instance)
}

pub fn update(
    app: &AppHandle,
    state: &CoreState,
    input: UpdateWidgetInstance,
) -> Result<WidgetInstance, AppError> {
    validate_segment(&input.instance_id, "widget instance id")?;
    let available_monitors = monitors(app)?;
    let _guard = state.lock_io()?;
    let mut instances = load_unlocked(state)?;
    let instance = instances
        .iter_mut()
        .find(|candidate| candidate.instance_id == input.instance_id)
        .ok_or_else(|| AppError::new("widgets.not-found", "Widget instance was not found."))?;

    if let Some(size) = input.size {
        instance.size = size;
    }
    if let Some(visible) = input.visible {
        instance.visible = visible;
    }
    if let Some(locked) = input.locked {
        instance.locked = locked;
    }
    if let Some(display_mode) = input.display_mode {
        instance.display_mode = display_mode;
    }
    if let Some(dimensions) = input.dimensions {
        instance.dimensions = dimensions.validated()?;
    }
    if let Some(monitor_id) = input.monitor_id {
        let selected = select_monitor(&available_monitors, Some(&monitor_id))?;
        instance.monitor_id = selected.id.clone();
        instance.scale_factor = selected.scale_factor;
    }
    if let Some(position) = input.position {
        let validated = position.validated()?;
        instance.position = validated;
        instance.last_valid_position = validated;
    }

    let updated = instance.clone();
    save_unlocked(state, &instances)?;
    Ok(updated)
}

pub fn remove(state: &CoreState, instance_id: &str) -> Result<(), AppError> {
    validate_segment(instance_id, "widget instance id")?;
    let _guard = state.lock_io()?;
    let mut instances = load_unlocked(state)?;
    let original_len = instances.len();
    instances.retain(|instance| instance.instance_id != instance_id);
    if instances.len() == original_len {
        return Err(AppError::new(
            "widgets.not-found",
            "Widget instance was not found.",
        ));
    }
    save_unlocked(state, &instances)
}

pub fn reset_position(
    app: &AppHandle,
    state: &CoreState,
    instance_id: &str,
) -> Result<WidgetInstance, AppError> {
    validate_segment(instance_id, "widget instance id")?;
    let available_monitors = monitors(app)?;
    let primary = select_monitor(&available_monitors, None)?;
    let _guard = state.lock_io()?;
    let mut instances = load_unlocked(state)?;
    let instance = instances
        .iter_mut()
        .find(|candidate| candidate.instance_id == instance_id)
        .ok_or_else(|| AppError::new("widgets.not-found", "Widget instance was not found."))?;
    let reset = NormalizedPosition { x: 0.04, y: 0.04 };
    instance.monitor_id = primary.id.clone();
    instance.position = reset;
    instance.last_valid_position = reset;
    instance.scale_factor = primary.scale_factor;
    let updated = instance.clone();
    save_unlocked(state, &instances)?;
    Ok(updated)
}

pub fn reconcile(app: &AppHandle, state: &CoreState) -> Result<Vec<WidgetInstance>, AppError> {
    let available_monitors = monitors(app)?;
    let primary = select_monitor(&available_monitors, None)?.clone();
    let monitor_ids = available_monitors
        .iter()
        .map(|monitor| monitor.id.as_str())
        .collect::<HashSet<_>>();
    let _guard = state.lock_io()?;
    let mut instances = load_unlocked(state)?;
    let mut changed = false;

    for instance in &mut instances {
        let reconciled_position = instance
            .position
            .validated()
            .unwrap_or(instance.last_valid_position);
        if instance.position != reconciled_position {
            instance.position = reconciled_position;
            changed = true;
        }
        if !monitor_ids.contains(instance.monitor_id.as_str()) {
            instance.monitor_id = primary.id.clone();
            instance.position = instance
                .last_valid_position
                .validated()
                .unwrap_or(NormalizedPosition { x: 0.04, y: 0.04 });
            instance.scale_factor = primary.scale_factor;
            changed = true;
        } else if let Some(monitor) = available_monitors
            .iter()
            .find(|monitor| monitor.id == instance.monitor_id)
            && (instance.scale_factor - monitor.scale_factor).abs() > f64::EPSILON
        {
            instance.scale_factor = monitor.scale_factor;
            changed = true;
        }
    }

    if changed {
        save_unlocked(state, &instances)?;
    }
    Ok(instances)
}

pub fn monitors(app: &AppHandle) -> Result<Vec<WidgetMonitor>, AppError> {
    let primary_id = app
        .primary_monitor()
        .map_err(tauri_error)?
        .as_ref()
        .map(monitor_id);
    let monitors = app.available_monitors().map_err(tauri_error)?;
    if monitors.is_empty() {
        return Err(AppError::new(
            "widgets.no-monitor",
            "No available display monitor was found.",
        ));
    }
    Ok(monitors
        .iter()
        .map(|monitor| describe_monitor(monitor, primary_id.as_deref()))
        .collect())
}

pub fn host_label(monitor_id: &str, display_mode: &WidgetDisplayMode) -> String {
    format!("widget-host-{monitor_id}-{}", display_mode.label_suffix())
}

fn describe_monitor(monitor: &Monitor, primary_id: Option<&str>) -> WidgetMonitor {
    let id = monitor_id(monitor);
    let work_area = monitor.work_area();
    WidgetMonitor {
        primary: primary_id == Some(id.as_str()),
        id,
        name: monitor
            .name()
            .cloned()
            .unwrap_or_else(|| "显示器".to_string()),
        scale_factor: monitor.scale_factor(),
        x: work_area.position.x,
        y: work_area.position.y,
        width: work_area.size.width,
        height: work_area.size.height,
    }
}

fn monitor_id(monitor: &Monitor) -> String {
    let mut hasher = DefaultHasher::new();
    if let Some(name) = monitor.name() {
        name.hash(&mut hasher);
    } else {
        monitor.position().x.hash(&mut hasher);
        monitor.position().y.hash(&mut hasher);
    }
    format!("m{:016x}", hasher.finish())
}

fn select_monitor<'a>(
    monitors: &'a [WidgetMonitor],
    requested_id: Option<&str>,
) -> Result<&'a WidgetMonitor, AppError> {
    requested_id
        .and_then(|id| monitors.iter().find(|monitor| monitor.id == id))
        .or_else(|| monitors.iter().find(|monitor| monitor.primary))
        .or_else(|| monitors.first())
        .ok_or_else(|| AppError::new("widgets.no-monitor", "No display monitor is available."))
}

fn next_position(state: &CoreState) -> Result<NormalizedPosition, AppError> {
    let count = list(state)?.len() as f64;
    let offset = (count % 8.0) * 0.035;
    Ok(NormalizedPosition {
        x: (0.04 + offset).min(0.8),
        y: (0.04 + offset).min(0.8),
    })
}

fn new_instance_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let counter = INSTANCE_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("w{timestamp:x}{counter:x}")
}

fn load_unlocked(state: &CoreState) -> Result<Vec<WidgetInstance>, AppError> {
    let value = read_json(&state.app_directory.join("app/widgets.json"))?
        .unwrap_or_else(|| json!({ "version": 1, "instances": [] }));
    serde_json::from_value(
        value
            .get("instances")
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new())),
    )
    .map_err(|error| AppError::new("widgets.invalid-storage", error.to_string()))
}

fn save_unlocked(state: &CoreState, instances: &[WidgetInstance]) -> Result<(), AppError> {
    write_json(
        &state.app_directory.join("app/widgets.json"),
        &json!({ "version": 1, "instances": instances }),
    )
}

fn tauri_error(error: tauri::Error) -> AppError {
    AppError::new("widgets.window-failed", error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{NormalizedPosition, WidgetDimensions};

    #[test]
    fn clamps_normalized_positions() {
        assert_eq!(
            NormalizedPosition { x: -1.0, y: 2.0 }
                .validated()
                .expect("position should validate"),
            NormalizedPosition { x: 0.0, y: 1.0 }
        );
    }

    #[test]
    fn rejects_non_finite_positions_and_invalid_dimensions() {
        assert!(
            NormalizedPosition {
                x: f64::NAN,
                y: 0.0
            }
            .validated()
            .is_err()
        );
        assert!(
            WidgetDimensions {
                width: 20.0,
                height: 20.0,
            }
            .validated()
            .is_err()
        );
    }
}
