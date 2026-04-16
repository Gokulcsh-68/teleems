const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'teleems_user',
    password: 'localpassword',
    database: 'teleems'
  });

  try {
    await client.connect();
    console.log('SUCCESS: Connected to local Postgres on 5432');
    const res = await client.query('SELECT current_user, current_database();');
    console.table(res.rows);
    await client.end();
  } catch (err) {
    console.error('FAILURE: Could not connect to local Postgres on 5432:', err.message);
  }
}

testConnection();
