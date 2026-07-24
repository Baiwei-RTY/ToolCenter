use tauri::State;

use crate::error::AppError;
use crate::services::display::{self, DisplaySummary};
use crate::services::permissions;
use crate::state::CoreState;

const DISPLAY_READ_PERMISSION: &str = "display.read";
const DISPLAY_CONTROL_PERMISSION: &str = "display.control";

#[tauri::command]
pub fn display_targets_list(
    state: State<'_, CoreState>,
    plugin_id: String,
) -> Result<Vec<DisplaySummary>, AppError> {
    require_permission(&state, &plugin_id, DISPLAY_READ_PERMISSION)?;
    display::list_displays()
}

#[tauri::command]
pub fn display_hdr_set(
    state: State<'_, CoreState>,
    plugin_id: String,
    display_id: String,
    enabled: bool,
) -> Result<(), AppError> {
    require_permission(&state, &plugin_id, DISPLAY_CONTROL_PERMISSION)?;
    display::set_hdr_enabled(&display_id, enabled)
}

fn require_permission(
    state: &CoreState,
    plugin_id: &str,
    permission: &str,
) -> Result<(), AppError> {
    permissions::require(state, plugin_id, permission).map_err(|error| {
        if error.code == "permission.denied" {
            AppError {
                code: "display.permission-denied".to_string(),
                message: format!(
                    "Plugin \"{plugin_id}\" is not allowed to use permission \"{permission}\"."
                ),
                user_message: "插件没有获得所需的显示器权限，请授权后重试。".to_string(),
                recoverable: true,
                details: None,
            }
        } else {
            error
        }
    })
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{DISPLAY_CONTROL_PERMISSION, DISPLAY_READ_PERMISSION, require_permission};
    use crate::services::permissions;
    use crate::state::CoreState;

    #[test]
    fn keeps_read_and_control_permissions_separate() {
        assert_eq!(DISPLAY_READ_PERMISSION, "display.read");
        assert_eq!(DISPLAY_CONTROL_PERMISSION, "display.control");
        assert_ne!(DISPLAY_READ_PERMISSION, DISPLAY_CONTROL_PERMISSION);
    }

    #[test]
    fn maps_denied_display_permissions_before_the_service_runs() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be valid")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "toolcenter-display-permission-{}-{unique}",
            std::process::id()
        ));
        let state = CoreState::new(directory.clone());

        let denied = require_permission(
            &state,
            "toolcenter.display-test",
            DISPLAY_CONTROL_PERMISSION,
        )
        .expect_err("prompt must not authorize display control");
        assert_eq!(denied.code, "display.permission-denied");

        permissions::set(
            &state,
            "toolcenter.display-test",
            DISPLAY_READ_PERMISSION,
            "granted",
        )
        .expect("read permission should be persisted");
        assert!(
            require_permission(&state, "toolcenter.display-test", DISPLAY_READ_PERMISSION).is_ok()
        );
        assert!(
            require_permission(
                &state,
                "toolcenter.display-test",
                DISPLAY_CONTROL_PERMISSION
            )
            .is_err(),
            "read permission must not grant display control"
        );

        fs::remove_dir_all(directory).expect("temporary test directory should be removable");
    }
}
