/**
 * TypeScript port of legacy_fod_model.py — OFFSET odor setback distance model
 *
 * References:
 *   Jacobson et al. (2005) OFFSET Part I.  Transactions of the ASAE 48(6).
 *   Guo et al.      (2005) OFFSET Part II. Transactions of the ASAE 48(6).
 *
 * NOTE on numpy-ts: the Python model's core operations are boolean fancy
 * indexing (e.g. `arr[bool_mask]`), which numpy-ts does not support. The
 * algorithm is implemented here with plain TypeScript typed arrays, which is
 * functionally equivalent and avoids adding WASM to the browser bundle.
 */

// ─── types ───────────────────────────────────────────────────────────────────

/** One row of summarized output per compass direction. */
export type SetbackTableRows = {
	/** Compass direction label (N, NNE, …, NNW). */
	label: string;
	/** Setback distance for ≤5% occurrence threshold (miles). */
	d5pct: number;
	/** Setback distance for ≤3% occurrence threshold (miles). */
	d3pct: number;
	/** Setback distance for ≤1.5% occurrence threshold (miles)). */
	d1_5pct: number;
};

/** Full model output. */
export type ModelOutput = {
	/** Raw D matrix, shape [80][3]. Each block of 5 rows is identical. */
	D: number[][];
	/** one per compass direction, all 80 directions, clockwise from N. */
	setbackTable: SetbackTableRows[];
};

// ─── compass direction metadata ──────────────────────────────────────────────

export const DIRECTION_LABELS: string[] = [
	'N',
	'NNE',
	'NE',
	'ENE',
	'E',
	'ESE',
	'SE',
	'SSE',
	'S',
	'SSW',
	'SW',
	'WSW',
	'W',
	'WNW',
	'NW',
	'NNW'
];


/**
 * Representative row in D[80][3] for each compass direction.
 * (All 5 rows in a block are identical; we just read the first one.)
 */
const DIRECTION_ROW: Record<string, number> = {
	N: 0,
	NNE: 5,
	NE: 10,
	ENE: 15,
	E: 20,
	ESE: 25,
	SE: 30,
	SSE: 35,
	S: 40,
	SSW: 45,
	SW: 50,
	WSW: 55,
	W: 60,
	WNW: 65,
	NW: 70,
	NNW: 75
};

const SETBACK_TABLE_ROW_LABELS: string[] = [
		'N','-','-','-','-', 
		'NNE','-','-','-','-',
		'NE','-','-','-','-', 
		'ENE','-','-','-','-',
		'E','-','-','-','-',
		'ESE','-','-','-','-', 
		'SE','-','-','-','-',
		'SSE','-','-','-','-',
		'S','-','-','-','-', 
		'SSW','-','-','-','-',
		'SW','-','-','-','-',
		'WSW','-','-','-','-', 
		'W','-','-','-','-',
		'WNW','-','-','-','-',
		'NW','-','-','-','-', 
		'NNW','-','-','-','-'
	];

// ─── setback-distance coefficients (D = a·E^b, output in feet) ───────────────
// original comment inside the python program is incorrect
//  # Total odor emission factor (E):
//  # Product of source area, odor emission number, and odor control factor, 
//  # divided by 10000, summed over all sources.
// I don't think this is in feet 
// AND I don't think the odor index is ÷ 10000 here, maybe in front ent


const COEF: Array<{ a: number; b: number }> = [
	{ a: 0, b: 0 }, // index 0 unused (1-based class numbering)
	{ a: 0.1181, b: 0.5132 }, // class 1
	{ a: 0.0634, b: 0.5366 }, // class 2
	{ a: 0.0399, b: 0.5397 }, // class 3
	{ a: 0.0242, b: 0.5844 }, // class 4
	{ a: 0.0175, b: 0.5827 }, // class 5
	{ a: 0.0101, b: 0.6264 } // class 6
];

// ─── internal helpers ─────────────────────────────────────────────────────────

/**
 * Seeded Fisher-Yates shuffle using Mulberry32 PRNG.
 * Returns a permutation of 0..n-1.  Seed 8675309 matches the Python source.
 * (Not identical to numpy MT19937 outputs, but reproducible and sufficient for
 * the spike-removal step which only needs a consistent random ordering.)
 */
function seededPermutation(n: number, seed: number): number[] {
	let s = seed >>> 0;
	const rand = (): number => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const arr = Array.from({ length: n }, (_, i) => i);
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		const tmp = arr[i];
		arr[i] = arr[j];
		arr[j] = tmp;
	}
	return arr;
}

