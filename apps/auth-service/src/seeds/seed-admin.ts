/**
 * Seed script to create the initial CURESELECT_ADMIN user.
 *
 * Usage:
 *   npx ts-node apps/auth-service/src/seeds/seed-admin.ts
 *
 * Environment variables required:
 *   ADMIN_USERNAME (default: admin)
 *   ADMIN_PASSWORD (default: Admin@1234)
 *   ADMIN_PHONE    (default: +910000000000)
 *   ADMIN_EMAIL    (default: admin@teleems.in)
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User, AuditLog } from '@app/common';
import * as bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 12;

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433', 10),
    username: process.env.DB_USER || 'teleems_user',
    password: process.env.DB_PASSWORD || 'localpassword',
    database: process.env.DB_NAME || 'teleems',
    entities: [User, AuditLog],
    synchronize: true, // Auto-create tables for dev seeding
  });

  await dataSource.initialize();
  console.log('[SEED] Database connected.');

  const userRepo = dataSource.getRepository(User);
  const username = process.env.ADMIN_USERNAME || 'admin';

  // Check if admin already exists
  const existing = await userRepo.findOneBy({ username });
  if (existing) {
    if (!existing.roles.includes('CURESELECT_ADMIN')) {
      console.log(
        `[SEED] Promoting existing user "${username}" to CURESELECT_ADMIN.`,
      );
      existing.roles = Array.from(
        new Set([...existing.roles, 'CURESELECT_ADMIN']),
      );
      await userRepo.save(existing);
    } else {
      console.log(
        `[SEED] Admin user "${username}" already exists and has correct roles. Skipping.`,
      );
    }
    await dataSource.destroy();
    return;
  }

  const password = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const admin = userRepo.create({
    username,
    password: hashedPassword,
    phone: process.env.ADMIN_PHONE || '+910000000000',
    email: process.env.ADMIN_EMAIL || 'admin@teleems.in',
    roles: ['CURESELECT_ADMIN'],
    mfaEnabled: false,
    forcePasswordReset: false,
  });

  await userRepo.save(admin);

  console.log(`[SEED] ✅ Admin user created successfully.`);
  console.log(`       Username: ${username}`);
  console.log(`       Password: ${password}`);
  console.log(`       Role:     CURESELECT_ADMIN`);
  console.log(`       ID:       ${admin.id}`);
  console.log(
    `\n⚠️  Change the default password immediately and enable MFA via POST /v1/auth/mfa/setup`,
  );

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('[SEED] ❌ Failed:', err);
  process.exit(1);
});
