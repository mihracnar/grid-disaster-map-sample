// Initialize the map
const map = L.map('map', {
  center: [39.5, -98.35], // USA center
  zoom: 4,
  minZoom: 4,
  maxZoom: 5,
  zoomControl: false,
  attributionControl: false
});

// Define Carto Light basemap
const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
});

// Basemap toggle controller
let basemapVisible = false;
const toggleElement = document.getElementById('basemapToggle');
const toggleSwitch = document.getElementById('toggleSwitch');

toggleElement.addEventListener('click', () => {
  basemapVisible = !basemapVisible;
  
  if (basemapVisible) {
    map.addLayer(cartoLight);
    toggleSwitch.classList.add('active');
  } else {
    map.removeLayer(cartoLight);
    toggleSwitch.classList.remove('active');
  }
});

// Set map bounds for USA
const bounds = [[24, -125], [50, -65]];
map.setMaxBounds(bounds);
// map.fitBounds(bounds); // Bu satır kaldırıldı - zoom seviyesini bozuyordu

// Zoom seviyesini sabitlemek için setView kullanın (opsiyonel)
map.setView([39.5, -98.35], 4);

// Store grid data globally
let gridData = {};

// Calculate center of a polygon
function calculatePolygonCenter(coordinates) {
  const coords = coordinates[0]; // Get outer ring
  let latSum = 0, lngSum = 0;
  
  for (let i = 0; i < coords.length - 1; i++) { // Exclude last point (same as first)
    lngSum += coords[i][0];
    latSum += coords[i][1];
  }
  
  return [latSum / (coords.length - 1), lngSum / (coords.length - 1)];
}

// Load and display grid data
async function loadGridData() {
  try {
    const response = await fetch('data/grid.geojson');
    const geoJsonData = await response.json();
    
    // Store grid data for later use (supporting both string and numeric IDs)
    geoJsonData.features.forEach(feature => {
      const gridId = feature.properties.id;
      const center = calculatePolygonCenter(feature.geometry.coordinates);
      gridData[gridId] = {
        center: center,
        properties: feature.properties,
        geometry: feature.geometry
      };
    });
    
    // Add grid to map
    L.geoJSON(geoJsonData, {
      style: {
        color: '#aaa',
        weight: 0.5,
        fillOpacity: 0.05
      }
    }).addTo(map);
    
    console.log('Grid data loaded:', Object.keys(gridData).length, 'grid cells');
  } catch (error) {
    console.error('Error loading grid data:', error);
    // Fallback: Generate grid programmatically
    generateFallbackGrid();
  }
}

// Load and display border data - YENİ FONKSİYON
async function loadBorderData() {
  try {
    const response = await fetch('data/border.geojson');
    const borderData = await response.json();
    
    // Add border to map with bold styling
    L.geoJSON(borderData, {
      style: {
        color: '#333',        // Koyu gri renk
        weight: 3,            // Kalın çizgi
        fillOpacity: 0,       // İç dolgu yok
        opacity: 0.8          // Çizgi şeffaflığı
      }
    }).addTo(map);
    
    console.log('Border data loaded successfully');
  } catch (error) {
    console.error('Error loading border data:', error);
    console.log('Border file not found, continuing without external border');
  }
}

// Load and display disaster data
async function loadDisasterData() {
  try {
    const response = await fetch('data/disaster.csv');
    const csvText = await response.text();
    const disasters = parseCSV(csvText);
    
    console.log('Disaster data loaded:', disasters.length, 'disasters');
    
    // Add disaster markers to map
    disasters.forEach(disaster => {
      addDisasterMarker(disaster);
    });
  } catch (error) {
    console.error('Error loading disaster data:', error);
    // Fallback: Generate random disasters
    generateRandomDisasters();
  }
}

// Simple CSV parser
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] ? values[index].trim() : '';
    });
    data.push(row);
  }
  
  return data;
}

