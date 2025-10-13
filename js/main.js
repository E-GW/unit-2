// Global state
var map;
var crashLayer;                 // Leaflet layer for crashes
var geojsonData = null;         // Loaded GeoJSON
var currentMonth = 1;           // 1..12
let symbolMode = "single";      // 'single' | 'class'
let activeSizeFilters = new Set();  // set of numbered keys for Legend

const DEFAULT_VIEW = {
  center: [38.9, -77.03],
  zoom: 11,
  minZoom: 8
};

// Style constants
var minRadius = 4;
var scaleFactor = 2;

// Month names for labels
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];



// Map init
function createMap() {
  map = L.map('map', {center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom, minZoom: DEFAULT_VIEW.minZoom});

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://carto.com/about-carto/">CARTO</a> contributors',
    ext: 'png'
  }).addTo(map);

  ["1","2","3","4-6","7","8","9","10-11","12+"].forEach(k => activeSizeFilters.add(k));

  // Create UI immediately so it always shows, even if data fails to load
  createSequenceControls();

  // Load data (controls will start working as soon as data is ready)
  loadData();
}



// Data loading with robust errors
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



// Helpers
function setStatus(msg) {
  let el = document.getElementById("panel-status");
  if (!el) {
    el = document.createElement('div');
    el.id = "panel-status";
    el.style.cssText = "margin-top:10px; font-size:13px; color:#555;";
    document.querySelector("#panel").appendChild(el);
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


// Legend and its colors
function getClassColor(vehicleCount) {
  const count = Number(vehicleCount);
  if (count <= 1) return "#e7e7e7ff";    // off-white
  if (count === 2) return "#7634CD";     // violet
  if (count === 3) return "#273ED7";     // indigo
  if (count >= 4 && count <= 6) return "#20A9ED"; // blue
  if (count === 7) return "#42DC6E";     // green
  if (count === 8) return "#FFF646";     // yellow
  if (count === 9) return "#ff6a00ff";   // orange
  if (count >= 10 && count <= 11) return "#be3838ff"; // red
  if (count >= 12) return "#000000ff";   // black
}

// Legend buttons
function getSizeClassKey(vehicleCount) {
  const count = Number(vehicleCount) || 0;
  if (count <= 1) return "1";
  if (count === 2) return "2";
  if (count === 3) return "3";
  if (count >= 4 && count <= 6) return "4-6";
  if (count === 7) return "7";
  if (count === 8) return "8";
  if (count === 9) return "9";
  if (count >= 10 && count <= 11) return "10-11";
  if (count >= 12) return "12+";
  return "1";
}



// Render by month
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
      if (!d || (d.getMonth() + 1) !== month) return false;

      // Check size filter
      const sizeKey = getSizeClassKey(f.properties?.TOTAL_VEHICLES);
      return activeSizeFilters.has(sizeKey);
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
      const props = feature.properties || {};
      const popup = `
        <b>Date:</b> ${props.REPORTDATE || "N/A"}<br>
        <b>Location:</b> ${props.ADDRESS || "N/A"}<br>
        <b>Total Vehicles:</b> ${props.TOTAL_VEHICLES ?? "N/A"}<br>
        <b>Total Pedestrians:</b> ${props.TOTAL_PEDESTRIANS ?? "N/A"}<br>
        <b>Major Driver Injuries:</b> ${props.MAJORINJURIES_DRIVER ?? "N/A"}<br>
        <b>Minor Driver Injuries:</b> ${props.MINORINJURIES_DRIVER ?? "N/A"}<br>
        <b>Major Passenger Injuries:</b> ${props.MAJORINJURIESPASSENGER ?? "N/A"}<br>
        <b>Minor Passenjor Injuries:</b> ${props.MINORINJURIESPASSENGER ?? "N/A"}<br>
      `;
      layer.bindPopup(popup);
      return layer;
    }
  }).addTo(map);

  // Count crashes and total vehicles
  const count = filtered.features.length;
  const totalVehicles = filtered.features.reduce((sum, f) => {
    return sum + (parseInt(f.properties?.TOTAL_VEHICLES) || 0);
  }, 0);

  const countEl = document.getElementById("crash-count");
  if (countEl) countEl.textContent = `Crashes this month: ${count}`;

  const vehicleEl = document.getElementById("vehicle-count");
  if (vehicleEl) vehicleEl.textContent = `Vehicles involved: ${totalVehicles}`;

}



