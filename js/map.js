// KHÔNG TẠO SẴN TRẠM MASTER MẪU - NGƯỜI DÙNG TỰ THÊM VÀ HỆ THỐNG TỰ LƯU
const DEFAULT_MASTER_NODES = {};
const STORAGE_KEY = "user_master_nodes_v2";

let MASTER_NODES_DATA = {};
let currentMasterKey = null;
let map = null;
let markers = {};
let tempPickMarker = null;

// KHÔI PHỤC DANH SÁCH TRẠM MASTER TỪ LOCAL STORAGE
function loadSavedMasterNodes() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.keys(parsed).forEach((key) => {
          const item = parsed[key];
          if (!Array.isArray(item.childNodes)) item.childNodes = [];
          if (!Array.isArray(item.disabledNodes)) item.disabledNodes = [];
          if (item.pumpNode) delete item.pumpNode;
          if (!item.childNodes.includes(item.selectedSlaveId)) {
            item.selectedSlaveId =
              item.childNodes.length > 0 ? item.childNodes[0] : null;
          }
        });
        MASTER_NODES_DATA = parsed;
      }
    } catch (e) {
      console.error("Lỗi đọc dữ liệu trạm Master từ bộ nhớ:", e);
      MASTER_NODES_DATA = {};
    }
  } else {
    MASTER_NODES_DATA = {};
  }

  window.MASTER_NODES_DATA = MASTER_NODES_DATA;
}

// LƯU DỮ LIỆU MASTER NODE VÀ SLAVE NODE VÀO LOCAL STORAGE
function saveMasterNodesToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(MASTER_NODES_DATA));
  window.MASTER_NODES_DATA = MASTER_NODES_DATA;
}

// LÀM MỚI KÍCH THƯỚC BẢN ĐỒ
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

  const keys = Object.keys(MASTER_NODES_DATA);
  if (keys.length === 0) {
    currentMasterKey = null;
  } else if (!MASTER_NODES_DATA[currentMasterKey]) {
    currentMasterKey = keys[0];
  }

  // Nếu chưa có trạm nào, hiển thị bản đồ tổng quan Việt Nam
  const initialLat = currentMasterKey
    ? MASTER_NODES_DATA[currentMasterKey].lat
    : 14.0583;
  const initialLng = currentMasterKey
    ? MASTER_NODES_DATA[currentMasterKey].lng
    : 108.2772;
  const initialZoom = currentMasterKey ? 13 : 6;

  if (!map) {
    map = L.map("map").setView([initialLat, initialLng], initialZoom);
    window.map = map;

    L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: "Google Maps",
    }).addTo(map);

    map.on("click", onMapClickSelectLocation);
  }

  renderAllMarkers();
  updateMasterSelectOptions();

  if (currentMasterKey) {
    switchMasterNode(currentMasterKey);
  } else {
    renderEmptyMasterState();
  }

  refreshMapSize();
}

// HIỂN THỊ TRẠNG THÁI KHI CHƯA CÓ TRẠM MASTER NÀO
function renderEmptyMasterState() {
  const currentMasterLabel = document.getElementById("current-master-label");
  if (currentMasterLabel) currentMasterLabel.innerText = "Chưa có trạm Master";

  const farmLocation = document.getElementById("farm-location");
  if (farmLocation) farmLocation.innerText = "Chưa chọn trạm";

  if (typeof renderChildNodesUI === "function") {
    renderChildNodesUI(null);
  }
  if (typeof resetSensorDisplay === "function") {
    resetSensorDisplay();
  }
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

  const keys = Object.keys(MASTER_NODES_DATA);
  if (keys.length === 0) {
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.innerText = "-- Chưa có trạm Master --";
    selectEl.appendChild(emptyOpt);
    return;
  }

  keys.forEach((key) => {
    const item = MASTER_NODES_DATA[key];
    const opt = document.createElement("option");
    opt.value = key;
    opt.innerText = item.name;
    selectEl.appendChild(opt);
  });

  if (currentMasterKey && MASTER_NODES_DATA[currentMasterKey]) {
    selectEl.value = currentMasterKey;
  }
}

// CHUYỂN ĐỔI TRẠM MASTER HIỆN TẠI
function switchMasterNode(masterKey) {
  if (!masterKey || !MASTER_NODES_DATA[masterKey]) {
    currentMasterKey = null;
    renderEmptyMasterState();
    return;
  }

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
  if (typeof fetchSensorData === "function") fetchSensorData(10);
}

// CHỌN NODE CON ĐỂ XEM BIỂU ĐỒ VÀ BẢNG THÔNG SỐ RIÊNG
function selectSlaveNode(slaveId) {
  if (!currentMasterKey || !MASTER_NODES_DATA[currentMasterKey]) return;
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];

  currentMaster.selectedSlaveId = slaveId;
  saveMasterNodesToStorage();

  if (typeof renderChildNodesUI === "function") {
    renderChildNodesUI(currentMaster);
  }
  if (typeof fetchSensorData === "function") {
    fetchSensorData(10);
  }
}

function getSelectedSlaveId() {
  if (!currentMasterKey || !MASTER_NODES_DATA[currentMasterKey]) return null;
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];

  if (!currentMaster.childNodes || currentMaster.childNodes.length === 0) {
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

// THÊM TRẠM MASTER MỚI (KHÔNG TẠO SẴN NODE CON & LƯU VÀO LOCAL STORAGE)
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

// XÓA TRẠM MASTER ĐANG CHỌN (CHO PHÉP XÓA SẠCH VỀ 0 TRẠM)
function deleteCurrentMasterNode() {
  if (!currentMasterKey || !MASTER_NODES_DATA[currentMasterKey]) {
    alert("⚠️ Hiện không có Trạm Master nào để xóa!");
    return;
  }

  const currentData = MASTER_NODES_DATA[currentMasterKey];
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

  const remainingKeys = Object.keys(MASTER_NODES_DATA);
  if (remainingKeys.length > 0) {
    currentMasterKey = remainingKeys[0];
    updateMasterSelectOptions();
    switchMasterNode(currentMasterKey);
  } else {
    currentMasterKey = null;
    updateMasterSelectOptions();
    renderEmptyMasterState();
    if (map) map.flyTo([14.0583, 108.2772], 6);
  }
}

// QUẢN LÝ THÊM / TẠM NGƯNG / XÓA SLAVE NODE (NODE CON)
function addSlaveNodeToCurrentMaster(slaveId) {
  if (!currentMasterKey || !MASTER_NODES_DATA[currentMasterKey]) {
    alert("⚠️ Vui lòng tạo ít nhất 01 Trạm Master trước khi thêm Node con!");
    return false;
  }

  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
  if (!currentMaster.childNodes) currentMaster.childNodes = [];

  if (currentMaster.childNodes.includes(slaveId)) {
    alert("⚠️ Node con này đã tồn tại trong Trạm Master hiện tại!");
    return false;
  }

  currentMaster.childNodes.push(slaveId);
  // Tự động chọn ngay Node con vừa thêm để nạp 10 dữ liệu gần nhất từ Supabase
  currentMaster.selectedSlaveId = slaveId;
  saveMasterNodesToStorage();
  return true;
}

function toggleSlaveNodeActive(slaveId) {
  if (!currentMasterKey || !MASTER_NODES_DATA[currentMasterKey]) return;
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];
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
    fetchSensorData(10);
  }
}

function deleteSlaveNodeFromMaster(slaveId) {
  if (!currentMasterKey || !MASTER_NODES_DATA[currentMasterKey]) return;
  const currentMaster = MASTER_NODES_DATA[currentMasterKey];

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
    fetchSensorData(10);
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
