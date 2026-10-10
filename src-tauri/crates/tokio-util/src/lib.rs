pub mod sync {
    use std::sync::Arc;
    use tokio::sync::Notify;
    use std::sync::atomic::{AtomicBool, Ordering};

    #[derive(Clone)]
    pub struct CancellationToken {
        is_cancelled: Arc<AtomicBool>,
        notify: Arc<Notify>,
    }

    impl CancellationToken {
        pub fn new() -> Self {
            Self {
                is_cancelled: Arc::new(AtomicBool::new(false)),
                notify: Arc::new(Notify::new()),
            }
        }

        pub fn cancel(&self) {
            self.is_cancelled.store(true, Ordering::SeqCst);
            self.notify.notify_waiters();
        }

        pub fn is_cancelled(&self) -> bool {
            self.is_cancelled.load(Ordering::SeqCst)
        }

        pub async fn cancelled(&self) {
            while !self.is_cancelled() {
                self.notify.notified().await;
            }
        }

        pub fn child_token(&self) -> Self {
            let child = Self::new();
            let parent = self.clone();
            let child_clone = child.clone();
            tokio::spawn(async move {
                parent.cancelled().await;
                child_clone.cancel();
            });
            child
        }
    }

    impl Default for CancellationToken {
        fn default() -> Self {
            Self::new()
        }
    }
}