// Add disaster marker to map using grid ID - DÜZELTILMIŞ VERSİYON
function addDisasterMarker(disaster) {
  let gridId = disaster.grid_id;
  
  // Convert to number if it's a numeric string
  if (!isNaN(gridId)) {
    gridId = parseInt(gridId);
  }
  
  // Check if grid exists
  if (!gridData[gridId]) {
    console.warn(`Grid ${gridId} not found for disaster ${disaster.id}`);
    return;
  }
  
  const gridCenter = gridData[gridId].center;
  const lat = gridCenter[0];
  const lng = gridCenter[1];
  
  // Map disaster types to CSS classes
  const typeClassMap = {
    'bi-fire': 'fire',
    'bi-droplet-fill': 'flood', 
    'bi-hurricane': 'hurricane',
    'bi-tornado': 'tornado',
    'bi-activity': 'earthquake'
  };
  
  const typeClass = typeClassMap[disaster.icon] || 'fire';
  
  // İkonu tam merkeze ortalamak için iconAnchor kullanıyoruz - ANA DEĞİŞİKLİK
  const marker = L.marker([lat, lng], {
    icon: L.divIcon({
      html: `<div class="disaster-icon ${typeClass}"><i class="${disaster.icon}"></i></div>`,
      className: '',
      iconSize: [20, 20]
    })
  }).addTo(map);
  
  marker.on('click', () => {
    document.getElementById('disasterModalLabel').innerText = disaster.type;
    document.getElementById('modalContent').innerHTML = `
      <p><strong>Type:</strong> ${disaster.type}</p>
      <p><strong>Grid ID:</strong> ${disaster.grid_id}</p>
      <p><strong>Date:</strong> ${disaster.date}</p>
      <p><strong>Location:</strong> [${lat.toFixed(2)}, ${lng.toFixed(2)}]</p>
      <p><strong>Description:</strong> ${disaster.description}</p>
    `;
    const modal = new bootstrap.Modal(document.getElementById('disasterModal'));
    modal.show();
  });
}

// USA elliptical boundary configuration (for fallback)
const center = [39.5, -98.35]; // USA center
const radiusLat = 15;
const radiusLng = 25;

// Check if point is inside ellipse (for fallback)
function isInsideEllipse(lat, lng) {
  const dx = (lng - center[1]) / radiusLng;
  const dy = (lat - center[0]) / radiusLat;
  return dx * dx + dy * dy <= 1;
}

// Fallback: Generate grid programmatically
function generateFallbackGrid() {
  console.log('Generating fallback grid...');
  
  const rows = 10;
  const cols = 10;
  const size = 3;
  const startLat = 50;  // USA north boundary
  const startLng = -125; // USA west boundary
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lat1 = startLat - row * size;
      const lng1 = startLng + col * size;
      const lat2 = lat1 - size;
      const lng2 = lng1 + size;
      const centerLat = (lat1 + lat2) / 2;
      const centerLng = (lng1 + lng2) / 2;
      
      // Skip cells outside ellipse
      if (!isInsideEllipse(centerLat, centerLng)) continue;
      
      // Store grid data
      const gridId = `grid_${row}_${col}`;
      gridData[gridId] = {
        center: [centerLat, centerLng],
        properties: { id: gridId, row: row, col: col }
      };
      
      // Draw grid cell
      const bounds = [[lat1, lng1], [lat2, lng2]];
      L.rectangle(bounds, {
        color: '#aaa',
        weight: 0.5,
        fillOpacity: 0.05
      }).addTo(map);
    }
  }
}

// Fallback: Generate random disasters (for grid-based system)
function generateRandomDisasters() {
  console.log('Generating random disasters...');
  
  const disasterTypes = ['Wildfire', 'Flood', 'Hurricane', 'Tornado', 'Earthquake'];
  const disasterIcons = ['bi-fire', 'bi-droplet-fill', 'bi-hurricane', 'bi-tornado', 'bi-activity'];
  const availableGrids = Object.keys(gridData);
  
  // Generate 15 random disasters
  for (let i = 0; i < 15; i++) {
    const randomGridId = availableGrids[Math.floor(Math.random() * availableGrids.length)];
    const typeIndex = Math.floor(Math.random() * disasterTypes.length);
    
    const disaster = {
      id: i + 1,
      grid_id: randomGridId,
      type: disasterTypes[typeIndex],
      icon: disasterIcons[typeIndex],
      date: `20${20 + Math.floor(Math.random() * 4)}-0${1 + Math.floor(Math.random() * 9)}-${10 + Math.floor(Math.random() * 19)}`,
      description: `Sample ${disasterTypes[typeIndex].toLowerCase()} event in ${randomGridId} area.`
    };
    
    addDisasterMarker(disaster);
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing disaster map...');
  
  // Load grid data first, then border, then disasters
  await loadGridData();
  await loadBorderData();
  await loadDisasterData();
  
  console.log('Map initialization complete');
});