import pool from './db/init.js';
const r = await pool.query('DELETE FROM result_cache');
console.log('Cleared', r.rowCount, 'cached entries');
process.exit(0);
