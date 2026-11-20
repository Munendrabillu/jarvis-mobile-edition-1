/* ==========================================
   J.A.R.V.I.S. AI - COMPLETE SCRIPT
========================================== */

const $ = id => document.getElementById(id);

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
  API_KEY = prompt("Enter your Gemini API Key:");
  if (API_KEY) localStorage.setItem("jarvis_key", API_KEY.trim());
}

API_KEY = API_KEY ? API_KEY.trim() : "";

const MODEL = "gemini-2.5-flash";
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  MODEL + ":generateContent";

let history = [];
let selectedImage = null;
let wakeEnabled = false;
let wakeRecognition = null;
let wakeRestart = false;
let currentRecognition = null;
let flashlightStream = null;
let torchOn = false;
let speakEnabled = true;

try {
  history = JSON.parse(localStorage.getItem("jarvis_memory") || "[]");
} catch {
  history = [];
}

/* ===== CHAT ===== */

function addMessage(text, type) {
  const box = document.createElement("div");
  box.className = "message " + type;

  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = type === "bot" ? "JARVIS" : "YOU";

  const body = document.createElement("div");
  body.textContent = text;

  box.appendChild(tag);
  box.appendChild(body);

  $("chat").appendChild(box);
  $("chat").scrollTop = $("chat").scrollHeight;
}

function saveHistory() {
  try {
    localStorage.setItem("jarvis_memory", JSON.stringify(history.slice(-20)));
  } catch {}
}

function restoreChat() {
  if (!history.length) return;

  $("chat").innerHTML = "";

  history.forEach(item => {
    if (item.role === "user") {
      addMessage(item.parts?.[0]?.text || "Image sent", "user");
    } else {
      addMessage(item.parts?.[0]?.text || "Response", "bot");
    }
  });
}

function setStatus(text) {
  $("connection").textContent = text;
}

function setMode(mode, label) {
  document.body.classList.toggle("listening", mode === "listening");
  document.body.classList.toggle("processing", mode === "processing");
  $("reactor-label").textContent = label;
}

/* ===== SPEECH OUTPUT ===== */

function speak(text) {
  if (!speakEnabled || !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

/* ===== GEMINI ===== */

async function askGemini(text, imageData = null) {
  if (!API_KEY) {
    addMessage("Please enter your Gemini API key in the script configuration.", "bot");
    return;
  }

  const userParts = [];

  if (text) userParts.push({ text });

  if (imageData) {
    userParts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.data
      }
    });
  }

  history.push({
    role: "user",
    parts: userParts
  });

  const payload = {
    systemInstruction: {
      parts: [{
        text: "You are JARVIS, a helpful, intelligent and concise AI assistant. Speak naturally and politely. You are a voice assistant. Keep answers easy to hear and understand."
      }]
    },
    contents: history.slice(-20),
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000
    }
  };

  setMode("processing", "PROCESSING");
  setStatus("AI PROCESSING");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const errorText = data?.error?.message || "API request failed";
      throw new Error(errorText + " (" + response.status + ")");
    }

    const answer =
      data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "")
        .join("\n") || "I could not generate a response.";

    history.push({
      role: "model",
      parts: [{ text: answer }]
    });

    history = history.slice(-20);
    saveHistory();

    addMessage(answer, "bot");
    speak(answer);

    setStatus("SYSTEM READY");
    setMode("idle", "AWAITING COMMAND");

  } catch (error) {
    history.pop();

    const errorMsg = "AI Error: " + error.message;
    addMessage(errorMsg, "bot");

    setStatus("AI ERROR");
    setMode("idle", "SYSTEM ERROR");

    console.error(error);
  }
}

/* ===== LOCAL COMMANDS ===== */

