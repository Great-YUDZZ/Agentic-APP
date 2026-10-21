use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

/// Membersihkan tag HTML dan unescape entitas teks HTML umum
pub fn clean_html_text(input: &str) -> String {
    // 1. Buang komentar HTML
    let re_comment = Regex::new(r"(?s)<!--.*?-->").unwrap();
    let text = re_comment.replace_all(input, "");

    // 2. Buang tag skrip, stylesheet, navigasi, header, footer, svg, dan noscript
    let re_scripts = Regex::new(r"(?is)<(script|style|nav|header|footer|svg|noscript)[^>]*>.*?</(script|style|nav|header|footer|svg|noscript)>").unwrap();
    let text = re_scripts.replace_all(&text, " ");

    // 3. Ubah tag pemisah paragraf, list, dan heading menjadi baris baru
    let re_blocks = Regex::new(r"(?i)<(p|div|h[1-6]|li|tr|article|section)[^>]*>").unwrap();
    let text = re_blocks.replace_all(&text, "\n");

    let re_br = Regex::new(r"(?i)<br\s*/?>").unwrap();
    let text = re_br.replace_all(&text, "\n");

    // 4. Buang seluruh tag HTML yang tersisa
    let re_tags = Regex::new(r"<[^>]+>").unwrap();
    let text = re_tags.replace_all(&text, " ");

    // 5. Unescape entitas HTML umum
    let text = text
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&#039;", "'")
        .replace("&#183;", "·")
        .replace("&ndash;", "-")
        .replace("&mdash;", "-");

    // 6. Kompresi spasi dan baris kosong
    let re_spaces = Regex::new(r"[ \t]+").unwrap();
    let text = re_spaces.replace_all(&text, " ");

    let re_newlines = Regex::new(r"\n\s*\n\s*\n+").unwrap();
    let text = re_newlines.replace_all(&text, "\n\n");

    text.trim().to_string()
}

/// Decode URL yang dibungkus Bing redirection (&u=a1<BASE64_URL>&)
pub fn decode_bing_url(raw_href: &str) -> Option<String> {
    if let Some(pos) = raw_href.find("&u=a1") {
        let remainder = &raw_href[pos + 5..];
        let end_pos = remainder.find('&').unwrap_or(remainder.len());
        let base64_str = &remainder[..end_pos];

        // Normalisasi base64 padding jika diperlukan
        let mut padded = base64_str.to_string();
        while padded.len() % 4 != 0 {
            padded.push('=');
        }

        // Decode menggunakan base64 manual sederhana atau bytes
        if let Ok(decoded_bytes) = decode_base64_url(&padded) {
            if let Ok(decoded_url) = String::from_utf8(decoded_bytes) {
                if decoded_url.starts_with("http://") || decoded_url.starts_with("https://") {
                    return Some(decoded_url);
                }
            }
        }
    }
    None
}

/// Dekoder Base64 standar tanpa dependensi tambahan
fn decode_base64_url(input: &str) -> Result<Vec<u8>, ()> {
    let mut buffer: u32 = 0;
    let mut bits_collected = 0;
    let mut output = Vec::new();

    for c in input.chars() {
        if c == '=' {
            break;
        }
        let val = match c {
            'A'..='Z' => c as u32 - 'A' as u32,
            'a'..='z' => c as u32 - 'a' as u32 + 26,
            '0'..='9' => c as u32 - '0' as u32 + 52,
            '+' | '-' => 62,
            '/' | '_' => 63,
            _ => continue,
        };

        buffer = (buffer << 6) | val;
        bits_collected += 6;

        if bits_collected >= 8 {
            bits_collected -= 8;
            let byte = ((buffer >> bits_collected) & 0xFF) as u8;
            output.push(byte);
        }
    }

    Ok(output)
}

