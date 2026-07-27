use std::ffi::c_void;
use std::slice;

use windows::Win32::Security::Credentials::{
    CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC, CREDENTIALW, CredDeleteW, CredFree, CredReadW,
    CredWriteW,
};
use windows_core::{PCWSTR, PWSTR};

use crate::error::AppError;
use crate::services::validate_segment;

const MAX_CREDENTIAL_BYTES: usize = 2_048;

pub fn set(plugin_id: &str, key: &str, value: &str) -> Result<(), AppError> {
    validate_names(plugin_id, key)?;
    if value.is_empty() || value.len() > MAX_CREDENTIAL_BYTES {
        return Err(AppError::invalid_input(
            "Credential values must contain between 1 and 2048 UTF-8 bytes.",
        ));
    }

    let mut target = wide_string(&target_name(plugin_id, key));
    let mut username = wide_string("ToolCenter");
    let mut blob = value.as_bytes().to_vec();
    let credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: PWSTR(target.as_mut_ptr()),
        CredentialBlobSize: blob.len() as u32,
        CredentialBlob: blob.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: PWSTR(username.as_mut_ptr()),
        ..Default::default()
    };

    // SAFETY: every pointer in `credential` refers to a live buffer for the duration of the call.
    unsafe { CredWriteW(&credential, 0) }
        .map_err(|_| AppError::new("credential.write-failed", "Secure credential write failed."))
}

pub fn has(plugin_id: &str, key: &str) -> Result<bool, AppError> {
    match read(plugin_id, key) {
        Ok(_) => Ok(true),
        Err(error) if error.code == "credential.not-found" => Ok(false),
        Err(error) => Err(error),
    }
}

pub fn remove(plugin_id: &str, key: &str) -> Result<(), AppError> {
    validate_names(plugin_id, key)?;
    let target = wide_string(&target_name(plugin_id, key));
    // SAFETY: `target` is a valid, null-terminated UTF-16 string.
    match unsafe { CredDeleteW(PCWSTR(target.as_ptr()), CRED_TYPE_GENERIC, None) } {
        Ok(()) => Ok(()),
        Err(error) if is_not_found(&error) => Ok(()),
        Err(_) => Err(AppError::new(
            "credential.delete-failed",
            "Secure credential deletion failed.",
        )),
    }
}

pub(crate) fn read(plugin_id: &str, key: &str) -> Result<String, AppError> {
    validate_names(plugin_id, key)?;
    let target = wide_string(&target_name(plugin_id, key));
    let mut raw = std::ptr::null_mut::<CREDENTIALW>();
    // SAFETY: `target` is null-terminated and `raw` is a valid out pointer.
    match unsafe { CredReadW(PCWSTR(target.as_ptr()), CRED_TYPE_GENERIC, None, &mut raw) } {
        Ok(()) => {}
        Err(error) if is_not_found(&error) => {
            return Err(AppError::new(
                "credential.not-found",
                "The requested secure credential does not exist.",
            ));
        }
        Err(_) => {
            return Err(AppError::new(
                "credential.read-failed",
                "Secure credential read failed.",
            ));
        }
    }

    if raw.is_null() {
        return Err(AppError::new(
            "credential.read-failed",
            "Credential Manager returned an empty result.",
        ));
    }
    let buffer = CredentialBuffer(raw);
    // SAFETY: Credential Manager owns a blob of exactly CredentialBlobSize bytes until CredFree.
    let bytes = unsafe {
        slice::from_raw_parts(
            (*buffer.0).CredentialBlob,
            (*buffer.0).CredentialBlobSize as usize,
        )
    };
    String::from_utf8(bytes.to_vec()).map_err(|_| {
        AppError::new(
            "credential.invalid",
            "The secure credential is not valid UTF-8.",
        )
    })
}

fn validate_names(plugin_id: &str, key: &str) -> Result<(), AppError> {
    validate_segment(plugin_id, "plugin id")?;
    validate_segment(key, "credential key")
}

fn target_name(plugin_id: &str, key: &str) -> String {
    format!("ToolCenter/{plugin_id}/{key}")
}

fn wide_string(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

fn is_not_found(error: &windows_core::Error) -> bool {
    (error.code().0 as u32 & 0xffff) == 1168
}

struct CredentialBuffer(*mut CREDENTIALW);

impl Drop for CredentialBuffer {
    fn drop(&mut self) {
        // SAFETY: this pointer was allocated by CredReadW and is freed exactly once here.
        unsafe { CredFree(self.0.cast::<c_void>()) };
    }
}

#[cfg(test)]
mod tests {
    use super::{target_name, validate_names};

    #[test]
    fn namespaces_credential_targets_by_plugin() {
        assert_eq!(
            target_name("toolcenter.market-watch", "twelve-data-api-key"),
            "ToolCenter/toolcenter.market-watch/twelve-data-api-key"
        );
    }

    #[test]
    fn rejects_unsafe_credential_names() {
        assert!(validate_names("toolcenter.market-watch", "provider-key").is_ok());
        assert!(validate_names("../escape", "provider-key").is_err());
        assert!(validate_names("toolcenter.market-watch", "../escape").is_err());
    }
}
