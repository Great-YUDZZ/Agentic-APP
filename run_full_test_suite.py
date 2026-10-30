import os
import sys
import time
import json
import sqlite3
import datetime
from execute_tests import call_api, save_session_and_messages

results = {}

# ==============================================================================
# MODE 1: CHATBOT (Session title: "test")
# ==============================================================================
print("\n" + "="*60)
print("RUNNING TEST MODE 1: CHATBOT (Session: 'test')")
print("="*60)

session_1_id = "session-test-chatbot"
session_1_title = "test"
session_1_mode = "chatbot"
model_mode_1 = "ag/claude-sonnet-4-6"

messages_m1 = []

# Question 1
q1_text = "Halo! Jelaskan secara komparatif perbedaan arsitektur AI monolitik vs multi-agent event-driven dalam pengembangan sistem modern."
print(f"\n[Mode 1 - Q1] Mengirim pertanyaan: '{q1_text}'...")
resp_q1 = call_api(model_mode_1, [{"role": "user", "content": q1_text}])
print(f"[Mode 1 - Q1] Selesai dalam {resp_q1['duration']} detik.")
print(f"[Mode 1 - Q1] Ringkasan respon: {resp_q1['content'][:150]}...\n")

messages_m1.append({
    "id": f"msg-m1-1-{int(time.time()*1000)}",
    "role": "user",
    "content": q1_text,
    "token_count": resp_q1["usage"].get("prompt_tokens", 0)
})
messages_m1.append({
    "id": f"msg-m1-2-{int(time.time()*1000)+1}",
    "role": "assistant",
    "content": resp_q1["content"],
    "reasoning": resp_q1["reasoning"],
    "token_count": resp_q1["usage"].get("completion_tokens", 0)
})

# Question 2
q2_text = "Tuliskan contoh implementasi Tokio async task queue sederhana di Rust menggunakan mpsc channel beserta penjelasan singkatnya."
print(f"[Mode 1 - Q2] Mengirim pertanyaan lanjutan: '{q2_text}'...")
history_q2 = [
    {"role": "user", "content": q1_text},
    {"role": "assistant", "content": resp_q1["content"]},
    {"role": "user", "content": q2_text}
]
resp_q2 = call_api(model_mode_1, history_q2)
print(f"[Mode 1 - Q2] Selesai dalam {resp_q2['duration']} detik.")
print(f"[Mode 1 - Q2] Ringkasan respon: {resp_q2['content'][:150]}...\n")

messages_m1.append({
    "id": f"msg-m1-3-{int(time.time()*1000)+2}",
    "role": "user",
    "content": q2_text,
    "token_count": resp_q2["usage"].get("prompt_tokens", 0)
})
messages_m1.append({
    "id": f"msg-m1-4-{int(time.time()*1000)+3}",
    "role": "assistant",
    "content": resp_q2["content"],
    "reasoning": resp_q2["reasoning"],
    "token_count": resp_q2["usage"].get("completion_tokens", 0)
})

save_session_and_messages(session_1_id, session_1_title, session_1_mode, model_mode_1, messages_m1)
results["mode_1"] = {
    "session_id": session_1_id,
    "title": session_1_title,
    "mode": session_1_mode,
    "model": model_mode_1,
    "q1": {"prompt": q1_text, "latency_sec": resp_q1["duration"], "tokens": resp_q1["usage"]},
    "q2": {"prompt": q2_text, "latency_sec": resp_q2["duration"], "tokens": resp_q2["usage"]}
}

# ==============================================================================
# MODE 2: AGENT (Summarize Markdown Document)
# ==============================================================================
print("\n" + "="*60)
print("RUNNING TEST MODE 2: AGENT (Summarize Markdown File)")
print("="*60)

session_2_id = "session-test-agent"
session_2_title = "Ringkasan Arsitektur Agentic"
session_2_mode = "agent"
model_mode_2 = "ag/gemini-2.5-flash"

with open("/home/yudz/Agentic/arsitektur_agentic.md", "r", encoding="utf-8") as f:
    source_md_content = f.read()

agent_prompt = f"""Anda bertindak sebagai Lead Research Analyst (Agent Spesialis Riset & Analisis Arsitektur).
Tugas Anda: Baca dokumen arsitektur teknis berikut, lakukan analisis mendalam, lalu buatkan ringkasan eksekutif komprehensif dalam format Markdown yang rapi dan profesional.

--- DOKUMEN SUMBER ---
{source_md_content}
-----------------------

Format keluaran Markdown:
1. Executive Summary
2. Komponen Inti & Alur Kerja (Sertakan poin DAG & Tokio)
3. Matriks Keamanan & Mekanisme Sandboxing
4. Rekomendasi Arsitektural untuk Tim Developer
"""

print(f"[Mode 2] Mengirim instruksi ke Agent (model: {model_mode_2})...")
resp_agent = call_api(model_mode_2, [{"role": "user", "content": agent_prompt}])
print(f"[Mode 2] Selesai dalam {resp_agent['duration']} detik.")
print(f"[Mode 2] Ringkasan respon: {resp_agent['content'][:150]}...\n")

summary_file_path = "/home/yudz/Agentic/ringkasan_arsitektur_agentic.md"
with open(summary_file_path, "w", encoding="utf-8") as f:
    f.write(resp_agent["content"])
