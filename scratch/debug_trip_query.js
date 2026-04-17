const { Client } = require('pg');

async function testQuery() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    database: 'teleems',
    user: 'teleems_user',
    password: 'localpassword',
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    // Mimic the TypeORM query
    const query = `
      SELECT trip.* 
      FROM dispatches trip 
      INNER JOIN incident incident ON incident.id = trip.incident_id 
      ORDER BY trip.dispatched_at DESC, trip.id DESC 
      LIMIT 5
    `;
    
    const res = await client.query(query);
    console.log('Query successful, rows:', res.rowCount);
    
    // Test the count query which is often where it fails
    const countRes = await client.query(`
      SELECT count(*) 
      FROM dispatches trip 
      INNER JOIN incident incident ON incident.id = trip.incident_id
    `);
    console.log('Count successful:', countRes.rows[0].count);

  } catch (err) {
    console.error('ERROR:', err.message);
    if (err.hint) console.error('HINT:', err.hint);
  } finally {
    await client.end();
  }
}

testQuery();
