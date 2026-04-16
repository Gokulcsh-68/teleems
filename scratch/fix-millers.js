const { Client } = require('pg');

async function fix() {
  const client = new Client({
    connectionString: 'postgres://teleems_user:localpassword@localhost:5433/teleems'
  });

  try {
    await client.connect();
    console.log('Connected to DB.');

    const APOLLO_ID = '84c30e99-5112-4be9-8ee7-39d6d4676914';

    // 1. Fix Sarah Miller
    const res1 = await client.query(
      'UPDATE public."user" SET "organisationId" = $1 WHERE username = $2',
      [APOLLO_ID, 'sarah_miller_er']
    );
    console.log('Fixed Sarah Miller:', res1.rowCount);

    // 2. Fix Alex Johnson (if he already exists)
    const res2 = await client.query(
      'UPDATE public."user" SET "organisationId" = $1 WHERE phone = $2',
      [APOLLO_ID, '9876543222']
    );
    console.log('Fixed Alex Johnson (existing):', res2.rowCount);

    // 3. Fix Anyone else with that phone
    const res3 = await client.query(
      'UPDATE public."user" SET "organisationId" = $1 WHERE phone = $2',
      [APOLLO_ID, '9876543555']
    );
    console.log('Fixed Alexa Johnson (existing):', res3.rowCount);

    await client.end();
  } catch (err) {
    console.error('Error:', err);
    await client.end();
  }
}

fix();
