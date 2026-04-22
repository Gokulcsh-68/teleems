const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/teleems' });

async function check() {
  await client.connect();
  let res = await client.query(`SELECT * FROM organisations WHERE name ILIKE '%Shah%'`);
  console.log('Orgs:', res.rows);
  res = await client.query(`SELECT * FROM users WHERE username = 'Shahil'`);
  console.log('Users:', res.rows);
  process.exit(0);
}
check().catch(console.error);
