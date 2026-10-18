use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteNode {
    pub path: PathBuf,
    pub title: String,
    pub tags: Vec<String>,
    pub links_to: Vec<String>,
    pub content_hash: String,
    pub word_count: usize,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphSnapshot {
    pub nodes: Vec<GraphNodeItem>,
    pub edges: Vec<GraphEdgeItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNodeItem {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub backlink_count: usize,
    pub link_count: usize,
    pub word_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdgeItem {
    pub source: String,
    pub target: String,
}

pub struct VaultGraph {
    pub nodes: HashMap<String, NoteNode>,
    pub backlinks: HashMap<String, HashSet<String>>,
    pub index_version: u64,
}

impl VaultGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            backlinks: HashMap::new(),
            index_version: 1,
        }
    }

    pub fn compute_hash(content: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }

    pub fn parse_note(path: &PathBuf) -> NoteNode {
        let content = std::fs::read_to_string(path).unwrap_or_default();
        let link_re = Regex::new(r"\[\[([^\]\|]+)(?:\|[^\]]+)?\]\]").unwrap();
        let mut links_to = Vec::new();
        for cap in link_re.captures_iter(&content) {
            let target = cap[1].trim().to_string();
            if !target.is_empty() && !links_to.contains(&target) {
                links_to.push(target);
            }
        }

        let title = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Untitled".to_string());

        let content_hash = Self::compute_hash(&content);

        let tag_re = Regex::new(r"(?:^|\s)#([a-zA-Z0-9_\-]+)").unwrap();
        let mut tags = Vec::new();
        for cap in tag_re.captures_iter(&content) {
            let tag = cap[1].to_string();
            if !tags.contains(&tag) {
                tags.push(tag);
            }
        }

        let word_count = content.split_whitespace().count();
        let updated_at = path
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or_else(|| chrono::Utc::now().timestamp());

        NoteNode {
            path: path.clone(),
            title,
            tags,
            links_to,
            content_hash,
            word_count,
            updated_at,
        }
    }

    pub fn upsert_note(&mut self, node: NoteNode) {
        if let Some(old) = self.nodes.get(&node.title) {
            for target in &old.links_to {
                if let Some(set) = self.backlinks.get_mut(target) {
                    set.remove(&node.title);
                }
            }
        }
        for target in &node.links_to {
            self.backlinks
                .entry(target.clone())
                .or_default()
                .insert(node.title.clone());
        }
        self.nodes.insert(node.title.clone(), node);
    }

    pub fn remove_note(&mut self, title: &str) -> Option<NoteNode> {
        if let Some(old) = self.nodes.remove(title) {
            for target in &old.links_to {
                if let Some(set) = self.backlinks.get_mut(target) {
                    set.remove(title);
                }
            }
            self.backlinks.remove(title);
            Some(old)
        } else {
            None
        }
    }

    pub fn get_snapshot(&self) -> GraphSnapshot {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        for (title, node) in &self.nodes {
            let backlink_count = self.backlinks.get(title).map(|s| s.len()).unwrap_or(0);
            nodes.push(GraphNodeItem {
                id: title.clone(),
                title: title.clone(),
                tags: node.tags.clone(),
                backlink_count,
                link_count: node.links_to.len(),
                word_count: node.word_count,
            });

            for target in &node.links_to {
                edges.push(GraphEdgeItem {
                    source: title.clone(),
                    target: target.clone(),
                });
            }
        }

        GraphSnapshot { nodes, edges }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_hash_stability() {
        let text1 = "Hello vault markdown";
        let text2 = "Hello vault markdown";
        let text3 = "Different markdown";

        assert_eq!(VaultGraph::compute_hash(text1), VaultGraph::compute_hash(text2));
        assert_ne!(VaultGraph::compute_hash(text1), VaultGraph::compute_hash(text3));
    }

    #[test]
    fn test_upsert_and_backlinks() {
        let mut graph = VaultGraph::new();

        let node_a = NoteNode {
            path: PathBuf::from("NoteA.md"),
            title: "NoteA".to_string(),
            tags: vec!["architecture".to_string()],
            links_to: vec!["NoteB".to_string(), "NoteC".to_string()],
            content_hash: "hash_a".to_string(),
            word_count: 50,
            updated_at: 1000,
        };

        let node_b = NoteNode {
            path: PathBuf::from("NoteB.md"),
            title: "NoteB".to_string(),
            tags: vec!["database".to_string()],
            links_to: vec!["NoteC".to_string()],
            content_hash: "hash_b".to_string(),
            word_count: 30,
            updated_at: 1000,
        };

        graph.upsert_note(node_a);
        graph.upsert_note(node_b);

        let snapshot = graph.get_snapshot();
        assert_eq!(snapshot.nodes.len(), 2);
        assert_eq!(snapshot.edges.len(), 3);

        // NoteC should have backlinks from both NoteA and NoteB
        let note_c_backlinks = graph.backlinks.get("NoteC").unwrap();
        assert!(note_c_backlinks.contains("NoteA"));
        assert!(note_c_backlinks.contains("NoteB"));
    }
}
