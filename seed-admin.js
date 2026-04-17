const { Client } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function seed() {
  const url = process.env.DATABASE_URL;
  let clientConfig;

  if (url) {
    clientConfig = {
      connectionString: url,
      ssl: { rejectUnauthorized: false }
    };
  } else if (process.env.DB_HOST) {
    clientConfig = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_HOST === 'localhost' ? false : { rejectUnauthorized: false }
    };
  } else {
    console.error("❌ Please provide either DATABASE_URL or DB_HOST environment variables.");
    console.error("Example: $env:DATABASE_URL='postgresql://...'; node seed-admin.js");
    process.exit(1);
  }

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log("Connected to database successfully!");

    // 1. Hash the password securely
    const passwordHash = await bcrypt.hash('Admin@123!', 10);
    
    // 2. Ensure the CURESELECT_ADMIN role exists
    const roleId = crypto.randomUUID();
    await client.query(`
      INSERT INTO "role" (id, name, scope, permissions, "createdAt", "updatedAt") 
      VALUES ($1, 'CURESELECT_ADMIN', 'GLOBAL', 'admin:all', NOW(), NOW())
      ON CONFLICT (name) DO NOTHING
    `, [roleId]);

    // 3. Create the Admin User
    const userId = crypto.randomUUID();
    await client.query(`
      INSERT INTO "user" (id, phone, email, username, password, roles, status, "failedLoginAttempts", "mfaEnabled", "forcePasswordReset", "createdAt", "updatedAt")
      VALUES ($1, '0000000000', 'admin@teleems.com', 'admin', $2, 'CURESELECT_ADMIN', 'ACTIVE', 0, false, false, NOW(), NOW())
    `, [userId, passwordHash]);

    console.log("✅ Admin user created successfully!");
    console.log("-----------------------------------------");
    console.log("Username: admin  (or login with Email: admin@teleems.com)");
    console.log("Password: Admin@123!");
    console.log("Roles: CURESELECT_ADMIN");
    console.log("-----------------------------------------");
    
  } catch (err) {
    if (err.code === '23505') {
       console.log("⚠️ Admin user already exists! You can log in using 'admin@teleems.com'.");
    } else {
       console.error("❌ Error creating admin:", err);
    }
  } finally {
    await client.end();
  }
}

seed();
