// The Python server forwards this same-origin request to Ollama.
const CHAT_URL = "/api/chat";
const MODEL_NAME = "qwen2.5:3b";

const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const chat = document.querySelector("#chat");
const clearButton = document.querySelector("#clear-chat");

// Keep recent messages so Ollama can use earlier parts of the conversation.
const conversation = [];

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
});

clearButton.addEventListener("click", () => {
  conversation.length = 0;
  chat.replaceChildren(createWelcome());
  input.focus();
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.textContent.trim();
    form.requestSubmit();
  });
});

async function sendMessage() {
  const message = input.value.trim();
  if (!message || sendButton.disabled) return;

  hideWelcome();
  addMessage("user", message);
  conversation.push({ role: "user", content: message });

  input.value = "";
  input.style.height = "auto";
  setBusy(true);
  const pendingMessage = addMessage("assistant", "Thinking...", true);

  try {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: conversation,
        stream: false
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `The local server returned HTTP ${response.status}.`);
    }

    const reply = data.message?.content?.trim();
    if (!reply) {
      throw new Error("Ollama returned an empty reply.");
    }

    conversation.push({ role: "assistant", content: reply });
    pendingMessage.querySelector(".bubble").textContent = reply;
    pendingMessage.classList.remove("pending");
  } catch (error) {
    const explanation = getErrorMessage(error);
    pendingMessage.querySelector(".bubble").textContent = explanation;
    pendingMessage.classList.remove("pending");
    conversation.pop();
  } finally {
    setBusy(false);
    input.focus();
    scrollToLatest();
  }
}

function addMessage(role, text, pending = false) {
  const row = document.createElement("article");
  row.className = `message ${role}${pending ? " pending" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "You" : "✦";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  row.append(avatar, bubble);
  chat.append(row);
  scrollToLatest();
  return row;
}

function hideWelcome() {
  chat.querySelector(".welcome")?.remove();
}

function createWelcome() {
  const welcome = document.createElement("div");
  welcome.className = "welcome";

  const icon = document.createElement("div");
  icon.className = "welcome-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✦";

  const heading = document.createElement("h2");
  heading.textContent = "Good to see you.";

  const message = document.createElement("p");
  message.textContent = "What would you like to talk about?";

  const suggestions = document.createElement("div");
  suggestions.className = "suggestions";

  for (const text of ["What can you help me with?", "Tell me something interesting"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion";
    button.textContent = text;
    button.addEventListener("click", () => {
      input.value = text;
      form.requestSubmit();
    });
    suggestions.append(button);
  }

  welcome.append(icon, heading, message, suggestions);
  return welcome;
}

function setBusy(isBusy) {
  sendButton.disabled = isBusy;
  input.disabled = isBusy;
  clearButton.disabled = isBusy;
}

function scrollToLatest() {
  chat.scrollTop = chat.scrollHeight;
}

function getErrorMessage(error) {
  if (error instanceof TypeError) {
    return "I couldn't reach the Python chat server. Start it with `python app.py`, then open http://127.0.0.1:8000 in your browser.";
  }

  return `Sorry, the local model could not reply. ${error.message}`;
}
