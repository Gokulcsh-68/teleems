import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { RedisService } from '../../../libs/common/src';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: ['polling', 'websocket'],
})
export class RtvsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RtvsGateway.name);

  constructor(private readonly redisService: RedisService) {}

  afterInit(server: Server) {
    this.logger.log('RTVS WebSocket Gateway Initialized');

    // Subscribe to all vitals streams using pattern matching
    this.redisService.pSubscribe('vitals:stream:*', (channel, message) => {
      try {
        const payload = JSON.parse(message);
        const { patient_id } = payload;

        // Broadcast to the specific patient room
        this.server.to(`patient_${patient_id}`).emit('vitals_update', payload);

        this.logger.debug(
          `Streamed ${payload.type} update for patient ${patient_id}`,
        );
      } catch (err) {
        this.logger.error('Failed to parse vitals stream message', err);
      }
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    // In production, we'd verify JWT here.
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_patient_stream')
  handleJoinPatient(
    @MessageBody() data: { patient_id: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `patient_${data.patient_id}`;
    client.join(room);
    this.logger.log(
      `Client ${client.id} joined stream for patient ${data.patient_id}`,
    );
    return { status: 'joined', room };
  }

  @SubscribeMessage('leave_patient_stream')
  handleLeavePatient(
    @MessageBody() data: { patient_id: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `patient_${data.patient_id}`;
    client.leave(room);
    this.logger.log(
      `Client ${client.id} left stream for patient ${data.patient_id}`,
    );
    return { status: 'left', room };
  }
}