function localCommand(text) {
  const command = text.toLowerCase().trim();

  if (/^(what time|time|tell me the time)/.test(command)) {
    const answer = "The time is " +
      new Date().toLocaleTimeString("en-IN");
    addMessage(answer, "bot");
    speak(answer);
    return true;
  }

  if (/^(what date|date|today's date)/.test(command)) {
    const answer = "Today is " +
      new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    addMessage(answer, "bot");
    speak(answer);
    return true;
  }

  if (command.includes("battery")) {
    const answer = $("battery").textContent === "--%"
      ? "Battery information is unavailable."
      : "Battery level is " + $("battery").textContent;
    addMessage(answer, "bot");
    speak(answer);
    return true;
  }

  if (command.includes("weather")) {
    window.open("https://www.google.com/search?q=weather", "_blank");
    return true;
  }

  if (command.includes("flashlight on") || command.includes("torch on")) {
    toggleFlashlight(true);
    return true;
  }

  if (command.includes("flashlight off") || command.includes("torch off")) {
    toggleFlashlight(false);
    return true;
  }

  if (command.includes("open whatsapp")) {
    window.open("https://wa.me/", "_blank");
    return true;
  }

  if (command.includes("open youtube")) {
    window.open("https://youtube.com", "_blank");
    return true;
  }

  if (command.includes("open google")) {
    window.open("https://google.com", "_blank");
    return true;
  }

  if (command.includes("open maps")) {
    window.open("https://maps.google.com", "_blank");
    return true;
  }

  if (command.includes("open phone") || command.includes("open dialer")) {
    window.location.href = "tel:";
    return true;
  }

  if (command.includes("open messages") || command.includes("open sms")) {
    window.location.href = "sms:";
    return true;
  }

  if (command.includes("open calculator")) {
    window.location.href = "intent://calculator/#Intent;scheme=android;end";
    return true;
  }

  if (command.includes("open settings")) {
    window.location.href = "intent://settings/#Intent;scheme=android;end";
    return true;
  }

  if (command.includes("stop speaking") || command.includes("stop voice")) {
    window.speechSynthesis.cancel();
    return true;
  }

  if (command.includes("mute voice")) {
    speakEnabled = false;
    addMessage("Voice output muted.", "bot");
    return true;
  }

  if (command.includes("enable voice") || command.includes("unmute voice")) {
    speakEnabled = true;
    addMessage("Voice output enabled.", "bot");
    speak("Voice output enabled.");
    return true;
  }

  return false;
}

/* ===== SEND MESSAGE ===== */

async function sendMessage(textOverride = null) {
  const text = (textOverride ?? $("msg").value).trim();

  if (!text && !selectedImage) return;

  $("msg").value = "";

  const image = selectedImage;
  selectedImage = null;

  $("image-preview").style.display = "none";

  addMessage(text || "Describe this image.", "user");

  if (localCommand(text)) return;

  setStatus("AI PROCESSING");

  await askGemini(text, image);
}

/* ===== IMAGE ===== */

$("cam-btn").addEventListener("click", () => {
  $("img-input").click();
});

$("img-input").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    addMessage("Please select an image.", "bot");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    addMessage("Image is too large. Please select an image under 10 MB.", "bot");
    return;
  }

  try {
    const data = await fileToBase64(file);

    selectedImage = {
      mimeType: file.type,
      data
    };

    $("preview-img").src = URL.createObjectURL(file);
    $("image-preview").style.display = "block";
  } catch (error) {
    addMessage("Could not load image.", "bot");
  }

  event.target.value = "";
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      resolve(result.split(",")[1]);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

$("remove-image").addEventListener("click", () => {
  selectedImage = null;
  $("preview-img").src = "";
  $("image-preview").style.display = "none";
});

/* ===== MICROPHONE ===== */

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

$("mic-btn").addEventListener("click", () => {
  const SpeechRecognition = getSpeechRecognition();

  if (!SpeechRecognition) {
    addMessage("Speech recognition is not supported by this browser.", "bot");
    return;
  }

  const recognition = new SpeechRecognition();
  currentRecognition = recognition;

  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    $("voice-status").textContent = "VOICE ON";
    setMode("listening", "LISTENING");
    setStatus("LISTENING");
  };

  recognition.onresult = event => {
    const text = event.results[0][0].transcript;
    $("msg").value = text;
    sendMessage(text);
  };

  recognition.onerror = event => {
    console.error("Speech error", event.error);
    setStatus("VOICE ERROR");
  };

  recognition.onend = () => {
    currentRecognition = null;
    $("voice-status").textContent = wakeEnabled ? "WAKE ON" : "VOICE OFF";
    if (!wakeEnabled) setMode("idle", "AWAITING COMMAND");
  };

  try {
    recognition.start();
  } catch (error) {
    addMessage("Microphone could not start.", "bot");
  }
});

/* ===== WAKE WORD ===== */

function startWake() {
  const SpeechRecognition = getSpeechRecognition();

  if (!SpeechRecognition) {
    addMessage("Wake-word recognition is not supported in this browser.", "bot");
    return;
  }

  if (wakeEnabled) return;

  wakeEnabled = true;
  wakeRestart = true;

  wakeRecognition = new SpeechRecognition();
  wakeRecognition.lang = "en-IN";
  wakeRecognition.continuous = true;
  wakeRecognition.interimResults = true;

  wakeRecognition.onstart = () => {
    $("voice-status").textContent = "WAKE ON";
    setMode("listening", "SAY HEY JARVIS");
  };

  wakeRecognition.onresult = event => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.toLowerCase();

      if (
        transcript.includes("hey jarvis") ||
        transcript.includes("hi jarvis") ||
        transcript.includes("jarvis")
      ) {
        wakeRecognition.stop();

        const cleanText = transcript
          .replace("hey jarvis", "")
          .replace("hi jarvis", "")
          .replace("jarvis", "")
          .trim();

        if (cleanText) {
          sendMessage(cleanText);
        } else {
          $("mic-btn").click();
        }

        break;
      }
    }
  };

  wakeRecognition.onerror = event => {
    console.warn("Wake recognition error:", event.error);
  };

  wakeRecognition.onend = () => {
    if (wakeEnabled && wakeRestart) {
      try {
        wakeRecognition.start();
      } catch {}
    } else {
      $("voice-status").textContent = "VOICE OFF";
      setMode("idle", "AWAITING COMMAND");
    }
  };

  try {
    wakeRecognition.start();
  } catch {
    wakeEnabled = false;
    wakeRestart = false;
  }
}

