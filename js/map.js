// DỮ LIỆU MẶC ĐỊNH CÁC MASTER NODE
const DEFAULT_MASTER_NODES = {
  master_1: {
    name: "Master 01 - Tiền Giang",
    location: "Tiền Giang",
    lat: 10.3563,
    lng: 106.3631,
    childNodes: ["node_1_1", "node_1_2", "node_1_3"],
    disabledNodes: [],
    selectedSlaveId: "node_1_1",
  },
  master_2: {
    name: "Master 02 - Bến Tre",
    location: "Ben Tre",
    lat: 10.2431,
    lng: 106.3751,
    childNodes: ["node_2_1", "node_2_2", "node_2_3"],
    disabledNodes: [],
    selectedSlaveId: "node_2_1",
  },
  master_3: {
    name: "Master 03 - Lâm Đồng",
    location: "Da Lat",
    lat: 11.9404,
    lng: 108.4583,
    childNodes: ["node_3_1", "node_3_2", "node_3_3"],
    disabledNodes: [],
    selectedSlaveId: "node_3_1",
  },
};

let MASTER_NODES_DATA = JSON.parse(JSON.stringify(DEFAULT_MASTER_NODES));
let currentMasterKey = "master_1";
let map = null;
let markers = {};
let tempPickMarker = null;

// KHÔI PHỤC MASTER NODE TỪ LOCAL STORAGE (TỰ ĐỘNG KHÔI PHỤC MẶC ĐỊNH NẾU DỮ LIỆU LỖI)
function loadSavedMasterNodes() {
  const saved = localStorage.getItem("custom_master_nodes");
  let isValid = false;

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        if (keys.length > 0) {
          keys.forEach((key) => {
            const item = parsed[key];
            if (
              !item ||
              typeof item.lat !== "number" ||
              typeof item.lng !== "number" ||
              isNaN(item.lat) ||
              isNaN(item.lng)
            ) {
              throw new Error("Dữ liệu tọa độ trạm không hợp lệ");
            }
            if (!Array.isArray(item.childNodes)) item.childNodes = [];
            if (!Array.isArray(item.disabledNodes)) item.disabledNodes = [];
            if (item.pumpNode) delete item.pumpNode;
            if (!item.childNodes.includes(item.selectedSlaveId)) {
              item.selectedSlaveId =
                item.childNodes.length > 0 ? item.childNodes[0] : null;
            }
          });
          MASTER_NODES_DATA = parsed;
          isValid = true;
        }
      }
    } catch (e) {
      console.warn(
        "Khôi phục danh sách trạm Master mặc định do dữ liệu cũ lỗi:",
        e,
      );
    }
  }

  if (!isValid) {
    MASTER_NODES_DATA = JSON.parse(JSON.stringify(DEFAULT_MASTER_NODES));
    saveMasterNodesToStorage();
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

  loadSavedMasterNodes();

  if (!MASTER_NODES_DATA[currentMasterKey]) {
    currentMasterKey = Object.keys(MASTER_NODES_DATA)[0] || "master_1";
  }

  if (!map) {
    const currentData = MASTER_NODES_DATA[currentMasterKey] || {
      lat: 10.3563,
      lng: 106.3631,
    };

    map = L.map("map").setView([currentData.lat, currentData.lng], 13);
    window.map = map;

    // SỬ DỤNG GOOGLE MAPS HYBRID (ẢNH VỆ TINH SẮC NÉT)
    L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: "Google Maps",
    }).addTo(map);

    map.on("click", onMapClickSelectLocation);
  }

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

  const latInput = document.getElementById("new-master-lat");
  const lngInput = document.getElementById("new-master-lng");
  if (latInput && lngInput) {
    latInput.value = lat;
    lngInput.value = lng;
  }

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

  const nodes = data.childNodes || [];
  if (!nodes.includes(data.selectedSlaveId)) {
    data.selectedSlaveId = nodes.length > 0 ? nodes[0] : null;
    saveMasterNodesToStorage();
  }

  const currentMasterLabel = document.getElementById("current-master-label");
  if (currentMasterLabel) currentMasterLabel.innerText = data.name;

  const farmLocation = document.getElementById("farm-location");
  if (farmLocation) farmLocation.innerText = data.location;

  if (map) {
    refreshMapSize();
    map.flyTo([data.lat, data.lng], 13);
    if (markers[masterKey]) markers[masterKey].openPopup();
  }

  if (typeof renderChildNodesUI === "function") {
    renderChildNodesUI(data);
  }
  if (typeof fetchWeather === "function") fetchWeather(data.location);
  if (typeof fetchSensorData === "function") fetchSensorData();
}

// CHỌN NODE CON ĐỂ XEM BIỂU ĐỒ VÀ BẢNG THÔNG SỐ RIÊNG
function selectSlaveNode(slaveId) {
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (!currentMaster) return;

  currentMaster.selectedSlaveId = slaveId;
  saveMasterNodesToStorage();

  if (typeof renderChildNodesUI === "function") {
    renderChildNodesUI(currentMaster);
  }
  if (typeof fetchSensorData === "function") {
    fetchSensorData();
  }
}

