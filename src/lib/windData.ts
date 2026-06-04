export const DATASETS = ['pc', 'ws', 'wd'] as const;

export type Dataset = (typeof DATASETS)[number];

export type WindDatasetRecord = Record<string, unknown>;

export type WindDataRecord = Record<Dataset, WindDatasetRecord>;

function flattenValue(value: unknown): number[] {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return [value];
	}

	if (Array.isArray(value)) {
		return value.flatMap(flattenValue);
	}

	if (value && typeof value === 'object') {
		return Object.values(value).flatMap(flattenValue);
	}

	return [];
}

export class WindData {
	static years(dataset: WindDatasetRecord): string[] {
		return Object.keys(dataset).sort((a, b) => a.localeCompare(b));
	}

	static flattenDataset(dataset: WindDatasetRecord): number[] {
		return this.years(dataset).flatMap((year) => flattenValue(dataset[year]));
	}

	static datasetEntries(data: WindDataRecord): [Dataset, WindDatasetRecord][] {
		return DATASETS.map((dataset) => [dataset, data[dataset]]);
	}

	static yearEntries(dataset: WindDatasetRecord): [string, unknown][] {
		return this.years(dataset).map((year) => [year, dataset[year]]);
	}

	static flattenAll(data: WindDataRecord): Record<Dataset, number[]> {
		return Object.fromEntries(
			DATASETS.map((dataset) => [dataset, this.flattenDataset(data[dataset])])
		) as Record<Dataset, number[]>;
	}
}