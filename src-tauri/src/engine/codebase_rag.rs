use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChunk {
    pub file_path: String,
    pub relative_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub content: String,
    pub symbols: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChunkMatch {
    pub file_path: String,
    pub relative_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub content: String,
    pub score: f32,
    pub matched_terms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextSearchMatch {
    pub relative_path: String,
    pub file_name: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

const EXCLUDED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".trash",
    ".gemini",
    "coverage",
    "venv",
    ".venv",
    "__pycache__",
    ".idea",
    ".vscode",
    ".next",
    ".turbo",
];

const ALLOWED_EXTENSIONS: &[&str] = &[
    "rs", "ts", "tsx", "js", "jsx", "py", "go", "c", "cpp", "cc", "h", "hpp", "cs", "java", "kt",
    "rb", "php", "sh", "bash", "sql", "html", "css", "scss", "json", "yaml", "yml", "toml", "md",
];

/// Memeriksa apakah suatu folder harus diabaikan dalam pemindaian
pub fn should_skip_dir(dir_name: &str) -> bool {
    EXCLUDED_DIRS.contains(&dir_name)
}

/// Memeriksa apakah ekstensi berkas didukung untuk pengindeksan kode
pub fn is_supported_code_file(path: &Path) -> bool {
    if let Some(ext) = path.extension() {
        let ext_str = ext.to_string_lossy().to_lowercase();
        ALLOWED_EXTENSIONS.contains(&ext_str.as_str())
    } else {
        false
    }
}

/// Tokenizer sederhana untuk mengekstrak kata kunci huruf dan angka
pub fn tokenize(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();

    for ch in text.chars() {
        if ch.is_alphanumeric() || ch == '_' {
            current.push(ch.to_ascii_lowercase());
        } else if !current.is_empty() {
            if current.len() >= 2 {
                tokens.push(current.clone());
            }
            current.clear();
        }
    }
    if current.len() >= 2 {
        tokens.push(current);
    }
    tokens
}

/// Ekstrak simbol deklarasi sederhana dari baris kode (fn, function, class, struct, def, interface, type)
pub fn extract_symbols(lines: &[&str]) -> Vec<String> {
    let mut symbols = Vec::new();
    let keywords = [
        "fn ", "pub fn ", "function ", "class ", "struct ", "def ", "interface ", "type ",
        "export const ", "export function ", "export class ", "export interface ", "export type ",
    ];

    for line in lines {
        let trimmed = line.trim();
        for kw in &keywords {
            if trimmed.starts_with(kw) {
                let remainder = &trimmed[kw.len()..];
                let sym: String = remainder
                    .chars()
                    .take_while(|c| c.is_alphanumeric() || *c == '_')
                    .collect();
                if !sym.is_empty() {
                    symbols.push(sym.to_lowercase());
                }
            }
        }
    }
    symbols
}

/// Memecah konten berkas teks menjadi potongan-potongan chunk kode yang tumpang tindih (overlap)
pub fn chunk_file_content(file_path: &Path, workspace_root: &Path, content: &str) -> Vec<CodeChunk> {
    let mut chunks = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return chunks;
    }

    let rel_path = file_path
        .strip_prefix(workspace_root)
        .unwrap_or(file_path)
        .to_string_lossy()
        .to_string();

    let chunk_size = 40;
    let overlap = 10;
    let total_lines = lines.len();

    let mut start = 0;
    while start < total_lines {
        let end = (start + chunk_size).min(total_lines);
        let chunk_lines = &lines[start..end];
        let chunk_text = chunk_lines.join("\n");
        let symbols = extract_symbols(chunk_lines);

        chunks.push(CodeChunk {
            file_path: file_path.to_string_lossy().to_string(),
            relative_path: rel_path.clone(),
            start_line: start + 1,
            end_line: end,
            content: chunk_text,
            symbols,
        });

        if end == total_lines {
            break;
        }
        start += chunk_size - overlap;
    }

    chunks
}

/// Memindai direktori workspace secara rekursif dan menghasilkan daftar chunk kode
pub fn scan_workspace_chunks(workspace_root: &Path, max_total_chunks: usize) -> Vec<CodeChunk> {
    let mut chunks = Vec::new();
    let mut stack = vec![workspace_root.to_path_buf()];

    while let Some(current_dir) = stack.pop() {
        let entries = match fs::read_dir(&current_dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            if path.is_dir() {
                if !should_skip_dir(&file_name) {
                    stack.push(path);
                }
            } else if path.is_file() && is_supported_code_file(&path) {
                // Hindari membaca berkas yang terlalu besar (> 1 MB)
                if let Ok(meta) = fs::metadata(&path) {
                    if meta.len() > 1024 * 1024 {
                        continue;
                    }
                }

                if let Ok(content) = fs::read_to_string(&path) {
                    let file_chunks = chunk_file_content(&path, workspace_root, &content);
                    chunks.extend(file_chunks);
                    if chunks.len() >= max_total_chunks {
                        return chunks;
                    }
                }
            }
        }
    }

    chunks
}

/// Menghitung skor kemiripan BM25 + TF-IDF dan Symbol Lexical antara query dan koleksi chunk kode
pub fn search_chunks(query: &str, chunks: &[CodeChunk], top_k: usize) -> Vec<CodeChunkMatch> {
    let query_tokens = tokenize(query);
    if query_tokens.is_empty() || chunks.is_empty() {
        return Vec::new();
    }

    let n = chunks.len() as f32;
    // Hitung Document Frequency (DF) untuk setiap token query
    let mut df: HashMap<String, usize> = HashMap::new();
    for token in &query_tokens {
        let count = chunks
            .iter()
            .filter(|c| {
                let lower_content = c.content.to_lowercase();
                let lower_path = c.relative_path.to_lowercase();
                lower_content.contains(token) || lower_path.contains(token)
            })
            .count();
        df.insert(token.clone(), count);
    }

    // Parameter standar BM25
    let k1 = 1.2f32;
    let b = 0.75f32;

    let avg_len: f32 = chunks
        .iter()
        .map(|c| c.content.len() as f32)
        .sum::<f32>()
        / n;

    let mut scored: Vec<CodeChunkMatch> = Vec::new();

    for chunk in chunks {
        let lower_content = chunk.content.to_lowercase();
        let lower_path = chunk.relative_path.to_lowercase();
        let chunk_len = chunk.content.len() as f32;

        let mut total_score = 0.0f32;
        let mut matched = Vec::new();

        for token in &query_tokens {
            let doc_freq = *df.get(token).unwrap_or(&0) as f32;
            if doc_freq == 0.0 {
                continue;
            }

            // Hitung frekuensi kemunculan token di chunk
            let tf = lower_content.matches(token).count() as f32;
            let path_matches = lower_path.contains(token);
            let symbol_matches = chunk.symbols.iter().any(|s| s.contains(token));

            if tf > 0.0 || path_matches || symbol_matches {
                matched.push(token.clone());

                // IDF calculation
                let idf = ((n - doc_freq + 0.5) / (doc_freq + 0.5) + 1.0).ln();

                // BM25 term score
                let tf_norm = (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * (chunk_len / avg_len.max(1.0))));
                let mut term_score = idf * tf_norm;

                // Bobot tambahan jika nama file atau jalur folder cocok
                if path_matches {
                    term_score += idf * 2.5;
                }

                // Bobot tambahan jika simbol nama fungsi / kelas cocok
                if symbol_matches {
                    term_score += idf * 2.0;
                }

                total_score += term_score;
            }
        }

        if total_score > 0.0 && !matched.is_empty() {
            scored.push(CodeChunkMatch {
                file_path: chunk.file_path.clone(),
                relative_path: chunk.relative_path.clone(),
                start_line: chunk.start_line,
                end_line: chunk.end_line,
                content: chunk.content.clone(),
                score: total_score,
                matched_terms: matched,
            });
        }
    }

    // Urutkan berdasarkan skor tertinggi
    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);
    scored
}