function getSelectedSlaveId() {
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (
    !currentMaster ||
    !currentMaster.childNodes ||
    currentMaster.childNodes.length === 0
  ) {
    return null;
  }
  if (!currentMaster.childNodes.includes(currentMaster.selectedSlaveId)) {
    currentMaster.selectedSlaveId = currentMaster.childNodes[0];
  }
  return currentMaster.selectedSlaveId;
}

// HÀM TÌM TỌA ĐỘ THÔNG MINH
async function searchAddressCoordinates() {
  const addressInput = document.getElementById("new-master-address");
  if (!addressInput) return;
  const inputStr = addressInput.value.trim();

  if (!inputStr) {
    alert("⚠️ Vui lòng nhập địa chỉ, tọa độ hoặc dán link Google Maps!");
    return;
  }

  const coordMatch = inputStr.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    applyFoundCoordinates(
      parseFloat(coordMatch[1]),
      parseFloat(coordMatch[2]),
      "Tọa độ từ chuỗi nhập",
    );
    return;
  }

  const urlCoordMatch = inputStr.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (urlCoordMatch) {
    applyFoundCoordinates(
      parseFloat(urlCoordMatch[1]),
      parseFloat(urlCoordMatch[2]),
      "Link Google Maps",
    );
    return;
  }

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

// THÊM TRẠM MASTER MỚI (KHÔNG TẠO SẴN NODE CON)
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

  MASTER_NODES_DATA[key] = {
    name: `${name} - ${city}`,
    location: city,
    lat: lat,
    lng: lng,
    childNodes: [],
    disabledNodes: [],
    selectedSlaveId: null,
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
    `Đã thêm thành công Trạm Master mới: ${name}\n(Nhấn "Thêm Node Con" để tự tạo các Node cảm biến)`,
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

  if (!confirm(`Bạn có chắc chắn muốn xóa "${currentData.name}" không?`)) {
    return;
  }

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

// QUẢN LÝ THÊM / TẠM NGƯNG / XÓA SLAVE NODE (NODE CON)
function addSlaveNodeToCurrentMaster(slaveId) {
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (!currentMaster) return false;
  if (!currentMaster.childNodes) currentMaster.childNodes = [];

  if (currentMaster.childNodes.includes(slaveId)) {
    alert("⚠️ Node con này đã tồn tại trong Trạm Master hiện tại!");
    return false;
  }

  currentMaster.childNodes.push(slaveId);
  if (!currentMaster.selectedSlaveId) {
    currentMaster.selectedSlaveId = slaveId;
  }
  saveMasterNodesToStorage();
  return true;
}

function toggleSlaveNodeActive(slaveId) {
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (!currentMaster) return;
  if (!currentMaster.disabledNodes) currentMaster.disabledNodes = [];

  if (currentMaster.disabledNodes.includes(slaveId)) {
    currentMaster.disabledNodes = currentMaster.disabledNodes.filter(
      (id) => id !== slaveId,
    );
  } else {
    currentMaster.disabledNodes.push(slaveId);
  }

  saveMasterNodesToStorage();

  if (typeof renderChildNodesUI === "function") {
    renderChildNodesUI(currentMaster);
  }
  if (typeof fetchSensorData === "function") {
    fetchSensorData();
  }
}

function deleteSlaveNodeFromMaster(slaveId) {
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (!currentMaster) return;

  if (
    !confirm(`Bạn có chắc chắn muốn xóa Node con "${slaveId}" khỏi trạm này?`)
  ) {
    return;
  }

  currentMaster.childNodes = currentMaster.childNodes.filter(
    (id) => id !== slaveId,
  );
  if (currentMaster.disabledNodes) {
    currentMaster.disabledNodes = currentMaster.disabledNodes.filter(
      (id) => id !== slaveId,
    );
  }

  if (currentMaster.selectedSlaveId === slaveId) {
    currentMaster.selectedSlaveId =
      currentMaster.childNodes.length > 0 ? currentMaster.childNodes[0] : null;
  }

  saveMasterNodesToStorage();

  if (typeof renderChildNodesUI === "function") {
    renderChildNodesUI(currentMaster);
  }
  if (typeof fetchSensorData === "function") {
    fetchSensorData();
  }
}

// GẮN CÁC HÀM XỬ LÝ VÀ DỮ LIỆU VÀO PHẠM VI TOÀN CỤC (WINDOW)
window.MASTER_NODES_DATA = MASTER_NODES_DATA;
window.getCurrentMasterKey = () => currentMasterKey;
window.getSelectedSlaveId = getSelectedSlaveId;
window.selectSlaveNode = selectSlaveNode;
window.saveMasterNodesToStorage = saveMasterNodesToStorage;
window.initLeafletMap = initLeafletMap;
window.refreshMapSize = refreshMapSize;
window.switchMasterNode = switchMasterNode;
window.searchAddressCoordinates = searchAddressCoordinates;
window.handleAddMasterNode = handleAddMasterNode;
window.openAddMasterModal = openAddMasterModal;
window.closeAddMasterModal = closeAddMasterModal;
window.deleteCurrentMasterNode = deleteCurrentMasterNode;
window.addSlaveNodeToCurrentMaster = addSlaveNodeToCurrentMaster;
window.toggleSlaveNodeActive = toggleSlaveNodeActive;
window.deleteSlaveNodeFromMaster = deleteSlaveNodeFromMaster;
