// =====================
// Global state
// =====================
var map;
var crashLayer;                 // Leaflet layer for crashes
var geojsonData = null;         // Loaded GeoJSON
var currentMonth = 1;           // 1..12
let symbolMode = "single";      // 'single' | 'class'

// Style constants
var minRadius = 4;
var scaleFactor = 2;

// Month names for labels
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// =====================
// Map init
// =====================
function createMap() {
  map = L.map('map', { center: [38.9, -77.03], zoom: 11 });

  L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.{ext}',  {
    attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/about-carto/">CARTO</a> contributors',
    ext: 'png'
  }).addTo(map);

  // Create UI immediately so it always shows, even if data fails to load
  createSequenceControls();

  // Load data (controls will start working as soon as data is ready)
  loadData();
}

// =====================
// Data loading with robust errors
// =====================
async function loadData() {
  // Show a quick status line in the panel (optional)
  setStatus("Loading crash data…");

  try {
    const res = await fetch('data/Crashes_in_DC_short.geojson', { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} – check the file path and that you’re running a local server.`);
    }

    // Read as text first so JSON parse errors report the first characters
    const text = await res.text();

    // Quick guard: if the first non-space char is "<", you likely got an HTML error page (404)
    const firstNonWs = (text.match(/\S/) || [""])[0];
    if (firstNonWs === "<") {
      console.error("The fetched file looks like HTML (likely a 404 page). Check the path: data/Crashes_in_DC_short.geojson");
      throw new Error("Fetched response is HTML, not JSON.");
    }

    geojsonData = JSON.parse(text);

    // Initial draw
    updateCrashesForMonth(currentMonth);
    setStatus(""); // clear status
  } catch (err) {
    console.error("Error loading GeoJSON:", err);
    setStatus("❌ Failed to load data. Open console for details.");
  }
}

// =====================
// Helpers
// =====================
function setStatus(msg) {
  let el = document.getElementById("panel-status");
  if (!el) {
    const html = `<div id="panel-status" style="margin-top:10px; font-size:13px; color:#555;"></div>`;
    document.querySelector("#panel").insertAdjacentHTML("beforeend", html);
    el = document.getElementById("panel-status");
  }
  el.textContent = msg || "";
}

function calcRadius(numVehicles) {
  const n = Number(numVehicles) || 1;
  return minRadius + scaleFactor * Math.sqrt(n);
}

// Tolerant date parser: handles ISO (YYYY-MM-DD...), and common US formats M/D/YYYY or M-D-YYYY
function parseReportDate(str) {
  if (!str) return null;
  let d = new Date(str);
  if (!isNaN(d)) return d;
  // Try M/D/YYYY or M-D-YYYY
  const m = String(str).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (m) {
    const mm = parseInt(m[1], 10);
    const dd = parseInt(m[2], 10);
    const yyyy = parseInt(m[3].length === 2 ? ("20" + m[3]) : m[3], 10);
    d = new Date(yyyy, mm - 1, dd);
    if (!isNaN(d)) return d;
  }
  return null;
}

function updateMonthLabel(month) {
  const el = document.getElementById("month-label");
  if (el) el.innerText = "Month: " + MONTH_NAMES[month - 1];
}

// 6-digit hex colors for stable canvas rendering
function getClassColor(vehicleCount) {
  const count = Number(vehicleCount);
  if (count === 1) return "#e7e7e7ff"; 
  if (count === 2) return "#7634CD";     // violet
  if (count === 3) return "#273ED7";     // indigo
  if (count >= 4 && count <= 6) return "#20A9ED"; // blue
  if (count === 7) return "#42DC6E";     // green
  if (count === 8) return "#FFF646";     // yellow
  if (count === 9) return "#ff6a00ff";     // orange
  if (count >= 10 && count <= 11) return "#be3838ff"; // red
  if (count >= 12) return "#000000ff";     // near black
  return "#e7e7e7ff";                      // fallback (single-color orange)
}

// =====================
// Render by month
// =====================
function updateCrashesForMonth(month) {
  updateMonthLabel(month);

  if (!geojsonData || !geojsonData.features) {
    // Data not ready yet; keep UI working but do nothing
    return;
  }

  if (crashLayer) {
    map.removeLayer(crashLayer);
  }

  const filtered = {
    type: "FeatureCollection",
    features: geojsonData.features.filter(f => {
      const d = parseReportDate(f.properties?.REPORTDATE);
      return d ? (d.getMonth() + 1) === month : false;
    })
  };

  crashLayer = L.geoJSON(filtered, {
    pointToLayer: function (feature, latlng) {
      const vehicles = feature.properties?.TOTAL_VEHICLES;
      const radius = calcRadius(vehicles);
      const opts = {
        radius,
        fillColor: (symbolMode === 'single')
          ? '#FF5722'
          : getClassColor(vehicles),
        color: '#333',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.6
      };
      const layer = L.circleMarker(latlng, opts);
      const popup =
        `<b>Date:</b> ${feature.properties?.REPORTDATE || "N/A"}<br>` +
        `<b>Total Vehicles:</b> ${vehicles ?? "N/A"}`;
      layer.bindPopup(popup);
      return layer;
    }
  }).addTo(map);
}

// =====================
// UI (slider, buttons, color mode, legend, month label)
// =====================
function createSequenceControls() {
  const panel = document.querySelector("#panel");

  // Slider + buttons
  const sliderHtml = `
    <input class='range-slider' type='range' min='1' max='12' value='${currentMonth}' step='1' />
    <button class="step" id="reverse">Back</button>
    <button class="step" id="forward">Forward</button>
  `;
  panel.insertAdjacentHTML('beforeend', sliderHtml);

   // Month label
  const monthLabelHTML = `<div id="month-label">Month: ${MONTH_NAMES[currentMonth-1]}</div>`;
  panel.insertAdjacentHTML('beforeend', monthLabelHTML);

  // Color mode radios
  const colorOptionsHTML = `
    <div class="color-mode">
      <label><input type="radio" name="colorMode" value="single" checked> Single Color</label>
      <label><input type="radio" name="colorMode" value="class"> Color by Vehicle Count</label>
    </div>
  `;
  panel.insertAdjacentHTML('beforeend', colorOptionsHTML);


  // Legend (hidden by default)
  const legendHTML = `
    <div id="legend" class="is-hidden">
      <h4>Crash Size Colors</h4>
      <div class="legend-grid">
        <div class="legend-item"><span class="swatch swatch--white"></span>0–1 Vehicles</div>
        <div class="legend-item"><span class="swatch swatch--yellow"></span>8 Vehicles</div> 
        <div class="legend-item"><span class="swatch swatch--violet"></span>2 Vehicles</div>
        <div class="legend-item"><span class="swatch swatch--orange"></span>9 Vehicles</div>
        <div class="legend-item"><span class="swatch swatch--indigo"></span>3 Vehicles</div>
        <div class="legend-item"><span class="swatch swatch--red"></span>10–11 Vehicles</div>
        <div class="legend-item"><span class="swatch swatch--blue"></span>4–6 Vehicles</div>
        <div class="legend-item"><span class="swatch swatch--black"></span>12+ Vehicles</div>
        <div class="legend-item"><span class="swatch swatch--green"></span>7 Vehicles</div>
      </div>
    </div>
  `;
  panel.insertAdjacentHTML('beforeend', legendHTML);


  // Wire up radios
  document.querySelectorAll('input[name="colorMode"]').forEach(radio => {
    radio.addEventListener('change', function () {
      symbolMode = this.value;
      // Toggle legend visibility
      document.getElementById("legend").classList.toggle('is-hidden', symbolMode !== 'class');
      updateCrashesForMonth(currentMonth);
    });
  });

  // Wire up slider + buttons
  const slider = document.querySelector(".range-slider");

  document.querySelectorAll('.step').forEach(btn => {
    btn.addEventListener('click', function () {
      let idx = Number(slider.value);
      if (btn.id === 'forward') {
        idx = (idx % 12) + 1;           // 12 -> 1
      } else {
        idx = (idx - 2 + 12) % 12 + 1;  // 1 -> 12
      }
      slider.value = idx;
      currentMonth = idx;
      updateCrashesForMonth(currentMonth);
    });
  });

  slider.addEventListener('input', function () {
    currentMonth = Number(this.value);
    updateCrashesForMonth(currentMonth);
  });
}

// Start
document.addEventListener('DOMContentLoaded', createMap);
