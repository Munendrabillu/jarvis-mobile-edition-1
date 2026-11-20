// ===========================================
// J.A.R.V.I.S AI ASSISTANT
// Gemini AI | Voice | Image | Local Memory
// ===========================================

const API_KEY_STORAGE = "jarvis_key";
const MEMORY_STORAGE = "jarvis_memory";

// Newer model names first; fallback attempts follow.
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite"
];

let API_KEY = localStorage.getItem(API_KEY_STORAGE);

if (!API_KEY) {
  API_KEY = prompt("Enter your Gemini API Key:");
  if (API_KEY) {
    API_KEY = API_KEY.trim();
    localStorage.setItem(API_KEY_STORAGE, API_KEY);
  }
}

let MEMORY = JSON.parse(
  localStorage.getItem(MEMORY_STORAGE) || "[]"
);

const chat = document.getElementById("chat");
const msg = document.getElementById("msg");
const send = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const imgInput = document.getElementById("img-input");
const clearBtn = document.getElementById("clear-btn");
const connection = document.getElementById("connection");
const voiceStatus = document.getElementById("voice-status");
const coreText = document.getElementById("core-text");

// ===========================================
// CHAT DISPLAY
// ===========================================

function add(text, type = "ai") {
  const div = document.createElement("div");
  div.className = "msg " + type;

  const title = document.createElement("strong");
  title.textContent = type === "user" ? "YOU" : "J.A.R.V.I.S";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  div.appendChild(title);
  div.appendChild(paragraph);

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;

  return div;
}

function setStatus(text, state = "on") {
  connection.textContent = text;
  connection.className = state;
}

function setCore(text) {
  coreText.textContent = text;
}

function saveMemory() {
  localStorage.setItem(
    MEMORY_STORAGE,
    JSON.stringify(MEMORY)
  );
}

function restoreChat() {
  chat.innerHTML = "";

  if (MEMORY.length === 0) {
    add("Hello! I am online. How may I assist you today?", "ai");
    return;
  }

  MEMORY.forEach(item => {
    add(item.text, item.role === "user" ? "user" : "ai");
  });
}

restoreChat();

// ===========================================
// GEMINI API
// ===========================================

async function callGemini(contents) {
  if (!API_KEY) {
    throw new Error("API key is missing. Refresh and enter your key.");
  }

  let lastError = "";

  for (const model of MODELS) {
    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          data?.error?.message || `HTTP ${response.status}`;

        lastError = `${model}: ${errorMessage}`;

        // Try another model for model/access or server errors.
        if (
          response.status === 404 ||
          response.status === 429 ||
          response.status === 503 ||
          response.status === 500
        ) {
          continue;
        }

        throw new Error(errorMessage);
      }

      const answer =
        data?.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("");

      if (!answer) {
        lastError = `${model}: Empty response`;
        continue;
      }

      return answer;

    } catch (error) {
      lastError = error.message;

      // Network failures cannot reliably be solved by
      // changing models, so stop.
      if (
        error.name === "TypeError" ||
        error.message.includes("API key") ||
        error.message.includes("PERMISSION_DENIED")
      ) {
        throw error;
      }
    }
  }

  throw new Error(
    "All available model attempts failed. " + lastError
  );
}

// ===========================================
// CHAT HISTORY
// ===========================================

function getContents(newPrompt) {
  const contents = [];

  // Keep only recent turns for API requests.
  const recent = MEMORY.slice(-12);

  recent.forEach(item => {
    contents.push({
      role: item.role === "user" ? "user" : "model",
      parts: [{ text: item.text }]
    });
  });

  contents.push({
    role: "user",
    parts: [{ text: newPrompt }]
  });

  return contents;
}

// ===========================================
// TEXT CHAT
// ===========================================

async function askGemini(text) {
  const question = text.trim();

  if (!question) return;

  msg.value = "";
  add(question, "user");

  MEMORY.push({
    role: "user",
    text: question
  });

  saveMemory();

  const loading = add("Thinking...", "ai");

  setStatus("PROCESSING", "on");
  setCore("THINKING");

  try {
    const contents = getContents(question);
    const answer = await callGemini(contents);

    loading.querySelector("p").textContent = answer;

    MEMORY.push({
      role: "ai",
      text: answer
    });

    MEMORY = MEMORY.slice(-40);
    saveMemory();

    setStatus("ONLINE", "on");
    setCore("SYSTEM ONLINE");

    speak(answer);

  } catch (error) {
    loading.querySelector("p").textContent =
      "ERROR: " + error.message;

    setStatus("ERROR", "off");
    setCore("ERROR");

    console.error(error);
  }

  chat.scrollTop = chat.scrollHeight;
}

