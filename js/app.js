const API_BASE = "https://durian-iot-backend.onrender.com/api/v1";
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
  if (typeof initLeafletMap === "function") {
    initLeafletMap();
  }

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

// ==========================================
// 3. QUẢN LÝ DANH SÁCH NODE CON (SLAVE NODES)
// ==========================================
function renderChildNodesUI(masterDataOrList) {
  const container = document.getElementById("child-nodes-container");
  if (!container) return;
  container.innerHTML = "";

  const currentKey = window.getCurrentMasterKey
    ? window.getCurrentMasterKey()
    : "master_1";
  const masterData =
    masterDataOrList && !Array.isArray(masterDataOrList)
      ? masterDataOrList
      : window.MASTER_NODES_DATA
        ? window.MASTER_NODES_DATA[currentKey]
        : null;

  if (!masterData) return;

  const childNodesList = Array.isArray(masterDataOrList)
    ? masterDataOrList
    : masterData.childNodes || [];
  const disabledList = masterData.disabledNodes || [];
  const selectedSlaveId = window.getSelectedSlaveId
    ? window.getSelectedSlaveId()
    : masterData.selectedSlaveId;

  updateChartTitle(selectedSlaveId);

  if (childNodesList.length === 0) {
    const emptyCard = document.createElement("div");
    emptyCard.className =
      "col-span-1 md:col-span-3 text-center py-6 text-slate-400 text-xs italic bg-slate-800/40 rounded-xl border border-slate-700/50";
    emptyCard.innerText =
      "Chưa có Node con cảm biến nào thuộc Trạm Master này. Hãy nhấn nút 'Thêm Node Con' để tạo mới.";
    container.appendChild(emptyCard);
    return;
  }

  childNodesList.forEach((nodeId, idx) => {
    const isSelected = nodeId === selectedSlaveId;
    const isDisabled = disabledList.includes(nodeId);

    const card = document.createElement("div");
    card.onclick = () => window.selectSlaveNode(nodeId);
    card.className = `p-3.5 rounded-xl space-y-2.5 relative cursor-pointer transition border ${
      isDisabled
        ? "bg-slate-900/50 border-slate-700/50 opacity-60"
        : isSelected
          ? "bg-emerald-950/40 border-emerald-400 ring-1 ring-emerald-400/60 shadow-lg"
          : "bg-slate-800/70 border-slate-700 hover:border-emerald-500/50"
    }`;

    card.innerHTML = `
      <div class="flex justify-between items-start gap-2">
        <span class="font-bold text-xs ${isDisabled ? "text-slate-400 line-through" : "text-emerald-400"} flex items-center space-x-1.5 pt-0.5">
          <i class="fa-solid fa-microchip"></i>
          <span>Gốc Sầu Riêng - Node ${idx + 1} (${nodeId})</span>
        </span>

        <div class="flex items-center space-x-1.5 flex-shrink-0">
          <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${
            isSelected
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "bg-slate-700/70 text-slate-400"
          }">
            ${isSelected ? "📊 Đang xem" : "Chọn xem"}
          </span>

          <button
            onclick="event.stopPropagation(); window.toggleSlaveNodeActive('${nodeId}')"
            class="px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer border ${
              isDisabled
                ? "bg-slate-800 text-slate-300 border-slate-600 hover:bg-emerald-600/20 hover:text-emerald-300"
                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-amber-500/20 hover:text-amber-300"
            }"
            title="${isDisabled ? "Bấm để kích hoạt lại Node này" : "Bấm để tạm ngưng Node không dùng"}"
          >
            ${isDisabled ? "⚪ Không dùng" : "🟢 Đang dùng"}
          </button>

          <button
            onclick="event.stopPropagation(); window.deleteSlaveNodeFromMaster('${nodeId}')"
            class="bg-red-500/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer"
            title="Xóa Node con này"
          >
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>

      <div class="text-[11px] text-slate-300 space-y-1">
        <div class="flex justify-between">
          <span>Độ ẩm đất (LoRa):</span>
          <b id="slave-soil-${nodeId}" class="${isDisabled ? "text-slate-500" : "text-emerald-300"}">${isDisabled ? "Tạm ngưng" : "-- %"}</b>
        </div>
        <div class="flex justify-between">
          <span>Nhiệt độ lá:</span>
          <b id="slave-temp-${nodeId}" class="${isDisabled ? "text-slate-500" : "text-amber-300"}">${isDisabled ? "Tạm ngưng" : "-- °C"}</b>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateChartTitle(selectedSlaveId) {
  const canvas = document.getElementById("sensorChart");
  if (!canvas) return;
  const heading = canvas.closest(".glass")?.querySelector("h2 span");
  if (heading) {
    heading.innerText = selectedSlaveId
      ? `Biểu Đồ Xu Hướng Cảm Biến - Node Con (${selectedSlaveId})`
      : "Biểu Đồ Xu Hướng Cảm Biến (Chưa có Node con)";
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
        fetchSensorData();
        closeAddSlaveModal();
      }
    }
  }
}

// ==========================================
// 4. LẤY DỮ LIỆU CẢM BIẾN THEO TỪNG NODE CON & THỜI TIẾT
// ==========================================
function resetSensorDisplay() {
  safeSetInnerText("card-temp", "-- °C");
  safeSetInnerText("card-humidity", "-- %");
  safeSetInnerText("card-soil", "-- %");
  safeSetInnerText("card-light", "-- Lux");
  safeSetInnerText("card-battery", "-- %");

  if (chart) {
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.update();
  }
}

function formatMetric(val, decimals = 1) {
  if (val === undefined || val === null || isNaN(Number(val))) return "--";
  return Number(Number(val).toFixed(decimals));
}

async function fetchSensorData() {
  const currentKey = window.getCurrentMasterKey
    ? window.getCurrentMasterKey()
    : "master_1";
  const masterData = window.MASTER_NODES_DATA
    ? window.MASTER_NODES_DATA[currentKey]
    : null;
  const childNodes = masterData?.childNodes || [];
  const disabledNodes = masterData?.disabledNodes || [];
  const selectedSlaveId = window.getSelectedSlaveId
    ? window.getSelectedSlaveId()
    : null;

  if (
    childNodes.length === 0 ||
    !selectedSlaveId ||
    disabledNodes.includes(selectedSlaveId)
  ) {
    resetSensorDisplay();
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/sensors/latest?node_id=${encodeURIComponent(selectedSlaveId)}&master_id=${encodeURIComponent(currentKey)}&limit=15`,
    );
    const rawData = await res.json();

    if (!Array.isArray(rawData) || rawData.length === 0) {
      resetSensorDisplay();
      return;
    }

    const hasNodeField = rawData.some(
      (item) => item.node_id !== undefined || item.slave_id !== undefined,
    );
    const nodeLogs = hasNodeField
      ? rawData.filter(
          (item) =>
            item.node_id === selectedSlaveId ||
            item.slave_id === selectedSlaveId,
        )
      : rawData;

    if (nodeLogs.length === 0) {
      resetSensorDisplay();
      return;
    }

    const latest = nodeLogs[0];
    const tempVal = formatMetric(latest.temperature, 1);
    const humVal = formatMetric(latest.humidity, 1);
    const soilVal = formatMetric(latest.soil_moisture, 1);
    const lightVal = formatMetric(latest.light_lux, 0);
    const batVal = formatMetric(latest.battery, 0);

    safeSetInnerText("card-temp", `${tempVal} °C`);
    safeSetInnerText("card-humidity", `${humVal} %`);
    safeSetInnerText("card-soil", `${soilVal} %`);
    safeSetInnerText("card-light", `${lightVal} Lux`);
    safeSetInnerText("card-battery", `${batVal} %`);

    safeSetInnerText(`slave-soil-${selectedSlaveId}`, `${soilVal} %`);
    safeSetInnerText(`slave-temp-${selectedSlaveId}`, `${tempVal} °C`);

    updateChart(nodeLogs);
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
  chart.data.datasets[0].data = reversed.map((l) =>
    formatMetric(l.temperature, 1),
  );
  chart.data.datasets[1].data = reversed.map((l) =>
    formatMetric(l.soil_moisture, 1),
  );
  chart.update();
}

// ==========================================
// GẮN CÁC HÀM XỬ LÝ VÀ DỮ LIỆU VÀO PHẠM VI TOÀN CỤC (WINDOW)
// ==========================================
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.fetchSensorData = fetchSensorData;
window.renderChildNodesUI = renderChildNodesUI;
window.renderMasterPumpAndChildNodes = renderChildNodesUI;
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
