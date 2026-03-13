import { scoreProduct } from './utils/scoring.js';
const r = await scoreProduct({
  nova_group: 3,
  ingredients: 'cane sugar, ginger,tapioca starch,coconut oil',
  brand: 'Prince of Peace'
});
console.log('processing:', r.processing_score);
console.log('company:', r.company_behavior_score);
console.log('harmful:', r.harmful_ingredients_score);
console.log('banned:', r.banned_elsewhere_score);
console.log('transparency:', r.transparency_score);
process.exit(0);
