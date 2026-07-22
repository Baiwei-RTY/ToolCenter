use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use crate::error::AppError;

pub struct CoreState {
    pub app_directory: PathBuf,
    io_lock: Mutex<()>,
}

impl CoreState {
    pub fn new(app_directory: PathBuf) -> Self {
        Self {
            app_directory,
            io_lock: Mutex::new(()),
        }
    }

    pub fn lock_io(&self) -> Result<MutexGuard<'_, ()>, AppError> {
        self.io_lock
            .lock()
            .map_err(|_| AppError::new("state.poisoned", "The storage lock is unavailable."))
    }
}
