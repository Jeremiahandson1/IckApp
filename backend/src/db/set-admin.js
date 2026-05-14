// CLI utility to grant/revoke admin role on a user by email.
//
// Usage:
//   node src/db/set-admin.js grant   user@example.com
//   node src/db/set-admin.js revoke  user@example.com
//   node src/db/set-admin.js list                       # show all admins

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

const [action, email] = process.argv.slice(2);

async function main() {
  if (action === 'list') {
    const r = await pool.query(
      `SELECT email, name, created_at FROM users WHERE is_admin = true ORDER BY email`
    );
    console.log(`Admins (${r.rows.length}):`);
    for (const u of r.rows) console.log(`  ${u.email.padEnd(40)} ${u.name || '(no name)'}`);
    await pool.end();
    return;
  }

  if (!email || (action !== 'grant' && action !== 'revoke')) {
    console.error('Usage:');
    console.error('  node src/db/set-admin.js grant   <email>');
    console.error('  node src/db/set-admin.js revoke  <email>');
    console.error('  node src/db/set-admin.js list');
    process.exit(1);
  }

  const flag = action === 'grant';
  const r = await pool.query(
    `UPDATE users SET is_admin = $1 WHERE LOWER(email) = LOWER($2)
     RETURNING id, email, is_admin`,
    [flag, email]
  );

  if (r.rows.length === 0) {
    console.error(`No user found with email ${email}`);
    await pool.end();
    process.exit(1);
  }

  const u = r.rows[0];
  console.log(`✓ ${action === 'grant' ? 'Granted' : 'Revoked'} admin for ${u.email}  (is_admin=${u.is_admin})`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); pool.end().then(() => process.exit(1)); });
