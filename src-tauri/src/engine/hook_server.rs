// Local loopback HTTP hook server inspired by Orca's agent-hooks telemetry architecture.
// Receives real-time telemetry events from AI CLI agents (SessionStart, tool.call, PermissionRequest, Stop).

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTelemetryPayload {
    pub pane_key: Option<String>,
    pub worktree_id: Option<String>,
    pub agent_name: String,
    pub hook_event_name: String,
    pub payload: serde_json::Value,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookServerCoords {
    pub port: u16,
    pub token: String,
}

pub struct AgentHookServer {
    pub port: u16,
    pub token: String,
    pub event_sender: broadcast::Sender<AgentTelemetryPayload>,
}

impl AgentHookServer {
    /// Memulai server hook loopback lokal pada port acak yang aman
    pub async fn start() -> Result<Arc<Self>, String> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| format!("Gagal mengikat loopback TCP listener: {}", e))?;

        let port = listener
            .local_addr()
            .map_err(|e| format!("Gagal mendapatkan local port: {}", e))?
            .port();

        let token = Uuid::new_v4().to_string();
        let (tx, _rx) = broadcast::channel::<AgentTelemetryPayload>(256);

        let server = Arc::new(Self {
            port,
            token: token.clone(),
            event_sender: tx.clone(),
        });

        let server_clone = server.clone();
        tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((mut socket, _addr)) => {
                        let token_expected = server_clone.token.clone();
                        let tx_event = server_clone.event_sender.clone();

                        tokio::spawn(async move {
                            let mut buf = [0u8; 8192];
                            let n = match socket.read(&mut buf).await {
                                Ok(n) if n > 0 => n,
                                _ => return,
                            };

                            let request = String::from_utf8_lossy(&buf[..n]);

                            // Verifikasi token otentikasi
                            let has_valid_token = request.contains(&format!("X-Agentic-Hook-Token: {}", token_expected))
                                || request.contains(&format!("x-agentic-hook-token: {}", token_expected))
                                || request.contains(&format!("Bearer {}", token_expected))
                                || request.contains(&format!("token={}", token_expected));

                            if !has_valid_token {
                                let response = "HTTP/1.1 401 Unauthorized\r\nContent-Length: 12\r\nConnection: close\r\n\r\nUnauthorized";
                                let _ = socket.write_all(response.as_bytes()).await;
                                return;
                            }

                            // Ekstrak nama agen dari path: POST /hook/<agent_name>
                            let first_line = request.lines().next().unwrap_or("");
                            let mut agent_name = "cli-agent".to_string();
                            if let Some(pos) = first_line.find("/hook/") {
                                let rest = &first_line[pos + 6..];
                                if let Some(end) = rest.find(' ') {
                                    agent_name = rest[..end].trim().to_string();
                                }
                            }

                            // Ekstrak body JSON setelah header pemisah \r\n\r\n
                            let body_start = request.find("\r\n\r\n").map(|p| p + 4)
                                .or_else(|| request.find("\n\n").map(|p| p + 2));

                            let body_str = match body_start {
                                Some(idx) if idx < request.len() => &request[idx..],
                                _ => "{}",
                            };

                            let parsed_json: serde_json::Value = serde_json::from_str(body_str)
                                .unwrap_or_else(|_| serde_json::json!({ "raw": body_str }));

                            let pane_key = parsed_json.get("paneKey")
                                .or_else(|| parsed_json.get("pane_key"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());

                            let worktree_id = parsed_json.get("worktreeId")
                                .or_else(|| parsed_json.get("worktree_id"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());

                            let event_name = parsed_json.get("hook_event_name")
                                .or_else(|| parsed_json.get("eventName"))
                                .or_else(|| parsed_json.get("event"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("agent.activity")
                                .to_string();

                            let telemetry = AgentTelemetryPayload {
                                pane_key,
                                worktree_id,
                                agent_name,
                                hook_event_name: event_name,
                                payload: parsed_json,
                                timestamp: chrono::Utc::now().timestamp_millis(),
                            };

                            let _ = tx_event.send(telemetry);

                            let ok_response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\nConnection: close\r\n\r\n{\"status\":\"ok\"}";
                            let _ = socket.write_all(ok_response.as_bytes()).await;
                        });
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(server)
    }

    pub fn get_coords(&self) -> HookServerCoords {
        HookServerCoords {
            port: self.port,
            token: self.token.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;

    #[test]
    fn test_agent_hook_server_lifecycle() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async {
            let server = AgentHookServer::start().await.expect("Gagal menjalankan hook server");
            let coords = server.get_coords();
            assert!(coords.port > 0);
            assert!(!coords.token.is_empty());

            let mut rx = server.event_sender.subscribe();

            // 1. Test request tanpa token (harus 401)
            let mut client_unauth = TcpStream::connect(format!("127.0.0.1:{}", coords.port))
                .await
                .expect("Gagal koneksi ke server");
            let req_unauth = "POST /hook/claude HTTP/1.1\r\nHost: localhost\r\n\r\n{}";
            client_unauth.write_all(req_unauth.as_bytes()).await.unwrap();

            let mut resp_buf = [0u8; 1024];
            let n = client_unauth.read(&mut resp_buf).await.unwrap();
            let resp_str = String::from_utf8_lossy(&resp_buf[..n]);
            assert!(resp_str.contains("401 Unauthorized"));

            // 2. Test request dengan token valid (harus 200 dan kirim event)
            let mut client_auth = TcpStream::connect(format!("127.0.0.1:{}", coords.port))
                .await
                .expect("Gagal koneksi ke server");
            let payload = r#"{"paneKey":"tab-1","worktreeId":"wt-auth","hook_event_name":"tool.call","payload":{"tool":"ReadFile"}}"#;
            let req_auth = format!(
                "POST /hook/claude HTTP/1.1\r\nHost: localhost\r\nX-Agentic-Hook-Token: {}\r\nContent-Length: {}\r\n\r\n{}",
                coords.token,
                payload.len(),
                payload
            );
            client_auth.write_all(req_auth.as_bytes()).await.unwrap();

            let n2 = client_auth.read(&mut resp_buf).await.unwrap();
            let resp_str2 = String::from_utf8_lossy(&resp_buf[..n2]);
            assert!(resp_str2.contains("200 OK"));

            // Verifikasi broadcast event diterima
            let received = tokio::time::timeout(Duration::from_secs(2), rx.recv())
                .await
                .expect("Timeout menunggu telemetri")
                .expect("Gagal membaca dari channel");

            assert_eq!(received.agent_name, "claude");
            assert_eq!(received.hook_event_name, "tool.call");
            assert_eq!(received.worktree_id, Some("wt-auth".to_string()));
        });
    }
}
