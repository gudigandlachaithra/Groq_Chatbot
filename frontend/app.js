document.addEventListener("DOMContentLoaded", () => {
    // Application State
    let state = {
        chats: [],
        currentChatId: null,
        isStreaming: false,
        systemPrompt: "You are a helpful, friendly, and knowledgeable AI assistant.",
        defaultSystemPrompt: "You are a helpful, friendly, and knowledgeable AI assistant.",
        apiKey: localStorage.getItem("groq_api_key") || "",
        selectedModel: localStorage.getItem("groq_model") || "llama-3.1-70b-versatile"
    };

    // DOM Elements
    const sidebar = document.getElementById("sidebar");
    const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
    const mobileCloseBtn = document.getElementById("mobileCloseBtn");
    const newChatBtn = document.getElementById("newChatBtn");
    const historyList = document.getElementById("historyList");
    
    const apiKeyInput = document.getElementById("apiKeyInput");
    const apiKeyToggle = document.getElementById("apiKeyToggle");
    const modelSelect = document.getElementById("modelSelect");
    
    const activeChatTitle = document.getElementById("activeChatTitle");
    const activeModelBadge = document.getElementById("activeModelBadge");
    const clearChatBtn = document.getElementById("clearChatBtn");
    
    const systemPromptToggleBtn = document.getElementById("systemPromptToggleBtn");
    const systemPromptPanel = document.getElementById("systemPromptPanel");
    const systemPromptCloseBtn = document.getElementById("systemPromptCloseBtn");
    const systemPromptInput = document.getElementById("systemPromptInput");
    const saveSystemPromptBtn = document.getElementById("saveSystemPromptBtn");
    const resetSystemPromptBtn = document.getElementById("resetSystemPromptBtn");
    
    const messagesContainer = document.getElementById("messagesContainer");
    const welcomeContainer = document.getElementById("welcomeContainer");
    const chatForm = document.getElementById("chatForm");
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");

    // --- INITIALIZATION ---
    function init() {
        // Load API key and model selection into UI
        apiKeyInput.value = state.apiKey;
        modelSelect.value = state.selectedModel;
        systemPromptInput.value = state.systemPrompt;
        
        // Load Chats
        loadChatsList();
        
        // Setup Event Listeners
        setupEventListeners();
        
        // Refresh icons
        lucide.createIcons();
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // Sidebar Toggles (Mobile & Desktop)
        sidebarToggleBtn.addEventListener("click", () => sidebar.classList.add("open"));
        mobileCloseBtn.addEventListener("click", () => sidebar.classList.remove("open"));
        
        // Create new chat
        newChatBtn.addEventListener("click", () => createNewChat());
        
        // API Key Inputs
        apiKeyInput.addEventListener("input", (e) => {
            state.apiKey = e.target.value;
            localStorage.setItem("groq_api_key", state.apiKey);
        });
        
        apiKeyToggle.addEventListener("click", (e) => {
            e.preventDefault();
            const isPassword = apiKeyInput.type === "password";
            apiKeyInput.type = isPassword ? "text" : "password";
            const icon = isPassword ? "eye-off" : "eye";
            apiKeyToggle.innerHTML = `<i data-lucide="${icon}"></i>`;
            lucide.createIcons();
        });
        
        // Model Selection
        modelSelect.addEventListener("change", (e) => {
            state.selectedModel = e.target.value;
            localStorage.setItem("groq_model", state.selectedModel);
            updateModelBadge();
            if (state.currentChatId) {
                // Keep the backend model synchronized
                updateChatSettings();
            }
        });
        
        // System Prompt Panel Toggles
        systemPromptToggleBtn.addEventListener("click", () => {
            systemPromptPanel.classList.toggle("open");
        });
        
        systemPromptCloseBtn.addEventListener("click", () => {
            systemPromptPanel.classList.remove("open");
        });
        
        saveSystemPromptBtn.addEventListener("click", () => {
            state.systemPrompt = systemPromptInput.value.trim() || state.defaultSystemPrompt;
            systemPromptPanel.classList.remove("open");
            showToast("System prompt updated!");
            updateChatSettings();
        });
        
        resetSystemPromptBtn.addEventListener("click", () => {
            systemPromptInput.value = state.defaultSystemPrompt;
            state.systemPrompt = state.defaultSystemPrompt;
            showToast("System prompt reset to default.");
            updateChatSettings();
        });
        
        // Textarea auto-sizing & submission
        messageInput.addEventListener("input", () => {
            messageInput.style.height = "auto";
            messageInput.style.height = (messageInput.scrollHeight - 16) + "px";
            
            // Enable/disable send button
            const hasText = messageInput.value.trim().length > 0;
            sendBtn.disabled = !hasText || state.isStreaming;
            if (hasText && !state.isStreaming) {
                sendBtn.classList.add("active");
            } else {
                sendBtn.classList.remove("active");
            }
        });
        
        messageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chatForm.requestSubmit();
            }
        });
        
        // Chat Form Submit
        chatForm.addEventListener("submit", (e) => {
            e.preventDefault();
            sendMessage();
        });
        
        // Clear history button
        clearChatBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to delete this chat session?")) {
                deleteActiveChat();
            }
        });
    }

    // --- API CALLS & CORE LOGIC ---

    async function loadChatsList() {
        try {
            const res = await fetch("/api/chats");
            if (!res.ok) throw new Error("Failed to fetch chats");
            state.chats = await res.json();
            renderHistoryList();
            
            if (state.chats.length > 0 && !state.currentChatId) {
                // Auto-load the most recent chat
                loadChatSession(state.chats[0].id);
            } else if (state.chats.length === 0) {
                // Render landing welcome screen if no chats exist
                showWelcome();
            }
        } catch (err) {
            console.error("Error loading chat history:", err);
            historyList.innerHTML = `<div class="error-msg">Error loading history</div>`;
        }
    }

    async function loadChatSession(chatId) {
        if (state.isStreaming) return;
        state.currentChatId = chatId;
        sidebar.classList.remove("open"); // close mobile sidebar if open
        
        try {
            const res = await fetch(`/api/chats/${chatId}`);
            if (!res.ok) throw new Error("Failed to load chat details");
            const chat = await res.json();
            
            // Update state & UI configurations
            state.systemPrompt = chat.system_prompt || state.defaultSystemPrompt;
            systemPromptInput.value = state.systemPrompt;
            
            state.selectedModel = chat.model || state.selectedModel;
            modelSelect.value = state.selectedModel;
            localStorage.setItem("groq_model", state.selectedModel);
            
            activeChatTitle.textContent = chat.title;
            updateModelBadge();
            
            // Clear message panel and render existing ones
            welcomeContainer.style.display = "none";
            messagesContainer.innerHTML = "";
            
            chat.messages.forEach(msg => {
                appendMessageBubble(msg.role, msg.content);
            });
            
            // Scroll to bottom
            scrollToBottom();
            
            // Highlight active in sidebar
            renderHistoryList();
        } catch (err) {
            console.error("Error loading chat session:", err);
            showToast("Failed to load chat session details.", "error");
        }
    }

    async function createNewChat() {
        if (state.isStreaming) return;
        
        try {
            const res = await fetch("/api/chats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: "New Chat",
                    system_prompt: state.systemPrompt,
                    model: state.selectedModel
                })
            });
            if (!res.ok) throw new Error("Failed to create chat");
            const newChat = await res.json();
            
            state.currentChatId = newChat.id;
            
            // Refresh history list and highlight the new item
            await loadChatsList();
            loadChatSession(newChat.id);
            
            showToast("Created a new conversation!");
        } catch (err) {
            console.error("Error creating chat:", err);
            showToast("Failed to start new chat.", "error");
        }
    }

    async function deleteActiveChat() {
        if (!state.currentChatId || state.isStreaming) return;
        const targetId = state.currentChatId;
        
        try {
            const res = await fetch(`/api/chats/${targetId}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete chat");
            
            state.currentChatId = null;
            await loadChatsList();
            
            showToast("Chat deleted.");
        } catch (err) {
            console.error("Error deleting chat:", err);
            showToast("Failed to delete chat session.", "error");
        }
    }

    async function updateChatSettings() {
        // Sends updated system prompt and model to backend so the chat saves it.
        // It runs in background silently to synchronize client modifications.
        if (!state.currentChatId) return;
        
        // We'll update the parameters as part of the next stream, or we can issue a dummy metadata save.
        // Since backend updates system prompt and model parameters whenever a stream starts,
        // it synchronizes automatically.
    }

    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || state.isStreaming) return;
        
        // 1. Create a session if none exists
        if (!state.currentChatId) {
            await createNewChat();
        }
        
        // 2. Clear input area and update UI state
        messageInput.value = "";
        messageInput.style.height = "auto";
        sendBtn.disabled = true;
        sendBtn.classList.remove("active");
        
        welcomeContainer.style.display = "none";
        
        // Append user bubble immediately
        appendMessageBubble("user", text);
        scrollToBottom();
        
        // Append AI loading bubble
        const aiBubbleId = appendAILoadingBubble();
        scrollToBottom();
        
        state.isStreaming = true;
        
        try {
            const payload = {
                chat_id: state.currentChatId,
                message: text,
                system_prompt: state.systemPrompt,
                model: state.selectedModel,
                api_key: state.apiKey
            };
            
            const response = await fetch("/api/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "Unknown server error" }));
                throw new Error(errorData.detail || `Server returned ${response.status}`);
            }
            
            // Read SSE streams
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let fullAIContent = "";
            
            const aiBubbleText = document.getElementById(aiBubbleId);
            
            // Remove loading indicator dots and prepare text area
            aiBubbleText.innerHTML = "";
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                // Process buffer SSE lines
                const lines = buffer.split("\n");
                // Save the last incomplete line back to buffer
                buffer = lines.pop();
                
                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine.startsWith("data: ")) continue;
                    
                    const dataStr = cleanLine.substring(6);
                    if (dataStr === "[DONE]") continue;
                    
                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.event === "start") {
                            // Update dynamic metadata e.g. updated title
                            if (parsed.title) {
                                activeChatTitle.textContent = parsed.title;
                            }
                        } else if (parsed.event === "token") {
                            fullAIContent += parsed.text;
                            // Re-render formatted markdown to the bubble
                            aiBubbleText.innerHTML = formatMarkdown(fullAIContent);
                            scrollToBottom();
                        } else if (parsed.event === "error") {
                            throw new Error(parsed.detail);
                        }
                    } catch (e) {
                        console.error("Error parsing stream chunk:", e, dataStr);
                        aiBubbleText.innerHTML = `<span class="text-danger">Error: ${e.message}</span>`;
                    }
                }
            }
            
            // Finished streaming!
            state.isStreaming = false;
            
            // Reload side list to reflect auto-renamed title
            await loadChatsList();
            
            // Highlight the active code buttons with copy actions
            lucide.createIcons();
            
        } catch (err) {
            console.error("Streaming error:", err);
            const errorBubble = document.getElementById(aiBubbleId);
            if (errorBubble) {
                errorBubble.innerHTML = `<div class="error-msg" style="color: var(--danger)">
                    <i data-lucide="alert-circle" style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:6px"></i>
                    Error streaming response: ${err.message}
                </div>`;
                lucide.createIcons();
            }
            state.isStreaming = false;
        } finally {
            // Enable text input
            messageInput.focus();
            const hasText = messageInput.value.trim().length > 0;
            sendBtn.disabled = !hasText;
        }
    }

    // --- DOM RENDERING UTILITIES ---

    function renderHistoryList() {
        if (state.chats.length === 0) {
            historyList.innerHTML = `<div class="empty-history">No active chats</div>`;
            return;
        }
        
        historyList.innerHTML = "";
        state.chats.forEach(chat => {
            const item = document.createElement("div");
            item.className = `history-item ${chat.id === state.currentChatId ? 'active' : ''}`;
            item.setAttribute("data-id", chat.id);
            
            const titleWrap = document.createElement("div");
            titleWrap.className = "history-title-wrap";
            titleWrap.innerHTML = `
                <i data-lucide="message-square"></i>
                <span class="history-title">${escapeHtml(chat.title)}</span>
            `;
            
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "delete-history-btn";
            deleteBtn.title = "Delete Chat";
            deleteBtn.innerHTML = `<i data-lucide="trash-2"></i>`;
            
            // Delete action (stops propagation so it doesn't trigger item selection click)
            deleteBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm(`Delete conversation "${chat.title}"?`)) {
                    try {
                        const res = await fetch(`/api/chats/${chat.id}`, { method: "DELETE" });
                        if (!res.ok) throw new Error();
                        state.chats = state.chats.filter(c => c.id !== chat.id);
                        if (state.currentChatId === chat.id) {
                            state.currentChatId = null;
                        }
                        renderHistoryList();
                        if (state.currentChatId) {
                            loadChatSession(state.currentChatId);
                        } else {
                            showWelcome();
                        }
                        showToast("Chat deleted.");
                    } catch {
                        showToast("Failed to delete chat.", "error");
                    }
                }
            });
            
            item.appendChild(titleWrap);
            item.appendChild(deleteBtn);
            
            // Click to load chat session
            item.addEventListener("click", () => {
                if (state.currentChatId !== chat.id) {
                    loadChatSession(chat.id);
                }
            });
            
            historyList.appendChild(item);
        });
        
        lucide.createIcons();
    }

    function appendMessageBubble(role, content) {
        const row = document.createElement("div");
        row.className = `message-row ${role === 'user' ? 'user-row' : 'ai-row'}`;
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const name = role === 'user' ? 'You' : 'AI Assistant';
        
        row.innerHTML = `
            <div class="message-bubble">
                <div class="message-info">
                    <span class="role-name">${name}</span>
                    <span class="timestamp">${timestamp}</span>
                </div>
                <div class="message-text">${role === 'user' ? escapeHtml(content) : formatMarkdown(content)}</div>
            </div>
        `;
        
        messagesContainer.appendChild(row);
        lucide.createIcons();
    }

    function appendAILoadingBubble() {
        const row = document.createElement("div");
        row.className = "message-row ai-row";
        const bubbleId = "ai-bubble-" + Date.now();
        
        row.innerHTML = `
            <div class="message-bubble">
                <div class="message-info">
                    <span class="role-name">AI Assistant</span>
                    <span class="timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="message-text" id="${bubbleId}">
                    <div class="typing-indicator">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(row);
        return bubbleId;
    }

    function showWelcome() {
        welcomeContainer.style.display = "flex";
        messagesContainer.innerHTML = "";
        messagesContainer.appendChild(welcomeContainer);
        activeChatTitle.textContent = "New Chat";
        activeModelBadge.textContent = getFriendlyModelName(state.selectedModel);
    }

    function updateModelBadge() {
        activeModelBadge.textContent = getFriendlyModelName(state.selectedModel);
    }

    function getFriendlyModelName(modelId) {
        switch (modelId) {
            case "llama-3.1-70b-versatile": return "Llama 3.1 70B";
            case "llama-3.1-8b-instant": return "Llama 3.1 8B";
            case "mixtral-8x7b-32768": return "Mixtral 8x7B";
            case "gemma2-9b-it": return "Gemma 2 9B";
            default: return "Groq LLM";
        }
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // --- HELPER UTILITIES ---

    function escapeHtml(text) {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Simple robust markdown parser
    function formatMarkdown(text) {
        if (!text) return "";
        
        let html = text;
        
        // Code Blocks: ```language\ncode\n```
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        html = html.replace(codeBlockRegex, (match, lang, code) => {
            const cleanLang = lang || "code";
            // Escape code inside blocks to avoid visual bugs
            const escapedCode = escapeHtml(code.trim());
            const codeId = 'code-' + Math.random().toString(36).substr(2, 9);
            return `
                <div class="code-header">
                    <span>${cleanLang.toUpperCase()}</span>
                    <button class="copy-btn" onclick="copyCode('${codeId}')">
                        <i data-lucide="clipboard" style="width:12px;height:12px;display:inline-block;vertical-align:middle"></i>
                        <span>Copy</span>
                    </button>
                </div>
                <pre><code id="${codeId}">${escapedCode}</code></pre>
            `;
        });
        
        // Inline Code: `code` (ensure we don't match inside already processed tags)
        html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
        
        // Bold: **text**
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Bullet Lists: starting with "- " or "* " on new lines
        const lines = html.split('\n');
        let inList = false;
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line.startsWith('- ') || line.startsWith('* ')) {
                const content = line.substring(2);
                if (!inList) {
                    lines[i] = '<ul><li>' + content + '</li>';
                    inList = true;
                } else {
                    lines[i] = '<li>' + content + '</li>';
                }
            } else {
                if (inList) {
                    lines[i] = '</ul>' + lines[i];
                    inList = false;
                }
            }
        }
        if (inList) {
            lines.push('</ul>');
        }
        
        html = lines.join('\n');
        
        // Single and double newline conversions (ignore pre block breaks)
        // We separate block tags from paragraphs
        const paragraphs = html.split(/\n{2,}/g);
        html = paragraphs.map(p => {
            const trimmed = p.trim();
            if (trimmed.startsWith('<div class="code-header"') || 
                trimmed.startsWith('<pre>') || 
                trimmed.startsWith('<ul>') || 
                trimmed.startsWith('<li>') || 
                trimmed.startsWith('</ul>')) {
                return p;
            }
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('');
        
        return html;
    }

    // Toast notifications utility
    function showToast(message, type = "success") {
        const toast = document.createElement("div");
        toast.style.position = "fixed";
        toast.style.bottom = "24px";
        toast.style.right = "24px";
        toast.style.backgroundColor = type === "success" ? "rgba(16, 185, 129, 0.9)" : "rgba(239, 68, 68, 0.9)";
        toast.style.color = "#ffffff";
        toast.style.padding = "12px 24px";
        toast.style.borderRadius = "8px";
        toast.style.boxShadow = "0 8px 16px rgba(0,0,0,0.3)";
        toast.style.fontSize = "14px";
        toast.style.fontWeight = "600";
        toast.style.zIndex = "1000";
        toast.style.transition = "all 0.3s ease";
        toast.style.transform = "translateY(20px)";
        toast.style.opacity = "0";
        toast.style.backdropFilter = "blur(10px)";
        toast.style.border = "1px solid rgba(255,255,255,0.1)";
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = "translateY(0)";
            toast.style.opacity = "1";
        }, 10);
        
        // Animate out
        setTimeout(() => {
            toast.style.transform = "translateY(20px)";
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Make copyCode accessible to HTML elements
    window.copyCode = function(codeId) {
        const codeElement = document.getElementById(codeId);
        if (!codeElement) return;
        
        const textToCopy = codeElement.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast("Copied to clipboard!");
        }).catch(err => {
            console.error("Clipboard copy failed: ", err);
            showToast("Failed to copy code.", "error");
        });
    };

    // Quick prompt selector click
    window.setQuickPrompt = function(promptText) {
        messageInput.value = promptText;
        // Trigger resize and submit state
        messageInput.dispatchEvent(new Event("input"));
        messageInput.focus();
    };

    // Run app init
    init();
});
