import { DataSource } from 'typeorm';
import { Vehicle, VehicleStatus } from '../libs/common/src/entities/vehicle.entity';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkVehicles() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    username: process.env.DB_USER || 'teleems_user',
    password: process.env.DB_PASSWORD || 'localpassword',
    database: process.env.DB_NAME || 'teleems',
    entities: [Vehicle],
  });

  await dataSource.initialize();
  const repo = dataSource.getRepository(Vehicle);
  
  // Reset all existing vehicles to AVAILABLE for testing
  const allVehicles = await repo.find();
  if (allVehicles.length > 0) {
    for (const v of allVehicles) {
      v.status = VehicleStatus.AVAILABLE;
      v.isActive = true;
      await repo.save(v);
    }
    console.log(`Reset ${allVehicles.length} vehicles to AVAILABLE status.`);
  }

  const vehicles = await repo.find();
  
  console.log('--- Current Vehicles in Database ---');
  vehicles.forEach(v => {
    console.log(`ID: ${v.id} | Reg: ${v.registration_number} | Status: ${v.status} | Active: ${v.isActive}`);
  });
  
  if (vehicles.length < 3) {
    console.log('Less than 3 vehicles found. Creating more test vehicles...');
    const testVehicles = [
      { registration_number: 'AMB-001', status: VehicleStatus.AVAILABLE, isActive: true, gps_lat: 13.0544, gps_lon: 80.2362, type: 'BLS' },
      { registration_number: 'AMB-002', status: VehicleStatus.AVAILABLE, isActive: true, gps_lat: 13.0555, gps_lon: 80.2377, type: 'ALS' },
      { registration_number: 'AMB-003', status: VehicleStatus.AVAILABLE, isActive: true, gps_lat: 13.0566, gps_lon: 80.2388, type: 'BLS' },
    ];

    for (const vData of testVehicles) {
      const exists = vehicles.find(v => v.registration_number === vData.registration_number);
      if (!exists) {
        const v = repo.create(vData);
        await repo.save(v);
        console.log(`Created vehicle: ${vData.registration_number}`);
      }
    }
  }

  await dataSource.destroy();
}

checkVehicles().catch(console.error);
