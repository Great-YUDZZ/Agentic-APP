import os
import json
import time
from execute_tests import call_api, save_session_and_messages

print("Menjalankan Mode 3 dengan ag/gemini-3.8-flash...")
session_3_id = "session-test-build"
session_3_title = "Studio Build SaaS Landing Page"
session_3_mode = "build"
model_mode_3 = "ag/gemini-3.8-flash"

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

resp_build = call_api(model_mode_3, [{"role": "user", "content": build_prompt}], timeout=60)
print(f"Mode 3 selesai dalam {resp_build['duration']}s, panjang konten: {len(resp_build['content'])} karakter.")

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
print(f"File landing page berhasil disimpan ke: {landing_file_path} ({len(html_code)} bytes)")

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

summary_data = {
    "mode_1": {
        "session_id": "session-test-chatbot",
        "title": "test",
        "mode": "chatbot",
        "model": "ag/claude-sonnet-4-6",
        "q1": {
            "prompt": "Halo! Jelaskan secara komparatif perbedaan arsitektur AI monolitik vs multi-agent event-driven dalam pengembangan sistem modern.",
            "latency_sec": 17.49,
            "status": "success"
        },
        "q2": {
            "prompt": "Tuliskan contoh implementasi Tokio async task queue sederhana di Rust menggunakan mpsc channel beserta penjelasan singkatnya.",
            "latency_sec": 12.50,
            "status": "success"
        }
    },
    "mode_2": {
        "session_id": "session-test-agent",
        "title": "Ringkasan Arsitektur Agentic",
        "mode": "agent",
        "model": "ag/gemini-2.5-flash",
        "file_output": "/home/yudz/Agentic/ringkasan_arsitektur_agentic.md",
        "latency_sec": 2.27,
        "status": "success"
    },
    "mode_3": {
        "session_id": session_3_id,
        "title": session_3_title,
        "mode": session_3_mode,
        "model": model_mode_3,
        "file_output": landing_file_path,
        "file_size_bytes": len(html_code),
        "latency_sec": resp_build["duration"],
        "tokens": resp_build["usage"],
        "status": "success"
    }
}

with open("/home/yudz/Agentic/test_results_summary.json", "w", encoding="utf-8") as f:
    json.dump(summary_data, f, indent=2)

print("Seluruh eksekusi Mode 3 dan summary JSON berhasil disimpan!")
