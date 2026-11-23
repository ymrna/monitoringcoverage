// ================= GLOBAL =================
let map;
let rawPoints = [];
let standingPoints = [];
let userMarker = null;
let targetLayers = [];
let measureLayers = [];
let circles = [];
let distanceLines = [];

// ICONS
const targetIcon = L.icon({
  iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png',
  iconSize: [32, 32]
});

const standIcon = L.icon({
  iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png',
  iconSize: [32, 32]
});

const userIcon = L.icon({
  iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png',
  iconSize: [32, 32]
});

// ================= INIT =================
window.onload = () => {
  map = L.map('map').setView([-2.5, 118], 5);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  setTimeout(() => map.invalidateSize(), 200);

  document.getElementById("btnHitung").onclick = optimize;
  document.getElementById("btnClear").onclick = clearAll;
  document.getElementById("btnPanel").onclick = togglePanel;
  document.getElementById("fabPanel").onclick = togglePanel;
  document.getElementById("excelFile").addEventListener("change", loadExcel);
  document.getElementById("btnSave").onclick = saveSession;
  document.getElementById("btnHistory").onclick = showHistory;
  document.getElementById("btnExport").onclick = exportExcel;
};

// ================= PANEL =================
function togglePanel() {
  document.getElementById("sidepanel").classList.toggle("open");
}

// ================= CLEAR =================
function clearMapOnly() {
  [...targetLayers, ...measureLayers, ...circles, ...distanceLines].forEach(l => {
    if (map.hasLayer(l)) map.removeLayer(l);
  });
  targetLayers = [];
  measureLayers = [];
  circles = [];
  distanceLines = [];
}

function clearAll() {
  clearMapOnly();

  rawPoints = [];
  standingPoints = [];

  document.getElementById("coords").value = "";
  document.getElementById("excelFile").value = "";
  document.getElementById("status").innerText = "Belum ada perhitungan";
  document.querySelector("#pointTable tbody").innerHTML = "";

  if (userMarker) {
    map.removeLayer(userMarker);
    userMarker = null;
  }

  map.setView([-2.5, 118], 5);
}

// ================= SHOW HISTORY (FROM DATABASE) =================
async function showHistory() {
  togglePanel();
  let div = document.getElementById("historyList");
  div.innerHTML = "Loading...";

  try {
    let res = await fetch('/api/history');
    let history = await res.json();

    div.innerHTML = "";
    if (history.length === 0) {
      div.innerHTML = "<p>Belum ada history</p>";
      return;
    }

    window.currentHistory = history;

    history.forEach(h => {
      let d = document.createElement("div");
      d.className = "history-item";
      d.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);";

      d.innerHTML = `
        <div style="flex: 1; padding-right: 8px;">
          <div style="font-weight: bold; color: #fff;">${h.nama}</div>
          <div style="font-size: 0.8em; color: #aaa;">${h.tanggal} (${h.standingPoints.length} titik)</div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button onclick="loadHistory(${h.id})" title="Load Project" style="padding: 6px 10px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; font-size: 14px;">
            📂
          </button>
          <button onclick="deleteHistory(${h.id})" title="Hapus Project" style="padding: 6px 10px; cursor: pointer; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 14px;">
            🗑️
          </button>
        </div>
      `;
      div.appendChild(d);
    });
  } catch (e) {
    div.innerHTML = "Gagal memuat history";
  }
}

// ================= LOAD HISTORY =================
function loadHistory(id) {
  let item = (window.currentHistory || []).find(h => h.id === id);
  if (!item) return;

  clearAll();

  rawPoints = item.rawPoints;
  standingPoints = item.standingPoints;

  plotTargets();

  standingPoints.forEach((c, i) => {
    let circle = L.circle(c, {
      radius: 10000,
      color: '#00ffaa',
      fillOpacity: 0.08
    }).addTo(map);

    circles.push(circle);

    let marker = L.marker(c, { icon: standIcon })
      .addTo(map)
      .bindPopup("📡 Titik Ukur " + (i + 1));

    measureLayers.push(marker);
  });

  updateTable();

  map.fitBounds(
    rawPoints.map(p => [p.lat, p.lon])
  );

  togglePanel();

  let wrapper = document.getElementById("pointListWrapper");
  let header = document.getElementById("togglePointList");
  wrapper.classList.remove("open");
  header.innerHTML = "▶ Daftar Titik";
}

// ================= DELETE HISTORY =================
async function deleteHistory(id) {
  if (!confirm("Hapus project ini?")) return;

  let res = await fetch('/api/history/' + id, { method: 'DELETE' });
  if (res.ok) {
    showHistory();
  } else {
    alert("Gagal menghapus history");
  }
}

// ================= SAVE SESSION (TO DATABASE) =================
async function saveSession() {
  if (standingPoints.length === 0) {
    alert("Belum ada hasil untuk disimpan");
    return;
  }

  if (!confirm("Simpan project ini?")) {
    return;
  }

  let projectName = prompt("Masukkan Nama Project:");

  if (projectName === null) {
    alert("❌ Penyimpanan dibatalkan");
    return;
  }

  if (projectName.trim() === "") {
    projectName = "Project Tanpa Nama";
  }

  let data = {
    nama: projectName,
    tanggal: new Date().toLocaleString(),
    rawPoints,
    standingPoints
  };

  let res = await fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    alert("✅ Project berhasil disimpan ke database");
    showHistory();
  } else {
    let err = await res.json();
    console.error("Save Error:", err);
    alert("❌ Gagal menyimpan project");
  }
}

