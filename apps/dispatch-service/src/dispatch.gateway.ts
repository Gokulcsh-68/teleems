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
import { Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '@app/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'dispatch',
})
export class DispatchGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('DispatchGateway');

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit() {
    // Subscribe to Redis updates from Fleet Service
    await this.redisService.subscribe('fleet:location_updated', (message: string) => {
      try {
        const data = JSON.parse(message);
        // Broadcast to everyone in the "fleet_locations" room (for BookingScreen map)
        this.server.to('fleet_locations').emit('fleet:location_updated', data);
      } catch (err) {
        this.logger.error('Error parsing fleet:location_updated message', err);
      }
    });

    // Subscribe to Vehicle Assignment updates
    await this.redisService.subscribe('vehicle:assigned', (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.driver_id) {
          this.server.to(`user_${data.driver_id}`).emit('vehicle:assigned', data);
        }
        if (data.staff_id) {
          this.server.to(`user_${data.staff_id}`).emit('vehicle:assigned', data);
        }
        this.logger.log(`Broadcast vehicle:assigned for vehicle ${data.registration_number}`);
      } catch (err) {
        this.logger.error('Error parsing vehicle:assigned message', err);
      }
    });

    // Subscribe to Vehicle Unassignment updates
    await this.redisService.subscribe('vehicle:unassigned', (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.driver_id) {
          this.server.to(`user_${data.driver_id}`).emit('vehicle:unassigned', data);
        }
        if (data.staff_id) {
          this.server.to(`user_${data.staff_id}`).emit('vehicle:unassigned', data);
        }
        this.logger.log(`Broadcast vehicle:unassigned for shift ${data.shift_id}`);
      } catch (err) {
        this.logger.error('Error parsing vehicle:unassigned message', err);
      }
    });
  }

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

  @SubscribeMessage('subscribe_fleet')
  handleSubscribeFleet(@ConnectedSocket() client: Socket) {
    const room = 'fleet_locations';
    client.join(room);
    this.logger.log(`Client ${client.id} subscribed to fleet locations`);
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
