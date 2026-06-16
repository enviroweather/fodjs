// @ts-ignore
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import LatLon, { Dms } from 'geodesy/latlon-ellipsoidal-vincenty.js';
import { LAT, LON } from '$lib/data/narr_latlon.json';

// SW of Chicago
const min_lat = 41.696;
const min_lon = -90.418;
// in Ontario, way NE of Sault Ste Marie
const max_lat = 47.48023;  // don't include isle royale - no farms there!  
const max_lon = -82.122;

// corresponding bounds reported as y, x
// these are not currently being used in code below
// but preserved because I took the time to find them
// NE 143, 230, SW 118, 215
const min_x = 215
const min_y = 118
const max_x = 230
const max_y = 143


// TODO create proper types for inputs/outputs 
type GridList = {
	coord: number[][];
};

type gridPoint = {
    y: number
    x: number
}

type simpleLatLon = {lat:number, lon:number}


type setbackCoordinates = {
    center: simpleLatLon,
    coords5pct: simpleLatLon[],
    coords3pct:simpleLatLon[],
    coords1_5pct:simpleLatLon[]
} 

const metersPerMile:number = 1609.344;

// 1 mile equals 1609.344 meters.
// https://www.movable-type.co.uk/scripts/geodesy/docs/module-latlon-ellipsoidal-vincenty-LatLonEllipsoidal_Vincenty.html#destinationPoint
// destinationPoint(distance, initialBearing) → {LatLon}
function geodeticDistance(
                    start_lat:number, 
                    start_lon:number, 
                    distanceMiles:number, 
                    bearing:number):[number, number] {

    const startingPoint = new LatLon(start_lat, start_lon);
    const distanceMeters = distanceMiles * metersPerMile;

    let destLatLon = startingPoint.destinationPoint(distanceMeters, bearing);
    // return {"lat": destLatLon.lat,"lon": destLatLon.lon};
    // geojson just wants a tuple/array of [lon, lat]
    return [destLatLon.lon, destLatLon.lat];
}

//TODO determine clock direction of these rings
// geoJSON spec suggests rings go counterclockwise
// this function goes clockwise but that may not be how the 
// the data is created in the FOD model
// this is the equivalent of the "LL" variable in legacy
// this is for GEOJSON and so it's always LON,LAT 
function  calcSetbackCoordinates(  
            startLat:number, 
            startLon:number, 
            D:number[][]):setbackCoordinates {

    const degIncrements = 360/D.length
    const center = [startLon, startLat]
    // for these rings to be polygons in GIS, the last value must be the same as the first
    // D has arrays of 3 distance, so add that array of 3 to the end
                
    let ll = {
        center: center,
        coords5pct: D.map((d,row) => {return(geodeticDistance(startLat, startLon, D[row][0], row*degIncrements))}), // 360-row*degIncrements ???
        coords3pct: D.map((d,row) => {return(geodeticDistance(startLat, startLon, D[row][1], row*degIncrements))}), 
        coords1_5pct:D.map((d,row) => {return(geodeticDistance(startLat, startLon, D[row][2], row*degIncrements))})
    }
    // complete the rings for geo applications
    ll.coords5pct.push(ll.coords5pct[0]);
    ll.coords3pct.push(ll.coords3pct[0]);
    ll.coords1_5pct.push(ll.coords1_5pct[0]);

    return(ll);
	
}

function setbackToGeoJSON(c: setbackCoordinates):string {
    // GeoJSON spec requires polygons to be rings with first and last elemen the same 
    // https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.6
    // and this is how the setbackCoordinates are created

    // function jsonCoordinates(coords){
    //     return(
    //         coords.map((coord) => { return( [coord, coord.long] )})
    //     );
    // }

    const features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [c.center[0], c.center[1]]},
            "properties": {"name": "Odor source", "odor_emission_factor": 0}, /// TODO ADD THIS VALUE HERE
        },
        {
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [ c.coords1_5pct ]},
            "properties": {"name": "1.5% footprint", "level": "1.5%"},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [ c.coords3pct ]},
            "properties": {"name": "3% footprint", "level": "3%"},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [ c.coords5pct ]},
            "properties": {"name": "5% footprint", "level": "5%"},
        },
    ]
    return(JSON.stringify({"type": "FeatureCollection", "features": features}, undefined, 2))
}

function findMinMax(arr: number[][]): { min: number; max: number } {
    // Flatten the array
    const flatArray = arr.reduce((acc, val) => acc.concat(val), []);
    
    // Find minimum and maximum
    const min = Math.min(...flatArray);
    const max = Math.max(...flatArray);
    
    return { min, max };
}

function indexOfMin(arr: number[][]): [number, number ] {
    var min_i = 0;
    var min_j = 0;
    for (var i:number = 0; i < arr.length; i++) {
        for (var j:number = 0; j < arr[i].length; j++) {
            if (arr[i][j] < arr[min_i][min_j]) {
                min_i = i; min_j = j};
        }
    }
    return [min_i, min_j];
}

// TODO ensure this runs only once 
const latBounds = findMinMax(LAT)
const lonBounds = findMinMax(LON)

function inBounds(lat, lon){
    // this is really inefficient to calc this every time
    return(( lat <  latBounds.min || lat > latBounds.max  ) || ( lon < lonBounds.min || lon > lonBounds.max )) 

}

function closestGridPoint(lat, lon){
    var found_y = -1;  // if -1 is returned, the loop did not work
    var found_x = -1;
    // current this assumes lat/lon is in bounds, but TODO defensive programming:
    // if (!inBounds(lat, lon, LAT, LON)){
    // // todo replace with exception raise
    //     return [min_x, min_y]
    // } 
    
    // the original code first calculated a distance matrix and then find the min distance
    // unsing numpy vectorized search
    
    // this loop through y,x and calculates the distannce and stores the min
    // it loops through the whole thing.  We could track the number 
    // of loops since the distance changed and check if it hasn't changed in a while
    // and stop the loop, but that introduces a conditional for every iteration
    var minDistance = 999999;  //starting value is high
    var grid_width = LON.length;
    var grid_height = LON[0].length;

    // using min_x, min_y etc to reduce the search space here doesn't make this any faster!
    for (var x = 0; x < grid_width; x++) {
        for (var y = 0; y < grid_height; y++) {
            var distanceFromPoint = (LAT[x][y] - lat)**2 + (LON[x][y] - lon)**2
            if (distanceFromPoint < minDistance){
                minDistance = distanceFromPoint;
                found_x  = x; found_y = y;
            }
        }
    }

    // TODO: check for -1 and raise exception if it is
    return [found_x, found_y]; 
}

export {geodeticDistance, closestGridPoint, setbackToGeoJSON, calcSetbackCoordinates, setbackCoordinates, simpleLatLon,min_lat, min_lon, max_lat, max_lon}
