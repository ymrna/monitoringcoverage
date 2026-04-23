// ================= GLOBAL STATE =================
let map;
let targetMarkers = [];
let measureMarkers = [];
let coverageCircles = [];
let userMarker = null;
let excelData = [];
let panelOpen = false;

// ================= INIT MAP =================
window.onload = () => {

    map = L.map('map', { zoomControl:true }).setView([-2.5,118],5);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19
    }).addTo(map);

    setupEvents();

    document.getElementById("overlay").onclick=togglePanel;
};

setTimeout(()=>map.invalidateSize(),200);
// ================= EVENTS =================
function setupEvents(){

    document.getElementById("btnHitung").onclick = optimize;
    document.getElementById("btnMyLoc").onclick = getUserLocation;
    document.getElementById("btnClear").onclick = clearAll;
    document.getElementById("btnPanel").onclick = togglePanel;
    document.getElementById("closePanel").onclick = togglePanel;

    document.getElementById("excelFile").addEventListener("change", readExcel);
}

// ================= READ EXCEL =================
async function readExcel(e){

    const file = e.target.files[0];
    if(!file) return;

    document.getElementById("fileName").innerText = file.name;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    excelData = json;

    // auto fill textarea
    let txt = "";
    json.forEach(r=>{
        if(r.lat && r.long)
            txt += `${r.lat},${r.long}\n`;
    });

    document.getElementById("targetInput").value = txt.trim();
}

// ================= USER LOCATION =================
function getUserLocation(){

    navigator.geolocation.getCurrentPosition(pos=>{

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        if(userMarker) map.removeLayer(userMarker);

        userMarker = L.marker([lat,lon],{
            icon: L.icon({
                iconUrl:"https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                iconSize:[32,32]
            })
        }).addTo(map).bindPopup("📍 Posisi Saya").openPopup();

        map.setView([lat,lon],13);

    },()=>alert("GPS tidak tersedia"));
}

// ================= OPTIMIZE =================
async function optimize(){

    clearMapLayers();

    const lines = document.getElementById("targetInput").value.trim().split("\n");

    if(lines.length===0){
        alert("Tidak ada koordinat");
        return;
    }

    let points = lines.map(l=>{
        let p=l.split(",");
        return [parseFloat(p[0]),parseFloat(p[1])];
    });

    // target markers
    points.forEach((p,i)=>{

        let info = excelData[i] || {};

        let popup = `
            <b>${info.nama || "Client"}</b><br>
            Frekuensi: ${info.freq || "-"}<br>
            Lokasi: ${info.lokasi || "-"}
        `;

        let marker = L.marker(p,{
            icon: L.icon({
                iconUrl:"https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                iconSize:[32,32]
            })
        }).addTo(map).bindPopup(popup);

        targetMarkers.push(marker);
    });

    // request optimizer
    let res = await fetch(window.location.origin + "/optimize",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({locations:points})
    });

    let data = await res.json();

    // measure points
    data.recommended_points.forEach((c,i)=>{

        let covered = countCovered(points,c);

        let circle = L.circle(c,{
            radius:10000,
            color:"#3a2edb",
            fillOpacity:0.08
        }).addTo(map);

        coverageCircles.push(circle);

        let nav = `https://www.google.com/maps/dir/?api=1&destination=${c[0]},${c[1]}`;

        let marker = L.marker(c,{
            icon:L.icon({
                iconUrl:"https://maps.google.com/mapfiles/ms/icons/green-dot.png",
                iconSize:[32,32]
            })
        }).addTo(map)
        .bindPopup(`
            <b>📡 Titik Ukur ${i+1}</b><br>
            Coverage: ${covered} titik<br>
            <a href="${nav}" target="_blank">Navigasi</a>
        `);

        measureMarkers.push(marker);
    });

    map.fitBounds(points);

    buildPointList(points,data.recommended_points);

    document.getElementById("statusText").innerText =
        `Total titik ukur: ${data.recommended_points.length}`;
}

// ================= SIDE PANEL LIST =================
function buildPointList(targets,stands){

    let div=document.getElementById("pointList");
    div.innerHTML="";

    excelData.forEach((row,i)=>{

        let covered=false;

        stands.forEach(s=>{
            if(distance([row.lat,row.long],s)<=10)
                covered=true;
        });

        let item=document.createElement("div");
        item.className="point-item "+(covered?"covered":"uncovered");

        item.innerHTML=`
            <b>${row.nama||"Client"}</b><br>
            ${row.freq||"-"}<br>
            ${row.lokasi||"-"}
        `;

        div.appendChild(item);
    });
}

// ================= PANEL =================
function togglePanel(){

 let panel=document.getElementById("sidepanel");
 let overlay=document.getElementById("overlay");

 panel.classList.toggle("open");
 overlay.classList.toggle("show");

}
// ================= DISTANCE =================
function distance(a,b){
    let R=6371;
    let dLat=(b[0]-a[0])*Math.PI/180;
    let dLon=(b[1]-a[1])*Math.PI/180;

    let lat1=a[0]*Math.PI/180;
    let lat2=b[0]*Math.PI/180;

    let x=Math.sin(dLat/2)**2+
          Math.sin(dLon/2)**2*Math.cos(lat1)*Math.cos(lat2);

    return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function countCovered(points,center){
    let total=0;
    points.forEach(p=>{
        if(distance(p,center)<=10) total++;
    });
    return total;
}

// ================= CLEAR =================
function clearMapLayers(){

    targetMarkers.forEach(m=>map.removeLayer(m));
    measureMarkers.forEach(m=>map.removeLayer(m));
    coverageCircles.forEach(c=>map.removeLayer(c));

    targetMarkers=[];
    measureMarkers=[];
    coverageCircles=[];
}

function clearAll(){

    clearMapLayers();

    if(userMarker){
        map.removeLayer(userMarker);
        userMarker=null;
    }

    document.getElementById("targetInput").value="";
    document.getElementById("excelFile").value="";
    document.getElementById("fileName").innerText="Pilih file Excel";
    document.getElementById("statusText").innerText="Status: Belum ada perhitungan";
    document.getElementById("pointList").innerHTML="";

    excelData=[];

    map.setView([-2.5,118],5);
}

// ================= SAVE SESSION =================
function saveSession(){

 if(standingPoints.length === 0){
   alert("Belum ada hasil untuk disimpan");
   return;
 }

 let history =
  JSON.parse(localStorage.getItem("coverage_history") || "[]");

 let data = {
   id: Date.now(),
   tanggal: new Date().toLocaleString(),
   rawPoints,
   standingPoints
 };

 history.push(data);

 localStorage.setItem(
   "coverage_history",
   JSON.stringify(history)
 );

 alert("✅ Data berhasil disimpan!");
}