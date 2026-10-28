// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Cegah glitch ghosting, buffer tearing, dan tumpang tindih repaint pada WebKitGTK Linux Wayland
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    agentic_native_hub_lib::run();
}
