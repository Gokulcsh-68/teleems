const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5433,
  user: 'teleems_user',
  password: 'localpassword',
  database: 'teleems',
});

const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});

async function seed() {
  try {
    await client.connect();
    
    // 1. Find a valid Organisation ID from an existing user
    console.log('Connecting to database...');
    const userRes = await client.query('SELECT "organisationId" FROM "user" LIMIT 1');
    const orgId = userRes.rows[0]?.organisationId || '00000000-0000-0000-0000-000000000001';
    
    console.log(`Seeding 5 ambulances for Organisation: ${orgId}`);

    const vehicles = [
      ['AMB-001', 'AVAILABLE', 'ALS', 12.9716, 77.5946],
      ['AMB-002', 'AVAILABLE', 'BLS', 12.9800, 77.6000],
      ['AMB-003', 'AVAILABLE', 'ALS', 12.9600, 77.5800],
      ['AMB-004', 'BUSY',      'BLS', 12.9500, 77.5700],
      ['AMB-005', 'AVAILABLE', 'ALS', 12.9900, 77.6100],
    ];

    for (const [identifier, status, type, lat, lon] of vehicles) {
      const id = uuidv4();
      await client.query(
        'INSERT INTO vehicles (id, identifier, status, type, gps_lat, gps_lon, "organisationId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) ON CONFLICT (identifier) DO NOTHING',
        [id, identifier, status, type, lat, lon, orgId]
      );
      console.log(`Registered: ${identifier} (${type})`);
    }

    console.log('\nSeeding completed successfully.');
    console.log('You can now use GET /v1/fleet to view them.');
  } catch (err) {
    console.error('Error seeding vehicles:', err);
  } finally {
    await client.end();
  }
}

seed();
