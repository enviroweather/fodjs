<script lang="ts">
	import {
		WindData,
		type Dataset,
		type WindDataRecord
	} from '$lib/windData';
	import { legacyFodModel, type ModelOutput } from '$lib/fodModel';

	const DATASET_LABELS: Record<Dataset, string> = {
		pc: 'PC – PC',
		ws: 'WS – Wind Speed',
		wd: 'WD – Wind Direction'
	};

	// ── wind data state ───────────────────────────────────────────────────────
	let gridX = $state('');
	let gridY = $state('');
	let windData = $state<WindDataRecord | null>(null);
	let flattenedByDataset = $derived(windData ? WindData.flattenAll(windData) : null);
	let loading = $state(false);
	let errorMsg = $state('');

	// ── FOD model state ───────────────────────────────────────────────────────
	let odorIndex = $state('');
	let modelResult = $state<ModelOutput | null>(null);
	let modelRunning = $state(false);
	let modelError = $state('');

	function runModel() {
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
		// Yield to the browser so the spinner can paint, then compute.
		setTimeout(() => {
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
		}, 0);
	}

	async function fetchWindData() {
		errorMsg = '';
		windData = null;

		const x = parseInt(gridX, 10);
		const y = parseInt(gridY, 10);

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
</script>

<main>
	<h1>Wind Data Viewer</h1>

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
	</form>

	{#if errorMsg}
		<p class="error">{errorMsg}</p>
	{/if}

	{#if windData}
		<section class="results">
			<h2>Results for grid ({gridX}, {gridY})</h2>

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
					{modelRunning ? 'Running…' : 'Run Model'}
				</button>
			</form>

			{#if modelError}
				<p class="error">{modelError}</p>
			{/if}

			{#if modelResult}
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
							{#each modelResult.byDirection as dir}
								<tr>
									<td class="dir-label">{dir.label}</td>
									<td class="num">{dir.d5pct.toFixed(2)}</td>
									<td class="num">{dir.d3pct.toFixed(2)}</td>
									<td class="num">{dir.d1_5pct.toFixed(2)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}
</main>

<style>
	main {
		max-width: 960px;
		margin: 2rem auto;
		padding: 0 1.25rem;
		font-family: system-ui, sans-serif;
	}

	h1 {
		margin-bottom: 1.5rem;
	}

	form {
		display: flex;
		gap: 1.25rem;
		align-items: flex-end;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.range {
		font-weight: 400;
		color: #6b7280;
	}

	input[type='number'] {
		padding: 0.45rem 0.65rem;
		font-size: 1rem;
		width: 9rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
	}

	button {
		padding: 0.5rem 1.4rem;
		font-size: 1rem;
		cursor: pointer;
		border: none;
		background: #2563eb;
		color: #fff;
		border-radius: 6px;
		height: fit-content;
	}

	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.error {
		color: #dc2626;
		margin-bottom: 1rem;
		font-size: 0.95rem;
	}

	/* Outer dataset accordion */
	.dataset-accordion {
		border: 1px solid #d1d5db;
		border-radius: 8px;
		margin-bottom: 0.85rem;
		overflow: hidden;
	}

	.dataset-accordion > summary {
		padding: 0.65rem 1rem;
		cursor: pointer;
		font-weight: 600;
		font-size: 1rem;
		background: #f3f4f6;
		list-style: none;
		user-select: none;
	}

	.dataset-accordion > summary::before {
		content: '▶ ';
		font-size: 0.7em;
		opacity: 0.6;
	}

	.dataset-accordion[open] > summary::before {
		content: '▼ ';
	}

	.dataset-body {
		padding: 0.75rem;
	}

	.flattened-accordion {
		border: 1px solid #bfdbfe;
		border-radius: 6px;
		margin-bottom: 0.75rem;
		overflow: hidden;
	}

	.flattened-accordion > summary {
		padding: 0.45rem 0.8rem;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.9rem;
		background: #eff6ff;
		list-style: none;
		user-select: none;
	}

	.flattened-accordion > summary::before {
		content: '▶ ';
		font-size: 0.65em;
		opacity: 0.55;
	}

	.flattened-accordion[open] > summary::before {
		content: '▼ ';
	}

	/* Inner year accordion */
	.year-accordion {
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		margin-bottom: 0.5rem;
		overflow: hidden;
	}

	.year-accordion > summary {
		padding: 0.4rem 0.8rem;
		cursor: pointer;
		font-weight: 500;
		font-size: 0.9rem;
		background: #f9fafb;
		list-style: none;
		user-select: none;
	}

	.year-accordion > summary::before {
		content: '▶ ';
		font-size: 0.65em;
		opacity: 0.55;
	}

	.year-accordion[open] > summary::before {
		content: '▼ ';
	}

	.year-data {
		margin: 0;
		padding: 0.75rem 1rem;
		font-size: 0.72rem;
		line-height: 1.5;
		overflow-x: auto;
		overflow-y: auto;
		max-height: 320px;
		background: #1e1e2e;
		color: #cdd6f4;
		border-top: 1px solid #e5e7eb;
	}

	.flattened-data {
		max-height: 220px;
	}

	/* ── FOD model section ─────────────────────────────────────────────────── */
	.section-divider {
		border: none;
		border-top: 2px solid #e5e7eb;
		margin: 2.5rem 0;
	}

	.model-section h2 {
		margin-bottom: 0.4rem;
	}

	.model-desc {
		color: #6b7280;
		font-size: 0.88rem;
		margin-bottom: 1.25rem;
		max-width: 680px;
	}

	.model-form {
		display: flex;
		gap: 1.25rem;
		align-items: flex-end;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
	}

	.model-results {
		margin-top: 1rem;
	}

	.model-results h3 {
		margin-bottom: 0.25rem;
	}

	.units-note {
		color: #6b7280;
		font-size: 0.83rem;
		margin-bottom: 0.85rem;
	}

	table {
		border-collapse: collapse;
		width: 100%;
		max-width: 540px;
		font-size: 0.9rem;
	}

	th,
	td {
		border: 1px solid #e5e7eb;
		padding: 0.45rem 0.8rem;
		text-align: left;
	}

	th {
		background: #f3f4f6;
		font-weight: 600;
	}

	tr:nth-child(even) td {
		background: #f9fafb;
	}

	.dir-label {
		font-weight: 600;
		width: 5rem;
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
