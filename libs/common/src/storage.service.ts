import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private basePath: string;
  private publicBaseUrl: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private configService: ConfigService) {
    // Lazy initialization — S3 credentials are only required when an upload is attempted
    const accessKey = this.configService.get<string>('S3_KEY');
    const secretKey = this.configService.get<string>('S3_SECRET');
    const region = this.configService.get<string>('S3_REGION');

    this.bucket = this.configService.get<string>('S3_BUCKET') || '';
    this.basePath = this.configService.get<string>('S3_BASE_PATH') || '';
    this.publicBaseUrl =
      this.configService.get<string>('S3_PUBLIC_BASE_PATH') || '';

    if (accessKey && secretKey && region) {
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
      });
      this.logger.log('S3 storage client initialized successfully');
    } else {
      this.logger.warn(
        'S3 storage credentials not configured — file uploads will be unavailable',
      );
    }
  }

  async uploadBase64(
    base64Data: string,
    folder: string,
    fileName: string,
  ): Promise<{ dbUrl: string; readUrl: string }> {
    if (!this.s3Client) {
      throw new InternalServerErrorException(
        'S3 storage is not configured. Set S3_KEY, S3_SECRET, S3_REGION, S3_BUCKET, and S3_PUBLIC_BASE_PATH environment variables.',
      );
    }

    try {
      // 1. Parse Base64
      const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      let content = base64Data;
      let contentType = 'image/png';

      if (matches && matches.length === 3) {
        contentType = matches[1];
        content = matches[2];
      }

      const buffer = Buffer.from(content, 'base64');
      return this.uploadBuffer(buffer, folder, fileName, contentType);
    } catch (error) {
      console.error('S3 Base64 Upload Error:', error);
      throw new InternalServerErrorException(
        `Failed to upload base64 to storage: ${error.message}`,
      );
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    folder: string,
    fileName: string,
    contentType: string,
  ): Promise<{ dbUrl: string; readUrl: string }> {
    if (!this.s3Client) {
      throw new InternalServerErrorException('S3 storage is not configured.');
    }

    try {
      const key = `${this.basePath}${folder}${fileName}`;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      const readUrl = await this.generatePresignedGetUrl(key);
      const dbUrl = `${this.publicBaseUrl}${key}`;

      return { dbUrl, readUrl };
    } catch (error) {
      console.error('S3 Buffer Upload Error:', error);
      throw new InternalServerErrorException(
        `Failed to upload buffer to storage: ${error.message}`,
      );
    }
  }
  async generatePresignedUrl(
    folder: string,
    fileName: string,
    contentType: string,
    expiresInMinutes = 10,
  ): Promise<{ uploadUrl: string; readUrl: string }> {
    if (!this.s3Client) {
      throw new InternalServerErrorException('S3 storage is not configured.');
    }

    try {
      const key = `${this.basePath}${folder}${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        // Using Bucket Owner Enforced security, no ACLs necessary here.
      });

      // Valid for configured minutes (default 10)
      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInMinutes * 60,
      });

      // Generate a signed GET URL directly for immediate read access, mimicking Laravel's getAwsTemporaryUrl('get')
      const readUrl = await this.generatePresignedGetUrl(key, expiresInMinutes);

      return {
        uploadUrl,
        readUrl,
      };
    } catch (error) {
      this.logger.error('S3 Pre-signed URL Generation Error', error);
      throw new InternalServerErrorException(
        `Failed to generate upload URL: ${error.message}`,
      );
    }
  }

  async generatePresignedGetUrl(
    keyOrPath: string,
    expiresInMinutes = 10,
  ): Promise<string> {
    if (!this.s3Client) {
      throw new InternalServerErrorException('S3 storage is not configured.');
    }

    try {
      let key = keyOrPath;
      // If a full public URL is passed, extract just the key
      if (this.publicBaseUrl && key.startsWith(this.publicBaseUrl)) {
        key = key.replace(this.publicBaseUrl, '');
      } else if (!key.startsWith(this.basePath)) {
        key = `${this.basePath}${key}`;
      }

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInMinutes * 60,
      });
    } catch (error) {
      this.logger.error('S3 Pre-signed GET URL Generation Error', error);
      throw new InternalServerErrorException(
        `Failed to generate read URL: ${error.message}`,
      );
    }
  }

  async downloadBuffer(keyOrPath: string): Promise<Buffer> {
    if (!this.s3Client) {
      throw new InternalServerErrorException('S3 storage is not configured.');
    }

    try {
      let key = keyOrPath;
      if (this.publicBaseUrl && key.startsWith(this.publicBaseUrl)) {
        key = key.replace(this.publicBaseUrl, '');
      } else if (!key.startsWith(this.basePath)) {
        key = `${this.basePath}${key}`;
      }

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const stream = response.Body as any;

      return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      this.logger.error('S3 File Download Error', error);
      throw new InternalServerErrorException(
        `Failed to download file from storage: ${error.message}`,
      );
    }
  }
}
