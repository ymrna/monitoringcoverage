
// ================= GLOBAL =================
let map;
let rawPoints=[];
let standingPoints=[];
let userMarker=null;
let targetLayers=[];
let measureLayers=[];
let circles=[];
let distanceLines=[];


// ICONS
const targetIcon=L.icon({
 iconUrl:'https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png',
 iconSize:[32,32]
});

const standIcon=L.icon({
 iconUrl:'https://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png',
 iconSize:[32,32]
});

const userIcon=L.icon({
 iconUrl:'https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png',
 iconSize:[32,32]
 
});

// ================= INIT =================
window.onload=()=>{
 map=L.map('map').setView([-2.5,118],5);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
 setTimeout(()=>map.invalidateSize(),200);


 document.getElementById("btnHitung").onclick=optimize;
 document.getElementById("btnClear").onclick=clearAll;
 document.getElementById("btnPanel").onclick=togglePanel;
 document.getElementById("fabPanel").onclick=togglePanel;
 document.getElementById("excelFile").addEventListener("change",loadExcel);
 document.getElementById("btnSave").onclick = saveSession;
 document.getElementById("btnHistory").onclick = showHistory;
 document.getElementById("btnExport").onclick = exportExcel;
};

// ================= PANEL =================
function togglePanel(){
 document.getElementById("sidepanel").classList.toggle("open");
}


// ================= CLEAR =================
function clearMapOnly(){
 [...targetLayers,...measureLayers,...circles,...distanceLines].forEach(l=>{
   if(map.hasLayer(l)) map.removeLayer(l);
 });
 targetLayers=[];
 measureLayers=[];
 circles=[];
 distanceLines=[];
}


function clearAll(){
 clearMapOnly();

 rawPoints=[];
 standingPoints=[];

 document.getElementById("coords").value="";
 document.getElementById("excelFile").value="";
 document.getElementById("status").innerText="Belum ada perhitungan";
 document.querySelector("#pointTable tbody").innerHTML="";

 if(userMarker){
   map.removeLayer(userMarker);
   userMarker=null;
 }

 map.setView([-2.5,118],5);
}


// ================= SHOW HISTORY =================

function showHistory(){

 togglePanel();

 let history =
 JSON.parse(
  localStorage.getItem(
   "coverage_history"
  ) || "[]"
 );

 let div =
 document.getElementById(
  "historyList"
 );

 div.innerHTML="";

 history.forEach(h=>{

  let d =
  document.createElement("div");

  d.style.marginBottom="10px";

  d.innerHTML =

  "<b>"+h.nama+"</b><br>"+

  h.tanggal+

  " ("+
  h.standingPoints.length+
  " titik) <br>"+

  "<button onclick='loadHistory("+h.id+")'>Load</button> "+

  "<button onclick='deleteHistory("+h.id+")'>Hapus</button>";

  div.appendChild(d);

 });

}



// ================= LOAD HISTORY =================

function loadHistory(id){

 let history =
  JSON.parse(localStorage.getItem("coverage_history") || "[]");

 let item = history.find(h=>h.id===id);

 if(!item) return;

 clearAll();

 rawPoints = item.rawPoints;
 standingPoints = item.standingPoints;

 plotTargets();

 standingPoints.forEach((c,i)=>{

   let circle=L.circle(c,{
     radius:10000,
     color:'#00ffaa',
     fillOpacity:0.08
   }).addTo(map);

   circles.push(circle);

   let marker=L.marker(c,{icon:standIcon})
   .addTo(map)
   .bindPopup("📡 Titik Ukur "+(i+1));

   measureLayers.push(marker);

 });

 updateTable();

 map.fitBounds(
   rawPoints.map(p=>[p.lat,p.lon])
 );

 togglePanel();

 // Tutup dropdown setelah load
let wrapper =
 document.getElementById("pointListWrapper");

let header =
 document.getElementById("togglePointList");

wrapper.classList.remove("open");
header.innerHTML = "▶ Daftar Titik";
}



// ================= DELETE HISTORY =================
function deleteHistory(id){

 let history =
  JSON.parse(localStorage.getItem("coverage_history") || "[]");

 history = history.filter(h=>h.id!==id);

 localStorage.setItem(
   "coverage_history",
   JSON.stringify(history)
 );

 showHistory();
}


// ================= USER =================
function getUserLocation(){
 navigator.geolocation.getCurrentPosition(pos=>{
  let lat=pos.coords.latitude;
  let lon=pos.coords.longitude;

  if(userMarker) map.removeLayer(userMarker);

  userMarker=L.marker([lat,lon],{icon:userIcon})
  .addTo(map).bindPopup("📍 Posisi Saya").openPopup();

  map.setView([lat,lon],13);
 });
}

