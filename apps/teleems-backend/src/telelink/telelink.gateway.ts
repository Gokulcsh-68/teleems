import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'telelink',
})
export class TelelinkGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TelelinkGateway.name);

  handleConnection(client: Socket) {
    const { hospitalId, organisationId } = client.handshake.query;
    
    if (hospitalId) {
      client.join(`hospital_${hospitalId}`);
      this.logger.log(`Client ${client.id} joined hospital room: ${hospitalId}`);
    }
    
    if (organisationId) {
      client.join(`org_${organisationId}`);
      this.logger.log(`Client ${client.id} joined org room: ${organisationId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  notifyNewConsult(consult: any) {
    const hospitalId = consult.target_hospital_id;
    const orgId = consult.organisationId;

    if (hospitalId) {
      this.server.to(`hospital_${hospitalId}`).emit('new_consult', consult);
    } else if (orgId) {
      this.server.to(`org_${orgId}`).emit('new_consult', consult);
    }
    
    // Also notify specific user if targeted
    if (consult.professional_id) {
      this.server.to(`user_${consult.professional_id}`).emit('new_consult', consult);
    }
  }

  notifyStatusUpdate(sessionId: string, status: string, data?: any) {
    this.server.to(`session_${sessionId}`).emit('status_update', { sessionId, status, ...data });
  }

  @SubscribeMessage('join_session')
  handleJoinSession(client: Socket, sessionId: string) {
    client.join(`session_${sessionId}`);
    return { event: 'joined', data: sessionId };
  }
}
