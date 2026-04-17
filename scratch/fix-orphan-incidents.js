const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5433,
  user: 'teleems_user',
  password: 'localpassword',
  database: 'teleems',
});

async function remediate() {
  try {
    await client.connect();
    console.log('Connecting to database...');

    // 1. Find a valid Organisation ID from an existing user
    const userRes = await client.query('SELECT "organisationId" FROM "user" WHERE "organisationId" IS NOT NULL LIMIT 1');
    if (userRes.rows.length === 0) {
      console.error('No valid organization found. Please create a user with an organisationId first.');
      return;
    }
    const orgId = userRes.rows[0].organisationId;
    console.log(`Using Organisation: ${orgId}`);

    // 2. Identify orphan incidents (organisationId is null or empty)
    const orphanRes = await client.query('SELECT id FROM incident WHERE "organisationId" IS NULL OR "organisationId" = \'\'');
    console.log(`Found ${orphanRes.rows.length} orphan incidents.`);

    if (orphanRes.rows.length === 0) {
        console.log('Nothing to remediate.');
        return;
    }

    // 3. Link them to the organization
    const ids = orphanRes.rows.map(r => r.id);
    await client.query('UPDATE incident SET "organisationId" = $1 WHERE id = ANY($2)', [orgId, ids]);
    
    console.log(`\nRemediation completed successfully.`);
    console.log(`Linked ${orphanRes.rows.length} incidents to Org: ${orgId}`);
    console.log('You should now be able to see your trips in the list.');

  } catch (err) {
    console.error('Error during remediation:', err);
  } finally {
    await client.end();
  }
}

remediate();
