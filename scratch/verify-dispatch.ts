import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/teleems-backend/src/app.module';
import { DispatchServiceService, AuditContext } from '../apps/dispatch-service/src/dispatch-service.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Vehicle, VehicleStatus } from '../apps/fleet-service/src/entities/vehicle.entity';
import { Incident } from '../apps/dispatch-service/src/entities/incident.entity';
import { Repository } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(DispatchServiceService);
  const vehicleRepo = app.get<Repository<Vehicle>>(getRepositoryToken(Vehicle));
  const incidentRepo = app.get<Repository<Incident>>(getRepositoryToken(Incident));

  console.log('--- Starting Dispatch Verification ---');

  try {
    // 1. Setup Test Vehicles
    await vehicleRepo.delete({}); // Clear for clean test
    
    // Create one nearby and one far away
    const v1 = vehicleRepo.create({
      identifier: 'AMB-NEAR',
      status: VehicleStatus.AVAILABLE,
      gps_lat: 10.3800000,
      gps_lon: 78.8200000,
      type: 'ALS'
    });
    const v2 = vehicleRepo.create({
      identifier: 'AMB-FAR',
      status: VehicleStatus.AVAILABLE,
      gps_lat: 10.5000000,
      gps_lon: 79.0000000,
      type: 'BLS'
    });
    await vehicleRepo.save([v1, v2]);
    console.log('✅ Test vehicles seeded (AMB-NEAR and AMB-FAR)');

    // 2. Setup Test Incident (Near AMB-NEAR)
    const incident = incidentRepo.create({
      category: 'MEDICAL',
      severity: 'CRITICAL',
      gps_lat: 10.3700000,
      gps_lon: 78.8200000,
      address: 'Test Proximity Location',
      caller_id: 'test-user',
      status: 'PENDING'
    });
    const savedIncident = await incidentRepo.save(incident);
    console.log(`✅ Test incident created: ${savedIncident.id}`);

    // 3. Trigger Dispatch
    const context: AuditContext = {
      userId: 'test-admin',
      ip: '127.0.0.1',
      userAgent: 'VerificationScript'
    };

    console.log('Triggering Auto-Dispatch...');
    const result = await service.dispatchIncident(savedIncident.id, {}, context);

    // 4. Verification
    console.log('Dispatch Assigned Vehicle:', result.vehicle.id);
    console.log('Calculated ETA:', result.eta_seconds, 'seconds');

    if (result.vehicle.id === 'AMB-NEAR') {
      console.log('🚀 SUCCESS: Proximity logic selected the nearest vehicle (AMB-NEAR)!');
    } else {
      console.log('❌ FAILURE: Proximity logic failed to select the nearest vehicle.');
    }

    // Check DB status of vehicle
    const updatedV1 = await vehicleRepo.findOneBy({ identifier: 'AMB-NEAR' });
    console.log('Vehicle status in DB:', updatedV1?.status);
    if (updatedV1?.status === VehicleStatus.BUSY) {
      console.log('🚀 SUCCESS: Vehicle status updated to BUSY!');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
