const API_BASE = "https://durian-iot-backend.onrender.com/api/v1";
let pumpStates = {};
let chart = null;
let isSystemInitialized = false;

// Hàm hỗ trợ gán text an toàn (tránh lỗi Cannot set properties of null)
function safeSetInnerText(elementId, textValue) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerText = textValue;
  }
}

// 1. AUTH & QUẢN LÝ PHIÊN ĐĂNG NHẬP
function checkAuthSession() {
  const token = localStorage.getItem("access_token");
  const fullName =
    localStorage.getItem("full_name") || localStorage.getItem("username");

  const loginScreen = document.getElementById("login-screen");
  const dashboardScreen = document.getElementById("dashboard-screen");

  if (token) {
    if (loginScreen) loginScreen.classList.add("hidden");
    if (dashboardScreen) dashboardScreen.classList.remove("hidden");
    safeSetInnerText("user-display-name", fullName || "Admin");

    if (!isSystemInitialized) {
      initDashboardSystem();
      isSystemInitialized = true;
    }
  } else {
    if (loginScreen) loginScreen.classList.remove("hidden");
    if (dashboardScreen) dashboardScreen.classList.add("hidden");
  }
}

async function handleLogin() {
  const uInputEl = document.getElementById("login-username");
  const pInputEl = document.getElementById("login-password");
  const errorEl = document.getElementById("login-error-msg");
  const submitBtn = document.getElementById("login-submit-btn");

  if (!uInputEl || !pInputEl) return;

  const uInput = uInputEl.value.trim();
  const pInput = pInputEl.value.trim();

  if (errorEl) errorEl.classList.add("hidden");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "ĐANG XÁC THỰC...";
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: uInput, password: pInput }),
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("username", data.username);
      localStorage.setItem("full_name", data.full_name || data.username);
      checkAuthSession();
    } else {
      if (errorEl) {
        errorEl.innerText =
          data.detail || "Tài khoản hoặc mật khẩu không đúng!";
        errorEl.classList.remove("hidden");
      }
    }
  } catch (e) {
    if (errorEl) {
      errorEl.innerText = "Lỗi kết nối tới Server Backend!";
      errorEl.classList.remove("hidden");
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i><span>ĐĂNG NHẬP HỆ THỐNG</span>`;
    }
  }
}

function handleLogout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("username");
  localStorage.removeItem("full_name");
  checkAuthSession();
}

// 2. KHỞI TẠO DASHBOARD
function initDashboardSystem() {
  initChart();
  if (typeof initLeafletMap === "function") initLeafletMap();
  if (typeof switchMasterNode === "function") switchMasterNode("master_1");

  setInterval(updateRealtimeClock, 1000);
  updateRealtimeClock();

  setInterval(fetchSensorData, 5000);
}

function updateRealtimeClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN", { hour12: false });
  const dateStr = now.toLocaleDateString("vi-VN");
  safeSetInnerText("realtime-clock", `${timeStr} - ${dateStr}`);
}

// 3. ĐIỀU KHIỂN CÁC NODE CON VÀ MÁY BƠM
function renderChildNodesUI(childNodesList) {
  const container = document.getElementById("child-nodes-container");
  if (!container) return;
  container.innerHTML = "";

  childNodesList.forEach((nodeId, idx) => {
    if (pumpStates[nodeId] === undefined) pumpStates[nodeId] = false;
    const isON = pumpStates[nodeId];

    const cardHTML = `
            <div class="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 flex justify-between items-center shadow-inner">
                <div>
                    <p class="font-bold text-emerald-300 text-sm">Gốc Sầu Riêng - Node ${idx + 1}</p>
                    <p class="text-[10px] text-slate-400 font-mono mt-0.5">Mã thiết bị: ${nodeId}</p>
                    <p id="status-${nodeId}" class="text-xs font-semibold ${isON ? "text-emerald-400" : "text-slate-400"} mt-1">
                        Trạng thái: ${isON ? "🟢 Đang BẬT" : "🔴 Đang TẮT"}
                    </p>
                </div>
                <button id="btn-${nodeId}" onclick="togglePump('${nodeId}')" class="${isON ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"} text-white text-xs px-3.5 py-2 rounded-lg font-bold transition shadow">
                    ${isON ? "TẮT BƠM" : "BẬT BƠM"}
                </button>
            </div>
        `;
    container.innerHTML += cardHTML;
  });
}

async function togglePump(nodeId) {
  const nextAction = pumpStates[nodeId] ? "OFF" : "ON";
  try {
    const res = await fetch(`${API_BASE}/control/pump`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId, action: nextAction }),
    });
    if (res.ok) {
      pumpStates[nodeId] = !pumpStates[nodeId];
      const isON = pumpStates[nodeId];
      const btn = document.getElementById(`btn-${nodeId}`);
      const status = document.getElementById(`status-${nodeId}`);
      if (btn) {
        btn.innerText = isON ? "TẮT BƠM" : "BẬT BƠM";
        btn.className = `${isON ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"} text-white text-xs px-3.5 py-2 rounded-lg font-bold transition shadow`;
      }
      if (status) {
        status.innerText = isON
          ? "Trạng thái: 🟢 Đang BẬT"
          : "Trạng thái: 🔴 Đang TẮT";
        status.className = `text-xs font-semibold ${isON ? "text-emerald-400" : "text-slate-400"} mt-1`;
      }
    }
  } catch (err) {
    alert("Lỗi kết nối lệnh bơm!");
  }
}

