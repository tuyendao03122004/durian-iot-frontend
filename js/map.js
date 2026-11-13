// DỮ LIỆU MẶC ĐỊNH CÁC MASTER NODE (Node Pump kết nối Wi-Fi trực tiếp Server)
const DEFAULT_MASTER_NODES = {
  master_1: {
    name: "Master 01 - Tiền Giang",
    location: "Tiền Giang",
    lat: 10.3563,
    lng: 106.3631,
    childNodes: ["node_1_1", "node_1_2", "node_1_3"],
    pumpNode: {
      id: "pump_wifi_1",
      name: "Node Pump 01 (Wi-Fi Direct)",
      status: false, // false: Tắt, true: Bật
      mode: "auto", // "auto": Tự động, "manual": Thủ công
      minThreshold: 50, // Bật bơm khi Độ ẩm đất < 50%
      maxThreshold: 80, // Tắt bơm khi Độ ẩm đất > 80%
      connection: "Wi-Fi / MQTT",
    },
  },
  master_2: {
    name: "Master 02 - Bến Tre",
    location: "Ben Tre",
    lat: 10.2431,
    lng: 106.3751,
    childNodes: ["node_2_1", "node_2_2", "node_2_3"],
    pumpNode: {
      id: "pump_wifi_2",
      name: "Node Pump 02 (Wi-Fi Direct)",
      status: false,
      mode: "manual",
      minThreshold: 45,
      maxThreshold: 75,
      connection: "Wi-Fi / MQTT",
    },
  },
  master_3: {
    name: "Master 03 - Lâm Đồng",
    location: "Da Lat",
    lat: 11.9404,
    lng: 108.4583,
    childNodes: ["node_3_1", "node_3_2", "node_3_3"],
    pumpNode: {
      id: "pump_wifi_3",
      name: "Node Pump 03 (Wi-Fi Direct)",
      status: false,
      mode: "auto",
      minThreshold: 50,
      maxThreshold: 80,
      connection: "Wi-Fi / MQTT",
    },
  },
};

let MASTER_NODES_DATA = { ...DEFAULT_MASTER_NODES };
let currentMasterKey = "master_1";
let map = null;
let markers = {};
let tempPickMarker = null; // Marker tạm thời khi click chọn trên bản đồ

// KHÔI PHỤC MASTER NODE TỪ LOCAL STORAGE NẾU CÓ
function loadSavedMasterNodes() {
  const saved = localStorage.getItem("custom_master_nodes");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && Object.keys(parsed).length > 0) {
        MASTER_NODES_DATA = parsed;
      }
    } catch (e) {
      console.error("Lỗi đọc dữ liệu Master Nodes từ bộ nhớ");
    }
  }
  window.MASTER_NODES_DATA = MASTER_NODES_DATA;
}

// LƯU DỮ LIỆU MASTER NODE VÀ SLAVE NODE VÀO LOCAL STORAGE
function saveMasterNodesToStorage() {
  localStorage.setItem(
    "custom_master_nodes",
    JSON.stringify(MASTER_NODES_DATA),
  );
  window.MASTER_NODES_DATA = MASTER_NODES_DATA;
}

// HÀM LÀM MỚI KÍCH THƯỚC BẢN ĐỒ
function refreshMapSize() {
  if (map) {
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }
}

// KHỞI TẠO BẢN ĐỒ LEAFLET
function initLeafletMap() {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  if (map) {
    refreshMapSize();
    return;
  }
  loadSavedMasterNodes();

  if (!MASTER_NODES_DATA[currentMasterKey]) {
    currentMasterKey = Object.keys(MASTER_NODES_DATA)[0] || "master_1";
  }

  const currentData = MASTER_NODES_DATA[currentMasterKey] || {
    lat: 10.3563,
    lng: 106.3631,
  };
  map = L.map("map").setView([currentData.lat, currentData.lng], 13);

  // SỬ DỤNG GOOGLE MAPS HYBRID (ẢNH VỆ TINH SẮC NÉT)
  L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "Google Maps",
  }).addTo(map);

  // BẮT SỰ KIỆN CLICK TRÊN BẢN ĐỒ ĐỂ LẤY TỌA ĐỘ
  map.on("click", onMapClickSelectLocation);

  renderAllMarkers();
  updateMasterSelectOptions();
  switchMasterNode(currentMasterKey);

  refreshMapSize();
}

