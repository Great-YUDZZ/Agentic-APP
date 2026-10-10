use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessagePayload {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub content: String,
    pub reasoning: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
}

#[allow(async_fn_in_trait)]
pub trait ProviderClient: Send + Sync {
    async fn send_chat(
        &self,
        messages: Vec<ChatMessagePayload>,
        system_prompt: Option<String>,
    ) -> anyhow::Result<ChatResponse>;

    async fn test_connection(&self) -> anyhow::Result<u128>; // returns latency in ms
}

// 1. Google Gemini Provider
pub struct GeminiProvider {
    pub api_key: String,
    pub model: String,
    client: reqwest::Client,
}

impl GeminiProvider {
    pub fn new(api_key: String, model: Option<String>) -> Self {
        Self {
            api_key,
            model: model.unwrap_or_else(|| "gemini-2.5-flash".to_string()),
            client: reqwest::Client::new(),
        }
    }
}

impl ProviderClient for GeminiProvider {
    async fn send_chat(
        &self,
        messages: Vec<ChatMessagePayload>,
        system_prompt: Option<String>,
    ) -> anyhow::Result<ChatResponse> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            self.model, self.api_key
        );

        let contents: Vec<serde_json::Value> = messages
            .into_iter()
            .map(|m| {
                let role = if m.role == "assistant" { "model" } else { "user" };
                serde_json::json!({
                    "role": role,
                    "parts": [{ "text": m.content }]
                })
            })
            .collect();

        let mut body = serde_json::json!({
            "contents": contents
        });

        if let Some(sys) = system_prompt {
            body["systemInstruction"] = serde_json::json!({
                "parts": [{ "text": sys }]
            });
        }

        let res = self.client.post(&url).json(&body).send().await?;
        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("Gemini API Error: {}", err_text));
        }

        let json_val: serde_json::Value = res.json().await?;
        let text = json_val["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let in_tok = json_val["usageMetadata"]["promptTokenCount"].as_i64();
        let out_tok = json_val["usageMetadata"]["candidatesTokenCount"].as_i64();

        Ok(ChatResponse {
            content: text,
            reasoning: None,
            input_tokens: in_tok,
            output_tokens: out_tok,
        })
    }

    async fn test_connection(&self) -> anyhow::Result<u128> {
        let start = std::time::Instant::now();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            self.model, self.api_key
        );
        let body = serde_json::json!({
            "contents": [{ "parts": [{ "text": "ping" }] }]
        });
        let res = self.client.post(&url).json(&body).send().await?;
        if res.status().is_success() {
            Ok(start.elapsed().as_millis())
        } else {
            Err(anyhow::anyhow!("Status code: {}", res.status()))
        }
    }
}

// 2. OpenAI Provider
pub struct OpenAiProvider {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    client: reqwest::Client,
}

impl OpenAiProvider {
    pub fn new(api_key: String, base_url: Option<String>, model: Option<String>) -> Self {
        Self {
            api_key,
            base_url: base_url.unwrap_or_else(|| "https://api.openai.com/v1".to_string()),
            model: model.unwrap_or_else(|| "gpt-4o".to_string()),
            client: reqwest::Client::new(),
        }
    }
}

pub type OpenAiCompatibleProvider = OpenAiProvider;