// ================= EXPORT EXCEL =================
function exportExcel(){

 if(standingPoints.length === 0){
   alert("Belum ada data");
   return;
 }

 let data = [];

 standingPoints.forEach((p,i)=>{

   data.push({
     No:i+1,
     Latitude:p[0],
     Longitude:p[1]
   });

 });

 let ws =
  XLSX.utils.json_to_sheet(data);

 let wb =
  XLSX.utils.book_new();

 XLSX.utils.book_append_sheet(
   wb,
   ws,
   "Titik_Ukur"
 );

 XLSX.writeFile(
   wb,
   "target_titik_ukur.xlsx"
 );

}
// ================= EXCEL =================
function loadExcel(e){
 const file=e.target.files[0];
 if(!file) return;

 const reader=new FileReader();
 reader.onload=ev=>{
  const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
  const sheet=wb.Sheets[wb.SheetNames[0]];
  const json=XLSX.utils.sheet_to_json(sheet);

  rawPoints=json.map(r=>({
   nama:r.nama_client || r.nama || "Client",
   freq:r.freq || "-",
   lokasi:r.lokasi || "-",
   lat:+r.lat,
   lon:+r.long
  }));

  document.getElementById("coords").value =
   rawPoints.map(p=>`${p.lat},${p.lon}`).join("\n");

  plotTargets();
 };
 reader.readAsArrayBuffer(file);
}

// ================= TARGET PLOT =================
function plotTargets(){
 targetLayers.forEach(l=>map.removeLayer(l));
 targetLayers=[];

 rawPoints.forEach(p=>{
  let m=L.marker([p.lat,p.lon],{icon:targetIcon})
  .addTo(map)
  .bindPopup(`<b>${p.nama}</b><br>Freq: ${p.freq}<br>${p.lokasi}`);

  targetLayers.push(m);
 });
}

// ================= OPTIMIZE =================
async function optimize(){

 clearMapOnly();

 if(rawPoints.length===0){
  rawPoints=document.getElementById("coords").value.trim().split("\n").map(l=>{
   let p=l.split(',');
   return {nama:'Manual',freq:'-',lokasi:'-',lat:+p[0],lon:+p[1]};
  });
 }

 let points=rawPoints.map(p=>[p.lat,p.lon]);
 plotTargets();

 let res=await fetch(window.location.origin +'/optimize',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({locations:points})
 });

 let data=await res.json();
 standingPoints=data.recommended_points;

 document.getElementById('status').innerText=
  "Dibutuhkan "+standingPoints.length+" titik ukur";

 standingPoints.forEach((c,i)=>{

  let circle=L.circle(c,{radius:10000,color:'#00ffaa',fillOpacity:0.08}).addTo(map);
  circles.push(circle);

  let marker=L.marker(c,{icon:standIcon})
  .addTo(map)
  .bindPopup(`<b>📡 Titik Ukur ${i+1}</b><br>
  <a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${c[0]},${c[1]}">Navigasi</a>`);

  measureLayers.push(marker);

   // === DISTANCE LINES ===
 rawPoints.forEach(p=>{
   let dist=haversine([p.lat,p.lon],c);

   if(dist<=10){ // hanya yg ke-cover
     let line=L.polyline([[p.lat,p.lon],c],{
       color:'#ffaa00',
       weight:2,
       dashArray:'6,6'
     }).addTo(map);

     let midLat=(p.lat+c[0])/2;
     let midLon=(p.lon+c[1])/2;

     line.bindTooltip(dist.toFixed(2)+" km",{
        permanent:true,
        direction:'center',
        className:'distance-label'
     });

     distanceLines.push(line);
   }
 });

 });

 updateTable();
 map.fitBounds(points);
}

// ================= TABLE =================
function updateTable(){
 const tb=document.querySelector('#pointTable tbody');
 tb.innerHTML='';
 rawPoints.forEach(p=>{
  tb.innerHTML+=`<tr>
  <td>${p.nama}</td>
  <td>${p.freq}</td>
  <td>${p.lokasi}</td>
  </tr>`;
 });
}

function haversine(a,b){
 let R=6371;
 let dLat=(b[0]-a[0])*Math.PI/180;
 let dLon=(b[1]-a[1])*Math.PI/180;
 let lat1=a[0]*Math.PI/180;
 let lat2=b[0]*Math.PI/180;

 let x=Math.sin(dLat/2)**2+
       Math.sin(dLon/2)**2*Math.cos(lat1)*Math.cos(lat2);

 return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

// ================= SAVE SESSION WITH PROJECT NAME =================


function saveSession(){

 if(standingPoints.length===0){
  alert("Belum ada hasil untuk disimpan");
  return;
 }

  // === CONFIRM DULU ===
 if(!confirm("Simpan project ini?")){
  return;
 }

 // MINTA NAMA PROJECT
 let projectName = prompt("Masukkan Nama Project:");

 // === Jika Cancel → BATAL SIMPAN ===
 if(projectName === null){
  alert("❌ Penyimpanan dibatalkan");
  return;
 }

 // === Jika kosong → beri default ===
 if(projectName.trim() === ""){
  projectName = "Project Tanpa Nama";
 }

 let history =
 JSON.parse(
  localStorage.getItem(
   "coverage_history"
  ) || "[]"
 );

 let data={

  id:Date.now(),

  nama:projectName,

  tanggal:
  new Date().toLocaleString(),

  rawPoints,
  standingPoints

 };

 history.push(data);

 localStorage.setItem(
  "coverage_history",
  JSON.stringify(history)
 );

 alert("✅ Project disimpan");

}

// ================= TOGGLE POINT LIST =================

function togglePointDropdown(){

 let content =
 document.getElementById(
  "pointListWrapper"
 );

 let header =
 document.getElementById(
  "togglePointList"
 );

 content.classList.toggle("open");

 if(content.classList.contains("open")){

  header.innerHTML =
  "▼ Daftar Titik";

 }else{

  header.innerHTML =
  "▶ Daftar Titik";

 }

}