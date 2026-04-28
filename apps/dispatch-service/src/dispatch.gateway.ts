import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'dispatch',
})
export class DispatchGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('DispatchGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoinRoom(@MessageBody() data: { userId: string }, @ConnectedSocket() client: Socket) {
    const room = `user_${data.userId}`;
    client.join(room);
    this.logger.log(`User ${data.userId} joined room ${room}`);
    return { event: 'joined', data: room };
  }

  /**
   * Notify specific crew members about a new dispatch
   */
  notifyCrew(dispatch: any) {
    const { driver_id, emt_id } = dispatch;

    if (driver_id) {
      this.server.to(`user_${driver_id}`).emit('dispatch:assigned', dispatch);
      this.logger.log(`Notified Driver ${driver_id} about dispatch ${dispatch.id}`);
    }

    if (emt_id) {
      this.server.to(`user_${emt_id}`).emit('dispatch:assigned', dispatch);
      this.logger.log(`Notified EMT ${emt_id} about dispatch ${dispatch.id}`);
    }
  }
}