// 4. LẤY DỮ LIỆU CẢM BIẾN & THỜI TIẾT
async function fetchSensorData() {
  try {
    const res = await fetch(`${API_BASE}/sensors/latest?limit=10`);
    const data = await res.json();
    if (data && data.length > 0) {
      const latest = data[0];
      safeSetInnerText("card-temp", `${latest.temperature ?? "--"} °C`);
      safeSetInnerText("card-humidity", `${latest.humidity ?? "--"} %`);
      safeSetInnerText("card-soil", `${latest.soil_moisture ?? "--"} %`);
      safeSetInnerText("card-light", `${latest.light_lux ?? "--"} Lux`);
      safeSetInnerText("card-battery", `${latest.battery ?? "--"} %`);
      updateChart(data);
    }
  } catch (err) {
    console.error("Lỗi dữ liệu cảm biến:", err);
  }
}

async function fetchWeather(cityName = "Tien Giang") {
  try {
    const res = await fetch(
      `${API_BASE}/weather?city=${encodeURIComponent(cityName)}`,
    );
    const data = await res.json();
    const tempVal =
      data.temp !== undefined && data.temp !== null
        ? `${data.temp}°C`
        : "31.5°C";
    const descVal = data.description || "Nắng nhẹ, mây rải rác";

    safeSetInnerText("weather-temp", tempVal);
    safeSetInnerText("weather-desc", descVal);
    safeSetInnerText("farm-temp", tempVal);
    safeSetInnerText(
      "farm-humidity",
      data.humidity ? `${data.humidity} %` : "75 %",
    );
    safeSetInnerText("farm-weather-desc", descVal);
  } catch (err) {
    console.error("Lỗi thời tiết:", err);
  }
}

// 5. XUẤT BÁO CÁO EXCEL
function exportExcel() {
  window.open(`${API_BASE}/export/excel`, "_blank");
}

// 6. CHATBOT AI GEMINI
function toggleChatbox() {
  const chatWindow = document.getElementById("chatbox-window");
  if (chatWindow) chatWindow.classList.toggle("hidden");
}

async function sendChatMessage() {
  const input = document.getElementById("chat-input");
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;

  const chatContainer = document.getElementById("chat-messages");
  if (chatContainer) {
    chatContainer.innerHTML += `<div class="bg-emerald-600/80 text-white p-2.5 rounded-xl ml-auto max-w-[85%]">${msg}</div>`;
    input.value = "";
    chatContainer.scrollTop = chatContainer.scrollHeight;

    const loadingId = "loading-" + Date.now();
    chatContainer.innerHTML += `<div id="${loadingId}" class="bg-slate-700/60 text-slate-400 p-2.5 rounded-xl max-w-[85%]">AI đang suy nghĩ...</div>`;

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      const loadingEl = document.getElementById(loadingId);
      if (loadingEl) loadingEl.remove();
      chatContainer.innerHTML += `<div class="bg-slate-700/60 text-slate-200 p-2.5 rounded-xl max-w-[85%]">${data.reply}</div>`;
    } catch (err) {
      const loadingEl = document.getElementById(loadingId);
      if (loadingEl) loadingEl.innerText = "Lỗi kết nối tới AI!";
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// 7. CHART.JS
function initChart() {
  const canvas = document.getElementById("sensorChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Nhiệt độ (°C)",
          data: [],
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245,158,11,0.1)",
          tension: 0.3,
          fill: true,
        },
        {
          label: "Độ ẩm đất (%)",
          data: [],
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.1)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#94a3b8", font: { size: 11 } } } },
      scales: {
        x: {
          ticks: { color: "#64748b" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          ticks: { color: "#64748b" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });
}

function updateChart(logs) {
  if (!chart) return;
  const reversed = [...logs].reverse();
  chart.data.labels = reversed.map((l) =>
    new Date(l.created_at).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
  chart.data.datasets[0].data = reversed.map((l) => l.temperature);
  chart.data.datasets[1].data = reversed.map((l) => l.soil_moisture);
  chart.update();
}

// GẮN CÁC HÀM XỬ LÝ VÀO PHẠM VI TOÀN CỤC (WINDOW)
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.togglePump = togglePump;
window.exportExcel = exportExcel;
window.toggleChatbox = toggleChatbox;
window.sendChatMessage = sendChatMessage;

// TỰ ĐỘNG KHỞI CHẠY KHỔI ĐẦU
window.onload = checkAuthSession;
