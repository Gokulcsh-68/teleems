const { Client } = require('pg');

async function checkVehicles() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: '',
    database: 'teleems'
  });

  try {
    await client.connect();
    const res = await client.query('SELECT identifier, status, type FROM vehicles;');
    console.log('--- Vehicles in DB ---');
    console.table(res.rows);
    await client.end();
  } catch (err) {
    console.error('Error querying DB:', err.message);
    process.exit(1);
  }
}

checkVehicles();