// SỰ KIỆN CLICK BẢN ĐỒ ĐỂ LẤY TỌA ĐỘ TỰ ĐỘNG
function onMapClickSelectLocation(e) {
  const modal = document.getElementById("add-master-modal");
  const isModalOpen = modal && !modal.classList.contains("hidden");

  const lat = parseFloat(e.latlng.lat.toFixed(6));
  const lng = parseFloat(e.latlng.lng.toFixed(6));

  // Tự động gán vào ô input nếu modal đang mở
  const latInput = document.getElementById("new-master-lat");
  const lngInput = document.getElementById("new-master-lng");
  if (latInput && lngInput) {
    latInput.value = lat;
    lngInput.value = lng;
  }

  // Đặt ghim tạm thời màu đỏ tại điểm click
  if (tempPickMarker) {
    map.removeLayer(tempPickMarker);
  }
  tempPickMarker = L.marker([lat, lng])
    .addTo(map)
    .bindPopup(`<b>📍 Vị trí đã chọn:</b><br>Vĩ độ: ${lat}<br>Kinh độ: ${lng}`)
    .openPopup();

  if (!isModalOpen) {
    openAddMasterModal();
  }
}

// VẼ LẠI TOÀN BỘ GHIM TRÊN BẢN ĐỒ
function renderAllMarkers() {
  if (!map) return;
  Object.keys(markers).forEach((k) => map.removeLayer(markers[k]));
  markers = {};

  Object.keys(MASTER_NODES_DATA).forEach((key) => {
    const item = MASTER_NODES_DATA[key];
    const marker = L.marker([item.lat, item.lng]).addTo(map);
    marker.bindPopup(`<b>${item.name}</b><br>Khu vực: ${item.location}`);

    marker.on("click", (evt) => {
      L.DomEvent.stopPropagation(evt);
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
  if (!MASTER_NODES_DATA[masterKey]) return;
  currentMasterKey = masterKey;
  const data = MASTER_NODES_DATA[masterKey];

  const currentMasterLabel = document.getElementById("current-master-label");
  if (currentMasterLabel) currentMasterLabel.innerText = data.name;

  const farmLocation = document.getElementById("farm-location");
  if (farmLocation) farmLocation.innerText = data.location;

  if (map) {
    refreshMapSize();
    map.flyTo([data.lat, data.lng], 13);
    if (markers[masterKey]) markers[masterKey].openPopup();
  }

  if (typeof renderMasterPumpAndChildNodes === "function") {
    renderMasterPumpAndChildNodes(data);
  } else if (typeof renderChildNodesUI === "function") {
    renderChildNodesUI(data.childNodes);
  }
  if (typeof fetchWeather === "function") fetchWeather(data.location);
  if (typeof fetchSensorData === "function") fetchSensorData();
}

// XỬ LÝ ĐIỀU KHIỂN ĐỘ ẨM & CHẾ ĐỘ BƠM (AUTO / MANUAL)
function setMasterPumpMode(mode) {
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (!currentMaster || !currentMaster.pumpNode) return;

  currentMaster.pumpNode.mode = mode;
  saveMasterNodesToStorage();

  if (typeof renderMasterPumpAndChildNodes === "function") {
    renderMasterPumpAndChildNodes(currentMaster);
  }
}

function toggleMasterPumpPower(status) {
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (!currentMaster || !currentMaster.pumpNode) return;

  if (currentMaster.pumpNode.mode === "auto") {
    alert(
      "⚠️ Máy bơm đang ở chế độ TỰ ĐỘNG. Vui lòng chuyển sang THỦ CÔNG để chủ động Bật/Tắt!",
    );
    return;
  }

  currentMaster.pumpNode.status = status;
  saveMasterNodesToStorage();

  if (typeof renderMasterPumpAndChildNodes === "function") {
    renderMasterPumpAndChildNodes(currentMaster);
  }
}

function updateMasterPumpMinThreshold(value) {
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (!currentMaster || !currentMaster.pumpNode) return;

  const val = parseFloat(value) || 50;
  if (val >= currentMaster.pumpNode.maxThreshold) {
    alert("⚠️ Ngưỡng bật (< %) phải nhỏ hơn Ngưỡng tắt (> %)!");
    return;
  }

  currentMaster.pumpNode.minThreshold = val;
  saveMasterNodesToStorage();
}

function updateMasterPumpMaxThreshold(value) {
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (!currentMaster || !currentMaster.pumpNode) return;

  const val = parseFloat(value) || 80;
  if (val <= currentMaster.pumpNode.minThreshold) {
    alert("⚠️ Ngưỡng tắt (> %) phải lớn hơn Ngưỡng bật (< %)!");
    return;
  }

  currentMaster.pumpNode.maxThreshold = val;
  saveMasterNodesToStorage();
}

// HÀM TÌM TỌA ĐỘ THÔNG MINH (HỖ TRỢ: ĐỊA CHỈ, TỌA ĐỘ VĨ/KINH, LINK GOOGLE MAPS)
async function searchAddressCoordinates() {
  const addressInput = document.getElementById("new-master-address");
  if (!addressInput) return;
  const inputStr = addressInput.value.trim();

  if (!inputStr) {
    alert("⚠️ Vui lòng nhập địa chỉ, tọa độ hoặc dán link Google Maps!");
    return;
  }

  // 1. Kiểm tra nếu người dùng dán Tọa độ trực tiếp (VD: 13.9871, 108.1234)
  const coordMatch = inputStr.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    applyFoundCoordinates(lat, lng, "Tọa độ từ chuỗi nhập");
    return;
  }

  // 2. Kiểm tra nếu dán Link Google Maps (VD: https://www.google.com/maps/@13.987,108.123,15z)
  const urlCoordMatch = inputStr.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (urlCoordMatch) {
    const lat = parseFloat(urlCoordMatch[1]);
    const lng = parseFloat(urlCoordMatch[2]);
    applyFoundCoordinates(lat, lng, "Link Google Maps");
    return;
  }

  // 3. Tra cứu bằng tên Địa danh (Open-Meteo & Photon API)
  try {
    let response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputStr)}&count=1&language=vi&format=json`,
    );
    let data = await response.json();

    if (data && data.results && data.results.length > 0) {
      const loc = data.results[0];
      applyFoundCoordinates(
        loc.latitude,
        loc.longitude,
        loc.admin1 || loc.name,
      );
      return;
    }

    // Dự phòng Photon API
    response = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(inputStr)}&limit=1`,
    );
    data = await response.json();

    if (data && data.features && data.features.length > 0) {
      const coords = data.features[0].geometry.coordinates;
      const props = data.features[0].properties;
      applyFoundCoordinates(
        coords[1],
        coords[0],
        props.state || props.city || props.name,
      );
      return;
    }

    alert(
      "💡 Mẹo: Bạn có thể click trực tiếp vị trí nông trại trên bản đồ Vệ tinh phía sau, hoặc nhập tên Huyện/Tỉnh (VD: Mang Yang, Gia Lai)!",
    );
  } catch (err) {
    alert("❌ Lỗi tìm kiếm! Hãy click chọn trực tiếp trên bản đồ.");
  }
}