// ================= USER LOCATION =================
function getUserLocation() {
  navigator.geolocation.getCurrentPosition(pos => {
    let lat = pos.coords.latitude;
    let lon = pos.coords.longitude;

    if (userMarker) map.removeLayer(userMarker);

    userMarker = L.marker([lat, lon], { icon: userIcon })
      .addTo(map).bindPopup("📍 Posisi Saya").openPopup();

    map.setView([lat, lon], 13);
  });
}

// ================= EXPORT EXCEL =================
function exportExcel() {
  if (standingPoints.length === 0) {
    alert("Belum ada data");
    return;
  }

  let data = [];

  standingPoints.forEach((p, i) => {
    let mapUrl = `https://www.google.com/maps?q=${p[0]},${p[1]}`;

    data.push({
      No: i + 1,
      Latitude: p[0],
      Longitude: p[1],
      "Link Google Maps": mapUrl
    });
  });

  let ws = XLSX.utils.json_to_sheet(data);

  standingPoints.forEach((p, i) => {
    let cellAddress = `D${i + 2}`;
    if (ws[cellAddress]) {
      ws[cellAddress].l = { Target: ws[cellAddress].v, Tooltip: "Buka di Google Maps" };
    }
  });

  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Titik_Ukur");
  XLSX.writeFile(wb, "target_titik_ukur.xlsx");
}

// ================= EXCEL LOAD =================
function loadExcel(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    rawPoints = json.map(r => ({
      nama: r.nama_client || r.nama || "Client",
      freq: r.freq || "-",
      lokasi: r.lokasi || "-",
      lat: +(r.lat || r.latitude || 0),
      lon: +(r.long || r.longitude || 0)
    }));

    document.getElementById("coords").value =
      rawPoints.map(p => `${p.lat},${p.lon}`).join("\n");

    plotTargets();
  };
  reader.readAsArrayBuffer(file);
}

// ================= TARGET PLOT =================
function plotTargets() {
  targetLayers.forEach(l => map.removeLayer(l));
  targetLayers = [];

  rawPoints.forEach(p => {
    let m = L.marker([p.lat, p.lon], { icon: targetIcon })
      .addTo(map)
      .bindPopup(`<b>${p.nama}</b><br>Freq: ${p.freq}<br>${p.lokasi}`);

    targetLayers.push(m);
  });
}

// ================= OPTIMIZE =================
async function optimize() {
  clearMapOnly();

  if (rawPoints.length === 0) {
    rawPoints = document.getElementById("coords").value.trim().split("\n").map(l => {
      let p = l.split(',');
      return { nama: 'Manual', freq: '-', lokasi: '-', lat: +p[0], lon: +p[1] };
    });
  }

  let points = rawPoints.map(p => [p.lat, p.lon]);
  plotTargets();

  let res = await fetch(window.location.origin + '/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: points })
  });

  let data = await res.json();
  standingPoints = data.recommended_points;

  document.getElementById('status').innerText =
    "Dibutuhkan " + standingPoints.length + " titik ukur";

  standingPoints.forEach((c, i) => {
    let circle = L.circle(c, { radius: 10000, color: '#00ffaa', fillOpacity: 0.08 }).addTo(map);
    circles.push(circle);

    let marker = L.marker(c, { icon: standIcon })
      .addTo(map)
      .bindPopup(`<b>📡 Titik Ukur ${i + 1}</b><br>
  <a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${c[0]},${c[1]}">Navigasi</a>`);

    measureLayers.push(marker);

    // === DISTANCE LINES ===
    rawPoints.forEach(p => {
      let dist = haversine([p.lat, p.lon], c);

      if (dist <= 10) {
        let line = L.polyline([[p.lat, p.lon], c], {
          color: '#ffaa00',
          weight: 2,
          dashArray: '6,6'
        }).addTo(map);

        line.bindTooltip(dist.toFixed(2) + " km", {
          permanent: true,
          direction: 'center',
          className: 'distance-label'
        });

        distanceLines.push(line);
      }
    });
  });

  updateTable();
  map.fitBounds(points);
}

// ================= TABLE =================
function updateTable() {
  const tb = document.querySelector('#pointTable tbody');
  tb.innerHTML = '';
  rawPoints.forEach(p => {
    tb.innerHTML += `<tr>
  <td>${p.nama}</td>
  <td>${p.freq}</td>
  <td>${p.lokasi}</td>
  </tr>`;
  });
}

function haversine(a, b) {
  let R = 6371;
  let dLat = (b[0] - a[0]) * Math.PI / 180;
  let dLon = (b[1] - a[1]) * Math.PI / 180;
  let lat1 = a[0] * Math.PI / 180;
  let lat2 = b[0] * Math.PI / 180;

  let x = Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ================= TOGGLE POINT LIST =================
function togglePointDropdown() {
  let content = document.getElementById("pointListWrapper");
  let header = document.getElementById("togglePointList");

  content.classList.toggle("open");

  if (content.classList.contains("open")) {
    header.innerHTML = "▼ Daftar Titik";
  } else {
    header.innerHTML = "▶ Daftar Titik";
  }
}