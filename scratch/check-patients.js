const { Client } = require('pg');

async function checkIncidents() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'teleems_user',
    password: 'localpassword',
    database: 'teleems'
  });

  try {
    await client.connect();
    const res = await client.query('SELECT id, patients FROM incident LIMIT 5;');
    console.log('--- Incidents and Patients in DB ---');
    res.rows.forEach(row => {
      console.log(`Incident ID: ${row.id}`);
      console.log('Patients:', JSON.stringify(row.patients, null, 2));
    });
    await client.end();
  } catch (err) {
    console.error('Error querying DB:', err.message);
    process.exit(1);
  }
}

checkIncidents();
