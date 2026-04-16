const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'teleems'
  });

  try {
    await client.connect();
    console.log('SUCCESS: Connected to local Postgres on 5432 with user "postgres"');
    await client.end();
  } catch (err) {
    console.error('FAILURE: Could not connect to local Postgres on 5432 with user "postgres":', err.message);
  }
}

testConnection();
