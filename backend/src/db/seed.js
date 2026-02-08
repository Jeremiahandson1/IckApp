import pool from './init.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const additionalRecipes = require('./additional-recipes.cjs');

// ============================================
// HARMFUL INGREDIENTS DATABASE (50+ items)
// ============================================
const harmfulIngredients = [
  {
    name: 'Red 40',
    aliases: ['Allura Red', 'FD&C Red No. 40', 'E129', 'CI 16035'],
    severity: 8,
    category: 'Artificial Color',
    health_effects: ['Hyperactivity in children', 'Allergic reactions', 'Possible carcinogen'],
    banned_in: ['Austria', 'Finland', 'France', 'Norway', 'UK (warning required)'],
    why_used: 'Cheap way to make food look more appealing to children'
  },
  {
    name: 'Yellow 5',
    aliases: ['Tartrazine', 'FD&C Yellow No. 5', 'E102'],
    severity: 7,
    category: 'Artificial Color',
    health_effects: ['Hyperactivity', 'Asthma', 'Hives', 'Behavioral issues'],
    banned_in: ['Austria', 'Norway', 'UK (warning required)'],
    why_used: 'Inexpensive coloring agent'
  },
  {
    name: 'Yellow 6',
    aliases: ['Sunset Yellow', 'FD&C Yellow No. 6', 'E110'],
    severity: 7,
    category: 'Artificial Color',
    health_effects: ['Allergic reactions', 'Hyperactivity', 'Tumors in animal studies'],
    banned_in: ['Finland', 'Norway', 'UK (warning required)'],
    why_used: 'Creates orange/yellow coloring cheaply'
  },
  {
    name: 'Blue 1',
    aliases: ['Brilliant Blue', 'FD&C Blue No. 1', 'E133'],
    severity: 6,
    category: 'Artificial Color',
    health_effects: ['Allergic reactions', 'Chromosomal damage in studies'],
    banned_in: ['Austria', 'Belgium', 'France', 'Germany', 'Norway', 'Sweden', 'Switzerland'],
    why_used: 'Creates blue and green colors'
  },
  {
    name: 'Blue 2',
    aliases: ['Indigotine', 'FD&C Blue No. 2', 'E132'],
    severity: 6,
    category: 'Artificial Color',
    health_effects: ['Brain tumors in animal studies', 'Allergic reactions'],
    banned_in: ['Norway'],
    why_used: 'Blue coloring for candies and beverages'
  },
  {
    name: 'High Fructose Corn Syrup',
    aliases: ['HFCS', 'Corn Syrup', 'Glucose-Fructose Syrup', 'Isoglucose'],
    severity: 7,
    category: 'Sweetener',
    health_effects: ['Obesity', 'Diabetes', 'Fatty liver disease', 'Heart disease'],
    banned_in: [],
    why_used: 'Cheaper than sugar, extends shelf life, sweeter taste'
  },
  {
    name: 'Aspartame',
    aliases: ['NutraSweet', 'Equal', 'E951'],
    severity: 6,
    category: 'Artificial Sweetener',
    health_effects: ['Headaches', 'Possible carcinogen (WHO)', 'Neurological effects'],
    banned_in: [],
    why_used: 'Zero-calorie sweetener, 200x sweeter than sugar'
  },
  {
    name: 'Sucralose',
    aliases: ['Splenda', 'E955'],
    severity: 5,
    category: 'Artificial Sweetener',
    health_effects: ['Gut microbiome disruption', 'Glucose intolerance'],
    banned_in: [],
    why_used: 'Zero-calorie sweetener, heat stable'
  },
  {
    name: 'Sodium Nitrite',
    aliases: ['E250', 'Sodium Nitrate', 'E251'],
    severity: 8,
    category: 'Preservative',
    health_effects: ['Forms carcinogenic nitrosamines', 'Colorectal cancer risk'],
    banned_in: [],
    why_used: 'Preserves color, prevents botulism in processed meats'
  },
  {
    name: 'BHA',
    aliases: ['Butylated Hydroxyanisole', 'E320'],
    severity: 7,
    category: 'Preservative',
    health_effects: ['Possible carcinogen', 'Endocrine disruption', 'Tumor growth'],
    banned_in: ['Japan', 'UK', 'EU (restricted)'],
    why_used: 'Prevents fats from going rancid'
  },
  {
    name: 'BHT',
    aliases: ['Butylated Hydroxytoluene', 'E321'],
    severity: 6,
    category: 'Preservative',
    health_effects: ['Possible carcinogen', 'Liver and kidney damage'],
    banned_in: ['Japan', 'Romania', 'Sweden', 'Australia'],
    why_used: 'Antioxidant preservative'
  },
  {
    name: 'TBHQ',
    aliases: ['Tertiary Butylhydroquinone', 'E319'],
    severity: 7,
    category: 'Preservative',
    health_effects: ['Nausea', 'ADHD symptoms', 'Immune system effects'],
    banned_in: ['Japan'],
    why_used: 'Extends shelf life of oils and fats'
  },
  {
    name: 'Potassium Bromate',
    aliases: ['Bromated Flour', 'E924'],
    severity: 9,
    category: 'Dough Conditioner',
    health_effects: ['Known carcinogen', 'Kidney damage', 'Thyroid issues'],
    banned_in: ['EU', 'UK', 'Canada', 'Brazil', 'China', 'India'],
    why_used: 'Makes bread rise higher and look whiter'
  },
  {
    name: 'Azodicarbonamide',
    aliases: ['ADA', 'E927a'],
    severity: 7,
    category: 'Dough Conditioner',
    health_effects: ['Respiratory issues', 'Asthma trigger', 'Possible carcinogen'],
    banned_in: ['EU', 'UK', 'Australia', 'Singapore'],
    why_used: 'Bleaches flour, improves bread texture'
  },
  {
    name: 'Carrageenan',
    aliases: ['E407', 'Irish Moss Extract'],
    severity: 5,
    category: 'Thickener/Stabilizer',
    health_effects: ['Gut inflammation', 'Digestive issues', 'Possible colon cancer link'],
    banned_in: ['EU (in infant formula)'],
    why_used: 'Thickens and stabilizes products cheaply'
  },
  {
    name: 'Propyl Paraben',
    aliases: ['E217', 'Propylparaben'],
    severity: 7,
    category: 'Preservative',
    health_effects: ['Endocrine disruption', 'Hormone interference', 'Reproductive issues'],
    banned_in: ['EU (in food)'],
    why_used: 'Antimicrobial preservative'
  },
  {
    name: 'Titanium Dioxide',
    aliases: ['E171', 'TiO2'],
    severity: 6,
    category: 'Whitening Agent',
    health_effects: ['Intestinal inflammation', 'Immune system effects', 'Possible carcinogen'],
    banned_in: ['EU', 'France'],
    why_used: 'Makes products white and opaque'
  },
  {
    name: 'Sodium Benzoate',
    aliases: ['E211', 'Benzoate of Soda'],
    severity: 5,
    category: 'Preservative',
    health_effects: ['Forms benzene with vitamin C', 'Hyperactivity', 'Allergic reactions'],
    banned_in: [],
    why_used: 'Prevents mold growth in acidic foods'
  },
  {
    name: 'Partially Hydrogenated Oil',
    aliases: ['Trans Fat', 'PHO', 'Margarine'],
    severity: 9,
    category: 'Fat',
    health_effects: ['Heart disease', 'Stroke', 'Type 2 diabetes', 'Inflammation'],
    banned_in: ['USA', 'Canada', 'Denmark', 'Switzerland', 'Austria'],
    why_used: 'Extends shelf life, improves texture cheaply'
  },
  {
    name: 'MSG',
    aliases: ['Monosodium Glutamate', 'E621', 'Hydrolyzed Protein'],
    severity: 4,
    category: 'Flavor Enhancer',
    health_effects: ['Headaches', 'Flushing', 'Obesity link'],
    banned_in: [],
    why_used: 'Enhances savory flavor cheaply'
  },
  {
    name: 'Artificial Vanilla',
    aliases: ['Vanillin', 'Ethyl Vanillin'],
    severity: 3,
    category: 'Artificial Flavor',
    health_effects: ['Allergic reactions in sensitive individuals'],
    banned_in: [],
    why_used: '20x cheaper than real vanilla'
  },
  {
    name: 'Polysorbate 80',
    aliases: ['E433', 'Tween 80'],
    severity: 5,
    category: 'Emulsifier',
    health_effects: ['Gut inflammation', 'Metabolic syndrome'],
    banned_in: [],
    why_used: 'Emulsifier and stabilizer'
  },
  {
    name: 'Caramel Color',
    aliases: ['E150a', 'E150b', 'E150c', 'E150d', '4-MEI'],
    severity: 5,
    category: 'Coloring',
    health_effects: ['Contains 4-MEI (possible carcinogen)', 'Immune effects'],
    banned_in: [],
    why_used: 'Adds brown color to sodas and foods'
  },
  {
    name: 'Acesulfame Potassium',
    aliases: ['Ace-K', 'E950', 'Sunett'],
    severity: 5,
    category: 'Artificial Sweetener',
    health_effects: ['Possible carcinogen', 'Affects prenatal development'],
    banned_in: [],
    why_used: 'Zero-calorie sweetener'
  },
  {
    name: 'Saccharin',
    aliases: ['E954', 'Sweet N Low'],
    severity: 5,
    category: 'Artificial Sweetener',
    health_effects: ['Bladder cancer in animal studies', 'Gut bacteria disruption'],
    banned_in: ['Canada (was banned)'],
    why_used: 'Oldest artificial sweetener, very cheap'
  }
];

