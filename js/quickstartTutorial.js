//makes a map object and ties it to the 'map' element in the html.  
// Also sets the view area for the map.
var map = L.map('map').setView([51.505, -0.09], 13);

//loads a chosen tile layer for the map, sets the zoom level, and credits the map creators.
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

//adds a marker item to the map.
var marker = L.marker([51.5, -0.09]).addTo(map);

//adds a circle to the map and defines its color and size.
var circle = L.circle([51.508, -0.11], {
    color: 'red',
    fillColor: '#f03',
    fillOpacity: 0.5,
    radius: 500
}).addTo(map);

//adds a polygon to the map and defines its shape.
var polygon = L.polygon([
    [51.509, -0.08],
    [51.503, -0.06],
    [51.51, -0.047]
]).addTo(map);

//adds popups to the marker, circle, and polygon.
marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();
circle.bindPopup("I am a circle.");
polygon.bindPopup("I am a polygon.");

//adds a popup to the map.
var popup = L.popup()
    .setLatLng([51.513, -0.09])
    .setContent("I am a standalone popup.")
    .openOn(map);

var popup = L.popup();

//adds a popup that appears when the map is clicked. 
//the popup displays a message and the lat and long of the location.
function onMapClick(e) {
    popup
        .setLatLng(e.latlng)
        .setContent("You clicked the map at " + e.latlng.toString())
        .openOn(map);
}
map.on('click', onMapClick);