// HÀM HỖ TRỢ ĐIỀN TỌA ĐỘ VÀO FORM VÀ ĐỊNH VỊ BẢN ĐỒ
function applyFoundCoordinates(lat, lng, cityName) {
  document.getElementById("new-master-lat").value = lat;
  document.getElementById("new-master-lng").value = lng;

  const cityInput = document.getElementById("new-master-city");
  if (cityInput && !cityInput.value.trim() && cityName) {
    cityInput.value = cityName;
  }

  if (map) {
    map.flyTo([lat, lng], 15);
    if (tempPickMarker) map.removeLayer(tempPickMarker);
    tempPickMarker = L.marker([lat, lng])
      .addTo(map)
      .bindPopup(
        `<b>📍 Vị trí đã chọn:</b><br>Vĩ độ: ${lat}<br>Kinh độ: ${lng}`,
      )
      .openPopup();
  }

  alert(`📍 Đã xác định vị trí thành công:\nVĩ độ: ${lat}\nKinh độ: ${lng}`);
}

// THÊM TRẠM MASTER MỚI TỪ FORM MODAL (TỰ ĐỘNG TẠO NODE PUMP WI-FI ĐỘC LẬP)
function handleAddMasterNode(e) {
  if (e) e.preventDefault();

  const idInput = document.getElementById("new-master-id");
  const nameInput = document.getElementById("new-master-name");
  const cityInput = document.getElementById("new-master-city");
  const latInput = document.getElementById("new-master-lat");
  const lngInput = document.getElementById("new-master-lng");
  const addressInput = document.getElementById("new-master-address");

  if (!idInput || !nameInput || !cityInput || !latInput || !lngInput) return;

  const id = idInput.value.trim();
  const name = nameInput.value.trim();
  const city = cityInput.value.trim();
  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);

  if (!id || !name || !city || isNaN(lat) || isNaN(lng)) {
    alert("Vui lòng điền đầy đủ và chính xác thông tin!");
    return;
  }

  const key = `master_${id}`;
  if (MASTER_NODES_DATA[key]) {
    alert("⚠️ Mã Trạm ID này đã tồn tại! Vui lòng chọn ID khác.");
    return;
  }

  const childNodes = [`node_${id}_1`, `node_${id}_2`, `node_${id}_3`];

  MASTER_NODES_DATA[key] = {
    name: `${name} - ${city}`,
    location: city,
    lat: lat,
    lng: lng,
    childNodes: childNodes,
    pumpNode: {
      id: `pump_wifi_${id}`,
      name: `Node Pump ${id} (Wi-Fi Direct)`,
      status: false,
      mode: "auto",
      minThreshold: 50,
      maxThreshold: 80,
      connection: "Wi-Fi / MQTT",
    },
  };

  saveMasterNodesToStorage();

  if (tempPickMarker && map) {
    map.removeLayer(tempPickMarker);
    tempPickMarker = null;
  }

  renderAllMarkers();
  updateMasterSelectOptions();
  switchMasterNode(key);

  idInput.value = "";
  nameInput.value = "";
  cityInput.value = "";
  latInput.value = "";
  lngInput.value = "";
  if (addressInput) addressInput.value = "";

  closeAddMasterModal();
  alert(
    `Đã thêm thành công Trạm Master mới cùng Node Pump Wi-Fi độc lập: ${name}`,
  );
}