print(f"[Mode 2] File ringkasan berhasil disimpan ke: {summary_file_path}")

messages_m2 = [
    {
        "id": f"msg-m2-1-{int(time.time()*1000)}",
        "role": "user",
        "content": agent_prompt,
        "token_count": resp_agent["usage"].get("prompt_tokens", 0)
    },
    {
        "id": f"msg-m2-2-{int(time.time()*1000)+1}",
        "role": "assistant",
        "content": resp_agent["content"],
        "reasoning": resp_agent["reasoning"],
        "token_count": resp_agent["usage"].get("completion_tokens", 0)
    }
]

save_session_and_messages(session_2_id, session_2_title, session_2_mode, model_mode_2, messages_m2)
results["mode_2"] = {
    "session_id": session_2_id,
    "title": session_2_title,
    "mode": session_2_mode,
    "model": model_mode_2,
    "file_output": summary_file_path,
    "latency_sec": resp_agent["duration"],
    "tokens": resp_agent["usage"]
}

# ==============================================================================
# MODE 3: BUILD STUDIO (Create Web Landing Page)
# ==============================================================================
print("\n" + "="*60)
print("RUNNING TEST MODE 3: BUILD STUDIO (Web Landing Page Project)")
print("="*60)

session_3_id = "session-test-build"
session_3_title = "Studio Build SaaS Landing Page"
session_3_mode = "build"
model_mode_3 = "ag/claude-sonnet-4-6"

build_prompt = """Sebagai tim insinyur web frontend dan desainer UI/UX senior di Autonomous AI Native Hub Studio:
Buatkan kode lengkap berkas tunggal (Single File HTML5 + Tailwind CSS via CDN) untuk web landing page modern sebuah platform SaaS bernama:
"Autonomous AI Native Hub: Next-Gen Multi-Agent Engineering Platform"

Ketentuan Desain & Fitur:
1. Tema: Flat Dark Design (#0f172a / #18181b / #212121), clean, anti-slop, kontras tajam, border 1px subtle.
2. Section:
   - Navigation Bar (Logo, Nav Links: Features, Architecture, Security, Docs, Launch Studio CTA).
   - Hero Section (Badge "v2.0 Native Hub", Headline berdampak tinggi, Subheadline, Primary CTA Button "Start Free Trial", Secondary CTA "View GitHub Demo", dan mockup visual dashboard mini).
   - Features Grid 3-Kolom (1. DAG Task Decomposition, 2. Secure Tokio PTY Sandbox, 3. Inter-Agent Message Bus).
   - Interactive Architecture Diagram / Terminal Log Preview box.
   - Testimonial / Metrics Section (10x Faster Task Execution, 100% Sandbox Confinement, 0% Vulnerabilities).
   - Footer lengkap dengan copyright dan links.
3. Kualitas Kode:
   - Lengkap tanpa placeholder "...", langsung bisa dibuka di browser.
   - Responsive (mobile-friendly).
   - Sertakan font inter Google Fonts.

Tuliskan seluruh kode HTML lengkap di dalam blok kode ```html ... ```.
"""

print(f"[Mode 3] Mengirim permintaan build landing page ke model {model_mode_3}...")
resp_build = call_api(model_mode_3, [{"role": "user", "content": build_prompt}])
print(f"[Mode 3] Selesai dalam {resp_build['duration']} detik.")

content_build = resp_build["content"]
html_code = ""
if "```html" in content_build:
    parts = content_build.split("```html")
    if len(parts) > 1:
        html_code = parts[1].split("```")[0].strip()
elif "<!DOCTYPE html>" in content_build:
    idx = content_build.find("<!DOCTYPE html>")
    html_code = content_build[idx:].strip()
else:
    html_code = content_build

landing_dir = "/home/yudz/Agentic/landing_page_output"
os.makedirs(landing_dir, exist_ok=True)
landing_file_path = os.path.join(landing_dir, "index.html")

with open(landing_file_path, "w", encoding="utf-8") as f:
    f.write(html_code)
print(f"[Mode 3] File Landing Page berhasil disimpan ke: {landing_file_path} ({len(html_code)} bytes)")

messages_m3 = [
    {
        "id": f"msg-m3-1-{int(time.time()*1000)}",
        "role": "user",
        "content": build_prompt,
        "token_count": resp_build["usage"].get("prompt_tokens", 0)
    },
    {
        "id": f"msg-m3-2-{int(time.time()*1000)+1}",
        "role": "assistant",
        "content": resp_build["content"],
        "reasoning": resp_build["reasoning"],
        "token_count": resp_build["usage"].get("completion_tokens", 0)
    }
]

save_session_and_messages(session_3_id, session_3_title, session_3_mode, model_mode_3, messages_m3)
results["mode_3"] = {
    "session_id": session_3_id,
    "title": session_3_title,
    "mode": session_3_mode,
    "model": model_mode_3,
    "file_output": landing_file_path,
    "file_size_bytes": len(html_code),
    "latency_sec": resp_build["duration"],
    "tokens": resp_build["usage"]
}

with open("/home/yudz/Agentic/test_results_summary.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("\n" + "="*60)
print("SELURUH TEST SUITE SELESAI DENGAN SUKSES!")
print("="*60)
