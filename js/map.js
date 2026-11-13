const API_BASE = "https://durian-iot-backend.onrender.com/api/v1";
let pumpStates = {};
let chart = null;
let isSystemInitialized = false;

function safeSetInnerText(elementId, textValue) {
  const el = document.getElementById(elementId);
  if (el) el.innerText = textValue;
}

// ==========================================
// 1. AUTH & QUẢN LÝ PHIÊN ĐĂNG NHẬP
// ==========================================
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

    setTimeout(() => {
      if (window.map) {
        window.map.invalidateSize();
      }
    }, 300);
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

// ==========================================
// 2. KHỞI TẠO DASHBOARD SYSTEM
// ==========================================
function initDashboardSystem() {
  initChart();
  if (typeof initLeafletMap === "function") initLeafletMap();
  if (typeof switchMasterNode === "function") switchMasterNode("master_1");

  setInterval(updateRealtimeClock, 1000);
  updateRealtimeClock();

  setInterval(fetchSensorData, 5000);
  setInterval(evaluateAutoPumpLogic, 3000);
}

function updateRealtimeClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN", { hour12: false });
  const dateStr = now.toLocaleDateString("vi-VN");
  safeSetInnerText("realtime-clock", `${timeStr} - ${dateStr}`);
}

// ==========================================
// 3. XỬ LÝ ĐIỀU KHIỂN NODE PUMP WI-FI & NODE CON (SLAVE)
// ==========================================
function renderMasterPumpAndChildNodes(masterData) {
  const container = document.getElementById("child-nodes-container");
  if (!container) return;
  container.innerHTML = "";

  if (!masterData) {
    const currentKey = window.getCurrentMasterKey
      ? window.getCurrentMasterKey()
      : "master_1";
    masterData = window.MASTER_NODES_DATA
      ? window.MASTER_NODES_DATA[currentKey]
      : null;
  }
  if (!masterData) return;

  const pump = masterData.pumpNode || {
    id: "pump_wifi_1",
    name: "Node Pump (Wi-Fi Direct)",
    status: false,
    mode: "auto",
    minThreshold: 50,
    maxThreshold: 80,
    connection: "Wi-Fi / MQTT",
  };

  const isAuto = pump.mode === "auto";

  // A. CARD ĐIỀU KHIỂN NODE PUMP WI-FI
  const pumpCard = document.createElement("div");
  pumpCard.className =
    "col-span-1 md:col-span-3 bg-slate-800/90 border-2 border-amber-500/50 rounded-2xl p-4 shadow-xl space-y-4";
  pumpCard.innerHTML = `
    <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-700/80 pb-3">
      <div class="flex items-center space-x-2.5">
        <span class="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl text-xl"><i class="fa-solid fa-wifi"></i></span>
        <div>
          <h3 class="font-bold text-sm text-slate-100 flex items-center space-x-2">
            <span>${pump.name} (${pump.id})</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full ${pump.status ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-slate-700 text-slate-400"} font-mono">
              ${pump.status ? "🟢 BƠM ĐANG BẬT" : "🔴 BƠM ĐÃ TẮT"}
            </span>
          </h3>
          <p class="text-[11px] text-slate-400">Kết nối: <span class="text-blue-400 font-semibold">${pump.connection || "Wi-Fi / MQTT"}</span> | Trực thuộc: <b class="text-emerald-400">${masterData.name}</b></p>
        </div>
      </div>

      <!-- CÔNG TẮC AUTO / MANUAL -->
      <div class="flex bg-slate-900/90 p-1 rounded-xl border border-slate-700 text-xs font-semibold">
        <button onclick="window.setMasterPumpMode('auto')" class="px-3 py-1.5 rounded-lg transition ${isAuto ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"} flex items-center space-x-1 cursor-pointer">
          <i class="fa-solid fa-robot"></i>
          <span>Tự Động</span>
        </button>
        <button onclick="window.setMasterPumpMode('manual')" class="px-3 py-1.5 rounded-lg transition ${!isAuto ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:text-white"} flex items-center space-x-1 cursor-pointer">
          <i class="fa-solid fa-hand"></i>
          <span>Thủ Công</span>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
      <!-- CÀI ĐẶT 2 NGƯỠNG ĐỘ ẨM MIN/MAX -->
      <div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 space-y-3">
        <div class="space-y-1">
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-300 font-medium">💧 Ngưỡng BẬT BƠM (Độ ẩm &lt;):</span>
            <span class="font-bold text-amber-400 font-mono text-xs">${pump.minThreshold}%</span>
          </div>
          <input type="range" min="20" max="70" value="${pump.minThreshold}" onchange="window.updateMasterPumpMinThreshold(this.value)" oninput="this.previousElementSibling.querySelector('.text-amber-400').innerText = this.value + '%'" class="w-full accent-amber-500 cursor-pointer">
        </div>

        <div class="space-y-1">
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-300 font-medium">🌱 Ngưỡng TẮT BƠM (Độ ẩm &gt;):</span>
            <span class="font-bold text-emerald-400 font-mono text-xs">${pump.maxThreshold}%</span>
          </div>
          <input type="range" min="60" max="95" value="${pump.maxThreshold}" onchange="window.updateMasterPumpMaxThreshold(this.value)" oninput="this.previousElementSibling.querySelector('.text-emerald-400').innerText = this.value + '%'" class="w-full accent-emerald-500 cursor-pointer">
        </div>
      </div>

      <!-- ĐIỀU KHIỂN BƠM THỦ CÔNG QUA WI-FI -->
      <div class="flex flex-col space-y-2">
        <span class="text-[11px] text-slate-400">Điều khiển trực tiếp qua Wi-Fi:</span>
        <div class="flex space-x-2">
          <button onclick="executePumpCommand('${window.getCurrentMasterKey ? window.getCurrentMasterKey() : "master_1"}', '${pump.id}', 'ON')" ${isAuto ? 'disabled title="Vô hiệu hóa khi ở chế độ Tự Động"' : ""} class="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition ${pump.status ? "bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400" : "bg-slate-700 text-slate-300 hover:bg-emerald-600 hover:text-white"} ${isAuto ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} flex items-center justify-center space-x-1.5">
            <i class="fa-solid fa-power-off"></i>
            <span>BẬT BƠM</span>
          </button>
          <button onclick="executePumpCommand('${window.getCurrentMasterKey ? window.getCurrentMasterKey() : "master_1"}', '${pump.id}', 'OFF')" ${isAuto ? 'disabled title="Vô hiệu hóa khi ở chế độ Tự Động"' : ""} class="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition ${!pump.status ? "bg-red-600 text-white shadow-lg ring-2 ring-red-400" : "bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white"} ${isAuto ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} flex items-center justify-center space-x-1.5">
            <i class="fa-solid fa-ban"></i>
            <span>TẮT BƠM</span>
          </button>
        </div>
        <p class="text-[10px] text-slate-400 italic">Lưu ý: Nút Bật/Tắt thủ công chỉ có hiệu lực khi chuyển sang chế độ <b>Thủ Công</b>.</p>
      </div>
    </div>
  `;
  container.appendChild(pumpCard);

  // B. DANH SÁCH NODE CON SLAVE (CÓ NÚT TẠM NGƯNG & NÚT XÓA)
  const childNodesList = masterData.childNodes || [];
  const disabledList = masterData.disabledNodes || [];

  if (childNodesList.length === 0) {
    const emptyCard = document.createElement("div");
    emptyCard.className =
      "col-span-1 md:col-span-3 text-center py-4 text-slate-400 text-xs italic bg-slate-800/40 rounded-xl border border-slate-700/50";
    emptyCard.innerText =
      "Chưa có Node con cảm biến nào thuộc Trạm Master này. Nhấn 'Thêm Node Con' để tạo mới.";
    container.appendChild(emptyCard);
    return;
  }

  childNodesList.forEach((nodeId, idx) => {
    const isDisabled = disabledList.includes(nodeId);
    const card = document.createElement("div");
    card.className = `border p-3.5 rounded-xl space-y-2.5 transition ${
      isDisabled
        ? "bg-slate-900/50 border-slate-700/50 opacity-60"
        : "bg-slate-800/70 border-slate-700 hover:border-emerald-500/50"
    }`;

    card.innerHTML = `
      <div class="flex justify-between items-start gap-2">
        <span class="font-bold text-xs ${isDisabled ? "text-slate-400 line-through" : "text-emerald-400"} flex items-center space-x-1.5 pt-0.5">
          <i class="fa-solid fa-microchip"></i>
          <span>Gốc Sầu Riêng - Node ${idx + 1} (${nodeId})</span>
        </span>

        <!-- CỤM NÚT QUẢN LÝ NODE CON KHÔNG DÙNG -->
        <div class="flex items-center space-x-1.5 flex-shrink-0">
          <button
            onclick="window.toggleSlaveNodeActive('${nodeId}')"
            class="px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer border ${
              isDisabled
                ? "bg-slate-800 text-slate-300 border-slate-600 hover:bg-emerald-600/20 hover:text-emerald-300 hover:border-emerald-500/40"
                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/40"
            }"
            title="${isDisabled ? "Bấm để kích hoạt lại Node này" : "Bấm để tạm ngưng Node không dùng"}"
          >
            ${isDisabled ? "⚪ Không dùng" : "🟢 Đang dùng"}
          </button>

          <button
            onclick="window.deleteSlaveNodeFromMaster('${nodeId}')"
            class="bg-red-500/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer flex items-center space-x-1"
            title="Xóa bỏ Node con này"
          >
            <i class="fa-solid fa-trash-can"></i>
            <span>Xóa</span>
          </button>
        </div>
      </div>

      <div class="text-[11px] text-slate-300 space-y-1">
        <div class="flex justify-between">
          <span>Độ ẩm đất (LoRa):</span>
          <b class="${isDisabled ? "text-slate-500" : "text-emerald-300"}">${isDisabled ? "Tạm ngưng" : `${55 + idx * 4} %`}</b>
        </div>
        <div class="flex justify-between">
          <span>Nhiệt độ lá:</span>
          <b class="${isDisabled ? "text-slate-500" : "text-amber-300"}">${isDisabled ? "Tạm ngưng" : `${28 + idx} °C`}</b>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderChildNodesUI(childNodesList) {
  const currentKey = window.getCurrentMasterKey
    ? window.getCurrentMasterKey()
    : "master_1";
  const masterData = window.MASTER_NODES_DATA
    ? window.MASTER_NODES_DATA[currentKey]
    : null;

  if (masterData) {
    if (childNodesList) masterData.childNodes = childNodesList;
    renderMasterPumpAndChildNodes(masterData);
  }
}

async function executePumpCommand(masterId, pumpId, action) {
  const currentKey =
    masterId ||
    (window.getCurrentMasterKey ? window.getCurrentMasterKey() : "master_1");
  const master = window.MASTER_NODES_DATA
    ? window.MASTER_NODES_DATA[currentKey]
    : null;

  try {
    await fetch(`${API_BASE}/control/pump`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        master_id: currentKey,
        node_id: pumpId,
        action: action,
      }),
    });
  } catch (err) {
    console.error("Lỗi gửi lệnh bơm Wi-Fi tới Backend:", err);
  }

  if (master && master.pumpNode) {
    master.pumpNode.status = action === "ON";
    if (window.saveMasterNodesToStorage) window.saveMasterNodesToStorage();
    renderMasterPumpAndChildNodes(master);
  }
}

async function evaluateAutoPumpLogic() {
  const currentKey = window.getCurrentMasterKey
    ? window.getCurrentMasterKey()
    : "master_1";
  const master = window.MASTER_NODES_DATA
    ? window.MASTER_NODES_DATA[currentKey]
    : null;
  if (!master || !master.pumpNode) return;

  const pump = master.pumpNode;
  const soilCard = document.getElementById("card-soil");
  if (!soilCard) return;

  const soilText = soilCard.innerText.replace("%", "").trim();
  const currentSoilMoisture = parseFloat(soilText);
  if (isNaN(currentSoilMoisture)) return;

  if (pump.mode === "auto") {
    if (currentSoilMoisture < pump.minThreshold && !pump.status) {
      await executePumpCommand(currentKey, pump.id, "ON");
    } else if (currentSoilMoisture > pump.maxThreshold && pump.status) {
      await executePumpCommand(currentKey, pump.id, "OFF");
    }
  }
}

function openAddSlaveModal() {
  const modal = document.getElementById("add-slave-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeAddSlaveModal() {
  const modal = document.getElementById("add-slave-modal");
  if (modal) modal.classList.add("hidden");
  const input = document.getElementById("new-slave-id");
  if (input) input.value = "";
}

function handleAddSlaveNode(event) {
  if (event) event.preventDefault();
  const slaveIdInput = document.getElementById("new-slave-id");
  if (!slaveIdInput) return;
  const slaveId = slaveIdInput.value.trim();

  if (slaveId) {
    if (typeof window.addSlaveNodeToCurrentMaster === "function") {
      const success = window.addSlaveNodeToCurrentMaster(slaveId);
      if (success) {
        renderChildNodesUI();
        closeAddSlaveModal();
      }
    }
  }
}

// ==========================================
// 4. LẤY DỮ LIỆU CẢM BIẾN & THỜI TIẾT
// ==========================================
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

// ==========================================
// 5. DỰ BÁO THỜI TIẾT 7 NGÀY & KHUNG GIỜ
// ==========================================
function getWeatherIconClass(iconCode) {
  if (!iconCode) return "fa-cloud-sun text-amber-400";
  if (iconCode.startsWith("01")) return "fa-sun text-amber-400";
  if (iconCode.startsWith("02")) return "fa-cloud-sun text-yellow-300";
  if (iconCode.startsWith("03") || iconCode.startsWith("04"))
    return "fa-cloud text-slate-300";
  if (iconCode.startsWith("09") || iconCode.startsWith("10"))
    return "fa-cloud-sun-rain text-blue-400";
  if (iconCode.startsWith("11"))
    return "fa-cloud-showers-heavy text-indigo-400";
  if (iconCode.startsWith("13")) return "fa-snowflake text-cyan-300";
  return "fa-cloud-sun text-amber-400";
}

async function openWeatherForecastModal() {
  const modal = document.getElementById("weather-forecast-modal");
  const container = document.getElementById("forecast-7days-list");
  if (!modal || !container) return;

  const city =
    document.getElementById("farm-location")?.innerText || "Tien Giang";
  safeSetInnerText("forecast-modal-city", city);

  container.innerHTML = `
      <div class="text-center py-8 text-slate-400 font-medium animate-pulse text-xs">
          <i class="fa-solid fa-spinner fa-spin text-lg mb-2 text-emerald-400"></i>
          <p>Đang kết nối vệ tinh thời tiết khu vực ${city}...</p>
      </div>
  `;
  modal.classList.remove("hidden");

  try {
    const res = await fetch(
      `${API_BASE}/weather/forecast?city=${encodeURIComponent(city)}`,
    );
    const data = await res.json();

    if (!data.forecast || data.forecast.length === 0) {
      container.innerHTML = `<div class="text-center py-6 text-amber-400 text-xs">${data.message || "Chưa tìm thấy dữ liệu thời tiết."}</div>`;
      return;
    }

    container.innerHTML = "";
    const daysOfWeek = [
      "Chủ Nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];

    data.forecast.forEach((dayData, i) => {
      const dateObj = new Date(dayData.date);
      const dayName = i === 0 ? "Hôm nay" : daysOfWeek[dateObj.getDay()];
      const dateFormatted = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      const iconClass = getWeatherIconClass(dayData.icon_code);

      let hourlyHTML = dayData.hourly
        .map((h) => {
          const hIconClass = getWeatherIconClass(h.icon);
          return `
              <div class="bg-slate-900/90 p-2.5 rounded-xl text-center border border-slate-700/60 shadow-inner">
                  <p class="text-[11px] text-slate-400 font-mono font-bold">${h.time}</p>
                  <div class="my-1 text-base"><i class="fa-solid ${hIconClass}"></i></div>
                  <p class="text-xs font-bold text-amber-300">${h.temp}</p>
                  <p class="text-[10px] text-blue-400 mt-0.5">${h.humidity}</p>
              </div>
          `;
        })
        .join("");

      container.innerHTML += `
        <div class="bg-slate-800/90 rounded-xl border border-slate-700/80 overflow-hidden shadow">
            <div onclick="toggleHourlyForecast(${i})" class="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/50 transition select-none">
                <div class="flex items-center space-x-3">
                    <div class="text-2xl w-8 text-center"><i class="fa-solid ${iconClass}"></i></div>
                    <div>
                        <p class="font-bold text-slate-200 text-sm">${dayName} <span class="text-slate-400 font-normal">(${dateFormatted})</span></p>
                        <p class="text-xs text-slate-400 mt-0.5">${dayData.description}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-4 text-right">
                    <div>
                        <p class="font-bold text-amber-300 text-sm">${dayData.temp_range}</p>
                        <p class="text-xs text-blue-400">Độ ẩm TB: ${dayData.avg_humidity}</p>
                    </div>
                    <i id="arrow-icon-${i}" class="fa-solid fa-chevron-down text-slate-400 text-sm transition-transform duration-300"></i>
                </div>
            </div>

            <div id="hourly-container-${i}" class="hidden bg-slate-950/70 p-4 border-t border-slate-700/60">
                <p class="text-xs font-bold text-emerald-400 mb-2.5 flex items-center space-x-1.5">
                    <i class="fa-regular fa-clock"></i>
                    <span>Dự báo các khung giờ trong ngày (${dayName} - ${dateFormatted}):</span>
                </p>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    ${hourlyHTML}
                </div>
            </div>
        </div>
      `;
    });
  } catch (err) {
    container.innerHTML = `<div class="text-center py-6 text-red-400 text-xs">Lỗi kết nối máy chủ thời tiết!</div>`;
  }
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

// ==========================================
// 6. XUẤT EXCEL & CHATBOT AI
// ==========================================
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

// ==========================================
// 7. CẤU HÌNH BIỂU ĐỒ CHART.JS
// ==========================================
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

// ==========================================
// GẮN CÁC HÀM XỬ LÝ VÀO PHẠM VI TOÀN CỤC (WINDOW)
// ==========================================
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.executePumpCommand = executePumpCommand;
window.renderMasterPumpAndChildNodes = renderMasterPumpAndChildNodes;
window.renderChildNodesUI = renderChildNodesUI;
window.openAddSlaveModal = openAddSlaveModal;
window.closeAddSlaveModal = closeAddSlaveModal;
window.handleAddSlaveNode = handleAddSlaveNode;
window.exportExcel = exportExcel;
window.toggleChatbox = toggleChatbox;
window.sendChatMessage = sendChatMessage;
window.openWeatherForecastModal = openWeatherForecastModal;
window.closeWeatherForecastModal = closeWeatherForecastModal;
window.toggleHourlyForecast = toggleHourlyForecast;

window.onload = checkAuthSession;