/// Melakukan pencarian kata kunci ke internet via Bing SERP dengan User-Agent modern
pub async fn search_web(query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| format!("Gagal menginisialisasi HTTP client: {}", e))?;

    let encoded_query = urlencoding_simple(query);
    let search_url = format!("https://www.bing.com/search?q={}", encoded_query);

    let res = client
        .get(&search_url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .header("Accept-Language", "en-US,en;q=0.9,id;q=0.8")
        .send()
        .await
        .map_err(|e| format!("Gagal menghubungi mesin pencari: {}", e))?;

    let html = res
        .text()
        .await
        .map_err(|e| format!("Gagal membaca hasil pencarian: {}", e))?;

    let mut results = Vec::new();

    // Regex untuk memecah blok <li class="b_algo"
    let re_algo = Regex::new(r#"(?s)<li class="b_algo".*?</li>"#).unwrap();
    let re_h2_link = Regex::new(r#"(?s)<h2><a[^>]+href="([^"]+)"[^>]*>(.*?)</a></h2>"#).unwrap();
    let re_caption = Regex::new(r#"(?s)<div class="b_caption"><p[^>]*>(.*?)</p>"#).unwrap();

    for cap in re_algo.find_iter(&html) {
        if results.len() >= limit {
            break;
        }
        let block = cap.as_str();

        if let Some(h2_cap) = re_h2_link.captures(block) {
            let raw_href = h2_cap.get(1).map(|m| m.as_str()).unwrap_or("");
            let raw_title = h2_cap.get(2).map(|m| m.as_str()).unwrap_or("");

            // Ekstrak URL asli via decode_bing_url atau gunakan raw jika sudah absolut
            let final_url = decode_bing_url(raw_href).unwrap_or_else(|| {
                if raw_href.starts_with("http") {
                    raw_href.to_string()
                } else {
                    format!("https://www.bing.com{}", raw_href)
                }
            });

            let clean_title = clean_html_text(raw_title);

            let clean_snippet = if let Some(cap_cap) = re_caption.captures(block) {
                let raw_snippet = cap_cap.get(1).map(|m| m.as_str()).unwrap_or("");
                clean_html_text(raw_snippet)
            } else {
                String::new()
            };

            if !clean_title.is_empty() && !final_url.is_empty() {
                results.push(SearchResult {
                    title: clean_title,
                    url: final_url,
                    snippet: clean_snippet,
                });
            }
        }
    }

    Ok(results)
}

/// Mengambil konten teks dari URL target dalam Mode Reader (membuang noise dan membatasi ukuran)
pub async fn fetch_and_clean_page(url: &str, max_chars: usize) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| format!("Gagal membuat HTTP client untuk peramban: {}", e))?;

    let res = client
        .get(url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .send()
        .await
        .map_err(|e| format!("Gagal memuat halaman {}: {}", url, e))?;

    let raw_html = res
        .text()
        .await
        .map_err(|e| format!("Gagal membaca data dari {}: {}", url, e))?;

    let cleaned = clean_html_text(&raw_html);

    if cleaned.len() > max_chars {
        let truncated = format!(
            "{}...\n\n[Konten dipotong pada {} karakter untuk efisiensi token]",
            &cleaned[..max_chars],
            max_chars
        );
        Ok(truncated)
    } else {
        Ok(cleaned)
    }
}

/// Menggabungkan pencarian kata kunci dan pembacaan konten halaman teratas sekaligus (All-in-One)
pub async fn execute_all_in_one_search(
    query: &str,
    max_chars: Option<usize>,
) -> Result<String, String> {
    let query_clean = query.trim();
    if query_clean.is_empty() {
        return Err("Kata kunci pencarian tidak boleh kosong".to_string());
    }

    let search_results = search_web(query_clean, 4).await?;
    if search_results.is_empty() {
        return Ok(format!(
            "Tidak ditemukan hasil pencarian di internet untuk kata kunci: \"{}\"",
            query_clean
        ));
    }

    let mut output = String::new();
    output.push_str(&format!("### Hasil Pencarian Web: \"{}\"\n\n", query_clean));
    output.push_str("**Sumber Rujukan Terkait:**\n");

    for (idx, item) in search_results.iter().enumerate() {
        output.push_str(&format!(
            "{}. [{}]({})\n   {}\n",
            idx + 1,
            item.title,
            item.url,
            item.snippet
        ));
    }

    // Ambil halaman teratas yang valid untuk dibaca konten lengkapnya
    let top_result = search_results
        .iter()
        .find(|r| r.url.starts_with("http://") || r.url.starts_with("https://"));

    if let Some(top) = top_result {
        output.push_str("\n---\n\n");
        output.push_str(&format!(
            "### Konten Halaman Teratas: [{}]({})\n\n",
            top.title, top.url
        ));

        let limit = max_chars.unwrap_or(4000);
        match fetch_and_clean_page(&top.url, limit).await {
            Ok(content) => {
                if content.trim().is_empty() {
                    output.push_str("*(Halaman berhasil dimuat tetapi tidak mengandung teks utama yang dapat diekstraksi)*\n");
                } else {
                    output.push_str(&content);
                    output.push('\n');
                }
            }
            Err(e) => {
                output.push_str(&format!("*(Catatan: Gagal membaca konten halaman teratas: {})*\n", e));
            }
        }
    }

    Ok(output)
}

/// Utilitas sederhana pengganti urlencoding tanpa library ekstra
fn urlencoding_simple(input: &str) -> String {
    let mut encoded = String::new();
    for b in input.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            b' ' => {
                encoded.push('+');
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", b));
            }
        }
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_html_text() {
        let sample = "<html><head><script>alert(1)</script><style>body{color:red}</style></head><body><h1>Title Here</h1><p>This is a paragraph with &amp; entity.</p></body></html>";
        let cleaned = clean_html_text(sample);
        assert!(cleaned.contains("Title Here"));
        assert!(cleaned.contains("This is a paragraph with & entity."));
        assert!(!cleaned.contains("alert(1)"));
        assert!(!cleaned.contains("color:red"));
    }

    #[test]
    fn test_decode_bing_url() {
        let sample_href = "https://www.bing.com/ck/a?!&&p=abc&u=a1aHR0cHM6Ly92Mi50YXVyaS5hcHAv&ntb=1";
        let decoded = decode_bing_url(sample_href);
        assert_eq!(decoded, Some("https://v2.tauri.app/".to_string()));
    }

    #[test]
    fn test_live_web_search_and_extract() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let res = rt.block_on(execute_all_in_one_search("rust programming language", Some(1000)));
        assert!(res.is_ok(), "Search should succeed");
        let content = res.unwrap();
        assert!(content.contains("Hasil Pencarian Web"));
        assert!(content.contains("http"));
    }
}