// ============================================
// COMPANIES DATABASE (30+ companies)
// ============================================
const companies = [
  {
    name: 'Mars, Inc.',
    parent_company: null,
    behavior_score: 25,
    controversies: [
      'Child labor in cocoa supply chain',
      'Heavy marketing to children',
      'Resisted front-of-package labeling'
    ],
    positive_actions: ['Committed to sustainable cocoa by 2025'],
    lobbying_history: 'Lobbied against sugar taxes and marketing restrictions',
    transparency_rating: 'poor'
  },
  {
    name: 'Kellogg\'s',
    parent_company: null,
    behavior_score: 30,
    controversies: [
      'Excessive sugar in kids cereals',
      'Misleading health claims',
      'Labor disputes'
    ],
    positive_actions: ['Reduced sugar in some products', 'Sustainable sourcing goals'],
    lobbying_history: 'Lobbied against nutrition labeling requirements',
    transparency_rating: 'poor'
  },
  {
    name: 'General Mills',
    parent_company: null,
    behavior_score: 35,
    controversies: [
      'Glyphosate residue in cereals',
      'Misleading "natural" claims',
      'High sugar content'
    ],
    positive_actions: ['Organic Annie\'s brand', 'Sustainability commitments'],
    lobbying_history: 'Lobbied against GMO labeling',
    transparency_rating: 'moderate'
  },
  {
    name: 'PepsiCo',
    parent_company: null,
    behavior_score: 30,
    controversies: [
      'Marketing sugary drinks to children',
      'Water usage in drought areas',
      'Palm oil deforestation'
    ],
    positive_actions: ['Reduced sodium and sugar goals', 'SodaStream acquisition'],
    lobbying_history: 'Major lobbying against soda taxes',
    transparency_rating: 'moderate'
  },
  {
    name: 'Frito-Lay',
    parent_company: 'PepsiCo',
    behavior_score: 30,
    controversies: ['Ultra-processed products', 'Excessive sodium', 'Marketing to children'],
    positive_actions: ['Some reduced-sodium options'],
    lobbying_history: 'Via PepsiCo parent',
    transparency_rating: 'moderate'
  },
  {
    name: 'Kraft Heinz',
    parent_company: null,
    behavior_score: 35,
    controversies: [
      'Lunchables marketed as healthy school lunch',
      'Artificial ingredients in kids foods',
      'Sodium content'
    ],
    positive_actions: ['Removed artificial colors from some products'],
    lobbying_history: 'Lobbied against front-of-package labeling',
    transparency_rating: 'moderate'
  },
  {
    name: 'Coca-Cola',
    parent_company: null,
    behavior_score: 25,
    controversies: [
      'Funding biased research',
      'Marketing to children globally',
      'Water rights disputes',
      'Plastic pollution'
    ],
    positive_actions: ['Some reduced sugar products'],
    lobbying_history: 'Extensive lobbying against sugar taxes worldwide',
    transparency_rating: 'poor'
  },
  {
    name: 'Honest Company',
    parent_company: null,
    behavior_score: 80,
    controversies: ['Some ingredient sourcing questions'],
    positive_actions: ['Transparent labeling', 'Clean ingredients focus', 'B-Corp certified'],
    lobbying_history: 'Advocates for cleaner products',
    transparency_rating: 'excellent'
  },
  {
    name: 'Annie\'s',
    parent_company: 'General Mills',
    behavior_score: 75,
    controversies: ['Owned by General Mills'],
    positive_actions: ['Organic focus', 'No artificial ingredients', 'Regenerative agriculture'],
    lobbying_history: 'Via parent company',
    transparency_rating: 'good'
  },
  {
    name: 'Three Wishes',
    parent_company: null,
    behavior_score: 95,
    controversies: [],
    positive_actions: ['Grain-free', 'Low sugar', 'Clean label', 'Transparent sourcing'],
    lobbying_history: 'None',
    transparency_rating: 'excellent'
  },
  {
    name: 'Serenity Kids',
    parent_company: null,
    behavior_score: 95,
    controversies: [],
    positive_actions: ['Meat-based baby food', 'Regenerative farms', 'No added sugar'],
    lobbying_history: 'Advocates for clean baby food',
    transparency_rating: 'excellent'
  },
  {
    name: 'Unreal Candy',
    parent_company: null,
    behavior_score: 90,
    controversies: [],
    positive_actions: ['No artificial colors', 'Fair trade chocolate', 'Less sugar'],
    lobbying_history: 'None',
    transparency_rating: 'excellent'
  },
  {
    name: 'Gerber',
    parent_company: 'Nestlé',
    behavior_score: 40,
    controversies: ['Heavy metals in baby food', 'Added sugars', 'Marketing practices'],
    positive_actions: ['Some organic options'],
    lobbying_history: 'Via Nestlé parent',
    transparency_rating: 'moderate'
  },
  {
    name: 'Nestlé',
    parent_company: null,
    behavior_score: 20,
    controversies: [
      'Infant formula scandal',
      'Water privatization',
      'Child labor',
      'Deforestation'
    ],
    positive_actions: ['Some sustainability commitments'],
    lobbying_history: 'Extensive lobbying globally',
    transparency_rating: 'poor'
  },
  {
    name: 'KIND',
    parent_company: 'Mars, Inc.',
    behavior_score: 65,
    controversies: ['Now owned by Mars', 'Some high sugar products'],
    positive_actions: ['Whole ingredients visible', 'No artificial sweeteners'],
    lobbying_history: 'Advocated for clearer labeling',
    transparency_rating: 'good'
  },
  {
    name: 'Cascadian Farm',
    parent_company: 'General Mills',
    behavior_score: 70,
    controversies: ['Owned by General Mills'],
    positive_actions: ['Organic certification', 'No artificial ingredients'],
    lobbying_history: 'Via parent company',
    transparency_rating: 'good'
  },
  {
    name: 'Pirate\'s Booty',
    parent_company: 'B&G Foods',
    behavior_score: 70,
    controversies: ['Some misleading health claims historically'],
    positive_actions: ['No artificial colors/flavors', 'Baked not fried'],
    lobbying_history: 'Minimal',
    transparency_rating: 'good'
  },
  {
    name: 'Welch\'s',
    parent_company: null,
    behavior_score: 50,
    controversies: ['High sugar content', 'Misleading fruit claims'],
    positive_actions: ['Real fruit juice', 'Farmer-owned cooperative'],
    lobbying_history: 'Minimal',
    transparency_rating: 'moderate'
  },
  {
    name: 'Capri Sun',
    parent_company: 'Kraft Heinz',
    behavior_score: 40,
    controversies: ['High sugar', 'Mold contamination issues', 'Environmental packaging'],
    positive_actions: ['Removed artificial colors', 'Organic line launched'],
    lobbying_history: 'Via parent company',
    transparency_rating: 'moderate'
  },
  {
    name: 'Horizon Organic',
    parent_company: 'Danone',
    behavior_score: 65,
    controversies: ['Factory farm accusations', 'Owned by large corporation'],
    positive_actions: ['Organic certification', 'No artificial ingredients'],
    lobbying_history: 'Minimal',
    transparency_rating: 'good'
  }
];

