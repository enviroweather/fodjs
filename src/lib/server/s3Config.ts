import {
	FOD_AWS_REGION,
	FOD_AWS_ACCESS_KEY_ID,
	FOD_AWS_SECRET_ACCESS_KEY,
	S3_BUCKET_NAME
} from '$env/static/private';

export const s3Config = {
	region: FOD_AWS_REGION,
	credentials: {
		accessKeyId: FOD_AWS_ACCESS_KEY_ID,
		secretAccessKey: FOD_AWS_SECRET_ACCESS_KEY
	},
	bucketName: S3_BUCKET_NAME
} as const;
