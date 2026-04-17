const { Client } = require('pg');

async function checkIncident() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'teleems',
    port: 5432,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT id, "organisationId" FROM incident WHERE id = $1', ['352eaa47-476d-4f2a-bb4a-e94492edd21e']);
    console.log('Incident Data:', res.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkIncident();
