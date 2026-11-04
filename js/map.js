// DỮ LIỆU MẶC ĐỊNH CÁC MASTER NODE
const DEFAULT_MASTER_NODES = {
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

let MASTER_NODES_DATA = { ...DEFAULT_MASTER_NODES };
let currentMasterKey = "master_1";
let map = null;
let markers = {};

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

  // SỬ DỤNG GOOGLE MAPS HYBRID (ẢNH VỆ TINH + NHÃN ĐỊA DANH SIÊU SẮC NÉT)
  L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "Google Maps",
  }).addTo(map);

  renderAllMarkers();
  updateMasterSelectOptions();
  switchMasterNode(currentMasterKey);

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

  if (typeof renderChildNodesUI === "function") {
    renderChildNodesUI(data.childNodes);
  }
  if (typeof fetchWeather === "function") fetchWeather(data.location);
  if (typeof fetchSensorData === "function") fetchSensorData();
}

// HÀM TÌM TỌA ĐỘ VĨ ĐỘ / KINH ĐỘ TỰ ĐỘNG TỪ ĐỊA CHỈ
async function searchAddressCoordinates() {
  const addressInput = document.getElementById("new-master-address");
  if (!addressInput) return;
  const address = addressInput.value.trim();

  if (!address) {
    alert("⚠️ Vui lòng nhập địa chỉ nông trại cần tìm!");
    return;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
    );
    const data = await response.json();

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);

      // Tự động điền Vĩ độ và Kinh độ vào Form
      document.getElementById("new-master-lat").value = lat;
      document.getElementById("new-master-lng").value = lon;

      // Nếu ô Tên Vùng / Tỉnh Thành chưa nhập, lấy từ địa chỉ nhập vào
      const cityInput = document.getElementById("new-master-city");
      if (cityInput && !cityInput.value.trim()) {
        const addressParts = address.split(",");
        cityInput.value = addressParts[addressParts.length - 1].trim();
      }

      alert(`📍 Đã tìm thấy tọa độ:\nVĩ độ: ${lat}\nKinh độ: ${lon}`);
    } else {
      alert(
        "❌ Không tìm thấy tọa độ cho địa chỉ này. Vui lòng thử lại với tên huyện/tỉnh rõ ràng hơn!",
      );
    }
  } catch (err) {
    alert("❌ Lỗi kết nối dịch vụ định vị địa chỉ!");
  }
}

// THÊM TRẠM MASTER MỚI TỪ FORM MODAL
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
  };

  saveMasterNodesToStorage();

  renderAllMarkers();
  updateMasterSelectOptions();
  switchMasterNode(key);

  // Xóa trắng dữ liệu form sau khi lưu thành công
  idInput.value = "";
  nameInput.value = "";
  cityInput.value = "";
  latInput.value = "";
  lngInput.value = "";
  if (addressInput) addressInput.value = "";

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
window.searchAddressCoordinates = searchAddressCoordinates;
window.handleAddMasterNode = handleAddMasterNode;
window.openAddMasterModal = openAddMasterModal;
window.closeAddMasterModal = closeAddMasterModal;
window.deleteCurrentMasterNode = deleteCurrentMasterNode;
window.addSlaveNodeToCurrentMaster = addSlaveNodeToCurrentMaster;
window.deleteSlaveNodeFromMaster = deleteSlaveNodeFromMaster;
