use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use tokio::sync::Mutex as AsyncMutex;

pub struct LockManager {
    locks: RwLock<HashMap<PathBuf, Arc<AsyncMutex<()>>>>,
}

impl LockManager {
    pub fn new() -> Self {
        Self {
            locks: RwLock::new(HashMap::new()),
        }
    }

    pub fn get_lock(&self, path: &PathBuf) -> Arc<AsyncMutex<()>> {
        let mut locks = self.locks.write().unwrap();
        locks
            .entry(path.clone())
            .or_insert_with(|| Arc::new(AsyncMutex::new(())))
            .clone()
    }
}