function openAddMasterModal() {
  const modal = document.getElementById("add-master-modal");
  if (modal) modal.classList.remove("hidden");
  refreshMapSize();
}

function closeAddMasterModal() {
  const modal = document.getElementById("add-master-modal");
  if (modal) modal.classList.add("hidden");
  if (tempPickMarker && map) {
    map.removeLayer(tempPickMarker);
    tempPickMarker = null;
  }
}

// XÓA TRẠM MASTER ĐANG CHỌN
function deleteCurrentMasterNode() {
  const keys = Object.keys(MASTER_NODES_DATA);

  if (keys.length <= 1) {
    alert("⚠️ Không thể xóa! Hệ thống phải duy trì ít nhất 01 Trạm Master.");
    return;
  }

  const currentData = MASTER_NODES_DATA[currentMasterKey];
  if (!currentData) return;

  const confirmDelete = confirm(
    `Bạn có chắc chắn muốn xóa "${currentData.name}" cùng Node Pump Wi-Fi đi kèm không?`,
  );
  if (!confirmDelete) return;

  const keyToDelete = currentMasterKey;

  delete MASTER_NODES_DATA[keyToDelete];
  saveMasterNodesToStorage();

  if (markers[keyToDelete] && map) {
    map.removeLayer(markers[keyToDelete]);
    delete markers[keyToDelete];
  }

  const nextKey = Object.keys(MASTER_NODES_DATA)[0];
  updateMasterSelectOptions();
  switchMasterNode(nextKey);

  alert(`🗑️ Đã xóa thành công Trạm Master: ${currentData.name}`);
}

// QUẢN LÝ THÊM / XÓA SLAVE NODE (NODE CON)
function addSlaveNodeToCurrentMaster(slaveId) {
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (!currentMaster) return false;
  if (!currentMaster.childNodes) currentMaster.childNodes = [];

  if (currentMaster.childNodes.includes(slaveId)) {
    alert("⚠️ Node con này đã tồn tại trong Trạm Master hiện tại!");
    return false;
  }

  currentMaster.childNodes.push(slaveId);
  saveMasterNodesToStorage();
  return true;
}

function deleteSlaveNodeFromMaster(slaveId) {
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (!currentMaster) return;

  const confirmDelete = confirm(
    `Bạn có chắc muốn xóa Node con "${slaveId}" khỏi trạm này?`,
  );
  if (!confirmDelete) return;

  currentMaster.childNodes = currentMaster.childNodes.filter(
    (id) => id !== slaveId,
  );
  saveMasterNodesToStorage();

  if (typeof renderMasterPumpAndChildNodes === "function") {
    renderMasterPumpAndChildNodes(currentMaster);
  } else if (typeof renderChildNodesUI === "function") {
    renderChildNodesUI(currentMaster.childNodes);
  }
}

// GẮN CÁC HÀM XỬ LÝ VÀ DỮ LIỆU VÀO PHẠM VI TOÀN CỤC (WINDOW)
window.MASTER_NODES_DATA = MASTER_NODES_DATA;
window.getCurrentMasterKey = () => currentMasterKey;
window.initLeafletMap = initLeafletMap;
window.refreshMapSize = refreshMapSize;
window.switchMasterNode = switchMasterNode;
window.searchAddressCoordinates = searchAddressCoordinates;
window.handleAddMasterNode = handleAddMasterNode;
window.openAddMasterModal = openAddMasterModal;
window.closeAddMasterModal = closeAddMasterModal;
window.deleteCurrentMasterNode = deleteCurrentMasterNode;
window.addSlaveNodeToCurrentMaster = addSlaveNodeToCurrentMaster;
window.deleteSlaveNodeFromMaster = deleteSlaveNodeFromMaster;
window.setMasterPumpMode = setMasterPumpMode;
window.toggleMasterPumpPower = toggleMasterPumpPower;
window.updateMasterPumpMinThreshold = updateMasterPumpMinThreshold;
window.updateMasterPumpMaxThreshold = updateMasterPumpMaxThreshold;