// ============================================
// PRODUCTS DATABASE (sample products)
// ============================================
const products = [
  // BAD PRODUCTS (0-30 score)
  {
    upc: '040000003441',
    name: 'Original Skittles',
    brand: 'Skittles',
    company: 'Mars, Inc.',
    category: 'Candy',
    subcategory: 'Chewy Candy',
    harmful_ingredients_score: 5,
    banned_elsewhere_score: 10,
    transparency_score: 20,
    processing_score: 5,
    company_behavior_score: 25,
    ingredients: 'Sugar, Corn Syrup, Hydrogenated Palm Kernel Oil, Citric Acid, Tapioca Dextrin, Modified Corn Starch, Natural and Artificial Flavors, Red 40, Titanium Dioxide, Red 40 Lake, Yellow 5 Lake, Yellow 5, Yellow 6 Lake, Yellow 6, Blue 2 Lake, Blue 1, Blue 1 Lake, Sodium Citrate, Carnauba Wax',
    harmful_ingredients_found: ['Red 40', 'Yellow 5', 'Yellow 6', 'Blue 1', 'Blue 2', 'Titanium Dioxide'],
    is_clean_alternative: false,
    swaps_to: ['040000003445'],
    typical_price: 3.49
  },
  {
    upc: '038000219818',
    name: 'Froot Loops',
    brand: 'Kellogg\'s',
    company: 'Kellogg\'s',
    category: 'Cereal',
    subcategory: 'Kids Cereal',
    harmful_ingredients_score: 10,
    banned_elsewhere_score: 15,
    transparency_score: 20,
    processing_score: 10,
    company_behavior_score: 30,
    ingredients: 'Corn flour blend, Sugar, Wheat flour, Whole grain oat flour, Modified food starch, Oat fiber, Salt, Soluble corn fiber, Natural flavor, Red 40, Blue 1, Yellow 6, BHT',
    harmful_ingredients_found: ['Red 40', 'Blue 1', 'Yellow 6', 'BHT'],
    is_clean_alternative: false,
    swaps_to: ['850015717017'],
    typical_price: 5.29
  },
  {
    upc: '016000275546',
    name: 'Lucky Charms',
    brand: 'General Mills',
    company: 'General Mills',
    category: 'Cereal',
    subcategory: 'Kids Cereal',
    harmful_ingredients_score: 15,
    banned_elsewhere_score: 20,
    transparency_score: 25,
    processing_score: 15,
    company_behavior_score: 35,
    ingredients: 'Whole Grain Oats, Sugar, Corn Starch, Modified Corn Starch, Corn Syrup, Dextrose, Salt, Red 40, Yellow 5 & 6, Blue 1, Natural and Artificial Flavor, Trisodium Phosphate',
    harmful_ingredients_found: ['Red 40', 'Yellow 5', 'Yellow 6', 'Blue 1'],
    is_clean_alternative: false,
    swaps_to: ['850015717017'],
    typical_price: 5.49
  },
  {
    upc: '028400090568',
    name: 'Crunchy Cheetos',
    brand: 'Cheetos',
    company: 'Frito-Lay',
    category: 'Snacks',
    subcategory: 'Chips',
    harmful_ingredients_score: 25,
    banned_elsewhere_score: 30,
    transparency_score: 35,
    processing_score: 25,
    company_behavior_score: 30,
    ingredients: 'Enriched Corn Meal, Vegetable Oil, Cheese Seasoning (Whey, Cheddar Cheese, Canola Oil, Maltodextrin, Natural and Artificial Flavors, Salt, MSG, Citric Acid, Artificial Color including Yellow 6, Lactic Acid)',
    harmful_ingredients_found: ['MSG', 'Yellow 6', 'Artificial Flavors'],
    is_clean_alternative: false,
    swaps_to: ['015665601004'],
    typical_price: 4.29
  },
  {
    upc: '034856001034',
    name: 'Welch\'s Fruit Snacks',
    brand: 'Welch\'s',
    company: 'Welch\'s',
    category: 'Snacks',
    subcategory: 'Fruit Snacks',
    harmful_ingredients_score: 35,
    banned_elsewhere_score: 45,
    transparency_score: 45,
    processing_score: 35,
    company_behavior_score: 50,
    ingredients: 'Fruit Puree, Corn Syrup, Sugar, Modified Corn Starch, Gelatin, Citric Acid, Natural and Artificial Flavors, Ascorbic Acid, Red 40, Blue 1',
    harmful_ingredients_found: ['Corn Syrup', 'Red 40', 'Blue 1'],
    is_clean_alternative: false,
    swaps_to: ['850000439412'],
    typical_price: 3.99
  },

  // MIDDLE PRODUCTS (50-70 score)
  {
    upc: '015000076160',
    name: 'Gerber Puffs Banana',
    brand: 'Gerber',
    company: 'Gerber',
    category: 'Baby Food',
    subcategory: 'Baby Snacks',
    harmful_ingredients_score: 65,
    banned_elsewhere_score: 70,
    transparency_score: 65,
    processing_score: 55,
    company_behavior_score: 40,
    ingredients: 'Rice Flour, Whole Wheat Flour, Whole Grain Oat Flour, Sugar, Banana Puree, Mixed Tocopherols, Sunflower Lecithin',
    harmful_ingredients_found: ['Sugar'],
    is_clean_alternative: false,
    swaps_to: ['860000826201'],
    typical_price: 4.29
  },
  {
    upc: '087684000175',
    name: 'Capri Sun Pacific Cooler',
    brand: 'Capri Sun',
    company: 'Capri Sun',
    category: 'Beverages',
    subcategory: 'Juice Drinks',
    harmful_ingredients_score: 55,
    banned_elsewhere_score: 80,
    transparency_score: 65,
    processing_score: 65,
    company_behavior_score: 40,
    ingredients: 'Water, High Fructose Corn Syrup, Pear and Grape Juice Concentrates, Citric Acid, Natural Flavor',
    harmful_ingredients_found: ['High Fructose Corn Syrup'],
    is_clean_alternative: false,
    swaps_to: ['657622101273'],
    typical_price: 3.99
  },
  {
    upc: '602652177071',
    name: 'KIND Kids Chewy Chocolate Chip',
    brand: 'KIND',
    company: 'KIND',
    category: 'Snacks',
    subcategory: 'Granola Bars',
    harmful_ingredients_score: 70,
    banned_elsewhere_score: 85,
    transparency_score: 75,
    processing_score: 60,
    company_behavior_score: 65,
    ingredients: 'Oats, Honey, Sugar, Palm Kernel Oil, Rice Flour, Chocolate Chips, Crisp Rice, Tapioca Syrup, Soy Lecithin, Natural Flavor, Salt',
    harmful_ingredients_found: [],
    is_clean_alternative: false,
    swaps_to: ['856575002018'],
    typical_price: 5.99
  },

  // GOOD PRODUCTS (71-85 score)
  {
    upc: '016000275867',
    name: 'Original Cheerios',
    brand: 'Cheerios',
    company: 'General Mills',
    category: 'Cereal',
    subcategory: 'Breakfast Cereal',
    harmful_ingredients_score: 85,
    banned_elsewhere_score: 90,
    transparency_score: 75,
    processing_score: 70,
    company_behavior_score: 35,
    ingredients: 'Whole Grain Oats, Corn Starch, Sugar, Salt, Tripotassium Phosphate, Vitamin E',
    harmful_ingredients_found: [],
    is_clean_alternative: true,
    swaps_to: [],
    typical_price: 5.49
  },
  {
    upc: '657622101273',
    name: 'Honest Kids Apple Juice',
    brand: 'Honest Company',
    company: 'Honest Company',
    category: 'Beverages',
    subcategory: 'Juice',
    harmful_ingredients_score: 80,
    banned_elsewhere_score: 90,
    transparency_score: 85,
    processing_score: 75,
    company_behavior_score: 80,
    ingredients: 'Filtered Water, Organic Apple Juice Concentrate, Organic Lemon Juice Concentrate, Natural Flavor',
    harmful_ingredients_found: [],
    is_clean_alternative: true,
    swaps_to: [],
    typical_price: 4.49
  },
  {
    upc: '015665601004',
    name: 'Pirate\'s Booty Aged White Cheddar',
    brand: 'Pirate\'s Booty',
    company: 'Pirate\'s Booty',
    category: 'Snacks',
    subcategory: 'Puffs',
    harmful_ingredients_score: 85,
    banned_elsewhere_score: 90,
    transparency_score: 80,
    processing_score: 75,
    company_behavior_score: 70,
    ingredients: 'Corn Meal, Rice Meal, Sunflower Oil, Cheddar Cheese, Whey, Salt, Citric Acid, Lactic Acid',
    harmful_ingredients_found: [],
    is_clean_alternative: true,
    swaps_to: [],
    typical_price: 4.99
  },
  {
    upc: '013562000043',
    name: 'Annie\'s Cheddar Bunnies',
    brand: 'Annie\'s',
    company: 'Annie\'s',
    category: 'Snacks',
    subcategory: 'Crackers',
    harmful_ingredients_score: 85,
    banned_elsewhere_score: 95,
    transparency_score: 85,
    processing_score: 80,
    company_behavior_score: 75,
    ingredients: 'Organic Wheat Flour, Sunflower Oil, Cheddar Cheese, Salt, Paprika',
    harmful_ingredients_found: [],
    is_clean_alternative: true,
    swaps_to: [],
    typical_price: 4.29
  },
  {
    upc: '021908501234',
    name: 'Cascadian Farm Organic Granola',
    brand: 'Cascadian Farm',
    company: 'Cascadian Farm',
    category: 'Cereal',
    subcategory: 'Granola',
    harmful_ingredients_score: 90,
    banned_elsewhere_score: 95,
    transparency_score: 85,
    processing_score: 80,
    company_behavior_score: 70,
    ingredients: 'Organic Whole Grain Oats, Organic Sugar, Organic Sunflower Oil, Organic Rice Flour, Organic Oat Flour, Salt',
    harmful_ingredients_found: [],
    is_clean_alternative: true,
    swaps_to: [],
    typical_price: 5.99
  },

  // EXCELLENT PRODUCTS (86-100 score)
  {
    upc: '040000003445',
    name: 'Unreal Dark Chocolate Gems',
    brand: 'Unreal Candy',
    company: 'Unreal Candy',
    category: 'Candy',
    subcategory: 'Chocolate',
    harmful_ingredients_score: 95,
    banned_elsewhere_score: 100,
    transparency_score: 90,
    processing_score: 85,
    company_behavior_score: 90,
    ingredients: 'Dark Chocolate, Organic Cane Sugar, Organic Tapioca Syrup, Organic Rice Syrup, Gum Arabic, Carnauba Wax, Colors (Beet Juice, Purple Carrot, Turmeric)',
    harmful_ingredients_found: [],
    is_clean_alternative: true,
    swaps_to: [],
    typical_price: 4.99
  },
  {
    upc: '850015717017',
    name: 'Three Wishes Cinnamon Cereal',
    brand: 'Three Wishes',
    company: 'Three Wishes',
    category: 'Cereal',
    subcategory: 'Breakfast Cereal',
    harmful_ingredients_score: 98,
    banned_elsewhere_score: 100,
    transparency_score: 95,
    processing_score: 90,
    company_behavior_score: 95,
    ingredients: 'Chickpea Flour, Pea Protein, Tapioca Starch, Cinnamon, Monk Fruit Extract, Salt',
    harmful_ingredients_found: [],
    is_clean_alternative: true,
    swaps_to: [],
    typical_price: 7.99
  },
  {
    upc: '860000826201',
    name: 'Serenity Kids Beef & Kale Puree',
    brand: 'Serenity Kids',
    company: 'Serenity Kids',
    category: 'Baby Food',
    subcategory: 'Baby Puree',
    harmful_ingredients_score: 98,
    banned_elsewhere_score: 100,
    transparency_score: 98,
    processing_score: 95,
    company_behavior_score: 95,
    ingredients: 'Grass-Fed Beef, Organic Butternut Squash, Organic Kale, Organic Olive Oil, Water',
    harmful_ingredients_found: [],
    is_clean_alternative: true,
    swaps_to: [],
    typical_price: 4.29
  }
];

