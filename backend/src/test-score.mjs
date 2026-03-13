import { scoreProduct } from './utils/scoring.js';
import pool from './db/init.js';

// 1. Check if Prince of Peace company exists
const companies = await pool.query("SELECT name,behavior_score FROM companies WHERE LOWER(name) LIKE '%prince%'");
console.log('Companies matching prince:', companies.rows);

// 2. Check total company count
const coCount = await pool.query("SELECT COUNT(*) FROM companies");
console.log('Total companies:', coCount.rows[0].count);

// 3. Check ginger chew products in DB
const products = await pool.query("SELECT upc,name,brand,nova_group,processing_score,company_behavior_score,total_score FROM products WHERE LOWER(name) LIKE '%ginger%' LIMIT 5");
console.log('Ginger products in DB:', products.rows);

// 4. Test scoring function
const r = await scoreProduct({
  nova_group: 3,
  ingredients: 'cane sugar, ginger,tapioca starch,coconut oil',
  brand: 'Prince of Peace'
});
console.log('Score result:', { processing: r.processing_score, company: r.company_behavior_score });

process.exit(0);