impl ProviderClient for OpenAiProvider {
    async fn send_chat(
        &self,
        messages: Vec<ChatMessagePayload>,
        system_prompt: Option<String>,
    ) -> anyhow::Result<ChatResponse> {
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));

        let mut formatted_msgs: Vec<serde_json::Value> = Vec::new();
        if let Some(sys) = system_prompt {
            formatted_msgs.push(serde_json::json!({
                "role": "system",
                "content": sys
            }));
        }

        for m in messages {
            formatted_msgs.push(serde_json::json!({
                "role": m.role,
                "content": m.content
            }));
        }

        let body = serde_json::json!({
            "model": self.model,
            "messages": formatted_msgs
        });

        let mut req = self.client.post(&url).json(&body);
        if !self.api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", self.api_key));
        }

        let res = req.send().await?;
        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("OpenAI API Error: {}", err_text));
        }

        let json_val: serde_json::Value = res.json().await?;
        let text = json_val["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let reasoning = json_val["choices"][0]["message"]["reasoning_content"]
            .as_str()
            .map(|s| s.to_string());

        let in_tok = json_val["usage"]["prompt_tokens"].as_i64();
        let out_tok = json_val["usage"]["completion_tokens"].as_i64();

        Ok(ChatResponse {
            content: text,
            reasoning,
            input_tokens: in_tok,
            output_tokens: out_tok,
        })
    }

    async fn test_connection(&self) -> anyhow::Result<u128> {
        let start = std::time::Instant::now();
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        let body = serde_json::json!({
            "model": self.model,
            "messages": [{ "role": "user", "content": "ping" }],
            "max_tokens": 5
        });
        let mut req = self.client.post(&url).json(&body);
        if !self.api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", self.api_key));
        }
        let res = req.send().await?;
        if res.status().is_success() {
            Ok(start.elapsed().as_millis())
        } else {
            Err(anyhow::anyhow!("Status code: {}", res.status()))
        }
    }
}

// 3. Anthropic Claude Provider
pub struct ClaudeProvider {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    client: reqwest::Client,
}

impl ClaudeProvider {
    pub fn new(api_key: String, base_url: Option<String>, model: Option<String>) -> Self {
        Self {
            api_key,
            base_url: base_url.unwrap_or_else(|| "https://api.anthropic.com/v1".to_string()),
            model: model.unwrap_or_else(|| "claude-3-5-sonnet-20241022".to_string()),
            client: reqwest::Client::new(),
        }
    }
}

impl ProviderClient for ClaudeProvider {
    async fn send_chat(
        &self,
        messages: Vec<ChatMessagePayload>,
        system_prompt: Option<String>,
    ) -> anyhow::Result<ChatResponse> {
        let url = format!("{}/messages", self.base_url.trim_end_matches('/'));

        let formatted_msgs: Vec<serde_json::Value> = messages
            .into_iter()
            .map(|m| {
                serde_json::json!({
                    "role": if m.role == "assistant" { "assistant" } else { "user" },
                    "content": m.content
                })
            })
            .collect();

        let mut body = serde_json::json!({
            "model": self.model,
            "max_tokens": 4096,
            "messages": formatted_msgs
        });

        if let Some(sys) = system_prompt {
            body["system"] = serde_json::json!(sys);
        }

        let mut req = self.client.post(&url).json(&body);
        req = req
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01");

        let res = req.send().await?;
        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("Claude API Error: {}", err_text));
        }

        let json_val: serde_json::Value = res.json().await?;
        let text = json_val["content"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let in_tok = json_val["usage"]["input_tokens"].as_i64();
        let out_tok = json_val["usage"]["output_tokens"].as_i64();

        Ok(ChatResponse {
            content: text,
            reasoning: None,
            input_tokens: in_tok,
            output_tokens: out_tok,
        })
    }

    async fn test_connection(&self) -> anyhow::Result<u128> {
        let start = std::time::Instant::now();
        let url = format!("{}/messages", self.base_url.trim_end_matches('/'));
        let body = serde_json::json!({
            "model": self.model,
            "max_tokens": 5,
            "messages": [{ "role": "user", "content": "ping" }]
        });
        let mut req = self.client.post(&url).json(&body);
        req = req
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01");

        let res = req.send().await?;
        if res.status().is_success() {
            Ok(start.elapsed().as_millis())
        } else {
            Err(anyhow::anyhow!("Status code: {}", res.status()))
        }
    }
}

// 4. DeepSeek Provider
pub struct DeepSeekProvider {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    client: reqwest::Client,
}

impl DeepSeekProvider {
    pub fn new(api_key: String, base_url: Option<String>, model: Option<String>) -> Self {
        Self {
            api_key,
            base_url: base_url.unwrap_or_else(|| "https://api.deepseek.com/v1".to_string()),
            model: model.unwrap_or_else(|| "deepseek-chat".to_string()),
            client: reqwest::Client::new(),
        }
    }
}

