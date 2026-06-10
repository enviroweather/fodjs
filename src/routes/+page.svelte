<script lang="ts">	

	import { 
		//geodeticDistance, // no longer needed 
		closestGridPoint, 
		setbackToGeoJSON,
		calcSetbackCoordinates,
		type simpleLatLon, 
		type setbackCoordinates

	} from '$lib/geo.js';

	import {
		WindData,
		type Dataset,
		type WindDataRecord
	} from '$lib/windData';
	
	import { legacyFodModel, type ModelOutput } from '$lib/fodModel';

	const DATASET_LABELS: Record<Dataset, string> = {
		pc: 'PC - PC',
		ws: 'WS - Wind Speed',
		wd: 'WD - Wind Direction'
	};

	
	// ── location state ───────────────────────────────────────────────────────
	let Lat = $state(44)
	let Lon = $state(-83)

	// ── wind data state ───────────────────────────────────────────────────────
	// let gridX = $state<number | null>(null);
	// let gridY = $state<number | null>(null);
	let windData = $state<WindDataRecord | null>(null);
	let flattenedByDataset = $derived(windData ? WindData.flattenAll(windData) : null);
	let loading = $state(false);
	let errorMsg = $state('');

	// ── FOD model state ───────────────────────────────────────────────────────
	let odorIndex = $state('');

	let modelResult = $state<ModelOutput | null>(null);
	let modelReady = $state(false)
	let modelRunning = $state(false);
	let modelError = $state('');

	// -- Map 

	// todo use $derived here? 
	let gridXY = $derived(closestGridPoint(Lat, Lon))
	let gridX = $derived(gridXY[0])
	let gridY = $derived(gridXY[1])

	// function latlon2gridxy() {
 	// 	var result = closestGridPoint(Lat, Lon)
    // 	gridX = result[0]
    // 	gridY = result[1]
	// }

	async function runModel() {
		modelError = '';
		modelResult = null;

		const E = parseFloat(odorIndex);
		if (isNaN(E) || E <= 0) {
			modelError = 'Odor index (E) must be a positive number.';
			return;
		}
		if (!flattenedByDataset) {
			modelError = 'Load wind data first.';
			return;
		}
		modelRunning = true;
		try {
			modelResult = legacyFodModel(
				flattenedByDataset!.wd,
				flattenedByDataset!.ws,
				flattenedByDataset!.pc,
				E
			);
		} catch (err) {
			modelError = err instanceof Error ? err.message : 'Model error';
		} finally {
			modelRunning = false;
		}		
	}

	// previous version of this function initiated a spinner but 
	// that is not needed and makes it hard to create anything 
	// that depends on await'ing this results. 
	// TODO delete this when confident we wont' need it
	// async function runModel() {
	// 	modelError = '';
	// 	modelResult = null;

	// 	const E = parseFloat(odorIndex);
	// 	if (isNaN(E) || E <= 0) {
	// 		modelError = 'Odor index (E) must be a positive number.';
	// 		return;
	// 	}
	// 	if (!flattenedByDataset) {
	// 		modelError = 'Load wind data first.';
	// 		return;
	// 	}

	// 	modelRunning = true;
	// 	// Yield to the browser so the spinner can paint, then compute.
	// 	setTimeout(() => {
	// 		try {
	// 			modelResult = legacyFodModel(
	// 				flattenedByDataset!.wd,
	// 				flattenedByDataset!.ws,
	// 				flattenedByDataset!.pc,
	// 				E
	// 			);

	// 		} catch (err) {
	// 			modelError = err instanceof Error ? err.message : 'Model error';
	// 		} finally {
	// 			modelRunning = false;
	// 		}
	// 	}, 0);
		
	// }

	// async is required
	async function fetchWindData() {
		errorMsg = '';
		windData = null;

		// const x = parseInt(gridX, 10);
		// const y = parseInt(gridY, 10);
		const x = gridX;
		const y = gridY;

		if (isNaN(x) || x < 0 || x > 276) {
			errorMsg = 'Grid X must be an integer between 0 and 276.';
			return;
		}
		if (isNaN(y) || y < 0 || y > 348) {
			errorMsg = 'Grid Y must be an integer between 0 and 348.';
			return;
		}

		loading = true;
		try {
			const res = await fetch(`/api/wind?x=${x}&y=${y}`);
			const body = await res.json();
			if (!res.ok) {
				errorMsg = body.error ?? `Server error ${res.status}`;
				return;
			}
			windData = body as WindDataRecord;
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Unknown error fetching data.';
		} finally {
			loading = false;
		}
	}


	let sbGJ = $state('');

	async function getAndRun() {
		if(gridX && gridY) {
			// latlon2gridxy();
			await fetchWindData();
			// the model could be derived from winddata
			await runModel(); // NoSpinner
			
			if (modelResult) {
				const sbm = calcSetbackCoordinates(Lat, Lon, modelResult.D);
				sbGJ = setbackToGeoJSON(sbm);
				
			} else {				
				sbGJ = ("['error running model']")
			}
		}
	}

