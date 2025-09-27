//declare map var in global scope
var map;
var minValue;
//Determine the attribute for scaling the proportional symbols
var attribute = "NUMROOMS";

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


/*
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
*/


//calculates minimum NUMROOMS value
function calculateMinValue(data){
    //create empty array to store all NUMROOMS values
    var allValues = [];

    //loop through each hotel feature
    for (var hotel of data.features){
        var value = hotel.properties["NUMROOMS"];
        if (value !== null && value !== undefined){
            allValues.push(Number(value));
        }
    }
    //get minimum value of our array
    return Math.min(...allValues);
}

//calculate the radius of each proportional symbol
function calcPropRadius(attValue) {
    //constant factor adjusts symbol sizes evenly
    var minRadius = 5;
    //Flannery Apperance Compensation formula
    var radius = 1.0083 * Math.pow(attValue/minValue,0.5715) * minRadius

    return radius;
};


//function to convert hotels to circle markers
function pointToLayer(feature, latlng){
    var attValue = Number(feature.properties[attribute]);

    var options = {
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
        radius: calcPropRadius(attValue)
    };

    var layer = L.circleMarker(latlng, options);

    //popup with hotel name + rooms
    var popupContent = "<p><b>Hotel:</b> " + (feature.properties.NAME || "Unknown") + "</p>"
                     + "<p><b>Rooms:</b> " + attValue + "</p>";

    layer.bindPopup(popupContent);

    return layer;
};


//Create new sequence controls (slider UI)
function createSequenceControls(){
    //create range input element (slider)
    var slider = "<input class='range-slider' type='range'></input>";
    document.querySelector("#panel").insertAdjacentHTML('beforeend',slider);

    //set slider attributes
    document.querySelector(".range-slider").max = 168;
    document.querySelector(".range-slider").min = 0;
    document.querySelector(".range-slider").value = 0;
    document.querySelector(".range-slider").step = 1;

    //add step buttons
    document.querySelector('#panel').insertAdjacentHTML('beforeend','<button class="step" id="reverse">Reverse</button>');
    document.querySelector('#panel').insertAdjacentHTML('beforeend','<button class="step" id="forward">Forward</button>');
};


//fetch the data and add proportional symbols
function getData(){
    fetch("data/Hotels.geojson")
        .then(response => response.json())
        .then(json => {   
            minValue = calculateMinValue(json);

            L.geoJson(json, {
                pointToLayer: pointToLayer
            }).addTo(map);

            // add slider after symbols load
            createSequenceControls();
        });
};

document.addEventListener('DOMContentLoaded', createMap);