impl ProviderClient for DeepSeekProvider {
    async fn send_chat(
        &self,
        messages: Vec<ChatMessagePayload>,
        system_prompt: Option<String>,
    ) -> anyhow::Result<ChatResponse> {
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));

        let mut formatted_msgs: Vec<serde_json::Value> = Vec::new();
        if let Some(sys) = system_prompt {
            formatted_msgs.push(serde_json::json!({
                "role": "system",
                "content": sys
            }));
        }

        for m in messages {
            formatted_msgs.push(serde_json::json!({
                "role": m.role,
                "content": m.content
            }));
        }

        let body = serde_json::json!({
            "model": self.model,
            "messages": formatted_msgs
        });

        let mut req = self.client.post(&url).json(&body);
        if !self.api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", self.api_key));
        }

        let res = req.send().await?;
        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("DeepSeek API Error: {}", err_text));
        }

        let json_val: serde_json::Value = res.json().await?;
        let text = json_val["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let reasoning = json_val["choices"][0]["message"]["reasoning_content"]
            .as_str()
            .map(|s| s.to_string());

        let in_tok = json_val["usage"]["prompt_tokens"].as_i64();
        let out_tok = json_val["usage"]["completion_tokens"].as_i64();

        Ok(ChatResponse {
            content: text,
            reasoning,
            input_tokens: in_tok,
            output_tokens: out_tok,
        })
    }

    async fn test_connection(&self) -> anyhow::Result<u128> {
        let start = std::time::Instant::now();
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        let body = serde_json::json!({
            "model": self.model,
            "messages": [{ "role": "user", "content": "ping" }],
            "max_tokens": 5
        });
        let mut req = self.client.post(&url).json(&body);
        if !self.api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", self.api_key));
        }
        let res = req.send().await?;
        if res.status().is_success() {
            Ok(start.elapsed().as_millis())
        } else {
            Err(anyhow::anyhow!("Status code: {}", res.status()))
        }
    }
}

// 5. Ollama Local Provider
pub struct OllamaProvider {
    pub base_url: String,
    pub model: String,
    client: reqwest::Client,
}

impl OllamaProvider {
    pub fn new(base_url: Option<String>, model: Option<String>) -> Self {
        Self {
            base_url: base_url.unwrap_or_else(|| "http://localhost:11434".to_string()),
            model: model.unwrap_or_else(|| "llama3.2".to_string()),
            client: reqwest::Client::new(),
        }
    }
}

impl ProviderClient for OllamaProvider {
    async fn send_chat(
        &self,
        messages: Vec<ChatMessagePayload>,
        system_prompt: Option<String>,
    ) -> anyhow::Result<ChatResponse> {
        let url = format!("{}/api/chat", self.base_url.trim_end_matches('/'));

        let mut formatted_msgs: Vec<serde_json::Value> = Vec::new();
        if let Some(sys) = system_prompt {
            formatted_msgs.push(serde_json::json!({
                "role": "system",
                "content": sys
            }));
        }

        for m in messages {
            formatted_msgs.push(serde_json::json!({
                "role": m.role,
                "content": m.content
            }));
        }

        let body = serde_json::json!({
            "model": self.model,
            "messages": formatted_msgs,
            "stream": false
        });

        let res = self.client.post(&url).json(&body).send().await?;
        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("Ollama API Error: {}", err_text));
        }

        let json_val: serde_json::Value = res.json().await?;
        let text = json_val["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let in_tok = json_val["prompt_eval_count"].as_i64();
        let out_tok = json_val["eval_count"].as_i64();

        Ok(ChatResponse {
            content: text,
            reasoning: None,
            input_tokens: in_tok,
            output_tokens: out_tok,
        })
    }

    async fn test_connection(&self) -> anyhow::Result<u128> {
        let start = std::time::Instant::now();
        let url = format!("{}/api/version", self.base_url.trim_end_matches('/'));
        let res = self.client.get(&url).send().await?;
        if res.status().is_success() {
            Ok(start.elapsed().as_millis())
        } else {
            Err(anyhow::anyhow!("Status code: {}", res.status()))
        }
    }
}
