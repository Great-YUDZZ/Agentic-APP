use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::fmt;
use std::process::Command;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct Error(String);

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for Error {}

impl From<String> for Error {
    fn from(s: String) -> Self {
        Error(s)
    }
}

impl From<&str> for Error {
    fn from(s: &str) -> Self {
        Error(s.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StatusCode(pub u16);

impl StatusCode {
    pub fn is_success(&self) -> bool {
        self.0 >= 200 && self.0 < 300
    }

    pub fn as_u16(&self) -> u16 {
        self.0
    }
}

impl fmt::Display for StatusCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Clone)]
pub struct Client {
    timeout: Option<Duration>,
}

pub struct ClientBuilder {
    timeout: Option<Duration>,
}

impl ClientBuilder {
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    pub fn build(self) -> Result<Client> {
        Ok(Client {
            timeout: self.timeout,
        })
    }
}

impl Client {
    pub fn new() -> Self {
        Self { timeout: None }
    }

    pub fn builder() -> ClientBuilder {
        ClientBuilder { timeout: None }
    }

    pub fn get(&self, url: &str) -> RequestBuilder {
        RequestBuilder::new("GET", url, self.timeout)
    }

    pub fn post(&self, url: &str) -> RequestBuilder {
        RequestBuilder::new("POST", url, self.timeout)
    }
}

impl Default for Client {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone)]
pub struct RequestBuilder {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    timeout: Option<Duration>,
}

impl RequestBuilder {
    pub fn new(method: &str, url: &str, timeout: Option<Duration>) -> Self {
        Self {
            method: method.to_string(),
            url: url.to_string(),
            headers: HashMap::new(),
            body: None,
            timeout,
        }
    }

    pub fn header(mut self, key: &str, value: impl Into<String>) -> Self {
        self.headers.insert(key.to_string(), value.into());
        self
    }

    pub fn json(mut self, value: &serde_json::Value) -> Self {
        self.headers.insert("Content-Type".to_string(), "application/json".to_string());
        self.body = Some(value.to_string());
        self
    }

    pub async fn send(self) -> Result<Response> {
        let method = self.method;
        let url = self.url;
        let headers = self.headers;
        let body = self.body;
        let timeout = self.timeout;

        // Run curl in a background thread
        let handle = std::thread::spawn(move || -> Result<Response> {
            let mut cmd = Command::new("curl");
            cmd.arg("-s").arg("-S");

            if let Some(to) = timeout {
                cmd.arg("--max-time").arg(format!("{}", to.as_secs().max(1)));
            }

            cmd.arg("-X").arg(&method);

            for (k, v) in headers {
                cmd.arg("-H").arg(format!("{}: {}", k, v));
            }

            if let Some(b) = body {
                cmd.arg("-d").arg(b);
            }

            cmd.arg("-w").arg("\n__STATUS_CODE__:%{http_code}");
            cmd.arg(&url);

            let output = cmd.output().map_err(|e| Error(format!("Failed to execute curl: {}", e)))?;
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            if !output.status.success() && stdout.is_empty() {
                return Err(Error(format!("curl error: {}", stderr)));
            }

            let (response_body, status_code) = if let Some(idx) = stdout.rfind("\n__STATUS_CODE__:") {
                let body_part = &stdout[..idx];
                let code_part = &stdout[idx + "\n__STATUS_CODE__:".len()..];
                let code: u16 = code_part.trim().parse().unwrap_or(200);
                (body_part.to_string(), StatusCode(code))
            } else {
                (stdout, StatusCode(200))
            };

            Ok(Response {
                status: status_code,
                body: response_body,
            })
        });

        handle.join().map_err(|_| Error("Thread panicked".to_string()))?
    }
}

pub struct Response {
    status: StatusCode,
    body: String,
}

impl Response {
    pub fn status(&self) -> StatusCode {
        self.status
    }

    pub async fn text(self) -> Result<String> {
        Ok(self.body)
    }

    pub async fn json<T: DeserializeOwned>(self) -> Result<T> {
        serde_json::from_str(&self.body)
            .map_err(|e| Error(format!("JSON deserialization failed: {} on '{}'", e, self.body)))
    }
}
