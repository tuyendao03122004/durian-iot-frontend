// Thay URL bằng đường dẫn API thực tế trên Render của bạn
const BACKEND_URL =
  "https://durian-iot-backend.onrender.com/api/v1/sensors/latest";

let sensorChart;

// Khởi tạo Biểu đồ Chart.js
function initChart() {
  const ctx = document.getElementById("sensorChart").getContext("2d");
  sensorChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Nhiệt độ (°C)",
          data: [],
          borderColor: "#fb7185",
          backgroundColor: "rgba(251, 113, 133, 0.1)",
          tension: 0.3,
          fill: true,
        },
        {
          label: "Độ ẩm không khí (%)",
          data: [],
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          tension: 0.3,
          fill: true,
        },
        {
          label: "Độ ẩm đất (%)",
          data: [],
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
      },
      plugins: {
        legend: { labels: { color: "#f8fafc" } },
      },
    },
  });
}

// Hàm lấy dữ liệu từ FastAPI Backend Render
async function fetchData() {
  const statusEl = document.getElementById("status");
  statusEl.innerText = "Đang tải dữ liệu...";
  statusEl.className = "text-amber-400 font-semibold";

  try {
    const response = await fetch(BACKEND_URL);
    if (!response.ok) throw new Error("Không thể kết nối Backend");

    const logs = await response.json();

    if (logs.length === 0) {
      statusEl.innerText = "Chưa có dữ liệu trong Database";
      return;
    }

    // Cập nhật giá trị hiển thị trên Card (Bản ghi mới nhất)
    const latest = logs[0];
    document.getElementById("temp").innerText = latest.temperature ?? "--";
    document.getElementById("hum").innerText = latest.humidity ?? "--";
    document.getElementById("soil").innerText = latest.soil_moisture ?? "--";
    document.getElementById("light").innerText = latest.light_lux ?? "--";
    document.getElementById("battery").innerText = latest.battery ?? "--";

    // Cập nhật Biểu đồ (Sắp xếp lại thời gian từ cũ tới mới)
    const reversedLogs = [...logs].reverse();
    const labels = reversedLogs.map((item) =>
      new Date(item.created_at).toLocaleTimeString("vi-VN"),
    );
    const tempData = reversedLogs.map((item) => item.temperature);
    const humData = reversedLogs.map((item) => item.humidity);
    const soilData = reversedLogs.map((item) => item.soil_moisture);

    sensorChart.data.labels = labels;
    sensorChart.data.datasets[0].data = tempData;
    sensorChart.data.datasets[1].data = humData;
    sensorChart.data.datasets[2].data = soilData;
    sensorChart.update();

    statusEl.innerText = "Hoạt động trực tuyến";
    statusEl.className = "text-emerald-400 font-semibold";
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu:", error);
    statusEl.innerText = "Lỗi kết nối Backend!";
    statusEl.className = "text-rose-500 font-semibold";
  }
}

// Chạy khởi tạo khi trang Web tải xong
window.onload = () => {
  initChart();
  fetchData();
  // Tự động làm mới dữ liệu mỗi 10 giây
  setInterval(fetchData, 10000);
};
