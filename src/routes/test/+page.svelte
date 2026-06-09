<script lang='ts'>
import { geodeticDistance,closestGridPoint } from '$lib/geo.js';
// import { LAT, LON } from '$lib/data/narr_latlon.json';


let distanceMiles = $state('');
let bearing=$state(0);
let startingLat = $state(45)
let startingLon = $state(-83)
let endCoordinates = $state({"lat": 0, "lon":0})

let endLat = $state(0);
let endLon = $state(0);

let Lat = $state(45)
let Lon = $state(-83)
let gridX = $state(0)
let gridY = $state(0)



function latlon2gridxy() {
    var result = closestGridPoint(Lat, Lon)
    gridX = result[0]
    gridY = result[1]
}

function distanceTest(){
    const result = geodeticDistance(startingLat, startingLon, distanceMiles, bearing);
    endCoordinates.lat = result.lat;
    endCoordinates.lon = result.lon

}

</script>

<main>
<h2>hey! just testing</h2>

<h3>get grid X,Y</h3>
<form onsubmit={(e) => { e.preventDefault(); latlon2gridxy(); }} class="form">
    <p>
    <label>
        Latitude (Y)
        <input type="number" bind:value={Lat} required />
    </label>
    </p>
    <p>
    <label>
        Longitude (X)
        <input type="number" bind:value={Lon} required />
    </label>
    </p>
    <p>
    <button type="submit">
        find X,Y
    </button></p>
</form>

<p>X:{gridX}, Y:{gridY} </p>

<hr>
<h3>calc geodetic vincenty distance</h3>
<form onsubmit={(e) => { e.preventDefault(); distanceTest(); }} class="form">
    <p>
        <label>
            distance (miles)
            <input type="number" bind:value={distanceMiles} required />
        </label>
    </p>
    <p>
        <label>
            Bearing (degrees from 0 N)
            <input type="number" min="0" max="359" bind:value={bearing} required />
        </label>
    </p>
    <p>
    <label>
        starting Lat (40 to 45) and Lon (-80 to -85)
    
        <input type="number" min="40" max="45" bind:value={startingLat} required />
        <input type="number" min="-85" max="-80" bind:value={startingLon} required />
        
    </label>
    </p>
    <button type="submit">
        calc
    </button>
</form>
<p>results</p>
<p>
    ({endCoordinates.lat}, {endCoordinates.lon})

</p>


<h3>Grid Lookup</h3>
<form onsubmit={(e) => { e.preventDefault(); distanceTest(); }} class="form">

    <p>
    <label> Lat (like 42) and Lon (like -85)
    
        <input type="number"  bind:value={Lat} required />
        <input type="number"  bind:value={Lon} required />
        
    </label>
    </p>
</form>

<h3>test: this should be [2,0]</h3>
<p>[{gridX}, {gridY}]</p>
</main>

<layout>

</layout>