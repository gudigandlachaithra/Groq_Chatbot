# GroqMind - Advanced AI Chatbot

GroqMind is a minimal, high-fidelity AI chatbot powered by the **Groq API** and **LangChain**, utilizing a **FastAPI** Python backend and a premium glassmorphic vanilla HTML/CSS/JavaScript frontend.

## Key Features

1. **Groq-Powered Conversational AI**: Ultrafast completions using Groq's high-speed LLM models.
2. **LangChain-Managed Logic**: Structured prompts, custom personas, and history context feeding.
3. **Real-time Response Streaming**: Dynamic token-by-token text typing on the screen.
4. **Persistent Chat Sessions**: Chat history is persisted in a local JSON database (`chats.json`), meaning you won't lose your messages when restarting the server.
5. **Interactive UI/UX**: Custom styling featuring:
   - Sidebar for chat history with auto-generated titles.
   - Expandable settings menu for API Keys and Model choice (Llama 3.1 70B, Llama 3.1 8B, Mixtral 8x7B, Gemma 2 9B).
   - Dynamic Custom System Prompt editor.
   - Code block syntax layouts with copy-to-clipboard actions.
   - Responsive design (mobile-optimized collapsible sidebar).

---

## Quick Start (Windows)

1. **Obtain your Groq API Key** from the [Groq Console](https://console.groq.com/).
2. **Configure your key**:
   - Option A: Rename `backend/.env` template or open it, and paste your API key next to `GROQ_API_KEY=`.
   - Option B: Launch the app first, and paste your API key directly into the settings panel in the sidebar (saved locally in your browser storage).
3. **Double-click `run.bat`** in the root project folder.
   - It will automatically set up the Python virtual environment, install requirements, and open `http://127.0.0.1:8000` in your web browser.

---

## Technical Details

- **Backend**: FastAPI (Python) serving API endpoints and static assets.
- **AI Chain**: LangChain Core & `langchain-groq` wrapper for LLM streaming integration.
- **Frontend**: HTML5, Vanilla CSS3 (Custom grid, HSL-colors, glassmorphism), JavaScript (Fetch ReadableStream reader for SSE chunk streams, Lucide icons).
