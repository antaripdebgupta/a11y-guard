import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createLogger, AppLogger } from '@a11y-guard/logger';

export interface IArtifactStore {
  uploadScreenshot(key: string, buffer: Buffer | Uint8Array): Promise<string>;
}

export interface S3ArtifactStoreOptions {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
  forcePathStyle?: boolean;
  logger?: AppLogger;
}

export class S3ArtifactStore implements IArtifactStore {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly logger: AppLogger;

  constructor(options: S3ArtifactStoreOptions) {
    this.bucket = options.bucket;
    this.logger = options.logger ?? createLogger('artifact-store');
    this.client = new S3Client({
      endpoint: `http://${options.endpoint}:${options.port}`,
      region: options.region ?? 'us-east-1',
      credentials: {
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey,
      },
      forcePathStyle: options.forcePathStyle ?? true,
    });
  }

  async uploadScreenshot(key: string, buffer: Buffer | Uint8Array): Promise<string> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: 'image/png',
        }),
      );
      const url = `/${this.bucket}/${key}`;
      this.logger.info({ key, bucket: this.bucket }, 'Screenshot uploaded');
      return url;
    } catch (err) {
      this.logger.error({ err, key }, 'Failed to upload screenshot');
      throw err;
    }
  }
}
