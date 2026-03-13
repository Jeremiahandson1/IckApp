import pool from './db/init.js';

process.argv[1] = 'force';
const { companies } = await import('./db/seed.js');

let inserted = 0;
for (const c of companies) {
  try {
    await pool.query(
      `INSERT INTO companies (name, parent_company, behavior_score, controversies, positive_actions, lobbying_history, transparency_rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (name) DO UPDATE SET
         parent_company = COALESCE(EXCLUDED.parent_company, companies.parent_company),
         behavior_score = COALESCE(EXCLUDED.behavior_score, companies.behavior_score),
         controversies = COALESCE(EXCLUDED.controversies, companies.controversies),
         positive_actions = COALESCE(EXCLUDED.positive_actions, companies.positive_actions),
         lobbying_history = COALESCE(EXCLUDED.lobbying_history, companies.lobbying_history),
         transparency_rating = COALESCE(EXCLUDED.transparency_rating, companies.transparency_rating)`,
      [c.name, c.parent_company, c.behavior_score, JSON.stringify(c.controversies),
       JSON.stringify(c.positive_actions), c.lobbying_history, c.transparency_rating]
    );
    inserted++;
  } catch (e) {
    console.error('Failed:', c.name, e.message);
  }
}
console.log(`Seeded ${inserted}/${companies.length} companies`);

const count = await pool.query('SELECT COUNT(*) FROM companies');
console.log('Total companies in DB:', count.rows[0].count);
process.exit(0);
