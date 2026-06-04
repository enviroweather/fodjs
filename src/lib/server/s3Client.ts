import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Config } from './s3Config';

const client = new S3Client({
	region: s3Config.region,
	credentials: s3Config.credentials
});

/**
 * Fetch a JSON object from S3 by key.
 * Key format for wind data: json/{dataset}/{dataset}_{gridX}_{gridY}.json
 */
export async function loadFromS3(key: string): Promise<unknown> {
    console.log(`retrieving S3 key: ${key}`);
	const command = new GetObjectCommand({
		Bucket: s3Config.bucketName,
		Key: key
	});

	const response = await client.send(command);

	if (!response.Body) {
		throw new Error(`Empty response body for S3 key: ${key}`);
	}

	const text = await response.Body.transformToString('utf-8');
	return JSON.parse(text);
}
