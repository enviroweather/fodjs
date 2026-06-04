import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadFromS3 } from '$lib/server/s3Client';
import { DATASETS, type Dataset, type WindDataRecord } from '$lib/windData';

function pad3(n: number): string {
	return String(n).padStart(3, '0');
}

function dataFile(dataset: Dataset, x: string, y: string) {
	return `json/${dataset}/${dataset}_${x}_${y}.json`;
}

export const GET: RequestHandler = async ({ url }) => {
	const xParam = url.searchParams.get('x');
	const yParam = url.searchParams.get('y');

	if (!xParam || !yParam) {
		return json({ error: 'Missing required query params: x, y' }, { status: 400 });
	}

	const x = parseInt(xParam, 10);
	const y = parseInt(yParam, 10);

	if (isNaN(x) || x < 0 || x > 276) {
		return json({ error: 'x must be an integer between 0 and 276' }, { status: 400 });
	}
	if (isNaN(y) || y < 0 || y > 348) {
		return json({ error: 'y must be an integer between 0 and 348' }, { status: 400 });
	}

	const xStr = pad3(x);
	const yStr = pad3(y);

	let results: WindDataRecord;

	try {
		const fetched = await Promise.all(DATASETS.map((ds) => loadFromS3(dataFile(ds, xStr, yStr))));
		results = Object.fromEntries(
			DATASETS.map((ds, i) => [ds, fetched[i]])
		) as WindDataRecord;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load data from S3';
		return json({ error: message }, { status: 502 });
	}

	return json(results);
};
