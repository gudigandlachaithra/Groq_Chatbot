import os
import json
import uuid
import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Header, Body
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Check imports after venv setup (will run inside venv)
try:
    from langchain_groq import ChatGroq
    from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
except ImportError:
    # If not fully installed yet in current context, we'll import inside request
    pass

app = FastAPI(title="Groq LangChain Chatbot API")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
DATA_FILE = os.path.join(BASE_DIR, "chats.json")
PROJECT_DIR = os.path.dirname(BASE_DIR)
FRONTEND_DIR = os.path.join(PROJECT_DIR, "frontend")

# Ensure chats database file exists
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump({}, f)

# Helper Functions for Data Persistence
def load_chats() -> dict:
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_chats(chats: dict):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(chats, f, indent=2, ensure_ascii=False)

# Pydantic Schemas
class ChatCreate(BaseModel):
    title: Optional[str] = "New Chat"
    system_prompt: Optional[str] = "You are a helpful, friendly, and knowledgeable AI assistant."
    model: Optional[str] = None

class MessagePayload(BaseModel):
    chat_id: str
    message: str
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None

# API Endpoints

@app.get("/api/chats")
def get_chats():
    """List all chat sessions metadata (no message content for speed)"""
    chats = load_chats()
    summary = []
    for cid, chat in chats.items():
        summary.append({
            "id": cid,
            "title": chat.get("title", "New Chat"),
            "system_prompt": chat.get("system_prompt", ""),
            "model": chat.get("model", "llama-3.1-70b-versatile"),
            "updated_at": chat.get("updated_at", "")
        })
    # Sort by updated_at descending
    summary.sort(key=lambda x: x["updated_at"], reverse=True)
    return summary

@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: str):
    """Retrieve full details of a specific chat session"""
    chats = load_chats()
    if chat_id not in chats:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return chats[chat_id]

@app.post("/api/chats")
def create_chat(payload: ChatCreate):
    """Create a new chat session"""
    chats = load_chats()
    chat_id = str(uuid.uuid4())
    
    # Resolve default model
    default_model = os.getenv("DEFAULT_MODEL", "llama-3.1-70b-versatile")
    model_to_use = payload.model or default_model
    
    now = datetime.datetime.now().isoformat()
    
    chats[chat_id] = {
        "id": chat_id,
        "title": payload.title,
        "system_prompt": payload.system_prompt,
        "model": model_to_use,
        "messages": [],
        "created_at": now,
        "updated_at": now
    }
    
    save_chats(chats)
    return chats[chat_id]

@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: str):
    """Delete a specific chat session"""
    chats = load_chats()
    if chat_id not in chats:
        raise HTTPException(status_code=404, detail="Chat session not found")
    del chats[chat_id]
    save_chats(chats)
    return {"status": "success", "message": f"Chat {chat_id} deleted"}

@app.post("/api/chat/stream")
def stream_chat(payload: MessagePayload):
    """Stream response from Groq using LangChain"""
    chats = load_chats()
    if payload.chat_id not in chats:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    chat = chats[payload.chat_id]
    
    # 1. Resolve API Key (payload override -> env variable)
    groq_api_key = payload.api_key or os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(
            status_code=400, 
            detail="Groq API Key is missing. Please set it in backend/.env or enter it in the settings panel."
        )
    
    # 2. Resolve Model
    default_model = os.getenv("DEFAULT_MODEL", "llama-3.1-70b-versatile")
    model_name = payload.model or chat.get("model") or default_model
    
    # Update chat metadata if overrides are provided
    if payload.system_prompt is not None:
        chat["system_prompt"] = payload.system_prompt
    if payload.model is not None:
        chat["model"] = payload.model
        
    # Append the new user message
    user_msg = {
        "role": "user",
        "content": payload.message,
        "timestamp": datetime.datetime.now().isoformat()
    }
    chat["messages"].append(user_msg)
    
    # Auto-rename title if it was default "New Chat" and this is the first message
    if chat["title"] == "New Chat" and len(chat["messages"]) <= 1:
        # Create a title from the first 5 words
        words = payload.message.split()
        title = " ".join(words[:5])
        if len(words) > 5:
            title += "..."
        chat["title"] = title
        
    chat["updated_at"] = datetime.datetime.now().isoformat()
    save_chats(chats)
    
    # 3. Construct LangChain messages
    langchain_messages = []
    
    # Custom system prompt
    sys_prompt = chat.get("system_prompt")
    if sys_prompt:
        langchain_messages.append(SystemMessage(content=sys_prompt))
        
    # Previous history
    # Excluding the last user message since it will be appended separately
    for m in chat["messages"][:-1]:
        if m["role"] == "user":
            langchain_messages.append(HumanMessage(content=m["content"]))
        elif m["role"] == "assistant":
            langchain_messages.append(AIMessage(content=m["content"]))
            
    # Add new user message
    langchain_messages.append(HumanMessage(content=payload.message))
    
    # Initialize ChatGroq Model
    try:
        from langchain_groq import ChatGroq
    except ImportError:
        raise HTTPException(
            status_code=500, 
            detail="langchain-groq is not installed or backend setup is incomplete."
        )
        
    try:
        llm = ChatGroq(
            temperature=0.7,
            groq_api_key=groq_api_key,
            model_name=model_name,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize Groq client: {str(e)}")

    # 4. Stream response generator
    async def response_generator():
        full_assistant_response = ""
        try:
            # Yield initial token indicating start
            yield f"data: {json.dumps({'event': 'start', 'model': model_name, 'title': chat['title']})}\n\n"
            
            async for chunk in llm.astream(langchain_messages):
                content = chunk.content
                if content:
                    full_assistant_response += content
                    yield f"data: {json.dumps({'event': 'token', 'text': content})}\n\n"
                    
            # Stream completed successfully, write to storage
            # Reload chats first to avoid race conditions with other operations
            latest_chats = load_chats()
            if payload.chat_id in latest_chats:
                assistant_msg = {
                    "role": "assistant",
                    "content": full_assistant_response,
                    "timestamp": datetime.datetime.now().isoformat()
                }
                latest_chats[payload.chat_id]["messages"].append(assistant_msg)
                latest_chats[payload.chat_id]["updated_at"] = datetime.datetime.now().isoformat()
                # Ensure the title and system prompt are stored as finalized in the generator run
                latest_chats[payload.chat_id]["title"] = chat["title"]
                latest_chats[payload.chat_id]["system_prompt"] = chat["system_prompt"]
                latest_chats[payload.chat_id]["model"] = model_name
                save_chats(latest_chats)
                
            yield f"data: {json.dumps({'event': 'done'})}\n\n"
            
        except Exception as e:
            # Send error details via stream
            yield f"data: {json.dumps({'event': 'error', 'detail': str(e)})}\n\n"

    return StreamingResponse(response_generator(), media_type="text/event-stream")

# Catch-all to serve frontend assets.
# Mount frontend files.
# If files exist, FastAPI will serve index.html for root /, and assets.
# Note: we set html=True so that it serves index.html at root automatically.
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    # Fallback endpoint if frontend directory is created after FastAPI boots
    @app.get("/")
    def read_root():
        return {"status": "backend_running", "message": "Frontend directory not found yet. Please create frontend folder."}