</script>


<h1>MI OFFSet Wind Data and Modelling</h1>

<h3>Enter Coordinates and Odor Index</h3>
<form onsubmit={(e) => { e.preventDefault(); getAndRun(); }} class="form">
		<label>
			Latitude (Y)
			<input type="number" bind:value={Lat} required />
		</label>
		<label>
			Longitude (X)
			<input type="number" bind:value={Lon} required />
		</label>
		<label>
			Odor index E <span class="range">(positive number)</span>
			<input type="number" min="0" bind:value={odorIndex} required />
		</label>
	
	<button type="submit" disabled={modelRunning}>
		{modelRunning || loading ? 'Running…' : 'Fetch Data and Run'}
	</button>
</form>

<!-- this form is for reading S3 data given an X,Y, which are now 
     derived from Lat/Lon so disabled but saved for debugging if needed
-->
<!-- 
<form onsubmit={(e) => { e.preventDefault(); fetchWindData(); }}>
	<label>
		Grid X <span class="range">(0 – 276)</span>
		<input type="number" min="0" max="276" step="1" bind:value={gridX} required />
	</label>
	<label>
		Grid Y <span class="range">(0 – 348)</span>
		<input type="number" min="0" max="348" step="1" bind:value={gridY} required />
	</label>
	<button type="submit" disabled={loading}>
		{loading ? 'Loading…' : 'Fetch Wind Data'}
	</button>
</form> -->

{#if errorMsg}
	<p class="error">{errorMsg}</p>
{/if}


{#if windData}
	<section class="results">
		<h2>Wind Data for grid ({gridX}, {gridY})</h2>

		{#each WindData.datasetEntries(windData) as [dataset, yearData]}
			<details class="dataset-accordion">
				<summary>{DATASET_LABELS[dataset] ?? dataset}</summary>
				<div class="dataset-body">
					<details class="flattened-accordion">
						<summary>
							Flattened values ({flattenedByDataset?.[dataset].length ?? 0})
						</summary>
						<pre class="year-data flattened-data">{JSON.stringify(flattenedByDataset?.[dataset] ?? [], null, 2)}</pre>
					</details>

					{#each WindData.yearEntries(yearData) as [year, data]}
						<details class="year-accordion">
							<summary>{year}</summary>
							<pre class="year-data">{JSON.stringify(data, null, 2)}</pre>
						</details>
					{/each}
				</div>
			</details>
		{/each}
	</section>
{/if}

{#if windData}
	<hr class="section-divider" />

	<section class="model-section">
		<h2>FOD Setback Distance Model</h2>
		<p class="model-desc">
			Inputs are the flattened WD, WS, and PC datasets loaded above.
			Odor index calculated from Site-specific information.  
		</p>

		<form onsubmit={(e) => { e.preventDefault(); runModel(); }} class="model-form">
			<label>
				Odor index E <span class="range">(positive number)</span>
				<input type="number" min="0" step="any" bind:value={odorIndex} required />
			</label>
			<button type="submit" disabled={modelRunning}>
				{modelRunning ? 'Running…' : 'Re-run Model'}
			</button>
		</form>

		{#if modelError}
			<p class="error">{modelError}</p>
		{/if}

		{@debug modelResult}
		{#if modelResult}

			<div class="model-results">
				<h2>setback GeoJSON</h2>
				<pre>
{sbGJ}
				</pre>

			</div>

			<div class="model-results">
				<h3>Setback distances for E = {odorIndex}</h3>
				<p class="units-note">Distances are miles (D = a·E<sup>b</sup> empirical formula).</p>

				<table>
					<thead>
						<tr>
							<th>Direction</th>
							<th title="Setback distance for ≤5% occurrence">D (5%)</th>
							<th title="Setback distance for ≤3% occurrence">D (3%)</th>
							<th title="Setback distance for ≤1.5% occurrence">D (1.5%)</th>
						</tr>
					</thead>
					<tbody>
						{#each modelResult.setbackTable as row}
							<tr>
								<td class="dir-label">{row.label}</td>
								<td class="num">{row.d5pct.toFixed(2)}</td>
								<td class="num">{row.d3pct.toFixed(2)}</td>
								<td class="num">{row.d1_5pct.toFixed(2)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>




		{/if}
	</section>
{/if}


<style>

</style>
