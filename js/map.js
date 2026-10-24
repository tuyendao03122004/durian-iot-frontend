// DỮ LIỆU CÁC MASTER NODE (Hỗ trợ lưu & khôi phục từ localStorage)
let MASTER_NODES_DATA = {
  master_1: {
    name: "Master 01 - Tiền Giang",
    location: "Tiền Giang",
    lat: 10.3563,
    lng: 106.3631,
    childNodes: ["node_1", "node_2", "node_3"],
  },
  master_2: {
    name: "Master 02 - Bến Tre",
    location: "Ben Tre",
    lat: 10.2431,
    lng: 106.3751,
    childNodes: ["node_4", "node_5", "node_6"],
  },
  master_3: {
    name: "Master 03 - Lâm Đồng",
    location: "Da Lat",
    lat: 11.9404,
    lng: 108.4583,
    childNodes: ["node_7", "node_8", "node_9"],
  },
};

let currentMasterKey = "master_1";
let map = null;
let markers = {};

// KHÔI PHỤC MASTER NODE TỪ LOCAL STORAGE NẾU CÓ
function loadSavedMasterNodes() {
  const saved = localStorage.getItem("custom_master_nodes");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      MASTER_NODES_DATA = { ...MASTER_NODES_DATA, ...parsed };
    } catch (e) {
      console.error("Lỗi đọc dữ liệu Master Nodes từ bộ nhớ");
    }
  }
}

// KHỞI TẠO BẢN ĐỒ LEAFLET
function initLeafletMap() {
  if (map) return;
  loadSavedMasterNodes();

  map = L.map("map").setView([10.3563, 106.3631], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  renderAllMarkers();
  updateMasterSelectOptions();
}

// VẼ LẠI TOÀN BỘ GHIM TRÊN BẢN ĐỒ
function renderAllMarkers() {
  // Xóa marker cũ
  Object.keys(markers).forEach((k) => map.removeLayer(markers[k]));
  markers = {};

  Object.keys(MASTER_NODES_DATA).forEach((key) => {
    const item = MASTER_NODES_DATA[key];
    const marker = L.marker([item.lat, item.lng]).addTo(map);
    marker.bindPopup(`<b>${item.name}</b><br>Khu vực: ${item.location}`);

    marker.on("click", () => {
      const selectEl = document.getElementById("master-select");
      if (selectEl) selectEl.value = key;
      switchMasterNode(key);
    });

    markers[key] = marker;
  });
}

// CẬP NHẬT DANH SÁCH SELECTOR TRẠM MASTER
function updateMasterSelectOptions() {
  const selectEl = document.getElementById("master-select");
  if (!selectEl) return;
  selectEl.innerHTML = "";

  Object.keys(MASTER_NODES_DATA).forEach((key) => {
    const item = MASTER_NODES_DATA[key];
    const opt = document.createElement("option");
    opt.value = key;
    opt.innerText = item.name;
    selectEl.appendChild(opt);
  });
  selectEl.value = currentMasterKey;
}

// CHUYỂN ĐỔI TRẠM MASTER HIỆN TẠI
function switchMasterNode(masterKey) {
  currentMasterKey = masterKey;
  const data = MASTER_NODES_DATA[masterKey];
  if (!data) return;

  document.getElementById("current-master-label").innerText = data.name;
  document.getElementById("farm-location").innerText = data.location;

  if (map) {
    map.flyTo([data.lat, data.lng], 10);
    if (markers[masterKey]) markers[masterKey].openPopup();
  }

  if (typeof renderChildNodesUI === "function")
    renderChildNodesUI(data.childNodes);
  if (typeof fetchWeather === "function") fetchWeather(data.location);
  if (typeof fetchSensorData === "function") fetchSensorData();
}

// THÊM TRẠM MASTER MỚI TỪ FORM MODAL
function handleAddMasterNode(e) {
  if (e) e.preventDefault();

  const id = document.getElementById("new-master-id").value.trim();
  const name = document.getElementById("new-master-name").value.trim();
  const city = document.getElementById("new-master-city").value.trim();
  const lat = parseFloat(document.getElementById("new-master-lat").value);
  const lng = parseFloat(document.getElementById("new-master-lng").value);

  if (!id || !name || !city || isNaN(lat) || isNaN(lng)) {
    alert("Vui lòng điền đầy đủ và chính xác thông tin!");
    return;
  }

  const key = `master_${id}`;
  // Tạo 3 node con mặc định cho trạm mới
  const childNodes = [`node_${id}_1`, `node_${id}_2`, `node_${id}_3`];

  MASTER_NODES_DATA[key] = {
    name: `${name} - ${city}`,
    location: city,
    lat: lat,
    lng: lng,
    childNodes: childNodes,
  };

  // Lưu vào localStorage
  const saved = JSON.parse(localStorage.getItem("custom_master_nodes") || "{}");
  saved[key] = MASTER_NODES_DATA[key];
  localStorage.setItem("custom_master_nodes", JSON.stringify(saved));

  // Cập nhật giao diện
  renderAllMarkers();
  updateMasterSelectOptions();
  switchMasterNode(key);

  closeAddMasterModal();
  alert(`Đã thêm thành công Trạm Master: ${name}`);
}

function openAddMasterModal() {
  const modal = document.getElementById("add-master-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeAddMasterModal() {
  const modal = document.getElementById("add-master-modal");
  if (modal) modal.classList.add("hidden");
}

window.initLeafletMap = initLeafletMap;
window.switchMasterNode = switchMasterNode;
window.handleAddMasterNode = handleAddMasterNode;
window.openAddMasterModal = openAddMasterModal;
window.closeAddMasterModal = closeAddMasterModal;
