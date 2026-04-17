import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
    this.publicBaseUrl = this.configService.get<string>('S3_PUBLIC_BASE_PATH') || '';

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
      this.logger.warn('S3 storage credentials not configured — file uploads will be unavailable');
    }
  }

  async uploadBase64(base64Data: string, folder: string, fileName: string): Promise<string> {
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
      const key = `${this.basePath}${folder}${fileName}`;

      // 2. Upload to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      // 3. Return Public URL
      return `${this.publicBaseUrl}${key}`;
    } catch (error) {
      console.error('S3 Upload Error:', error);
      throw new InternalServerErrorException(`Failed to upload file to storage: ${error.message}`);
    }
  }
}

