// DỮ LIỆU CÁC MASTER NODE (Hỗ trợ lưu & khôi phục từ localStorage)
let MASTER_NODES_DATA = {
  master_1: {
    name: "Master 01 - Tiền Giang",
    location: "Tiền Giang",
    lat: 10.3563,
    lng: 106.3631,
    childNodes: ["node_1_1", "node_1_2", "node_1_3"],
  },
  master_2: {
    name: "Master 02 - Bến Tre",
    location: "Ben Tre",
    lat: 10.2431,
    lng: 106.3751,
    childNodes: ["node_2_1", "node_2_2", "node_2_3"],
  },
  master_3: {
    name: "Master 03 - Lâm Đồng",
    location: "Da Lat",
    lat: 11.9404,
    lng: 108.4583,
    childNodes: ["node_3_1", "node_3_2", "node_3_3"],
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

// LƯU DỮ LIỆU MASTER NODE VÀ SLAVE NODE VÀO LOCAL STORAGE
function saveMasterNodesToStorage() {
  localStorage.setItem(
    "custom_master_nodes",
    JSON.stringify(MASTER_NODES_DATA),
  );
}

// HÀM LÀM MỚI KÍCH THƯỚC BẢN ĐỒ (SỬA LỖI Ô XÁM TILE MAP)
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

  map = L.map("map").setView([10.3563, 106.3631], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  renderAllMarkers();
  updateMasterSelectOptions();

  // Ép bản đồ cập nhật lại khung hiển thị sau khi khởi tạo
  refreshMapSize();
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

  const currentMasterLabel = document.getElementById("current-master-label");
  if (currentMasterLabel) currentMasterLabel.innerText = data.name;

  const farmLocation = document.getElementById("farm-location");
  if (farmLocation) farmLocation.innerText = data.location;

  if (map) {
    refreshMapSize();
    map.flyTo([data.lat, data.lng], 10);
    if (markers[masterKey]) markers[masterKey].openPopup();
  }

  if (typeof renderChildNodesUI === "function") {
    renderChildNodesUI(data.childNodes);
  }
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
  const childNodes = [`node_${id}_1`, `node_${id}_2`, `node_${id}_3`];

  MASTER_NODES_DATA[key] = {
    name: `${name} - ${city}`,
    location: city,
    lat: lat,
    lng: lng,
    childNodes: childNodes,
  };

  saveMasterNodesToStorage();

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
    `Bạn có chắc chắn muốn xóa "${currentData.name}" khỏi hệ thống không?`,
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

// QUẢN LÝ THÊM / XÓA SLAVE NODE (NODE CON) CHO MASTER ĐANG CHỌN
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

  if (typeof renderChildNodesUI === "function") {
    renderChildNodesUI(currentMaster.childNodes);
  }
}

// GẮN CÁC HÀM XỬ LÝ VÀ DỮ LIỆU VÀO PHẠM VI TOÀN CỤC (WINDOW)
window.MASTER_NODES_DATA = MASTER_NODES_DATA;
window.getCurrentMasterKey = () => currentMasterKey;
window.initLeafletMap = initLeafletMap;
window.refreshMapSize = refreshMapSize;
window.switchMasterNode = switchMasterNode;
window.handleAddMasterNode = handleAddMasterNode;
window.openAddMasterModal = openAddMasterModal;
window.closeAddMasterModal = closeAddMasterModal;
window.deleteCurrentMasterNode = deleteCurrentMasterNode;
window.addSlaveNodeToCurrentMaster = addSlaveNodeToCurrentMaster;
window.deleteSlaveNodeFromMaster = deleteSlaveNodeFromMaster;
