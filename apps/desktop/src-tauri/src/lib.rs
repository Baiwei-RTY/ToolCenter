mod commands;
mod error;
mod services;
mod state;

use tauri::Manager;

use services::audio::AudioState;
use services::widgets::WidgetHostState;
use state::CoreState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_directory = app.path().app_config_dir()?;
            std::fs::create_dir_all(&app_directory)?;
            app.manage(CoreState::new(app_directory));
            app.manage(WidgetHostState::new());
            app.manage(AudioState::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::settings_load,
            commands::settings::settings_save,
            commands::storage::plugin_storage_read,
            commands::storage::plugin_storage_write,
            commands::storage::plugin_storage_remove,
            commands::storage::plugin_storage_list,
            commands::permissions::permission_status,
            commands::permissions::permission_set,
            commands::permissions::permissions_list,
            commands::logs::log_write,
            commands::logs::log_list,
            commands::diagnostics::diagnostics_get,
            commands::widgets::widget_instances_list,
            commands::widgets::widget_host_instances,
            commands::widgets::widget_monitors_list,
            commands::widgets::widget_instance_create,
            commands::widgets::widget_instance_update,
            commands::widgets::widget_instance_remove,
            commands::widgets::widget_instance_reset_position,
            commands::widgets::widget_hosts_sync,
            commands::widgets::widget_host_set_regions,
            commands::audio::audio_devices_list,
            commands::audio::audio_default_device_get,
            commands::audio::audio_device_changes_subscribe,
            commands::audio::audio_default_device_set,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run ToolCenter");
}
