import { Injectable } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

@Injectable()
export class SqsService {
  private client = new SQSClient({ region: process.env.AWS_REGION });

  async publish(queueUrl: string, eventType: string, payload: object) {
    await this.client.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ eventType, payload, timestamp: new Date().toISOString() }),
      MessageGroupId: eventType,   // for FIFO queues
    }));
  }
}