// ============================================
// RECIPES DATABASE (homemade alternatives)
// ============================================
const recipes = [
  {
    name: 'Homemade Fruit Snacks',
    description: 'Healthy gummy snacks made with real fruit juice and no artificial colors',
    replaces_category: 'Fruit Snacks',
    replaces_products: ['034856001034'],
    prep_time_minutes: 10,
    cook_time_minutes: 5,
    total_time_minutes: 75,
    servings: 24,
    difficulty: 'easy',
    estimated_cost: 4.00,
    cost_per_serving: 0.17,
    ingredients: [
      { item: 'Fruit juice (100% juice)', amount: '1 cup', notes: 'Apple, grape, or berry work great' },
      { item: 'Gelatin powder', amount: '3 tbsp', notes: 'Or use agar for vegetarian version' },
      { item: 'Honey', amount: '2 tbsp', notes: 'Optional, adjust to taste' }
    ],
    instructions: [
      'Pour half the juice into a saucepan and sprinkle gelatin over it. Let bloom for 5 minutes.',
      'Heat gently while stirring until gelatin dissolves completely (do not boil).',
      'Remove from heat, add remaining juice and honey.',
      'Pour into silicone molds.',
      'Refrigerate for 1 hour until firm.',
      'Pop out and store in airtight container in fridge for up to 1 week.'
    ],
    tips: ['Use fun shaped molds to make them appealing to kids', 'Add a few drops of lemon juice for tartness'],
    health_benefits: ['No artificial colors', 'No high fructose corn syrup', 'Real fruit nutrients'],
    vs_store_bought: 'Zero artificial dyes vs. Red 40 and Blue 1 in Welch\'s. Uses real fruit juice.',
    kid_friendly: true,
    allergens: [],
    dietary_tags: ['gluten-free', 'no-artificial-colors']
  },
  {
    name: 'Crunchy Cheese Puffs',
    description: 'Baked cheesy puffs that satisfy the Cheetos craving without the junk',
    replaces_category: 'Chips',
    replaces_products: ['028400090568'],
    prep_time_minutes: 15,
    cook_time_minutes: 20,
    total_time_minutes: 35,
    servings: 6,
    difficulty: 'medium',
    estimated_cost: 3.50,
    cost_per_serving: 0.58,
    ingredients: [
      { item: 'Puffed corn or rice cereal', amount: '4 cups', notes: 'Plain, unsweetened' },
      { item: 'Butter', amount: '2 tbsp', notes: 'Melted' },
      { item: 'Sharp cheddar powder', amount: '1/4 cup', notes: 'Or blend dried cheddar' },
      { item: 'Nutritional yeast', amount: '2 tbsp', notes: 'For extra cheesy flavor' },
      { item: 'Paprika', amount: '1/2 tsp', notes: '' },
      { item: 'Salt', amount: '1/4 tsp', notes: '' }
    ],
    instructions: [
      'Preheat oven to 300°F.',
      'Mix cheddar powder, nutritional yeast, paprika, and salt in a small bowl.',
      'Toss puffed cereal with melted butter in a large bowl.',
      'Sprinkle cheese mixture over cereal and toss until evenly coated.',
      'Spread on baking sheet in single layer.',
      'Bake 15-20 minutes, stirring halfway, until crispy.',
      'Cool completely before storing in airtight container.'
    ],
    tips: ['Add a pinch of cayenne for adult version', 'Make extra cheese powder to keep on hand'],
    health_benefits: ['No MSG', 'No artificial colors', 'Baked not fried', 'Real cheese'],
    vs_store_bought: 'Real cheese vs. artificial flavors and Yellow 6. No MSG.',
    kid_friendly: true,
    allergens: ['dairy'],
    dietary_tags: ['gluten-free', 'vegetarian']
  },
  {
    name: '3-Ingredient Rainbow Cereal',
    description: 'A colorful breakfast cereal using natural colors from real foods',
    replaces_category: 'Kids Cereal',
    replaces_products: ['038000219818', '016000275546'],
    prep_time_minutes: 20,
    cook_time_minutes: 15,
    total_time_minutes: 35,
    servings: 8,
    difficulty: 'medium',
    estimated_cost: 5.00,
    cost_per_serving: 0.63,
    ingredients: [
      { item: 'Oat flour', amount: '2 cups', notes: 'Blend oats to make your own' },
      { item: 'Maple syrup', amount: '1/3 cup', notes: '' },
      { item: 'Coconut oil', amount: '2 tbsp', notes: 'Melted' },
      { item: 'Beet powder', amount: '1/2 tsp', notes: 'For pink/red' },
      { item: 'Turmeric', amount: '1/4 tsp', notes: 'For yellow' },
      { item: 'Spirulina', amount: '1/4 tsp', notes: 'For green' },
      { item: 'Butterfly pea powder', amount: '1/4 tsp', notes: 'For blue, or use blueberry' }
    ],
    instructions: [
      'Preheat oven to 325°F.',
      'Mix oat flour, maple syrup, and coconut oil into a dough.',
      'Divide dough into 4 portions.',
      'Add different natural color to each portion and knead.',
      'Roll each portion thin and cut into small O shapes.',
      'Bake 12-15 minutes until crispy.',
      'Cool completely. Mix colors together.'
    ],
    tips: ['Use mini cookie cutters for fun shapes', 'Store in airtight container for up to 2 weeks'],
    health_benefits: ['No artificial dyes', 'Whole grain oats', 'Natural sweetener'],
    vs_store_bought: 'Natural colors vs. Red 40, Yellow 5, Blue 1. Real oats vs. refined flour.',
    kid_friendly: true,
    allergens: ['gluten'],
    dietary_tags: ['vegan', 'no-artificial-colors']
  },
  {
    name: 'Healthy Gummy Bears',
    description: 'Fun gummy candies made with real fruit that kids love',
    replaces_category: 'Candy',
    replaces_products: ['040000003441'],
    prep_time_minutes: 15,
    cook_time_minutes: 5,
    total_time_minutes: 90,
    servings: 40,
    difficulty: 'easy',
    estimated_cost: 5.00,
    cost_per_serving: 0.13,
    ingredients: [
      { item: 'Fresh strawberries', amount: '1 cup', notes: 'For red gummies' },
      { item: 'Fresh mango', amount: '1 cup', notes: 'For orange gummies' },
      { item: 'Fresh blueberries', amount: '1 cup', notes: 'For purple gummies' },
      { item: 'Grass-fed gelatin', amount: '4 tbsp', notes: '' },
      { item: 'Honey', amount: '2 tbsp', notes: 'To taste' }
    ],
    instructions: [
      'Blend each fruit separately until smooth.',
      'For each color: strain puree, add to small saucepan with 1 tbsp gelatin.',
      'Heat gently while stirring until gelatin dissolves.',
      'Add honey to taste.',
      'Pour into gummy bear molds.',
      'Refrigerate 1 hour until set.',
      'Pop out and enjoy!'
    ],
    tips: ['Make all three colors for a rainbow mix', 'Keep refrigerated for best texture'],
    health_benefits: ['100% real fruit', 'No artificial colors', 'No refined sugar', 'Protein from gelatin'],
    vs_store_bought: 'Real fruit vs. corn syrup and artificial dyes. Zero synthetic chemicals.',
    kid_friendly: true,
    allergens: [],
    dietary_tags: ['gluten-free', 'no-artificial-colors', 'refined-sugar-free']
  },
  {
    name: 'Clean Juice Boxes',
    description: 'Homemade juice pouches with way less sugar than store-bought',
    replaces_category: 'Juice Drinks',
    replaces_products: ['087684000175'],
    prep_time_minutes: 5,
    cook_time_minutes: 0,
    total_time_minutes: 5,
    servings: 4,
    difficulty: 'easy',
    estimated_cost: 3.00,
    cost_per_serving: 0.75,
    ingredients: [
      { item: 'Fresh oranges', amount: '4 medium', notes: 'Or any fruit' },
      { item: 'Water', amount: '1 cup', notes: 'To dilute' },
      { item: 'Reusable juice pouches', amount: '4', notes: 'One-time purchase' }
    ],
    instructions: [
      'Juice the oranges (or blend and strain other fruits).',
      'Mix with water to dilute (50/50 ratio cuts sugar in half).',
      'Pour into reusable pouches.',
      'Refrigerate and use within 3 days.',
      'For travel, freeze overnight and pack - thaws by lunch!'
    ],
    tips: ['Mix fruits for variety', 'Add a splash of lime for tartness', 'Freeze extras as popsicles'],
    health_benefits: ['No high fructose corn syrup', '50% less sugar when diluted', 'Fresh vitamin C', 'No preservatives'],
    vs_store_bought: 'Real fruit vs. HFCS and concentrate. Zero additives.',
    kid_friendly: true,
    allergens: [],
    dietary_tags: ['vegan', 'gluten-free', 'no-added-sugar']
  },
  {
    name: 'Protein-Packed Baby Puffs',
    description: 'Nutritious puffs for babies with hidden veggies',
    replaces_category: 'Baby Snacks',
    replaces_products: ['015000076160'],
    prep_time_minutes: 15,
    cook_time_minutes: 12,
    total_time_minutes: 30,
    servings: 30,
    difficulty: 'medium',
    estimated_cost: 3.00,
    cost_per_serving: 0.10,
    ingredients: [
      { item: 'Oat flour', amount: '1 cup', notes: 'Baby oatmeal works too' },
      { item: 'Sweet potato puree', amount: '1/4 cup', notes: 'Cooked and mashed' },
      { item: 'Banana', amount: '1 small', notes: 'Very ripe' },
      { item: 'Egg', amount: '1', notes: 'For binding' },
      { item: 'Cinnamon', amount: '1/4 tsp', notes: 'Optional' }
    ],
    instructions: [
      'Preheat oven to 375°F.',
      'Mash banana with sweet potato puree.',
      'Mix in oat flour and egg until smooth batter forms.',
      'Add cinnamon if using.',
      'Pipe or drop tiny dots onto parchment-lined baking sheet.',
      'Bake 10-12 minutes until puffed and golden.',
      'Cool completely - they crisp up as they cool.'
    ],
    tips: ['Use a piping bag for uniform size', 'Freeze extras for later'],
    health_benefits: ['No added sugar', 'Hidden veggies', 'Whole grains', 'Protein from egg'],
    vs_store_bought: 'Zero added sugar vs. sugar in ingredient list. Hidden vegetables for nutrition.',
    kid_friendly: true,
    allergens: ['gluten', 'eggs'],
    dietary_tags: ['no-added-sugar', 'homemade']
  },
  {
    name: 'Homemade Granola Bars',
    description: 'Chewy, customizable granola bars without the corn syrup',
    replaces_category: 'Snack Bars',
    replaces_products: ['0016000264601', '0038000358210'],
    prep_time_minutes: 10,
    cook_time_minutes: 25,
    total_time_minutes: 35,
    servings: 12,
    difficulty: 'easy',
    estimated_cost: 6.00,
    cost_per_serving: 0.50,
    ingredients: [
      { item: 'Rolled oats', amount: '2 cups', notes: '' },
      { item: 'Honey', amount: '1/3 cup', notes: 'Or maple syrup' },
      { item: 'Peanut butter', amount: '1/3 cup', notes: 'Natural, no sugar added' },
      { item: 'Coconut oil', amount: '2 tbsp', notes: 'Melted' },
      { item: 'Vanilla extract', amount: '1 tsp', notes: '' },
      { item: 'Chocolate chips', amount: '1/3 cup', notes: 'Optional' },
      { item: 'Dried cranberries', amount: '1/4 cup', notes: 'Optional' }
    ],
    instructions: [
      'Preheat oven to 325°F and line an 8x8 pan with parchment.',
      'Mix honey, peanut butter, coconut oil, and vanilla in a saucepan over low heat.',
      'Stir oats into the wet mixture until fully coated.',
      'Fold in chocolate chips and cranberries.',
      'Press firmly into prepared pan.',
      'Bake 25 minutes until edges are golden.',
      'Cool completely before cutting into 12 bars.'
    ],
    tips: ['Press HARD — loose bars crumble', 'Freeze for best texture', 'Sub any nut butter'],
    health_benefits: ['No high fructose corn syrup', 'Whole grain oats', 'Healthy fats from nuts', 'You control the sugar'],
    vs_store_bought: 'No HFCS, no artificial flavors, no BHT preservative. Half the sugar.',
    kid_friendly: true,
    allergens: ['peanuts', 'gluten'],
    dietary_tags: ['vegetarian', 'homemade']
  },
  {
    name: 'Easy Pasta Sauce',
    description: 'Simple tomato sauce that beats any jar — no added sugar',
    replaces_category: 'Pasta Sauce',
    replaces_products: ['0036200004449', '0051000012555'],
    prep_time_minutes: 5,
    cook_time_minutes: 30,
    total_time_minutes: 35,
    servings: 6,
    difficulty: 'easy',
    estimated_cost: 4.00,
    cost_per_serving: 0.67,
    ingredients: [
      { item: 'Canned crushed tomatoes', amount: '28 oz can', notes: 'San Marzano if available' },
      { item: 'Garlic cloves', amount: '4', notes: 'Minced' },
      { item: 'Olive oil', amount: '3 tbsp', notes: 'Good quality' },
      { item: 'Fresh basil', amount: '1/4 cup', notes: 'Or 1 tsp dried' },
      { item: 'Salt', amount: '1 tsp', notes: '' },
      { item: 'Red pepper flakes', amount: '1/4 tsp', notes: 'Optional' }
    ],
    instructions: [
      'Heat olive oil in a saucepan over medium heat.',
      'Sauté garlic for 30 seconds until fragrant (don\'t brown).',
      'Add crushed tomatoes, salt, and red pepper flakes.',
      'Simmer uncovered for 25-30 minutes, stirring occasionally.',
      'Tear in fresh basil during the last 5 minutes.',
      'Taste and adjust salt. Done.'
    ],
    tips: ['Double the batch and freeze in portions', 'Add a parmesan rind while simmering for depth'],
    health_benefits: ['No added sugar', 'No canola/soybean oil', 'Lycopene from tomatoes', 'You control the sodium'],
    vs_store_bought: 'Ragú and Prego add sugar and soybean oil. This has 5 whole ingredients.',
    kid_friendly: true,
    allergens: [],
    dietary_tags: ['vegan', 'gluten-free', 'whole30']
  },
  {
    name: 'Stovetop Mac and Cheese',
    description: 'Creamy mac with real cheese — ready in 15 minutes',
    replaces_category: 'Mac & Cheese',
    replaces_products: ['0021000658831', '0021000672257'],
    prep_time_minutes: 5,
    cook_time_minutes: 12,
    total_time_minutes: 17,
    servings: 4,
    difficulty: 'easy',
    estimated_cost: 5.00,
    cost_per_serving: 1.25,
    ingredients: [
      { item: 'Elbow pasta', amount: '8 oz', notes: '' },
      { item: 'Sharp cheddar', amount: '2 cups', notes: 'Freshly shredded' },
      { item: 'Whole milk', amount: '1 cup', notes: '' },
      { item: 'Butter', amount: '2 tbsp', notes: '' },
      { item: 'Salt and pepper', amount: 'To taste', notes: '' }
    ],
    instructions: [
      'Cook pasta 1 minute less than package directions. Reserve 1/2 cup pasta water.',
      'Drain and return to pot over low heat.',
      'Add butter and milk, stir until butter melts.',
      'Add cheese in handfuls, stirring between each.',
      'Add pasta water a splash at a time for desired creaminess.',
      'Season with salt and pepper.'
    ],
    tips: ['Shred your own cheese — pre-shredded has anti-caking agents that prevent melting', 'Add a pinch of mustard powder for depth'],
    health_benefits: ['Real cheese instead of cheese product', 'No Yellow 5 or Yellow 6', 'No sodium phosphate', 'Simple recognizable ingredients'],
    vs_store_bought: 'Kraft uses Yellow 5, Yellow 6, sodium phosphates, and "cheese product." This is actual food.',
    kid_friendly: true,
    allergens: ['milk', 'gluten'],
    dietary_tags: ['vegetarian', 'homemade']
  },
  {
    name: 'Overnight Oats',
    description: 'No-cook breakfast ready when you wake up',
    replaces_category: 'Instant Oatmeal',
    replaces_products: ['0030000311505'],
    prep_time_minutes: 5,
    cook_time_minutes: 0,
    total_time_minutes: 5,
    servings: 1,
    difficulty: 'easy',
    estimated_cost: 1.50,
    cost_per_serving: 1.50,
    ingredients: [
      { item: 'Rolled oats', amount: '1/2 cup', notes: '' },
      { item: 'Milk or yogurt', amount: '1/2 cup', notes: 'Any kind' },
      { item: 'Chia seeds', amount: '1 tbsp', notes: 'Optional but great' },
      { item: 'Honey or maple syrup', amount: '1 tsp', notes: '' },
      { item: 'Fresh berries', amount: '1/4 cup', notes: 'Or banana slices' }
    ],
    instructions: [
      'Combine oats, milk, and chia seeds in a jar.',
      'Add honey and stir.',
      'Cover and refrigerate overnight (or at least 4 hours).',
      'Top with fresh fruit in the morning.',
      'Eat cold or microwave 1-2 minutes if you prefer warm.'
    ],
    tips: ['Prep 5 jars on Sunday for the whole week', 'PB&J version: add PB and jam'],
    health_benefits: ['Whole grains', 'Fiber from oats and chia', 'No artificial flavors', 'Control your own sugar'],
    vs_store_bought: 'Quaker instant packets have 12g added sugar per serving. This has 4g from honey.',
    kid_friendly: true,
    allergens: [],
    dietary_tags: ['vegetarian', 'high-fiber']
  },
  {
    name: 'Homemade Ranch Dressing',
    description: 'Creamy ranch without the MSG and preservatives',
    replaces_category: 'Salad Dressing',
    replaces_products: ['0071100002867'],
    prep_time_minutes: 5,
    cook_time_minutes: 0,
    total_time_minutes: 5,
    servings: 8,
    difficulty: 'easy',
    estimated_cost: 3.00,
    cost_per_serving: 0.38,
    ingredients: [
      { item: 'Greek yogurt', amount: '1/2 cup', notes: 'Plain, full fat' },
      { item: 'Mayonnaise', amount: '1/4 cup', notes: 'Avocado oil mayo preferred' },
      { item: 'Fresh dill', amount: '1 tbsp', notes: 'Chopped' },
      { item: 'Garlic powder', amount: '1/2 tsp', notes: '' },
      { item: 'Onion powder', amount: '1/2 tsp', notes: '' },
      { item: 'Lemon juice', amount: '1 tbsp', notes: 'Fresh' },
      { item: 'Milk', amount: '2 tbsp', notes: 'To thin' },
      { item: 'Salt and pepper', amount: 'To taste', notes: '' }
    ],
    instructions: [
      'Whisk all ingredients together in a bowl.',
      'Add milk to reach desired consistency.',
      'Taste and adjust salt/lemon.',
      'Refrigerate 30 minutes for flavors to meld.',
      'Keeps 5-7 days in fridge.'
    ],
    tips: ['Add fresh chives for extra flavor', 'Works as veggie dip too'],
    health_benefits: ['No MSG', 'No calcium disodium EDTA', 'No artificial flavors', 'Probiotic benefit from yogurt'],
    vs_store_bought: 'Hidden Valley contains MSG, calcium disodium EDTA, phosphoric acid, and artificial flavors.',
    kid_friendly: true,
    allergens: ['milk', 'eggs'],
    dietary_tags: ['gluten-free', 'vegetarian']
  },
  {
    name: 'Air-Fryer Chicken Nuggets',
    description: 'Crispy nuggets with real chicken — freezer friendly',
    replaces_category: 'Frozen Meals',
    replaces_products: ['0021130095186'],
    prep_time_minutes: 15,
    cook_time_minutes: 12,
    total_time_minutes: 27,
    servings: 4,
    difficulty: 'easy',
    estimated_cost: 6.00,
    cost_per_serving: 1.50,
    ingredients: [
      { item: 'Chicken breast', amount: '1 lb', notes: 'Cut into nugget-sized pieces' },
      { item: 'Panko breadcrumbs', amount: '1 cup', notes: '' },
      { item: 'Parmesan cheese', amount: '1/4 cup', notes: 'Grated' },
      { item: 'Eggs', amount: '2', notes: 'Beaten' },
      { item: 'Garlic powder', amount: '1 tsp', notes: '' },
      { item: 'Paprika', amount: '1/2 tsp', notes: '' },
      { item: 'Salt', amount: '1/2 tsp', notes: '' },
      { item: 'Olive oil spray', amount: '', notes: '' }
    ],
    instructions: [
      'Mix panko, parmesan, garlic powder, paprika, and salt in a bowl.',
      'Dip chicken pieces in egg, then coat in breadcrumb mixture.',
      'Place in air fryer basket in a single layer. Spray with olive oil.',
      'Air fry at 400°F for 10-12 minutes, flipping halfway.',
      'Internal temp should reach 165°F.'
    ],
    tips: ['Flash freeze on a sheet pan, then bag for weeknight dinners', 'Works in oven at 425°F for 18-20 min too'],
    health_benefits: ['Real chicken breast', 'No TBHQ preservative', 'No sodium phosphates', 'You control the ingredients'],
    vs_store_bought: 'Banquet nuggets contain TBHQ, sodium phosphates, and mechanically separated chicken.',
    kid_friendly: true,
    allergens: ['gluten', 'eggs', 'milk'],
    dietary_tags: ['high-protein', 'homemade']
  },
  {
    name: 'Natural Sports Drink',
    description: 'Electrolyte drink without artificial colors',
    replaces_category: 'Sports Drinks',
    replaces_products: ['0052000043372'],
    prep_time_minutes: 3,
    cook_time_minutes: 0,
    total_time_minutes: 3,
    servings: 4,
    difficulty: 'easy',
    estimated_cost: 2.00,
    cost_per_serving: 0.50,
    ingredients: [
      { item: 'Water', amount: '4 cups', notes: '' },
      { item: 'Fresh orange juice', amount: '1/4 cup', notes: '' },
      { item: 'Fresh lemon juice', amount: '2 tbsp', notes: '' },
      { item: 'Honey', amount: '2 tbsp', notes: '' },
      { item: 'Sea salt', amount: '1/4 tsp', notes: 'For electrolytes' }
    ],
    instructions: [
      'Combine all ingredients in a pitcher.',
      'Stir until honey dissolves.',
      'Chill and serve.',
      'Shake before pouring.'
    ],
    tips: ['Add coconut water for extra potassium', 'Freeze in ice cube trays for slushy version'],
    health_benefits: ['No artificial colors', 'No Red 40 or Yellow 5', 'Real fruit juice', 'Fraction of the sugar'],
    vs_store_bought: 'Gatorade contains Red 40, Yellow 5, and 34g sugar per bottle. This has 8g.',
    kid_friendly: true,
    allergens: [],
    dietary_tags: ['vegan', 'gluten-free']
  },
  {
    name: 'Peanut Butter Energy Bites',
    description: 'No-bake protein balls — perfect lunchbox snack',
    replaces_category: 'Candy',
    replaces_products: ['0040000424147', '0034000002412'],
    prep_time_minutes: 10,
    cook_time_minutes: 0,
    total_time_minutes: 10,
    servings: 20,
    difficulty: 'easy',
    estimated_cost: 5.00,
    cost_per_serving: 0.25,
    ingredients: [
      { item: 'Peanut butter', amount: '1 cup', notes: 'Natural' },
      { item: 'Rolled oats', amount: '1 cup', notes: '' },
      { item: 'Honey', amount: '1/3 cup', notes: '' },
      { item: 'Mini chocolate chips', amount: '1/2 cup', notes: '' },
      { item: 'Flaxseed', amount: '2 tbsp', notes: 'Ground' }
    ],
    instructions: [
      'Mix all ingredients in a large bowl.',
      'Refrigerate 30 minutes until firm enough to roll.',
      'Roll into 1-inch balls.',
      'Store in fridge for up to a week or freeze for a month.'
    ],
    tips: ['Roll in shredded coconut for variety', 'Use SunButter for nut-free version'],
    health_benefits: ['Protein from peanut butter', 'Fiber from oats and flax', 'No PGPR or TBHQ', 'Omega-3 from flaxseed'],
    vs_store_bought: 'Reese\'s cups contain PGPR, TBHQ, and soy lecithin. These have 5 whole ingredients.',
    kid_friendly: true,
    allergens: ['peanuts', 'gluten'],
    dietary_tags: ['vegetarian', 'high-protein']
  },
  {
    name: 'Homemade Tortilla Chips',
    description: 'Crispy baked chips from corn tortillas',
    replaces_category: 'Chips',
    replaces_products: ['0028400064545', '0028400083683'],
    prep_time_minutes: 5,
    cook_time_minutes: 12,
    total_time_minutes: 17,
    servings: 4,
    difficulty: 'easy',
    estimated_cost: 2.00,
    cost_per_serving: 0.50,
    ingredients: [
      { item: 'Corn tortillas', amount: '8', notes: '' },
      { item: 'Olive oil or avocado oil', amount: '1 tbsp', notes: '' },
      { item: 'Salt', amount: '1/2 tsp', notes: '' },
      { item: 'Lime juice', amount: '1 tsp', notes: 'Optional' }
    ],
    instructions: [
      'Preheat oven to 375°F.',
      'Brush tortillas lightly with oil on both sides.',
      'Stack and cut into 6 triangles each.',
      'Spread in a single layer on baking sheets.',
      'Sprinkle with salt and optional lime juice.',
      'Bake 10-12 minutes until crispy and golden.'
    ],
    tips: ['Watch closely — they go from perfect to burnt fast', 'Season with chili powder for a Doritos vibe'],
    health_benefits: ['No maltodextrin', 'No MSG', 'No artificial colors', '3 ingredients vs 30+'],
    vs_store_bought: 'Doritos have 30+ ingredients including MSG, Red 40, Yellow 6, and maltodextrin.',
    kid_friendly: true,
    allergens: [],
    dietary_tags: ['vegan', 'gluten-free']
  },
  {
    name: 'Quick Pickled Vegetables',
    description: 'Crunchy pickled veggies without artificial preservatives',
    replaces_category: 'Condiments',
    replaces_products: [],
    prep_time_minutes: 10,
    cook_time_minutes: 5,
    total_time_minutes: 15,
    servings: 8,
    difficulty: 'easy',
    estimated_cost: 3.00,
    cost_per_serving: 0.38,
    ingredients: [
      { item: 'Cucumbers or carrots', amount: '2 cups', notes: 'Sliced' },
      { item: 'White vinegar', amount: '1 cup', notes: '' },
      { item: 'Water', amount: '1 cup', notes: '' },
      { item: 'Sugar', amount: '2 tbsp', notes: '' },
      { item: 'Salt', amount: '1 tbsp', notes: '' },
      { item: 'Garlic', amount: '2 cloves', notes: 'Smashed' },
      { item: 'Peppercorns', amount: '1 tsp', notes: '' }
    ],
    instructions: [
      'Pack sliced vegetables into a clean jar.',
      'Heat vinegar, water, sugar, salt in a saucepan until dissolved.',
      'Add garlic and peppercorns to the jar.',
      'Pour hot brine over vegetables.',
      'Cool to room temperature, then refrigerate.',
      'Ready in 1 hour, best after 24 hours. Keeps 2 weeks.'
    ],
    tips: ['Add dill, mustard seeds, or red pepper flakes for variety', 'Pickle onions the same way for burger topping'],
    health_benefits: ['No calcium chloride', 'No polysorbate 80', 'No artificial colors', 'Probiotic potential'],
    vs_store_bought: 'Store pickles often contain Yellow 5, polysorbate 80, and calcium chloride.',
    kid_friendly: true,
    allergens: [],
    dietary_tags: ['vegan', 'gluten-free']
  },
  {
    name: 'Banana Oat Pancakes',
    description: 'Fluffy pancakes with no mix needed — just 3 ingredients',
    replaces_category: 'Pancake Mix',
    replaces_products: [],
    prep_time_minutes: 5,
    cook_time_minutes: 10,
    total_time_minutes: 15,
    servings: 2,
    difficulty: 'easy',
    estimated_cost: 1.50,
    cost_per_serving: 0.75,
    ingredients: [
      { item: 'Ripe banana', amount: '1 large', notes: '' },
      { item: 'Eggs', amount: '2', notes: '' },
      { item: 'Rolled oats', amount: '1/2 cup', notes: 'Blended into flour' }
    ],
    instructions: [
      'Blend oats into a flour in a blender.',
      'Add banana and eggs, blend until smooth.',
      'Heat a non-stick pan over medium heat with a touch of butter.',
      'Pour small pancakes (3-4 inches). Cook 2-3 minutes per side.',
      'Serve with fresh berries and a drizzle of maple syrup.'
    ],
    tips: ['Add cinnamon or vanilla for extra flavor', 'These are softer than traditional pancakes — small size helps'],
    health_benefits: ['No partially hydrogenated oils', 'No artificial flavors', 'Whole grain', 'Natural sweetness from banana'],
    vs_store_bought: 'Bisquick contains partially hydrogenated soybean oil and sodium aluminum phosphate.',
    kid_friendly: true,
    allergens: ['eggs', 'gluten'],
    dietary_tags: ['vegetarian', 'no-added-sugar']
  },
  {
    name: 'Homemade Popsicles',
    description: 'Real fruit popsicles kids actually love',
    replaces_category: 'Frozen Treats',
    replaces_products: [],
    prep_time_minutes: 10,
    cook_time_minutes: 0,
    total_time_minutes: 250,
    servings: 6,
    difficulty: 'easy',
    estimated_cost: 3.00,
    cost_per_serving: 0.50,
    ingredients: [
      { item: 'Strawberries', amount: '2 cups', notes: 'Fresh or frozen' },
      { item: 'Banana', amount: '1', notes: '' },
      { item: 'Greek yogurt', amount: '1/2 cup', notes: 'Plain' },
      { item: 'Honey', amount: '1 tbsp', notes: 'Optional' }
    ],
    instructions: [
      'Blend all ingredients until smooth.',
      'Pour into popsicle molds.',
      'Insert sticks.',
      'Freeze for at least 4 hours.',
      'Run mold under warm water for 10 seconds to release.'
    ],
    tips: ['Layer different fruit blends for rainbow effect', 'Add spinach — kids can\'t taste it, color is fun'],
    health_benefits: ['Real fruit', 'No Red 40 or Blue 1', 'Probiotics from yogurt', 'Fraction of the sugar'],
    vs_store_bought: 'Otter Pops contain Red 40, Blue 1, Yellow 5, sodium benzoate, and zero fruit.',
    kid_friendly: true,
    allergens: ['milk'],
    dietary_tags: ['vegetarian', 'gluten-free']
  },
  {
    name: 'Cashew Queso',
    description: 'Creamy nacho cheese sauce without processed cheese',
    replaces_category: 'Cheese Dips',
    replaces_products: [],
    prep_time_minutes: 10,
    cook_time_minutes: 5,
    total_time_minutes: 15,
    servings: 6,
    difficulty: 'easy',
    estimated_cost: 5.00,
    cost_per_serving: 0.83,
    ingredients: [
      { item: 'Raw cashews', amount: '1 cup', notes: 'Soaked 2 hours or boiled 15 min' },
      { item: 'Nutritional yeast', amount: '3 tbsp', notes: '' },
      { item: 'Water', amount: '1/2 cup', notes: '' },
      { item: 'Lime juice', amount: '1 tbsp', notes: '' },
      { item: 'Cumin', amount: '1/2 tsp', notes: '' },
      { item: 'Chili powder', amount: '1/2 tsp', notes: '' },
      { item: 'Garlic powder', amount: '1/2 tsp', notes: '' },
      { item: 'Salt', amount: '1/2 tsp', notes: '' },
      { item: 'Diced green chiles', amount: '4 oz can', notes: 'Optional' }
    ],
    instructions: [
      'Drain soaked cashews.',
      'Blend cashews, nutritional yeast, water, lime juice, and spices until very smooth.',
      'Heat in a saucepan over medium heat, stirring constantly.',
      'Stir in green chiles if using.',
      'Add more water to thin if needed.'
    ],
    tips: ['Works great as pasta sauce too', 'Keeps 4 days in fridge — reheat with a splash of water'],
    health_benefits: ['No sodium phosphate', 'No Yellow 5 or Yellow 6', 'Plant-based protein', 'Healthy fats from cashews'],
    vs_store_bought: 'Velveeta Queso contains sodium phosphate, Yellow 5, Yellow 6, and milk protein concentrate.',
    kid_friendly: true,
    allergens: ['tree nuts'],
    dietary_tags: ['vegan', 'gluten-free']
  }
];