function stopWake() {
  wakeEnabled = false;
  wakeRestart = false;

  if (wakeRecognition) {
    try {
      wakeRecognition.stop();
    } catch {}
  }

  $("voice-status").textContent = "VOICE OFF";
  setMode("idle", "AWAITING COMMAND");
}

$("wake-btn").addEventListener("click", () => {
  if (wakeEnabled) {
    stopWake();
    addMessage("Wake-word mode disabled.", "bot");
  } else {
    startWake();
    addMessage("Wake-word mode requested. Say Hey Jarvis.", "bot");
  }
});

/* ===== FLASHLIGHT ===== */

async function toggleFlashlight(forceState = null) {
  try {
    if (forceState === false && torchOn) {
      const track = flashlightStream?.getVideoTracks()[0];
      if (track) {
        await track.applyConstraints({
          advanced: [{ torch: false }]
        });
      }
      torchOn = false;
      $("flash-status").textContent = "OFF";
      return;
    }

    if (forceState === true && torchOn) return;

    if (!flashlightStream) {
      flashlightStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment"
        }
      });
    }

    const track = flashlightStream.getVideoTracks()[0];

    await track.applyConstraints({
      advanced: [{ torch: !torchOn }]
    });

    torchOn = !torchOn;
    $("flash-status").textContent = torchOn ? "ON" : "OFF";

  } catch (error) {
    addMessage("Flashlight is not supported or camera permission was denied.", "bot");
    console.warn(error);
  }
}

$("flash-btn").addEventListener("click", () => {
  toggleFlashlight();
});

/* ===== QUICK BUTTONS ===== */

$("google-btn").addEventListener("click", () => {
  window.open("https://google.com", "_blank");
});

$("youtube-btn").addEventListener("click", () => {
  window.open("https://youtube.com", "_blank");
});

$("maps-btn").addEventListener("click", () => {
  window.open("https://maps.google.com", "_blank");
});

$("weather-btn").addEventListener("click", () => {
  window.open("https://www.google.com/search?q=weather", "_blank");
});

/* ===== BATTERY ===== */

async function batteryInfo() {
  try {
    if (!navigator.getBattery) return;

    const battery = await navigator.getBattery();

    function update() {
      $("battery").textContent = Math.round(battery.level * 100) + "%";
      $("battery-status").textContent = battery.charging
        ? "CHARGING"
        : "DISCHARGING";
    }

    update();
    battery.addEventListener("levelchange", update);
    battery.addEventListener("chargingchange", update);
  } catch {}
}

batteryInfo();

/* ===== CLOCK ===== */

function updateClock() {
  $("clock").textContent = new Date().toLocaleTimeString("en-IN");
}

setInterval(updateClock, 1000);
updateClock();

/* ===== FULLSCREEN ===== */

function jarvisFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

$("fullscreen").addEventListener("click", jarvisFullscreen);
$("fullscreen-bottom").addEventListener("click", jarvisFullscreen);

/* ===== TEXT INPUT ===== */

$("send").addEventListener("click", () => sendMessage());

$("msg").addEventListener("keydown", event => {
  if (event.key === "Enter") sendMessage();
});

$("speak-btn").addEventListener("click", () => {
  speakEnabled = true;

  const lastBot = [...$("chat").querySelectorAll(".bot")]
    .pop();

  if (lastBot) {
    const text = lastBot.querySelector("div")?.textContent;
    if (text) speak(text);
  }
});

/* ===== CLEAR ===== */

$("clear-btn").addEventListener("click", () => {
  history = [];
  localStorage.removeItem("jarvis_memory");
  $("chat").innerHTML = "";
  addMessage("Communication log cleared. Systems ready.", "bot");
});

/* ===== INIT ===== */

restoreChat();
setStatus(API_KEY ? "SYSTEM READY" : "API KEY MISSING");

/* ===== SERVICE WORKER ===== */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.warn("Service worker:", error));
  });
}
