const { Client } = require('pg');

async function check() {
  const client = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: '', database: 'teleems' });
  try {
    await client.connect();
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'departments'");
    console.log('Departments table exists:', res.rows.length > 0);
    
    if (res.rows.length > 0) {
      const columns = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'departments'");
      console.log('Columns in departments:');
      columns.rows.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));
    }
    
    await client.end();
  } catch (err) {
    console.error(err);
  }
}

check();
