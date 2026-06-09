// @ts-ignore
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import LatLon, { Dms } from 'geodesy/latlon-ellipsoidal-vincenty.js';
import { LAT, LON } from '$lib/data/narr_latlon.json';


// TODO create proper types for inputs/outputs 
type GridList = {
	coord: number[][];
};

type gridPoint = {
    y: number
    x: number
}


// 1 mile equals 1609.344 meters.
// https://www.movable-type.co.uk/scripts/geodesy/docs/module-latlon-ellipsoidal-vincenty-LatLonEllipsoidal_Vincenty.html#destinationPoint
// destinationPoint(distance, initialBearing) → {LatLon}
function geodeticDistance(start_lat, start_lon, distanceMiles, bearing) {
    const startingPoint = new LatLon(start_lat, start_lon);
    const distanceMeters = distanceMiles * 1609.344 ;
    let destLatLon = startingPoint.destinationPoint(distanceMeters, bearing);
    return {"lat": destLatLon.lat,"lon": destLatLon.lon};
}


// https://github.com/caseycesari/geojson.js/

function geo2JSON(geography){

    return ""

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
    var min_y = -1;  // if -1 is returned, the loop did not work
    var min_x = -1;
    // if (!inBounds(lat, lon, LAT, LON)){
    // // todo replace with exception raise
    //     return [min_x, min_y]
    // } 
    
    // alternative to calculation a distance matrix and then find the min the same thing
    //  loop through y,x and find the min while calculating

    var minDistance = 9999;
    var grid_width = LON.length;
    var grid_height = LON[0].length;

    for (var x = 0; x < grid_width; x++) {
        for (var y = 0; y < grid_height; y++) {
            var distanceFromPoint = (LAT[x][y] - lat)**2 + (LON[x][y] - lon)**2
            if (distanceFromPoint < minDistance){
                minDistance = distanceFromPoint;
                min_x  = x; min_y = y;
            }
        }
    }

    // TODO: check for -1 and raise exception if it is
    return [min_x, min_y]; 
}

export {geodeticDistance, closestGridPoint}
