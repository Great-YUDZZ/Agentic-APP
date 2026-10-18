use std::sync::RwLock;
use serde::{Deserialize, Serialize};

use super::graph::VaultGraph;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoredSearchResult {
    pub title: String,
    pub path: String,
    pub snippet: String,
    pub score: f32,
    pub match_type: String,
    pub tags: Vec<String>,
}

pub fn search_notes_hybrid(
    graph: &RwLock<VaultGraph>,
    query: &str,
    limit: usize,
) -> Vec<ScoredSearchResult> {
    let query_trim = query.trim().to_lowercase();
    if query_trim.is_empty() {
        return Vec::new();
    }

    let g = graph.read().unwrap();
    let terms: Vec<&str> = query_trim.split_whitespace().collect();

    let mut results: Vec<ScoredSearchResult> = Vec::new();

    for (title, node) in &g.nodes {
        let content = std::fs::read_to_string(&node.path).unwrap_or_default();
        let content_lower = content.to_lowercase();
        let title_lower = title.to_lowercase();

        let mut score: f32 = 0.0;
        let mut snippet = String::new();

        // Title score
        for term in &terms {
            if title_lower == *term {
                score += 10.0;
            } else if title_lower.contains(term) {
                score += 5.0;
            }
        }

        // Tag score
        for tag in &node.tags {
            let tag_lower = tag.to_lowercase();
            for term in &terms {
                if tag_lower == *term {
                    score += 4.0;
                } else if tag_lower.contains(term) {
                    score += 2.0;
                }
            }
        }

        // Body content score & snippet extraction
        for term in &terms {
            let count = content_lower.matches(term).count();
            if count > 0 {
                score += (count as f32).min(10.0) * 1.0;

                if snippet.is_empty() {
                    if let Some(pos) = content_lower.find(term) {
                        let start = pos.saturating_sub(40);
                        let end = (pos + term.len() + 80).min(content.len());
                        snippet = format!("...{}...", &content[start..end].replace('\n', " "));
                    }
                }
            }
        }

        // Backlink prestige boost (popular notes get a slight relevance boost)
        let backlink_count = g.backlinks.get(title).map(|s| s.len()).unwrap_or(0);
        score += (backlink_count as f32 * 0.2).min(2.0);

        if score > 0.0 {
            if snippet.is_empty() {
                let first_line = content.lines().next().unwrap_or("").trim();
                snippet = first_line.chars().take(100).collect();
            }

            results.push(ScoredSearchResult {
                title: title.clone(),
                path: node.path.to_string_lossy().to_string(),
                snippet,
                score,
                match_type: "hybrid_bm25".to_string(),
                tags: node.tags.clone(),
            });
        }
    }

    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    if results.len() > limit {
        results.truncate(limit);
    }

    results
}