// ===========================================
// SEND BUTTON
// ===========================================

send.addEventListener("click", () => {
  askGemini(msg.value);
});

msg.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    askGemini(msg.value);
  }
});

// ===========================================
// CLEAR MEMORY
// ===========================================

clearBtn.addEventListener("click", () => {
  if (!confirm("Clear all saved chat memory?")) return;

  MEMORY = [];
  localStorage.removeItem(MEMORY_STORAGE);

  chat.innerHTML = "";
  add("Memory cleared. I am ready for a new conversation.", "ai");

  setStatus("READY", "on");
  setCore("SYSTEM ONLINE");
});

// ===========================================
// IMAGE UPLOAD / CAMERA
// ===========================================

camBtn.addEventListener("click", () => {
  imgInput.click();
});

imgInput.addEventListener("change", async () => {
  const file = imgInput.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    add("Please select a valid image.", "ai");
    imgInput.value = "";
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    add("Image is too large. Maximum size is 10 MB.", "ai");
    imgInput.value = "";
    return;
  }

  const question = prompt(
    "What should I analyze in this image?",
    "Describe this image."
  );

  if (!question) {
    imgInput.value = "";
    return;
  }

  add(question, "user");

  const loading = add("Analyzing image...", "ai");

  setStatus("VISION PROCESSING", "on");
  setCore("ANALYZING");

  try {
    const base64 = await fileToBase64(file);

    const contents = [
      {
        role: "user",
        parts: [
          { text: question },
          {
            inline_data: {
              mime_type: file.type,
              data: base64
            }
          }
        ]
      }
    ];

    const answer = await callGemini(contents);

    loading.querySelector("p").textContent = answer;

    MEMORY.push(
      { role: "user", text: "[Image] " + question },
      { role: "ai", text: answer }
    );

    MEMORY = MEMORY.slice(-40);
    saveMemory();

    speak(answer);

    setStatus("ONLINE", "on");
    setCore("SYSTEM ONLINE");

  } catch (error) {
    loading.querySelector("p").textContent =
      "IMAGE ERROR: " + error.message;

    setStatus("ERROR", "off");
    setCore("ERROR");

    console.error(error);

  } finally {
    imgInput.value = "";
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      resolve(result.split(",")[1]);
    };

    reader.onerror = () => reject(
      new Error("Could not read image file.")
    );

    reader.readAsDataURL(file);
  });
}

// ===========================================
// VOICE OUTPUT
// ===========================================

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    voiceStatus.textContent = "SPEAKING";
    voiceStatus.className = "on";
  };

  utterance.onend = () => {
    voiceStatus.textContent = "READY";
  };

  utterance.onerror = () => {
    voiceStatus.textContent = "READY";
  };

  window.speechSynthesis.speak(utterance);
}

// ===========================================
// VOICE INPUT
// ===========================================

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();

  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    micBtn.textContent = "🔴";
    voiceStatus.textContent = "LISTENING";
    voiceStatus.className = "on";
    setCore("LISTENING");
  };

  recognition.onresult = event => {
    const transcript =
      event.results[0][0].transcript;

    msg.value = transcript;

    micBtn.textContent = "🎤";
    voiceStatus.textContent = "READY";

    askGemini(transcript);
  };

  recognition.onerror = event => {
    console.error("Speech error:", event.error);

    micBtn.textContent = "🎤";
    voiceStatus.textContent = "ERROR";
    setCore("SYSTEM ONLINE");

    add("Voice recognition error: " + event.error, "ai");
  };

  recognition.onend = () => {
    micBtn.textContent = "🎤";

    if (voiceStatus.textContent === "LISTENING") {
      voiceStatus.textContent = "READY";
    }

    setCore("SYSTEM ONLINE");
  };

} else {
  micBtn.disabled = true;
  micBtn.title = "Speech recognition not supported";
  voiceStatus.textContent = "UNAVAILABLE";
  voiceStatus.className = "off";
}

micBtn.addEventListener("click", () => {
  if (!recognition) {
    add("Voice recognition is not supported in this browser.", "ai");
    return;
  }

  try {
    recognition.start();
  } catch (error) {
    console.log(error);
  }
});

// ===========================================
// API KEY CHANGE
// ===========================================

function changeAPIKey() {
  const newKey = prompt("Enter a new Gemini API key:");

  if (newKey && newKey.trim()) {
    API_KEY = newKey.trim();
    localStorage.setItem(API_KEY_STORAGE, API_KEY);

    add("API key updated.", "ai");
  }
}

// ===========================================
// STARTUP
// ===========================================

setStatus("READY", "on");
setCore("SYSTEM ONLINE");

console.log("J.A.R.V.I.S system initialized.");
