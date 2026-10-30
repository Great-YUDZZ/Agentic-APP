import urllib.request
import json
import time
import os
import sqlite3
import datetime

ENDPOINT = "http://localhost:20128/v1/chat/completions"
API_KEY = "sk-fba3a2b12de42b58-hg8zfr-fad76d5b"
DB_PATH = "/home/yudz/.local/share/agentic_native_hub/agentic_hub.db"

def call_api(model, messages, timeout=120):
    start = time.time()
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "temperature": 0.7
    }
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
    )
    
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        duration = time.time() - start
        raw_body = resp.read().decode("utf-8")
        
        # Check if SSE stream was returned
        if "data: " in raw_body and not raw_body.strip().startswith("{"):
            accumulated_content = []
            accumulated_reasoning = []
            usage = {}
            for line in raw_body.split("\n"):
                line = line.strip()
                if line.startswith("data: ") and line != "data: [DONE]":
                    try:
                        chunk = json.loads(line[6:])
                        choices = chunk.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            if "content" in delta and delta["content"]:
                                accumulated_content.append(delta["content"])
                            if "reasoning_content" in delta and delta["reasoning_content"]:
                                accumulated_reasoning.append(delta["reasoning_content"])
                        if "usage" in chunk and chunk["usage"]:
                            usage = chunk["usage"]
                    except Exception:
                        pass
            return {
                "status": "success",
                "duration": round(duration, 2),
                "content": "".join(accumulated_content),
                "reasoning": "".join(accumulated_reasoning),
                "usage": usage or {"prompt_tokens": len(str(messages)) // 4, "completion_tokens": len("".join(accumulated_content)) // 4},
                "model_used": model
            }
        else:
            data = json.loads(raw_body)
            choice = data["choices"][0]
            content = choice["message"].get("content", "")
            reasoning = choice["message"].get("reasoning_content", "") or choice["message"].get("reasoning", "")
            usage = data.get("usage", {})
            return {
                "status": "success",
                "duration": round(duration, 2),
                "content": content,
                "reasoning": reasoning,
                "usage": usage,
                "model_used": data.get("model", model)
            }

def save_session_and_messages(session_id, title, mode, model, messages_to_save):
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    now = datetime.datetime.utcnow().isoformat() + "Z"
    
    cur.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
    cur.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
    
    cur.execute(
        "INSERT INTO chat_sessions (id, title, model, provider, created_at, updated_at, mode) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (session_id, title, model, "custom", now, now, mode)
    )
    
    for msg in messages_to_save:
        cur.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, reasoning, token_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (msg["id"], session_id, msg["role"], msg["content"], msg.get("reasoning", ""), msg.get("token_count", 0), now)
        )
    
    con.commit()
    con.close()
    print(f"[DB] Berhasil menyimpan sesi '{session_id}' (Title: '{title}', Mode: '{mode}') dengan {len(messages_to_save)} pesan ke SQLite.")

