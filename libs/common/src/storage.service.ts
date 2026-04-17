import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private basePath: string;
  private publicBaseUrl: string;

  constructor(private configService: ConfigService) {
    const accessKey = this.configService.getOrThrow<string>('S3_KEY');
    const secretKey = this.configService.getOrThrow<string>('S3_SECRET');
    const region = this.configService.getOrThrow<string>('S3_REGION');

    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    this.basePath = this.configService.get<string>('S3_BASE_PATH') || '';
    this.publicBaseUrl = this.configService.getOrThrow<string>('S3_PUBLIC_BASE_PATH');

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });
  }

  async uploadBase64(base64Data: string, folder: string, fileName: string): Promise<string> {
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
