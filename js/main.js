//declare map var in global scope
var map;

//function to instantiate the Leaflet map
function createMap(){
    //create the map
    map = L.map('map', {
        center: [38.8954381, -77.0312812],
        zoom: 11
    });

    //add OSM base tilelayer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
    }).addTo(map);

    //call getData function
    getData();
};

/*
L.tileLayer('https://{s}.tile.thunderforest.com/spinal-map/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
*/

//function to attach popups to each mapped feature
function onEachFeature(feature, layer) {
    var popupContent = "";
    if (feature.properties) {
        for (var property in feature.properties){
            popupContent += "<p>" + property + ": " + feature.properties[property] + "</p>";
        }
        layer.bindPopup(popupContent);
    }
};

//function to retrieve the data and place it on the map
function getData(){
    fetch("data/Grocery_Store_Locations.geojson")
        .then(function(response){
            return response.json();
        })
        .then(function(json){            
            //marker style
            var geojsonMarkerOptions = {
                radius: 3,
                fillColor: "#ff7800",
                color: "#000",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            };

            //add GeoJSON layer
            L.geoJson(json, {
                pointToLayer: function (feature, latlng){
                    return L.circleMarker(latlng, geojsonMarkerOptions);
                },
                onEachFeature: onEachFeature
            }).addTo(map);
        });
};

document.addEventListener('DOMContentLoaded', createMap);
