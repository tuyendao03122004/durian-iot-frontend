const API_BASE = "https://durian-iot-backend.onrender.com/api/v1";
let pumpStates = {};
let chart = null;
let isSystemInitialized = false;

function safeSetInnerText(elementId, textValue) {
  const el = document.getElementById(elementId);
  if (el) el.innerText = textValue;
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

// 2. KHỞI TẠO DASHBOARD SYSTEM
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

// 3. XỬ LÝ ĐIỀU KHIỂN BƠM CỦA CÁC NODE CON
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
    const res = await fetch(`${API_BASE}/sensors/latest?limit=15`);
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

// 5. DỰ BÁO THỜI TIẾT 7 NGÀY & CHI TIẾT THEO GIỜ
function openWeatherForecastModal() {
  const modal = document.getElementById("weather-forecast-modal");
  const container = document.getElementById("forecast-7days-list");
  if (!modal || !container) return;

  const city =
    document.getElementById("farm-location")?.innerText || "Tiền Giang";
  safeSetInnerText("forecast-modal-city", city);

  const days = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ];
  const weatherTypes = [
    {
      desc: "Nắng tốt, mây thưa",
      icon: "fa-sun text-amber-400",
      temp: "28°C - 33°C",
      hum: "68%",
    },
    {
      desc: "Mây rải rác, nắng nhẹ",
      icon: "fa-cloud-sun text-yellow-300",
      temp: "27°C - 32°C",
      hum: "72%",
    },
    {
      desc: "Mưa rào nhẹ buổi chiều",
      icon: "fa-cloud-sun-rain text-blue-400",
      temp: "25°C - 30°C",
      hum: "82%",
    },
    {
      desc: "Mưa dông dải rác",
      icon: "fa-cloud-showers-heavy text-indigo-400",
      temp: "24°C - 29°C",
      hum: "88%",
    },
    {
      desc: "Nhiều mây, hửng nắng",
      icon: "fa-cloud text-slate-300",
      temp: "26°C - 31°C",
      hum: "75%",
    },
    {
      desc: "Nắng rực rỡ",
      icon: "fa-sun text-amber-400",
      temp: "29°C - 34°C",
      hum: "65%",
    },
    {
      desc: "Nắng ấm, chiều mát",
      icon: "fa-cloud-sun text-amber-300",
      temp: "27°C - 33°C",
      hum: "70%",
    },
  ];

  container.innerHTML = "";
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const nextDate = new Date();
    nextDate.setDate(today.getDate() + i);
    const dayName = i === 0 ? "Hôm nay" : days[nextDate.getDay()];
    const dateStr = `${nextDate.getDate()}/${nextDate.getMonth() + 1}`;
    const w = weatherTypes[i % weatherTypes.length];

    const hourlyData = [
      {
        time: "06:00",
        temp: "24°C",
        hum: "85%",
        icon: "fa-sun text-amber-300",
        desc: "Nắng sớm",
      },
      {
        time: "09:00",
        temp: "28°C",
        hum: "75%",
        icon: "fa-cloud-sun text-amber-400",
        desc: "Nắng nhẹ",
      },
      {
        time: "12:00",
        temp: "32°C",
        hum: "65%",
        icon: "fa-sun text-amber-400",
        desc: "Nắng gắt",
      },
      {
        time: "15:00",
        temp: "30°C",
        hum: "70%",
        icon: "fa-cloud-sun-rain text-blue-400",
        desc: "Mưa rào nhẹ",
      },
      {
        time: "18:00",
        temp: "27°C",
        hum: "80%",
        icon: "fa-cloud text-slate-300",
        desc: "Mát mẻ",
      },
      {
        time: "21:00",
        temp: "25°C",
        hum: "88%",
        icon: "fa-moon text-indigo-300",
        desc: "Đêm quang mây",
      },
    ];

    let hourlyHTML = hourlyData
      .map(
        (h) => `
            <div class="bg-slate-900/90 p-2.5 rounded-xl text-center border border-slate-700/60 shadow-inner">
                <p class="text-[11px] text-slate-400 font-mono font-bold">${h.time}</p>
                <div class="my-1 text-base"><i class="fa-solid ${h.icon}"></i></div>
                <p class="text-xs font-bold text-amber-300">${h.temp}</p>
                <p class="text-[10px] text-blue-400 mt-0.5">${h.hum}</p>
            </div>
        `,
      )
      .join("");

    container.innerHTML += `
      <div class="bg-slate-800/90 rounded-xl border border-slate-700/80 overflow-hidden shadow">
          <!-- TIÊU ĐỀ NGÀY -->
          <div onclick="toggleHourlyForecast(${i})" class="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/50 transition select-none">
              <div class="flex items-center space-x-3">
                  <div class="text-2xl w-8 text-center"><i class="fa-solid ${w.icon}"></i></div>
                  <div>
                      <p class="font-bold text-slate-200 text-sm">${dayName} <span class="text-slate-400 font-normal">(${dateStr})</span></p>
                      <p class="text-xs text-slate-400 mt-0.5">${w.desc}</p>
                  </div>
              </div>
              <div class="flex items-center space-x-4 text-right">
                  <div>
                      <p class="font-bold text-amber-300 text-sm">${w.temp}</p>
                      <p class="text-xs text-blue-400">Độ ẩm: ${w.hum}</p>
                  </div>
                  <i id="arrow-icon-${i}" class="fa-solid fa-chevron-down text-slate-400 text-sm transition-transform duration-300"></i>
              </div>
          </div>

          <!-- CHI TIẾT THEO GIỜ -->
          <div id="hourly-container-${i}" class="hidden bg-slate-950/70 p-4 border-t border-slate-700/60">
              <p class="text-xs font-bold text-emerald-400 mb-2.5 flex items-center space-x-1.5">
                  <i class="fa-regular fa-clock"></i>
                  <span>Chi tiết thời tiết theo giờ (${dayName} - ${dateStr}):</span>
              </p>
              <div class="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  ${hourlyHTML}
              </div>
          </div>
      </div>
    `;
  }

  modal.classList.remove("hidden");
}

function toggleHourlyForecast(index) {
  const container = document.getElementById(`hourly-container-${index}`);
  const arrow = document.getElementById(`arrow-icon-${index}`);

  if (container) {
    const isHidden = container.classList.contains("hidden");
    if (isHidden) {
      container.classList.remove("hidden");
      if (arrow) arrow.style.transform = "rotate(180deg)";
    } else {
      container.classList.add("hidden");
      if (arrow) arrow.style.transform = "rotate(0deg)";
    }
  }
}

function closeWeatherForecastModal() {
  const modal = document.getElementById("weather-forecast-modal");
  if (modal) modal.classList.add("hidden");
}

// 6. XUẤT EXCEL & CHATBOT AI
function exportExcel() {
  window.open(`${API_BASE}/export/excel`, "_blank");
}

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

// 7. CẤU HÌNH BIỂU ĐỒ CHART.JS
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
window.openWeatherForecastModal = openWeatherForecastModal;
window.closeWeatherForecastModal = closeWeatherForecastModal;
window.toggleHourlyForecast = toggleHourlyForecast;

window.onload = checkAuthSession;
