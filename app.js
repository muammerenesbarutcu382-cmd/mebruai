
const chatArea = document.getElementById("chatArea");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");

const chatPage = document.getElementById("chatPage");
const learnPage = document.getElementById("learnPage");

const knowledgeInput = document.getElementById("knowledgeInput");
const saveKnowledge = document.getElementById("saveKnowledge");
const knowledgeList = document.getElementById("knowledgeList");

let history = JSON.parse(localStorage.getItem("mebru_history") || "[]");
let knowledge = JSON.parse(localStorage.getItem("mebru_knowledge") || "[]");

let recognition = null;
let busy = false;

function saveHistory() {
  localStorage.setItem("mebru_history", JSON.stringify(history));
}

function saveKnowledgeData() {
  localStorage.setItem("mebru_knowledge", JSON.stringify(knowledge));
}

function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = "message " + type;
  div.textContent = text;
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
  return div;
}

function showWelcome() {
  chatArea.innerHTML = `
    <div class="welcome">
      <div class="big-logo">M</div>
      <h1>MEBRU AI</h1>
      <p>Merhaba! Sana nasıl yardımcı olabilirim?</p>
    </div>
  `;
}

function renderHistory() {
  chatArea.innerHTML = "";

  if (history.length === 0) {
    showWelcome();
    return;
  }

  history.forEach(item => {
    addMessage(item.content, item.role === "user" ? "user" : "ai");
  });
}

async function sendMessage(text) {
  text = text.trim();

  if (!text || busy) return;

  busy = true;
  sendBtn.disabled = true;

  messageInput.value = "";
  messageInput.style.height = "48px";

  if (history.length === 0) {
    chatArea.innerHTML = "";
  }

  history.push({ role: "user", content: text });
  addMessage(text, "user");
  saveHistory();

  const loading = addMessage("MEBRU düşünüyor...", "ai");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        history: history.slice(-20),
        knowledge: knowledge.slice(-50)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Sunucu hatası");
    }

    loading.textContent = data.reply;

    history.push({
      role: "assistant",
      content: data.reply
    });

    saveHistory();
    speak(data.reply);

  } catch (error) {
    loading.textContent = "Hata: " + error.message;
  } finally {
    busy = false;
    sendBtn.disabled = false;
    chatArea.scrollTop = chatArea.scrollHeight;
  }
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "tr-TR";
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

sendBtn.addEventListener("click", () => {
  sendMessage(messageInput.value);
});

messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage(messageInput.value);
  }
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "48px";
  messageInput.style.height =
    Math.min(messageInput.scrollHeight, 160) + "px";
});

document.getElementById("newChatBtn").addEventListener("click", () => {
  history = [];
  saveHistory();
  renderHistory();

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t =>
      t.classList.remove("active")
    );

    tab.classList.add("active");

    const page = tab.dataset.page;

    chatPage.classList.toggle("hidden", page !== "chat");
    learnPage.classList.toggle("hidden", page !== "learn");

    if (page === "learn") renderKnowledge();
  });
});

saveKnowledge.addEventListener("click", () => {
  const text = knowledgeInput.value.trim();

  if (!text) return;

  knowledge.unshift({
    id: Date.now(),
    text
  });

  saveKnowledgeData();
  knowledgeInput.value = "";
  renderKnowledge();

  alert("Bilgi kaydedildi.");
});

function renderKnowledge() {
  knowledgeList.innerHTML = "";

  if (knowledge.length === 0) {
    knowledgeList.textContent = "Henüz kaydedilen bilgi yok.";
    return;
  }

  knowledge.forEach(item => {
    const div = document.createElement("div");
    div.className = "knowledge-item";

    const content = document.createElement("div");
    content.textContent = item.text;

    const remove = document.createElement("button");
    remove.textContent = "Sil";
    remove.className = "delete-knowledge";

    remove.addEventListener("click", () => {
      knowledge = knowledge.filter(k => k.id !== item.id);
      saveKnowledgeData();
      renderKnowledge();
    });

    div.append(content, remove);
    knowledgeList.appendChild(div);
  });
}

function startVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Ses tanıma desteklenmiyor. Chrome kullanmayı deneyebilirsin.");
    return;
  }

  if (recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "tr-TR";
  recognition.continuous = false;
  recognition.interimResults = false;

  voiceBtn.classList.add("listening");
  voiceBtn.textContent = "🔴";

  recognition.onresult = event => {
    const text = event.results[0][0].transcript;
    messageInput.value = text;
    sendMessage(text);
  };

  recognition.onerror = event => {
    if (event.error !== "no-speech") {
      alert("Ses tanıma hatası: " + event.error);
    }
  };

  recognition.onend = () => {
    recognition = null;
    voiceBtn.classList.remove("listening");
    voiceBtn.textContent = "🎙";
  };

  recognition.start();
}

voiceBtn.addEventListener("click", startVoice);

renderHistory();
renderKnowledge();