// UI (slider, buttons, color mode, legend, month label)
function createSequenceControls() {
  
  // button to return map to default view
  const ResetViewControl = L.Control.extend({
    options: { position: 'topleft' },  // Change to 'topright' or others if preferred

    onAdd: function () {
      const btn = L.DomUtil.create('button', 'reset-view-btn leaflet-bar');
      btn.title = "Reset map view";
      btn.innerHTML = "⟳"; // Unicode for refresh icon

      L.DomEvent.on(btn, 'click', function (e) {
        L.DomEvent.stopPropagation(e);
        map.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
      });

      return btn;
    }
  });


  // Sequence UI: slider, buttons, month, counts, color mode
  const SequenceControl = L.Control.extend({
    options: { position: 'bottomleft' }, // Other options: 'topleft', 'topright', etc.
    
    // slider panel buttons
    onAdd: function () {
      const container = L.DomUtil.create('div', 'sequence-control leaflet-bar');
      container.innerHTML = `
        <div id="month-label">Month: ${MONTH_NAMES[currentMonth - 1]}</div>
        <div id="crash-count">Crashes this month: ...</div>
        <div id="vehicle-count">Vehicles involved: ...</div>

        <div class="slider-controls">
          <button class="step" id="reverse">Back</button>
          <input class='range-slider' type='range' min='1' max='12' value='${currentMonth}' step='1' />
          <button class="step" id="forward">Forward</button>
        </div>

        <div class="color-mode">
          <label><input type="radio" name="colorMode" value="single" checked> Single Color</label>
          <label><input type="radio" name="colorMode" value="class"> Color by Crash Size</label>
        </div>
      `;
      // Prevent clicks from bubbling to the map
      L.DomEvent.disableClickPropagation(container);

      // Return the fully built control
      return container;
    }
  });

  // Legend UI: on right side
  const LegendControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function () {
      const container = L.DomUtil.create('div', 'legend-control leaflet-bar');
      container.innerHTML = `
        <div id="legend" class="is-hidden">
          <h4>Crash Sizes by Color</h4>
          <h5>(Click color to deselect)<h5>
          <div class="legend-grid">
            <button class="legend-btn" data-size="1"><span class="swatch swatch--white"></span>0–1 Vehicles</button>
            <button class="legend-btn" data-size="8"><span class="swatch swatch--yellow"></span>8 Vehicles</button>
            <button class="legend-btn" data-size="2"><span class="swatch swatch--violet"></span>2 Vehicles</button>
            <button class="legend-btn" data-size="9"><span class="swatch swatch--orange"></span>9 Vehicles</button>
            <button class="legend-btn" data-size="3"><span class="swatch swatch--indigo"></span>3 Vehicles</button>
            <button class="legend-btn" data-size="10-11"><span class="swatch swatch--red"></span>10–11 Vehicles</button>
            <button class="legend-btn" data-size="4-6"><span class="swatch swatch--blue"></span>4–6 Vehicles</button>
            <button class="legend-btn" data-size="12+"><span class="swatch swatch--black"></span>12+ Vehicles</button>
            <button class="legend-btn" data-size="7"><span class="swatch swatch--green"></span>7 Vehicles</button>
          </div>
        </div>
      `;
      L.DomEvent.disableClickPropagation(container);
      return container;
    }
  });

  // Add both controls to the map
  map.addControl(new ResetViewControl());
  map.addControl(new SequenceControl());
  map.addControl(new LegendControl());

  // Attach interactions after render 
  setTimeout(() => {
    const slider = document.querySelector(".range-slider");

    document.querySelectorAll('.step').forEach(btn => {
      btn.addEventListener('click', function () {
        let idx = Number(slider.value);
        idx = (btn.id === 'forward') ? (idx % 12) + 1 : (idx - 2 + 12) % 12 + 1;
        slider.value = idx;
        currentMonth = idx;
        updateCrashesForMonth(currentMonth);
      });
    });

    slider.addEventListener('input', function () {
      currentMonth = Number(this.value);
      updateCrashesForMonth(currentMonth);
    });

    document.querySelectorAll('input[name="colorMode"]').forEach(radio => {
      radio.addEventListener('change', function () {
        symbolMode = this.value;
        document.getElementById("legend").classList.toggle('is-hidden', symbolMode !== 'class');
        updateCrashesForMonth(currentMonth);
      });
    });

    // After DOM is ready / controls are inserted
    document.querySelectorAll('.legend-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sizeKey = btn.getAttribute('data-size');
        if (activeSizeFilters.has(sizeKey)) {
          activeSizeFilters.delete(sizeKey);
          btn.classList.add('legend-btn--inactive');
        } else {
          activeSizeFilters.add(sizeKey);
          btn.classList.remove('legend-btn--inactive');
        }
        // Re-draw the crashes layer
        updateCrashesForMonth(currentMonth);
      });
    });
  }, 0); // Defer DOM wiring to allow Leaflet to mount the control
}


// Start
document.addEventListener('DOMContentLoaded', createMap);