/// Pencarian teks global di seluruh berkas kode proyek
pub fn search_workspace_text_files(
    workspace_root: &Path,
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
    max_results: usize,
) -> Vec<TextSearchMatch> {
    if query.trim().is_empty() || !workspace_root.exists() {
        return Vec::new();
    }

    let mut matches = Vec::new();
    let query_lower = query.to_lowercase();

    let is_whole_word_boundary = |line: &str, start: usize, end: usize| -> bool {
        let before_ok = if start == 0 {
            true
        } else {
            let prev_char = line[..start].chars().last().unwrap_or(' ');
            !prev_char.is_alphanumeric() && prev_char != '_'
        };
        let after_ok = if end >= line.len() {
            true
        } else {
            let next_char = line[end..].chars().next().unwrap_or(' ');
            !next_char.is_alphanumeric() && next_char != '_'
        };
        before_ok && after_ok
    };

    let mut stack = vec![workspace_root.to_path_buf()];

    while let Some(current_dir) = stack.pop() {
        if matches.len() >= max_results {
            break;
        }

        let entries = match fs::read_dir(&current_dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            if matches.len() >= max_results {
                break;
            }

            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if path.is_dir() {
                if !should_skip_dir(&file_name) && !file_name.starts_with('.') {
                    stack.push(path);
                }
            } else if path.is_file() {
                if !is_supported_code_file(&path) {
                    continue;
                }

                if let Ok(metadata) = entry.metadata() {
                    if metadata.len() > 2 * 1024 * 1024 {
                        continue;
                    }
                }

                let relative_path = path
                    .strip_prefix(workspace_root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");

                let content = match fs::read_to_string(&path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                for (idx, line) in content.lines().enumerate() {
                    if matches.len() >= max_results {
                        break;
                    }

                    let line_number = idx + 1;
                    if case_sensitive {
                        let mut search_from = 0;
                        while let Some(found_idx) = line[search_from..].find(query) {
                            let match_start = search_from + found_idx;
                            let match_end = match_start + query.len();
                            search_from = match_end;

                            if whole_word && !is_whole_word_boundary(line, match_start, match_end) {
                                continue;
                            }

                            matches.push(TextSearchMatch {
                                relative_path: relative_path.clone(),
                                file_name: file_name.clone(),
                                line_number,
                                line_content: line.trim_end().to_string(),
                                match_start,
                                match_end,
                            });

                            if matches.len() >= max_results {
                                break;
                            }
                        }
                    } else {
                        let line_lower = line.to_lowercase();
                        let mut search_from = 0;
                        while let Some(found_idx) = line_lower[search_from..].find(&query_lower) {
                            let match_start = search_from + found_idx;
                            let match_end = match_start + query.len();
                            search_from = match_end;

                            if whole_word && !is_whole_word_boundary(line, match_start, match_end) {
                                continue;
                            }

                            matches.push(TextSearchMatch {
                                relative_path: relative_path.clone(),
                                file_name: file_name.clone(),
                                line_number,
                                line_content: line.trim_end().to_string(),
                                match_start,
                                match_end,
                            });

                            if matches.len() >= max_results {
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    matches
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_basic() {
        let tokens = tokenize("get_user_account(id: 123) -> Option<User>");
        assert!(tokens.contains(&"get_user_account".to_string()));
        assert!(tokens.contains(&"id".to_string()));
        assert!(tokens.contains(&"option".to_string()));
        assert!(tokens.contains(&"user".to_string()));
    }

    #[test]
    fn test_extract_symbols() {
        let lines = vec![
            "pub fn calculate_balance(user_id: u64) -> i64 {",
            "    let x = 10;",
            "    x",
            "}",
            "struct UserProfile {",
            "    name: String,",
            "}",
        ];
        let symbols = extract_symbols(&lines);
        assert!(symbols.contains(&"calculate_balance".to_string()));
        assert!(symbols.contains(&"userprofile".to_string()));
    }

    #[test]
    fn test_chunk_file_content() {
        let content = (1..=100)
            .map(|i| format!("line {}", i))
            .collect::<Vec<_>>()
            .join("\n");
        let path = Path::new("/workspace/test.rs");
        let ws = Path::new("/workspace");

        let chunks = chunk_file_content(path, ws, &content);
        assert!(!chunks.is_empty());
        assert_eq!(chunks[0].start_line, 1);
        assert_eq!(chunks[0].end_line, 40);
        assert_eq!(chunks[0].relative_path, "test.rs");
    }

    #[test]
    fn test_search_chunks_bm25_scoring() {
        let _ws = Path::new("/project");
        let chunks = vec![
            CodeChunk {
                file_path: "/project/src/auth.rs".to_string(),
                relative_path: "src/auth.rs".to_string(),
                start_line: 1,
                end_line: 10,
                content: "pub fn authenticate_token(token: &str) -> bool { true }".to_string(),
                symbols: vec!["authenticate_token".to_string()],
            },
            CodeChunk {
                file_path: "/project/src/db.rs".to_string(),
                relative_path: "src/db.rs".to_string(),
                start_line: 1,
                end_line: 10,
                content: "pub fn connect_database(url: &str) { }".to_string(),
                symbols: vec!["connect_database".to_string()],
            },
        ];

        let results = search_chunks("authenticate token auth", &chunks, 5);
        assert!(!results.is_empty());
        assert_eq!(results[0].relative_path, "src/auth.rs");
        assert!(results[0].score > 0.0);
    }

    #[test]
    fn test_search_workspace_text_files() {
        let temp_dir = std::env::temp_dir().join("agentic_test_search_ws");
        let _ = fs::create_dir_all(&temp_dir);
        let file1 = temp_dir.join("main.rs");
        let file2 = temp_dir.join("helper.ts");

        let _ = fs::write(&file1, "fn main() {\n    let agent_name = \"Antigravity\";\n    println!(\"{}\", agent_name);\n}\n");
        let _ = fs::write(&file2, "export const agent_name = 'Antigravity';\n");

        let results = search_workspace_text_files(&temp_dir, "agent_name", true, true, 10);
        assert_eq!(results.len(), 3);

        let whole_word_test = search_workspace_text_files(&temp_dir, "agent", true, true, 10);
        assert_eq!(whole_word_test.len(), 0);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
