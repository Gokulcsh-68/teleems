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

  @SubscribeMessage('subscribe_trip')
  handleSubscribeTrip(@MessageBody() data: { tripId: string }, @ConnectedSocket() client: Socket) {
    const room = `trip_${data.tripId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} subscribed to trip ${data.tripId}`);
    return { event: 'subscribed', data: room };
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

  /**
   * Notify crew members about mission status updates
   */
  notifyStatusUpdate(dispatch: any, status: string) {
    const { driver_id, emt_id, id: tripId } = dispatch;
    const payload = {
      trip_id: tripId,
      status: status,
      timestamp: new Date(),
    };

    if (driver_id) {
      this.server.to(`user_${driver_id}`).emit('dispatch:status_updated', payload);
    }
    if (emt_id) {
      this.server.to(`user_${emt_id}`).emit('dispatch:status_updated', payload);
    }
    this.logger.log(`Broadcast status update [${status}] for Trip ${tripId}`);
  }

  /**
   * Notify the person who reported the incident about updates
   */
  notifyCaller(callerId: string, event: string, payload: any) {
    if (callerId) {
      this.server.to(`user_${callerId}`).emit(event, payload);
      this.logger.log(`Notified Caller ${callerId} with event ${event}`);
    }
  }

  /**
   * Broadcast live vehicle location to the caller
   */
  notifyVehicleLocation(callerId: string, vehicleId: string, location: { lat: number; lon: number; speed?: number }) {
    if (callerId) {
      this.server.to(`user_${callerId}`).emit('vehicle:location_updated', {
        vehicle_id: vehicleId,
        ...location,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Notify caller about arrival time changes
   */
  notifyETAUpdate(callerId: string, etaSeconds: number) {
    if (callerId) {
      this.server.to(`user_${callerId}`).emit('dispatch:eta_updated', {
        eta_seconds: etaSeconds,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Broadcast vitals update to all subscribers of a trip
   */
  notifyVitalsUpdate(tripId: string, vitals: any) {
    this.server.to(`trip_${tripId}`).emit('trip:vitals_updated', {
      trip_id: tripId,
      ...vitals,
      timestamp: new Date(),
    });
    this.logger.log(`Broadcast vitals update for Trip ${tripId}`);
  }
}
