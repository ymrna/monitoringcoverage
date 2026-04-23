// ================= GLOBAL =================

let map;
let rawPoints = [];
let standingPoints = [];
let markers = [];



// ================= INIT =================

window.onload = function(){

 try{

  initMap();
  initButtons();

 }catch(err){

  console.error(err);
  alert("JS Error: " + err.message);

 }

};



function initMap(){

 map = L.map('map')
   .setView([-2.5,118],5);

 L.tileLayer(
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom: 19 }
 ).addTo(map);

 setTimeout(
   ()=>map.invalidateSize(),
   200
 );

}



function initButtons(){

 document.getElementById("btnHitung")
  .onclick = optimize;

 document.getElementById("btnClear")
  .onclick = clearAll;

 document.getElementById("btnSave")
  .onclick = saveSession;

 document.getElementById("btnHistory")
  .onclick = showHistory;

 document.getElementById("btnExport")
  .onclick = exportExcel;

 document.getElementById("fabPanel")
  .onclick = togglePanel;

 document.getElementById("overlay")
  .onclick = togglePanel;

 document
  .getElementById("excelFile")
  .addEventListener(
   "change",
   loadExcel
  );

}



// ================= OPTIMIZE =================

async function optimize(){

 let text =
 document.getElementById("coords").value;

 let lines = text.split("\n");

 let points=[];

 lines.forEach(l=>{

  let p=l.split(",");

  if(p.length==2){

   points.push([
    parseFloat(p[0]),
    parseFloat(p[1])
   ]);

  }

 });

 if(points.length==0){

  alert("Tidak ada titik");

  return;

 }

 rawPoints =
 points.map(p=>({
  lat:p[0],
  lon:p[1]
 }));

 let res =
 await fetch("/optimize",{

  method:"POST",

  headers:{
   "Content-Type":
   "application/json"
  },

  body:JSON.stringify({
   locations:points
  })

 });

 let data =
 await res.json();

 standingPoints =
 data.recommended_points;

 drawPoints();

}



// ================= DRAW =================

function drawPoints(){

 markers.forEach(
  m=>map.removeLayer(m)
 );

 markers=[];

 rawPoints.forEach(p=>{

  let m =
  L.marker([p.lat,p.lon])
  .addTo(map);

  markers.push(m);

 });

 standingPoints.forEach(p=>{

  let m =
  L.circleMarker(
   [p[0],p[1]],
   {radius:8}
  ).addTo(map);

  markers.push(m);

 });

}



// ================= SAVE =================

function saveSession(){

 if(standingPoints.length==0){

  alert("Belum ada hasil");

  return;

 }

 let history =
 JSON.parse(
  localStorage.getItem(
   "coverage_history"
  ) || "[]"
 );

 let data={

  id:Date.now(),

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

 alert("✅ Data disimpan");

}



// ================= HISTORY =================

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

  d.innerHTML =

  h.tanggal+

  " ("+
  h.standingPoints.length+
  " titik) "+

  "<button onclick='loadHistory("+h.id+")'>Load</button>"+

  "<button onclick='deleteHistory("+h.id+")'>Hapus</button>";

  div.appendChild(d);

 });

}



function loadHistory(id){

 let history =
 JSON.parse(
  localStorage.getItem(
   "coverage_history"
  )
 );

 let h =
 history.find(x=>x.id==id);

 rawPoints =
 h.rawPoints;

 standingPoints =
 h.standingPoints;

 drawPoints();

}



function deleteHistory(id){

 let history =
 JSON.parse(
  localStorage.getItem(
   "coverage_history"
  )
 );

 history =
 history.filter(
  x=>x.id!=id
 );

 localStorage.setItem(
  "coverage_history",
  JSON.stringify(history)
 );

 showHistory();

}



// ================= EXPORT =================

function exportExcel(){

 if(typeof XLSX === "undefined"){

  alert("Library XLSX tidak terbaca");

  return;

 }

 if(standingPoints.length==0){

  alert("Tidak ada data");

  return;

 }

 let data=[];

 rawPoints.forEach((p,i)=>{

  data.push({

   Tipe:"Target",

   No:i+1,

   Lat:p.lat,

   Lon:p.lon

  });

 });

 standingPoints.forEach((p,i)=>{

  data.push({

   Tipe:"Titik Ukur",

   No:i+1,

   Lat:p[0],

   Lon:p[1]

  });

 });

 let ws =
 XLSX.utils.json_to_sheet(data);

 let wb =
 XLSX.utils.book_new();

 XLSX.utils.book_append_sheet(
  wb,
  ws,
  "Coverage"
 );

 XLSX.writeFile(
  wb,
  "coverage_result.xlsx"
 );

}



// ================= EXCEL LOAD =================

function loadExcel(e){

 let file=e.target.files[0];

 let reader =
 new FileReader();

 reader.onload=function(evt){

  let data =
  new Uint8Array(
   evt.target.result
  );

  let wb =
  XLSX.read(
   data,
   {type:"array"}
  );

  let ws =
  wb.Sheets[
   wb.SheetNames[0]
  ];

  let json =
  XLSX.utils
  .sheet_to_json(ws);

  let text="";

  json.forEach(r=>{

   let lat =
   r.Lat ||
   r.lat ||
   r.Latitude;

   let lon =
   r.Lon ||
   r.lon ||
   r.Longitude;

   if(lat && lon){

    text +=
    lat + "," + lon + "\n";

   }

  });

  document
  .getElementById("coords")
  .value = text;

 };

 reader.readAsArrayBuffer(file);

}



// ================= CLEAR =================

function clearAll(){

 rawPoints=[];
 standingPoints=[];

 markers.forEach(
  m=>map.removeLayer(m)
 );

 markers=[];

}



// ================= PANEL =================

function togglePanel(){

 let panel =
 document.getElementById(
  "sidepanel"
 );

 let overlay =
 document.getElementById(
  "overlay"
 );

 panel.classList
  .toggle("open");

 overlay.classList
  .toggle("show");

}