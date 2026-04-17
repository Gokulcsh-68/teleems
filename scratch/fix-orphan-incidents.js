const { Client } = require('pg');
require('dotenv').config();

async function fixOrphanIncidents() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    user: process.env.DB_USER || 'teleems_user',
    password: process.env.DB_PASSWORD || 'localpassword',
    database: process.env.DB_NAME || 'teleems',
  });

  try {
    await client.connect();
    console.log('Connected to database to fix orphan dispatches.');

    // 1. Delete dispatches with NULL incident_id
    const res1 = await client.query('DELETE FROM dispatches WHERE incident_id IS NULL');
    console.log(`Deleted ${res1.rowCount} dispatches with NULL incident_id.`);

    // 2. Optional: Delete dispatches that don't have a valid UUID in incident_id if we are changing type
    // (Postgres will fail anyway if we don't)
    // const res2 = await client.query("DELETE FROM dispatches WHERE incident_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'");
    // console.log(`Deleted ${res2.rowCount} dispatches with invalid UUID incident_id.`);

    console.log('Database cleanup complete.');
  } catch (err) {
    console.error('Error during database cleanup:', err);
  } finally {
    await client.end();
  }
}

fixOrphanIncidents();
