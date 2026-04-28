import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  TravelMode,
  UnitSystem,
} from '@googlemaps/google-maps-services-js';

@Injectable()
export class MapsService {
  private client: Client;
  private apiKey: string | undefined;
  private readonly logger = new Logger(MapsService.name);

  constructor(private configService: ConfigService) {
    this.client = new Client({});
    this.apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
  }

  /**
   * Calculates travel time and distance between origin and destination.
   * Returns duration in seconds and distance in meters.
   */
  async getTravelTime(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ) {
    if (!this.apiKey || this.apiKey === 'your-key') {
      this.logger.warn('Google Maps API Key not set. Using simulation.');
      return this.simulateTravelTime(origin, destination);
    }

    try {
      const response = await this.client.distancematrix({
        params: {
          origins: [`${origin.lat},${origin.lng}`],
          destinations: [`${destination.lat},${destination.lng}`],
          mode: TravelMode.driving,
          units: UnitSystem.metric,
          key: this.apiKey,
        },
      });

      const element = response.data.rows[0].elements[0];
      if (element.status === 'OK') {
        return {
          duration: element.duration.value, // in seconds
          distance: element.distance.value, // in meters
        };
      }
      throw new Error(`Distance Matrix failed with status: ${element.status}`);
    } catch (err) {
      this.logger.error('Google Maps Distance Matrix Error', err);
      return this.simulateTravelTime(origin, destination);
    }
  }

  /**
   * Gets optimized directions between two points.
   * Returns the encoded polyline for the route.
   */
  async getDirections(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ) {
    if (!this.apiKey || this.apiKey === 'your-key') {
      return { polyline: 'SIMULATED_POLYLINE', steps: [] };
    }

    try {
      const response = await this.client.directions({
        params: {
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          mode: TravelMode.driving,
          key: this.apiKey,
        },
      });

      const route = response.data.routes[0];
      return {
        polyline: route.overview_polyline.points,
        bounds: route.bounds,
        steps: route.legs[0].steps.map((s) => ({
          instruction: s.html_instructions,
          distance: s.distance.text,
          duration: s.duration.text,
        })),
      };
    } catch (err) {
      this.logger.error('Google Maps Directions Error', err);
      return { polyline: '', steps: [] };
    }
  }

  /**
   * Internal simulation for local dev without API key
   */
  private simulateTravelTime(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
    const dist = this.haversine(origin.lat, origin.lng, destination.lat, destination.lng);
    
    // SANITY CHECK: If distance > 100km, assume GPS is uninitialized (0,0) and use default 15 mins
    if (dist > 100) {
      return {
        duration: 900, // 15 minutes default
        distance: dist * 1000
      };
    }

    // Assume 30km/h average in city traffic
    const duration = Math.floor((dist / 30) * 3600);
    return {
      duration: duration < 120 ? 120 : duration,
      distance: dist * 1000,
    };
  }

  private haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