/** Median of arr[start..end). Returns 0 for empty slices. */
function medianOfSlice(arr: number[], start: number, end: number): number {
	const s = arr.slice(start, end).sort((a, b) => a - b);
	if (s.length === 0) return 0;
	const mid = Math.floor(s.length / 2);
	return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Banker's rounding (round-half-to-even), matching numpy's default behaviour.
 * Used for computing cap values in the spike-removal step.
 */
function bankersRound(v: number): number {
	const fl = Math.floor(v);
	if (Math.abs(v - fl - 0.5) < 1e-10) {
		return fl % 2 === 0 ? fl : fl + 1;
	}
	return Math.round(v);
}

/** Round value to 2 decimal places (matches np_round(…, 2)). */
function roundTo2(v: number): number {
	return Math.round(v * 100) / 100;
}

/**
 * Find the 1-based wind-stability class index for a given occurrence threshold.
 * Equivalent to: np_min(where(tem == np_max(tem[tem <= threshold]))) + 1
 */
function findWindClass(wcRow: number[], threshold: number): number {
	const tem = wcRow.map(roundTo2);
	let maxVal = -Infinity;
	for (const v of tem) {
		if (v <= threshold && v > maxVal) maxVal = v;
	}
	if (maxVal === -Infinity) return 1; // all values exceed threshold — use class 1
	const idx = tem.findIndex((v) => Math.abs(v - maxVal) < 1e-9);
	return idx < 0 ? 1 : idx + 1;
}

// ─── row-range map (d index → [start, end) pairs in f/D) ─────────────────────
// Each sector d fills a contiguous block of 5 rows, except N (d=8) which
// wraps around the end of the array: rows 77-79 + 0-1.

const ROW_RANGES: Array<Array<[number, number]>> = [
	[[37, 42]], // d=0  N wind  → S  setback
	[[42, 47]], // d=1  NNE    → SSW
	[[47, 52]], // d=2  NE     → SW
	[[52, 57]], // d=3  ENE    → WSW
	[[57, 62]], // d=4  E      → W
	[[62, 67]], // d=5  ESE    → WNW
	[[67, 72]], // d=6  SE     → NW
	[[72, 77]], // d=7  SSE    → NNW
	[
		[77, 80],
		[0, 2]
	], // d=8  S wind  → N  setback (split)
	[[2, 7]], // d=9  SSW    → NNE
	[[7, 12]], // d=10 SW     → NE
	[[12, 17]], // d=11 WSW    → ENE
	[[17, 22]], // d=12 W      → E
	[[22, 27]], // d=13 WNW    → ESE
	[[27, 32]], // d=14 NW     → SE
	[[32, 37]] // d=15 NNW    → SSE
];

// ─── main model function ──────────────────────────────────────────────────────

/**
 * OFFSET setback-distance model.
 *
 * @param WD          Flat array of wind directions (degrees, 0-360).
 * @param WS          Flat array of wind speeds (m/s), same length as WD.
 * @param PC          Flat array of Pasquill stability classes (4, 5, or 6).
 * @param odor_index  Total odor emission factor E (product of source area,
 *                    odor emission number, and odor control factor ÷ 10000).
 * @returns           D matrix [80][3] and 16-direction summary.
 */
export function legacyFodModel(
	WD: number[],
	WS: number[],
	PC: number[],
	odor_index: number
): ModelOutput {
	const n = WD.length;

	// ── Step 1: Remove spikes at cardinal wind directions (90, 180, 270, 360) ──
	// Equivalent to Python: random.RandomState(seed=8675309).permutation(WD.size)
	const indx = seededPermutation(n, 8675309);
	const wd4 = [90, 180, 270, 360];

	// Histogram of WD: h[i] = count of values in [i, i+1)
	const h = new Array(360).fill(0);
	for (const v of WD) {
		let bin = Math.floor(v);
		if (bin === 360) bin = 359; // numpy closes the last bin on the right
		if (bin >= 0 && bin < 360) h[bin]++;
	}

	// i4[row][m]: 1 = this observation is a "spike" that may be removed
	const i4: number[][] = Array.from({ length: n }, () => [0, 0, 0, 0]);

	for (let m = 0; m < 4; m++) {
		const wd = wd4[m];
		// a1 = median of histogram counts just below the cardinal direction
		// a2 = median just above (or h[1:5] for the wrap-around case wd=360)
		const a1 = medianOfSlice(h, wd - 7, wd - 3); // h[wd-7 : wd-3]
		const a2 =
			m < 3
				? medianOfSlice(h, wd + 1, wd + 5) // h[wd+1 : wd+5]
				: medianOfSlice(h, 1, 5); //  h[1:5] for wd=360
		const cap = bankersRound((a1 + a2) / 2);

		// Mark all observations at this exact cardinal degree
		for (let row = 0; row < n; row++) {
			i4[row][m] = WD[row] === wd ? 1 : 0;
		}

		// Walk through permuted order; unmark the first `cap` occurrences
		let c = 1;
		for (let t = 0; t < n; t++) {
			const tr = indx[t];
			if (i4[tr][m] === 1 && c <= cap) {
				i4[tr][m] = 0;
				c++;
			}
		}
	}

	// WDds: copy of WD with spike observations set to -999
	const WDds = WD.slice();
	for (let row = 0; row < n; row++) {
		if (i4[row][0] + i4[row][1] + i4[row][2] + i4[row][3] > 0) {
			WDds[row] = -999;
		}
	}

	// ── Step 2: Windstar chart (wc[16][6]) ───────────────────────────────────
	// dbin edges: 11.25, 33.75, 56.25, …, 348.75  (16 sector boundaries)
	const dbin: number[] = [];
	for (let v = 11.25; v < 360; v += 22.5) dbin.push(v);

	const validCount = WDds.reduce((acc, v) => acc + (v >= 0 ? 1 : 0), 0);
	const pct = (count: number): number => (validCount > 0 ? (count / validCount) * 100 : 0);

	// wc[d][col]: cumulative % occurrence of wind-stability classes 1…col+1
	// for direction sector d.
	const wc: number[][] = Array.from({ length: 16 }, () => new Array(6).fill(0));

	for (let d = 0; d < 16; d++) {
		let c0 = 0,
			c1 = 0,
			c2 = 0,
			c3 = 0,
			c4 = 0,
			c5 = 0;

		for (let i = 0; i < n; i++) {
			const v = WDds[i];
			// Sector membership — mirrors the Python boolean-index filter
			const inSector =
				d === 0
					? v >= dbin[15] || (v >= 0 && v < dbin[0]) // N sector wraps 360→0
					: v >= dbin[d - 1] && v < dbin[d];
			if (!inSector) continue;

			const pc = PC[i];
			const ws = WS[i];
			// Mutually-exclusive OFFSET wind-stability classes (1-6):
			if (pc === 6 && ws <= 1.3) c0++;
			else if (pc === 6 && ws > 1.3 && ws <= 3.1) c1++;
			else if (pc === 5 && ws <= 3.1) c2++;
			else if (pc === 5 && ws > 3.1 && ws <= 5.4) c3++;
			else if (pc === 4 && ws <= 5.4) c4++;
			else if (pc === 4 && ws > 5.4 && ws <= 8.0) c5++;
		}

		// Cumulative percentages
		wc[d][0] = pct(c0);
		wc[d][1] = wc[d][0] + pct(c1);
		wc[d][2] = wc[d][1] + pct(c2);
		wc[d][3] = wc[d][2] + pct(c3);
		wc[d][4] = wc[d][3] + pct(c4);
		wc[d][5] = wc[d][4] + pct(c5);
	}

	// ── Step 3: Wind-stability class array f[80][3] ───────────────────────────
	// f[row][0] = class for 5% threshold
	// f[row][1] = class for 3% threshold
	// f[row][2] = class for 1.5% threshold
	const f: number[][] = Array.from({ length: 80 }, () => [0, 0, 0]);

	for (let d = 0; d < 16; d++) {
		const fVals: [number, number, number] = [
			findWindClass(wc[d], 5), // col 0 — 5%
			findWindClass(wc[d], 3), // col 1 — 3%
			findWindClass(wc[d], 1.5) // col 2 — 1.5%
		];
		for (const [start, end] of ROW_RANGES[d]) {
			for (let row = start; row < end; row++) {
				f[row][0] = fVals[0];
				f[row][1] = fVals[1];
				f[row][2] = fVals[2];
			}
		}
	}

	// ── Step 4: Setback distances D[80][3] = a·E^b ───────────────────────────
	const D: number[][] = Array.from({ length: 80 }, () => [0, 0, 0]);
	for (let row = 0; row < 80; row++) {
		for (let p = 0; p < 3; p++) {
			const cls = f[row][p];
			if (cls >= 1 && cls <= 6) {
				const { a, b } = COEF[cls];
				D[row][p] = a * Math.pow(odor_index, b);
			}
		}
	}

	// ── Step 5: direction table for human viewing, all rows
	const setbackTable:SetbackTableRows[] = SETBACK_TABLE_ROW_LABELS.map((label, row) => {
		return {
			label, 
			d5pct: D[row][0],
			d3pct: D[row][1],
			d1_5pct: D[row][2]
		 }

	});

	return { D, setbackTable };
}