// ============================================
// SEED FUNCTION
// ============================================
async function seedDatabase() {
  try {
    console.log('Starting database seed...');

    // Seed harmful ingredients
    console.log('Seeding harmful ingredients...');
    for (const ingredient of harmfulIngredients) {
      await pool.query(
        `INSERT INTO harmful_ingredients (name, aliases, severity, category, health_effects, banned_in, why_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (name) DO NOTHING`,
        [
          ingredient.name,
          JSON.stringify(ingredient.aliases),
          ingredient.severity,
          ingredient.category,
          Array.isArray(ingredient.health_effects) ? ingredient.health_effects.join('. ') : ingredient.health_effects,
          JSON.stringify(ingredient.banned_in),
          ingredient.why_used
        ]
      );
    }
    console.log(`Seeded ${harmfulIngredients.length} harmful ingredients`);

    // Seed companies
    console.log('Seeding companies...');
    for (const company of companies) {
      await pool.query(
        `INSERT INTO companies (name, parent_company, behavior_score, controversies, positive_actions, lobbying_history, transparency_rating)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (name) DO NOTHING`,
        [
          company.name,
          company.parent_company,
          company.behavior_score,
          JSON.stringify(company.controversies),
          JSON.stringify(company.positive_actions),
          company.lobbying_history,
          company.transparency_rating
        ]
      );
    }
    console.log(`Seeded ${companies.length} companies`);

    // Seed products
    console.log('Seeding products...');
    for (const product of products) {
      // Get company ID
      const companyResult = await pool.query(
        'SELECT id FROM companies WHERE name = $1',
        [product.company]
      );
      const companyId = companyResult.rows[0]?.id;

      await pool.query(
        `INSERT INTO products (upc, name, brand, company_id, category, subcategory,
         harmful_ingredients_score, banned_elsewhere_score, transparency_score, processing_score, company_behavior_score,
         nutrition_score, additives_score, organic_bonus,
         ingredients, harmful_ingredients_found, is_clean_alternative, swaps_to, typical_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         ON CONFLICT (upc) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         subcategory = EXCLUDED.subcategory,
         harmful_ingredients_score = EXCLUDED.harmful_ingredients_score,
         nutrition_score = EXCLUDED.nutrition_score,
         additives_score = EXCLUDED.additives_score,
         organic_bonus = EXCLUDED.organic_bonus,
         ingredients = EXCLUDED.ingredients,
         harmful_ingredients_found = EXCLUDED.harmful_ingredients_found,
         is_clean_alternative = EXCLUDED.is_clean_alternative,
         swaps_to = EXCLUDED.swaps_to,
         typical_price = EXCLUDED.typical_price`,
        [
          product.upc,
          product.name,
          product.brand,
          companyId,
          product.category,
          product.subcategory,
          product.harmful_ingredients_score,
          product.banned_elsewhere_score,
          product.transparency_score,
          product.processing_score,
          product.company_behavior_score,
          // New scoring model: derive from old values
          product.banned_elsewhere_score || 50,   // nutrition_score (was unused, default 50)
          product.harmful_ingredients_score || 50, // additives_score
          product.transparency_score >= 80 ? 100 : 0, // organic_bonus
          product.ingredients,
          JSON.stringify(product.harmful_ingredients_found),
          product.is_clean_alternative,
          JSON.stringify(product.swaps_to),
          product.typical_price
        ]
      );
    }
    console.log(`Seeded ${products.length} products`);

    // Seed recipes (original + additional)
    const allRecipes = [...recipes, ...additionalRecipes];
    console.log('Seeding recipes...');
    for (const recipe of allRecipes) {
      await pool.query(
        `INSERT INTO recipes (name, description, replaces_category, replaces_products,
         prep_time_minutes, cook_time_minutes, total_time_minutes, servings, difficulty,
         estimated_cost, cost_per_serving, ingredients, instructions, tips,
         health_benefits, vs_store_bought, kid_friendly, allergens, dietary_tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         ON CONFLICT (name) DO NOTHING`,
        [
          recipe.name,
          recipe.description,
          recipe.replaces_category,
          JSON.stringify(recipe.replaces_products),
          recipe.prep_time_minutes,
          recipe.cook_time_minutes,
          recipe.total_time_minutes,
          recipe.servings,
          recipe.difficulty,
          recipe.estimated_cost,
          recipe.cost_per_serving,
          JSON.stringify(recipe.ingredients),
          JSON.stringify(recipe.instructions),
          JSON.stringify(recipe.tips),
          JSON.stringify(recipe.health_benefits),
          recipe.vs_store_bought,
          recipe.kid_friendly,
          JSON.stringify(recipe.allergens),
          JSON.stringify(recipe.dietary_tags)
        ]
      );
    }
    console.log(`Seeded ${allRecipes.length} recipes (${recipes.length} original + ${additionalRecipes.length} additional)`);

    console.log('Database seeding complete!');
    
  } catch (err) {
    console.error('Error seeding database:', err);
    throw err;
  }
}

// Run if called directly
if (process.argv[1].includes('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedDatabase, harmfulIngredients, companies, products, recipes };
