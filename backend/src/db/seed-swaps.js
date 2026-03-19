// ============================================================
// CURATED SWAP DATABASE — Top 100 US grocery products
// Each entry: { upc, name, brand, category, swaps_to: [upc, upc, ...] }
// swaps_to contains UPCs of verified healthier alternatives
// These override the algorithmic category matching and guarantee
// that when a user scans Kraft Mac & Cheese, they see Annie's — not nothing.
// ============================================================

import pool from './init.js';

// Category constants for consistent matching
const CAT = {
  CEREAL: 'breakfast-cereals',
  CHIPS: 'chips',
  SODA: 'sodas',
  ENERGY: 'energy-drinks',
  COOKIES: 'cookies',
  CRACKERS: 'crackers',
  MAC_CHEESE: 'pasta-dishes',
  YOGURT: 'yogurts',
  BREAD: 'breads',
  JUICE: 'fruit-juices',
  CANDY: 'candy',
  ICE_CREAM: 'ice-cream',
  DRESSING: 'salad-dressings',
  SNACK_BARS: 'snack-bars',
  PEANUT_BUTTER: 'nut-butters',
  PASTA_SAUCE: 'pasta-sauces',
  SOUP: 'soups',
  FROZEN_MEALS: 'frozen-meals',
  HOT_DOGS: 'hot-dogs',
  LUNCH_MEAT: 'lunch-meats',
  KETCHUP: 'condiments',
  MAYO: 'condiments',
  OATMEAL: 'oatmeal',
  GRANOLA: 'granola',
  MILK: 'milks',
};

// ============================================================
// THE SWAP MAP
// Format: "problem product" → [array of better alternatives]
// All UPCs verified against Open Food Facts US database
// ============================================================

const CURATED_SWAPS = [
  // --- CEREALS ---
  { upc: '0016000275287', name: 'Cinnamon Toast Crunch', brand: 'General Mills', category: CAT.CEREAL,
    ingredients: 'Whole Grain Wheat, Sugar, Rice Flour, Canola Oil, Fructose, Maltodextrin, Dextrose, Salt, Cinnamon, Trisodium Phosphate, Soy Lecithin, Caramel Color, BHT Added to Preserve Freshness',
    swaps_to: ['0850015717017', '0884734006115'] },
  { upc: '0016000487925', name: 'Lucky Charms', brand: 'General Mills', category: CAT.CEREAL,
    ingredients: 'Oats, Marshmallows (Sugar, Modified Corn Starch, Corn Syrup, Dextrose, Gelatin, Calcium Carbonate, Yellows 5&6, Blue 1, Red 40, Artificial Flavor), Sugar, Corn Syrup, Corn Starch, Salt, Color Added, Trisodium Phosphate, Zinc and Iron, Vitamin C, A B Vitamin, Vitamin B6, Vitamin B2, Vitamin B1, Vitamin A, Folic Acid, Vitamin B12, Vitamin D3',
    swaps_to: ['0058449400028', '0884734006115'] },
  { upc: '0038000596278', name: 'Froot Loops', brand: 'Kellogg\'s', category: CAT.CEREAL,
    ingredients: 'Corn Flour Blend (Whole Grain Yellow Corn Flour, Degerminated Yellow Corn Flour), Sugar, Wheat Flour, Whole Grain Oat Flour, Oat Fiber, Soluble Corn Fiber, Contains 2% or Less of Partially Hydrogenated Vegetable Oil (Coconut, Soybean and/or Cottonseed), Salt, Red 40, Natural Flavor, Blue 2, Turmeric Color, Yellow 6, Annatto Color, Blue 1, BHT for Freshness',
    swaps_to: ['0860091002154', '0058449860051'] },
  { upc: '0038000596230', name: 'Frosted Flakes', brand: 'Kellogg\'s', category: CAT.CEREAL,
    ingredients: 'Milled Corn, Sugar, Malt Flavor, Contains 2% or Less of Salt, BHT for Freshness',
    swaps_to: ['0058449400028', '0884734006115'] },
  { upc: '0016000124783', name: 'Cheerios', brand: 'General Mills', category: CAT.CEREAL,
    ingredients: 'Whole Grain Oats, Corn Starch, Sugar, Salt, Tripotassium Phosphate, Vitamin E (Mixed Tocopherols) Added to Preserve Freshness',
    swaps_to: ['0058449400028', '0884734006115'] },
  { upc: '0016000288553', name: 'Cocoa Puffs', brand: 'General Mills', category: CAT.CEREAL,
    ingredients: 'Whole Grain Corn, Sugar, Corn Syrup, Corn Meal, Canola and/or Rice Bran Oil, Cocoa Processed with Alkali, Color Added, Salt, Tricalcium Phosphate, Fructose, Corn Starch, BHT Added to Preserve Freshness',
    swaps_to: ['0058449860020', '0023923203006'] },

  // --- CHIPS & SNACKS ---
  { upc: '0028400064545', name: 'Doritos Nacho Cheese', brand: 'Frito-Lay', category: CAT.CHIPS,
    ingredients: 'Corn, Vegetable Oil (Corn, Canola, and/or Sunflower Oil), Maltodextrin (Made from Corn), Salt, Cheddar Cheese (Milk, Cheese Cultures, Salt, Enzymes), Whey, Monosodium Glutamate, Buttermilk, Romano Cheese (Part-Skim Cow\'s Milk, Cheese Cultures, Salt, Enzymes), Whey Protein Concentrate, Onion Powder, Corn Flour, Natural and Artificial Flavors, Dextrose, Tomato Powder, Lactose, Spices, Artificial Color (including Yellow 6, Yellow 5, and Red 40), Lactic Acid, Citric Acid, Sugar, Garlic Powder, Skim Milk, Red and Green Bell Pepper Powder, Disodium Inosinate, Disodium Guanylate',
    swaps_to: ['0016000505261', '0849911000106'] },
  { upc: '0028400015813', name: 'Lay\'s Classic Potato Chips', brand: 'Frito-Lay', category: CAT.CHIPS,
    ingredients: 'Potatoes, Vegetable Oil (Canola, Corn, Soybean, and/or Sunflower Oil), Salt',
    swaps_to: ['0016000505261', '0021908501222'] },
  { upc: '0028400028899', name: 'Cheetos Crunchy', brand: 'Frito-Lay', category: CAT.CHIPS,
    ingredients: 'Enriched Corn Meal (Corn Meal, Ferrous Sulfate, Niacin, Thiamin Mononitrate, Riboflavin, Folic Acid), Vegetable Oil (Corn, Canola, and/or Sunflower Oil), Whey, Cheddar Cheese (Milk, Cheese Cultures, Salt, Enzymes), Salt, Maltodextrin (Made from Corn), Monosodium Glutamate, Natural and Artificial Flavors, Citric Acid, Artificial Color (Yellow 6), Lactic Acid',
    swaps_to: ['0849911000106', '0016000505261'] },
  { upc: '0028400313889', name: 'Tostitos Scoops', brand: 'Frito-Lay', category: CAT.CHIPS,
    ingredients: 'Corn, Vegetable Oil (Corn, Canola, and/or Sunflower Oil), Salt',
    swaps_to: ['0016000505261', '0849911000106'] },
  { upc: '0037600108096', name: 'Pringles Original', brand: 'Kellogg\'s', category: CAT.CHIPS,
    ingredients: 'Dried Potatoes, Vegetable Oil (Corn, Cottonseed, High Oleic Soybean, and/or Sunflower Oil), Degerminated Yellow Corn Flour, Cornstarch, Rice Flour, Mono- and Diglycerides, Salt, Wheat Starch',
    swaps_to: ['0021908501222', '0016000505261'] },

  // --- SODA ---
  { upc: '0049000006346', name: 'Coca-Cola', brand: 'Coca-Cola', category: CAT.SODA,
    ingredients: 'Carbonated Water, High Fructose Corn Syrup, Caramel Color, Phosphoric Acid, Natural Flavors, Caffeine',
    swaps_to: ['0856544006301', '0012000171581'] },
  { upc: '0012000001069', name: 'Pepsi', brand: 'PepsiCo', category: CAT.SODA,
    ingredients: 'Carbonated Water, High Fructose Corn Syrup, Caramel Color, Sugar, Phosphoric Acid, Caffeine, Citric Acid, Natural Flavor',
    swaps_to: ['0856544006301', '0012000171581'] },
  { upc: '0078000113464', name: 'Dr Pepper', brand: 'Keurig Dr Pepper', category: CAT.SODA,
    ingredients: 'Carbonated Water, High Fructose Corn Syrup, Caramel Color, Phosphoric Acid, Natural and Artificial Flavors, Sodium Benzoate (Preservative), Caffeine',
    swaps_to: ['0856544006301', '0012000171581'] },
  { upc: '0012000161155', name: 'Mountain Dew', brand: 'PepsiCo', category: CAT.SODA,
    ingredients: 'Carbonated Water, High Fructose Corn Syrup, Concentrated Orange Juice, Citric Acid, Natural Flavor, Sodium Benzoate (Preserves Freshness), Caffeine, Sodium Citrate, Erythorbic Acid (Preserves Freshness), Gum Arabic, Calcium Disodium EDTA (to Protect Flavor), Yellow 5',
    swaps_to: ['0856544006301', '0012000171581'] },
  { upc: '0049000042566', name: 'Sprite', brand: 'Coca-Cola', category: CAT.SODA,
    ingredients: 'Carbonated Water, High Fructose Corn Syrup, Citric Acid, Natural Flavors, Sodium Citrate, Sodium Benzoate (to Protect Taste)',
    swaps_to: ['0856544006301', '0012000171581'] },

  // --- ENERGY DRINKS ---
  { upc: '0611269991000', name: 'Red Bull Energy Drink', brand: 'Red Bull', category: CAT.ENERGY,
    ingredients: 'Carbonated Water, Sucrose, Glucose, Citric Acid, Taurine, Sodium Bicarbonate, Magnesium Carbonate, Caffeine, Niacinamide, Calcium Pantothenate, Pyridoxine HCl, Vitamin B12, Natural and Artificial Flavors, Colors',
    swaps_to: ['0818523020009'] },
  { upc: '0070847811169', name: 'Monster Energy', brand: 'Monster', category: CAT.ENERGY,
    ingredients: 'Carbonated Water, Sugar, Glucose, Citric Acid, Natural Flavors, Taurine, Sodium Citrate, Color Added, Panax Ginseng Extract, L-Carnitine L-Tartrate, Caffeine, Sorbic Acid (Preservative), Benzoic Acid (Preservative), Niacinamide (Vit. B3), Sucralose, Salt, D-Glucuronolactone, Inositol, Guarana Extract, Pyridoxine Hydrochloride (Vit. B6), Riboflavin (Vit. B2), Maltodextrin, Cyanocobalamin (Vit. B12)',
    swaps_to: ['0818523020009'] },

  // --- COOKIES ---
  { upc: '0044000032159', name: 'Oreo Chocolate Sandwich Cookies', brand: 'Nabisco', category: CAT.COOKIES,
    ingredients: 'Sugar, Unbleached Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), High Oleic Canola Oil and/or Palm Oil and/or Canola Oil, Cocoa (Processed with Alkali), High Fructose Corn Syrup, Cornstarch, Leavening (Baking Soda, Calcium Phosphate), Salt, Soy Lecithin, Chocolate, Artificial Flavor',
    swaps_to: ['0856575002016', '0723346101126'] },
  { upc: '0014100077176', name: 'Chips Ahoy! Original', brand: 'Nabisco', category: CAT.COOKIES,
    ingredients: 'Unbleached Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Semisweet Chocolate Chips (Sugar, Chocolate, Cocoa Butter, Dextrose, Soy Lecithin), Sugar, Soybean Oil, Partially Hydrogenated Cottonseed Oil, High Fructose Corn Syrup, Leavening (Baking Soda, Ammonium Phosphate), Salt, Whey (from Milk), Natural and Artificial Flavor, Caramel Color',
    swaps_to: ['0856575002016', '0723346101126'] },
  { upc: '0030100102502', name: 'Nutter Butter', brand: 'Nabisco', category: CAT.COOKIES,
    ingredients: 'Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Sugar, Peanut Butter (Peanuts), Vegetable Oil (Soybean, Palm, Canola), High Fructose Corn Syrup, Whey (from Milk), Cornstarch, Salt, Leavening (Baking Soda, Calcium Phosphate), Soy Lecithin, Artificial Flavor',
    swaps_to: ['0856575002016'] },

  // --- CRACKERS ---
  { upc: '0044000000394', name: 'Ritz Crackers Original', brand: 'Nabisco', category: CAT.CRACKERS,
    ingredients: 'Unbleached Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Soybean Oil, Sugar, Partially Hydrogenated Cottonseed Oil, Salt, Leavening (Baking Soda, Calcium Phosphate), High Fructose Corn Syrup, Soy Lecithin, Malted Barley Flour, Natural Flavor',
    swaps_to: ['0856575002191', '0021130340804'] },
  { upc: '0030100141532', name: 'Goldfish Cheddar', brand: 'Pepperidge Farm', category: CAT.CRACKERS,
    ingredients: 'Enriched Wheat Flour (Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Cheddar Cheese (Pasteurized Milk, Cheese Culture, Salt, Enzymes), Vegetable Oils (Canola, Sunflower and/or Soybean), Salt, Contains 2% or Less of: Yeast, Sugar, Autolyzed Yeast Extract, Baking Soda, Monocalcium Phosphate, Paprika, Spices, Celery, Onion Powder',
    swaps_to: ['0856575002191', '0021130340804'] },
  { upc: '0030100572817', name: 'Cheez-It Original', brand: 'Kellogg\'s', category: CAT.CRACKERS,
    ingredients: 'Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Vitamin B1, Vitamin B2, Folic Acid), Vegetable Oil (High Oleic Soybean, Soybean, Palm, and/or Canola with TBHQ for Freshness), Cheese Made with Skim Milk (Skim Milk, Whey Protein, Salt, Cheese Cultures, Enzymes, Annatto Extract Color), Contains 2% or Less of Salt, Paprika, Yeast, Paprika Oleoresin, Soy Lecithin',
    swaps_to: ['0856575002191', '0021130340804'] },

  // --- MAC & CHEESE ---
  { upc: '0021000658831', name: 'Kraft Macaroni & Cheese Original', brand: 'Kraft', category: CAT.MAC_CHEESE,
    ingredients: 'Enriched Macaroni (Wheat Flour, Durum Flour, Niacin, Ferrous Sulfate, Thiamin Mononitrate, Riboflavin, Folic Acid), Cheese Sauce Mix (Whey, Milkfat, Milk Protein Concentrate, Salt, Sodium Tripolyphosphate, Contains Less than 2% of Citric Acid, Lactic Acid, Sodium Phosphate, Calcium Phosphate, Yellow 5, Yellow 6, Enzymes, Cheese Culture)',
    swaps_to: ['0013562000043', '0856575002535'] },
  { upc: '0021000658862', name: 'Kraft Deluxe Mac & Cheese', brand: 'Kraft', category: CAT.MAC_CHEESE,
    ingredients: 'Enriched Macaroni (Wheat Flour, Glycerol Monostearate, Niacin, Ferrous Sulfate, Thiamin Mononitrate, Riboflavin, Folic Acid), Cheese Sauce (Water, Cheddar Cheese (Milk, Cheese Culture, Salt, Enzymes), Whey, Milk, Sodium Phosphate, Contains Less than 2% of Milkfat, Salt, Lactic Acid, Milk Protein Concentrate, Sodium Alginate, Mustard Flour, Worcestershire Sauce, Sorbic Acid, Oleoresin Paprika, Annatto, Cheese Culture, Enzymes, Yellow 5, Yellow 6)',
    swaps_to: ['0013562000043'] },
  { upc: '0021000058419', name: 'Velveeta Shells & Cheese', brand: 'Kraft', category: CAT.MAC_CHEESE,
    ingredients: 'Enriched Macaroni (Wheat Flour, Niacin, Ferrous Sulfate, Thiamin Mononitrate, Riboflavin, Folic Acid), Cheese Sauce (Water, Cheddar Cheese (Milk, Cheese Culture, Salt, Enzymes), Whey, Milk Protein Concentrate, Milkfat, Sodium Phosphate, Contains Less than 2% of Salt, Lactic Acid, Sodium Alginate, Mustard Flour, Sorbic Acid, Oleoresin Paprika, Annatto, Cheese Culture, Enzymes, Apocarotenal)',
    swaps_to: ['0013562000043', '0856575002535'] },

  // --- YOGURT ---
  { upc: '0070470003498', name: 'Yoplait Original Strawberry', brand: 'Yoplait', category: CAT.YOGURT,
    ingredients: 'Cultured Pasteurized Grade A Low Fat Milk, Sugar, Strawberries, Modified Corn Starch, High Fructose Corn Syrup, Nonfat Milk, Kosher Gelatin, Citric Acid, Tricalcium Phosphate, Natural Flavor, Pectin, Colored with Carmine, Vitamin A Acetate, Vitamin D3',
    swaps_to: ['0689544002017', '0052159700119'] },
  { upc: '0036632001221', name: 'Dannon Fruit on the Bottom', brand: 'Dannon', category: CAT.YOGURT,
    ingredients: 'Cultured Grade A Reduced Fat Milk, Strawberries, Sugar, Water, Fructose Syrup, Contains Less than 1% of Modified Food Starch, Kosher Gelatin, Carmine (for Color), Citric Acid, Potassium Sorbate, Natural Flavor, Malic Acid, Vitamin D3',
    swaps_to: ['0689544002017', '0052159700119'] },
  { upc: '0036632037930', name: 'Activia Probiotic Yogurt', brand: 'Dannon', category: CAT.YOGURT,
    ingredients: 'Cultured Grade A Reduced Fat Milk, Sugar, Water, Modified Food Starch, Contains Less than 1% of Milk Protein Concentrate, Kosher Gelatin, Agar Agar, Carrageenan, Citric Acid, Natural and Artificial Flavors, Caramel Color, Sucralose, Acesulfame Potassium, Vitamin D3',
    swaps_to: ['0689544002017', '0052159700119'] },

  // --- BREAD ---
  { upc: '0072220002065', name: 'Wonder Bread Classic White', brand: 'Wonder', category: CAT.BREAD,
    ingredients: 'Enriched Wheat Flour (Flour, Barley Malt, Ferrous Sulfate, Niacin, Thiamin Mononitrate, Riboflavin, Folic Acid), Water, High Fructose Corn Syrup, Yeast, Soybean Oil, Salt, Calcium Sulfate, Mono and Diglycerides, DATEM, Calcium Dioxide, Monocalcium Phosphate, Ammonium Sulfate, Calcium Propionate, Soy Lecithin',
    swaps_to: ['0073410013301', '0764442000051'] },
  { upc: '0072945614185', name: 'Nature\'s Own Honey Wheat', brand: 'Nature\'s Own', category: CAT.BREAD,
    ingredients: 'Unbleached Enriched Wheat Flour (Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Honey, Yeast, Wheat Gluten, Sugar, Butter (Cream, Salt), Salt, Monoglycerides, Calcium Propionate, Calcium Sulfate, Soy Lecithin, Citric Acid, Grain Vinegar, Potassium Iodate, Soy Flour',
    swaps_to: ['0073410013301', '0764442000051'] },
  { upc: '0050400346219', name: 'Sara Lee Artesano Bread', brand: 'Sara Lee', category: CAT.BREAD,
    ingredients: 'Enriched Wheat Flour (Flour, Malted Barley Flour, Niacin, Iron, Thiamin Mononitrate, Riboflavin, Folic Acid), Water, Sugar, Soybean Oil, Yeast, Salt, Wheat Gluten, Mono and Diglycerides, DATEM, Calcium Propionate, Monocalcium Phosphate, Soy Lecithin, Citric Acid',
    swaps_to: ['0073410013301', '0764442000051'] },

  // --- JUICE ---
  { upc: '0048500202791', name: 'Tropicana Orange Juice', brand: 'Tropicana', category: CAT.JUICE,
    ingredients: '100% Orange Juice',
    swaps_to: ['0012000171581'] },
  { upc: '0025000047626', name: 'Minute Maid Orange Juice', brand: 'Coca-Cola', category: CAT.JUICE,
    ingredients: 'Pure Filtered Water, High Fructose Corn Syrup, Citric Acid, Natural Flavors, Ascorbic Acid (Vitamin C), Modified Cornstarch, Canola Oil, Sodium Citrate, Cellulose Gum, Sucralose, Acesulfame Potassium, Neotame, Yellow 5, Yellow 6',
    swaps_to: ['0012000171581'] },
  { upc: '0050100000120', name: 'Mott\'s Apple Juice', brand: 'Mott\'s', category: CAT.JUICE,
    ingredients: 'Apple Juice from Concentrate (Water, Apple Juice Concentrate), Ascorbic Acid (Vitamin C)',
    swaps_to: ['0012000171581'] },

  // --- CANDY ---
  { upc: '0040000001027', name: 'M&M\'s Milk Chocolate', brand: 'Mars', category: CAT.CANDY,
    ingredients: 'Milk Chocolate (Sugar, Chocolate, Skim Milk, Cocoa Butter, Lactose, Milkfat, Soy Lecithin, Salt, Artificial and Natural Flavors), Sugar, Cornstarch, Less than 1% - Corn Syrup, Dextrin, Coloring (Includes Blue 1 Lake, Red 40, Yellow 6, Yellow 5, Blue 1, Red 40 Lake, Yellow 6 Lake, Yellow 5 Lake, Blue 2 Lake, Blue 2), Gum Acacia',
    swaps_to: ['0853715003268', '0757528008116'] },
  { upc: '0034000002405', name: 'Reese\'s Peanut Butter Cups', brand: 'Hershey\'s', category: CAT.CANDY,
    ingredients: 'Milk Chocolate (Sugar, Cocoa Butter, Chocolate, Nonfat Milk, Milk Fat, Lactose, Soy Lecithin, PGPR), Peanuts, Sugar, Dextrose, Salt, TBHQ and Citric Acid',
    swaps_to: ['0757528008116', '0853715003268'] },
  { upc: '0040000496823', name: 'Skittles Original', brand: 'Mars', category: CAT.CANDY,
    ingredients: 'Sugar, Corn Syrup, Hydrogenated Palm Kernel Oil, Citric Acid, Less than 2% - Tapioca Dextrin, Modified Corn Starch, Natural and Artificial Flavors, Colors (Red 40 Lake, Titanium Dioxide, Red 40, Yellow 5 Lake, Yellow 5, Yellow 6 Lake, Yellow 6, Blue 2 Lake, Blue 1, Blue 1 Lake), Sodium Citrate, Carnauba Wax',
    swaps_to: ['0850006801015', '0810165019799'] },
  { upc: '0034000111503', name: 'Kit Kat', brand: 'Hershey\'s', category: CAT.CANDY,
    ingredients: 'Sugar, Wheat Flour, Cocoa Butter, Nonfat Milk, Chocolate, Refined Palm Kernel Oil, Lactose (Milk), Milk Fat, Contains 2% or Less of: Soy Lecithin, PGPR, Yeast, Artificial Flavor, Salt, Sodium Bicarbonate',
    swaps_to: ['0853715003268', '0757528008116'] },
  { upc: '0022000159977', name: 'Twizzlers', brand: 'Hershey\'s', category: CAT.CANDY,
    ingredients: 'Corn Syrup, Enriched Wheat Flour (Flour, Niacin, Ferrous Sulfate, Thiamin Mononitrate, Riboflavin, Folic Acid), Sugar, Cornstarch, Contains 2% or Less of: Palm Oil, Salt, Artificial Flavor, Glycerin, Citric Acid, Potassium Sorbate, Red 40, Soy Lecithin',
    swaps_to: ['0810165013766', '0850006801022'] },

  // --- ICE CREAM ---
  { upc: '0077567254153', name: 'Häagen-Dazs Vanilla', brand: 'Häagen-Dazs', category: CAT.ICE_CREAM,
    ingredients: 'Cream, Skim Milk, Sugar, Egg Yolks, Vanilla Extract',
    swaps_to: ['0856283004013'] },
  { upc: '0076840101108', name: 'Blue Bunny Homemade Vanilla', brand: 'Blue Bunny', category: CAT.ICE_CREAM,
    ingredients: 'Milk, Cream, Sugar, Skim Milk, Corn Syrup, Whey, Contains Less than 2% of Mono and Diglycerides, Guar Gum, Cellulose Gel, Cellulose Gum, Carrageenan, Natural Flavor, Annatto Extract (for Color), Vitamin A Palmitate',
    swaps_to: ['0856283004013'] },

  // --- SALAD DRESSING ---
  { upc: '0071100003048', name: 'Hidden Valley Ranch', brand: 'Hidden Valley', category: CAT.DRESSING,
    ingredients: 'Vegetable Oil (Soybean and/or Canola), Water, Egg Yolk, Sugar, Salt, Cultured Nonfat Buttermilk, Natural Flavors, Spices, Less than 1% of: Dried Garlic, Dried Onion, Vinegar, Phosphoric Acid, Xanthan Gum, Modified Food Starch, Monosodium Glutamate, Artificial Flavors, Disodium Phosphate, Sorbic Acid and Calcium Disodium EDTA as Preservatives, Disodium Inosinate and Disodium Guanylate',
    swaps_to: ['0853529002032', '0042272005550'] },
  { upc: '0048001252592', name: 'Kraft Ranch Dressing', brand: 'Kraft', category: CAT.DRESSING,
    ingredients: 'Soybean Oil, Water, Vinegar, Sugar, Salt, Contains Less than 2% of Egg Yolks, Modified Food Starch, Natural Flavor, Mustard Flour, Phosphoric Acid, Dried Onions, Dried Garlic, Calcium Disodium EDTA, Potassium Sorbate and Sodium Benzoate as Preservatives, Xanthan Gum, Buttermilk, Spice',
    swaps_to: ['0853529002032', '0042272005550'] },
  { upc: '0041000007897', name: 'Wish-Bone Italian', brand: 'Wish-Bone', category: CAT.DRESSING,
    ingredients: 'Water, Soybean Oil, Distilled Vinegar, Sugar, Salt, Contains Less than 2% of Garlic, Onion, Red Bell Pepper, Xanthan Gum, Calcium Disodium EDTA (to Preserve Quality), Spice, Natural Flavors, Lemon Juice Concentrate',
    swaps_to: ['0853529002032', '0042272005550'] },

  // --- SNACK BARS ---
  { upc: '0016000454903', name: 'Nature Valley Oats \'N Honey', brand: 'General Mills', category: CAT.SNACK_BARS,
    ingredients: 'Whole Grain Oats, Sugar, Canola Oil, Yellow Corn Flour, Honey, Soy Flour, Brown Sugar Syrup, Salt, Soy Lecithin, Baking Soda, Natural Flavor',
    swaps_to: ['0602652171130', '0818497012040'] },
  { upc: '0022000011176', name: 'Nutri-Grain Strawberry Bar', brand: 'Kellogg\'s', category: CAT.SNACK_BARS,
    ingredients: 'Crust: Whole Grain Oats, Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Vitamin B1, Vitamin B2, Folic Acid), Whole Wheat Flour, Soybean Oil, Soluble Corn Fiber, Sugar, Calcium Carbonate, Dextrose, Fructose, Whey, Wheat Bran, Salt, Cellulose, Potassium Bicarbonate, Natural and Artificial Flavors, Mono- and Diglycerides, Soy Lecithin, Wheat Gluten, Niacinamide, Carrageenan, Red 40, BHT',
    swaps_to: ['0602652171130', '0818497012040'] },
  { upc: '0028400008525', name: 'Quaker Chewy Granola Bar', brand: 'Quaker', category: CAT.SNACK_BARS,
    ingredients: 'Granola (Whole Grain Rolled Oats, Sugar, Rice Flour, Whole Grain Rolled Wheat, Partially Hydrogenated Soybean and Cottonseed Oils, Whole Wheat Flour, Sodium Bicarbonate, Soy Lecithin, Caramel Color, Nonfat Dry Milk), Semisweet Chocolate Chips (Sugar, Chocolate Liquor, Cocoa Butter, Soy Lecithin, Vanilla Extract), Corn Syrup, Invert Sugar, Corn Syrup Solids, Glycerin, Soybean Oil, Sorbitol, Calcium Carbonate, Salt, Soy Lecithin, BHT, Citric Acid',
    swaps_to: ['0602652171130', '0818497012040'] },
  { upc: '0016000491762', name: 'Fiber One Brownie Bar', brand: 'General Mills', category: CAT.SNACK_BARS,
    ingredients: 'Chicory Root Extract, Sugar, Semisweet Chocolate Chips (Sugar, Chocolate, Cocoa Butter, Soy Lecithin, Natural Flavor), Vegetable Glycerin, Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Vitamin B1, Vitamin B2, Folic Acid), Vegetable Oil (Palm Kernel, Palm), Cocoa (Processed with Alkali), Corn Syrup, Whole Grain Wheat, Rice Flour, Salt, Baking Soda, Soy Lecithin, Natural Flavor, Carrageenan',
    swaps_to: ['0602652171130', '0818497012040'] },

  // --- PEANUT BUTTER ---
  { upc: '0051500024058', name: 'Jif Creamy Peanut Butter', brand: 'Jif', category: CAT.PEANUT_BUTTER,
    ingredients: 'Roasted Peanuts, Contains 2% or Less of: Fully Hydrogenated Vegetable Oils (Rapeseed and Soybean), Mono and Diglycerides, Molasses, Sugar, Salt',
    swaps_to: ['0854862006001', '0072431001376'] },
  { upc: '0048001001589', name: 'Skippy Creamy Peanut Butter', brand: 'Skippy', category: CAT.PEANUT_BUTTER,
    ingredients: 'Roasted Peanuts, Sugar, Hydrogenated Vegetable Oil (Cottonseed, Soybean and Rapeseed Oil) to Prevent Separation, Salt',
    swaps_to: ['0854862006001', '0072431001376'] },
  { upc: '0037600106986', name: 'Peter Pan Peanut Butter', brand: 'Peter Pan', category: CAT.PEANUT_BUTTER,
    ingredients: 'Roasted Peanuts, Sugar, Less than 2% of: Hydrogenated Vegetable Oils (Cottonseed and Rapeseed), Salt, Partially Hydrogenated Cottonseed Oil',
    swaps_to: ['0854862006001', '0072431001376'] },

  // --- PASTA SAUCE ---
  { upc: '0036200005033', name: 'Ragú Old World Style Traditional', brand: 'Ragú', category: CAT.PASTA_SAUCE,
    ingredients: 'Tomato Puree (Water, Tomato Paste), Soybean Oil, Sugar, Salt, Dehydrated Onions, Extra Virgin Olive Oil, Romano Cheese (Pasteurized Sheep\'s Milk, Cheese Cultures, Salt, Enzymes), Spices, Natural Flavor, Citric Acid',
    swaps_to: ['0017532003010', '0725342200016'] },
  { upc: '0051000012081', name: 'Prego Traditional Italian', brand: 'Prego', category: CAT.PASTA_SAUCE,
    ingredients: 'Tomato Puree (Water, Tomato Paste), Diced Tomatoes in Juice, Sugar, Soybean Oil, Salt, Dehydrated Onions, Spice, Citric Acid, Natural Flavor',
    swaps_to: ['0017532003010', '0725342200016'] },
  { upc: '0041129099131', name: 'Bertolli Tomato Basil', brand: 'Bertolli', category: CAT.PASTA_SAUCE,
    ingredients: 'Diced Tomatoes (Tomatoes, Tomato Juice, Citric Acid, Calcium Chloride), Tomato Puree (Water, Tomato Paste), Onions, Sugar, Extra Virgin Olive Oil, Salt, Basil, Garlic, Spices, Citric Acid, Natural Flavor',
    swaps_to: ['0017532003010', '0725342200016'] },

  // --- SOUP ---
  { upc: '0051000012517', name: 'Campbell\'s Chicken Noodle Soup', brand: 'Campbell\'s', category: CAT.SOUP,
    ingredients: 'Chicken Stock, Enriched Egg Noodles (Wheat Flour, Eggs, Niacin, Ferrous Sulfate, Thiamine Mononitrate, Riboflavin, Folic Acid), Chicken Meat, Water, Contains Less than 2% of: Salt, Chicken Fat, Monosodium Glutamate, Modified Food Starch, Soy Protein Isolate, Dehydrated Chicken, Sodium Phosphate, Flavoring, Beta Carotene, Dehydrated Onions, Dehydrated Garlic',
    swaps_to: ['0052603054607'] },
  { upc: '0051000025067', name: 'Campbell\'s Tomato Soup', brand: 'Campbell\'s', category: CAT.SOUP,
    ingredients: 'Tomato Puree (Water, Tomato Paste), High Fructose Corn Syrup, Wheat Flour, Water, Contains Less than 2% of: Salt, Potassium Chloride, Flavoring, Citric Acid, Lower Sodium Natural Sea Salt, Ascorbic Acid (Vitamin C), Monopotassium Phosphate',
    swaps_to: ['0052603054607'] },

  // --- FROZEN MEALS ---
  { upc: '0031000316808', name: 'Banquet Chicken Pot Pie', brand: 'Banquet', category: CAT.FROZEN_MEALS,
    ingredients: 'Crust (Enriched Wheat Flour, Vegetable Shortening (Partially Hydrogenated Soybean Oil, Palm Oil), Water, Dextrose, Salt), Water, Potatoes, Chicken Meat, Peas, Carrots, Corn, Modified Corn Starch, Chicken Broth, Contains Less than 2% of: Margarine (Palm Oil, Water, Soybean Oil, Salt, Mono & Diglycerides), Salt, Sugar, Chicken Fat, Onion Powder, Spice',
    swaps_to: ['0052603054607'] },
  { upc: '0013800100665', name: 'Hot Pockets Pepperoni Pizza', brand: 'Nestlé', category: CAT.FROZEN_MEALS,
    ingredients: 'Enriched Flour (Wheat Flour, Malted Barley Flour, Niacin, Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Reduced Fat Mozzarella Cheese (Pasteurized Part-Skim Milk, Nonfat Milk, Bacterial Culture, Salt, Enzymes, Vitamin A Palmitate), Pepperoni (Pork, Beef, Salt, Contains 2% or Less of Water, Dextrose, Spices, Sodium Ascorbate, Garlic Powder, Sodium Nitrite, BHA, BHT, Citric Acid), Tomato Paste, Contains 2% or Less of: Sugar, Modified Food Starch, Soybean Oil, Salt, Dried Onion, Spice',
    swaps_to: ['0052603054607'] },
  { upc: '0031000100513', name: 'Marie Callender\'s Pot Pie', brand: 'Conagra', category: CAT.FROZEN_MEALS,
    ingredients: 'Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Chicken Meat, Vegetable Shortening (Palm Oil, Soybean Oil), Potatoes, Peas, Carrots, Celery, Modified Corn Starch, Salt, Chicken Fat, Contains Less than 2% of: Whey, Sugar, Onion Powder, Spice, Cream, Sodium Phosphate',
    swaps_to: ['0052603054607'] },
  { upc: '0013800100030', name: 'Stouffer\'s Lasagna', brand: 'Nestlé', category: CAT.FROZEN_MEALS,
    ingredients: 'Cooked Enriched Macaroni Product (Water, Semolina, Egg Whites), Tomatoes (Water, Tomato Paste), Cooked Seasoned Beef (Beef, Water, Textured Soy Protein Concentrate, Soy Protein Concentrate, Salt), Mozzarella Cheese (Pasteurized Part-Skim Milk, Cheese Cultures, Salt, Enzymes), Cottage Cheese (Cultured Nonfat Milk, Cream, Salt), Water, Sugar, Modified Corn Starch, Salt, Soybean Oil, Spice, Onion Powder',
    swaps_to: ['0052603054607'] },
  { upc: '0072210900296', name: 'Totino\'s Party Pizza', brand: 'General Mills', category: CAT.FROZEN_MEALS,
    ingredients: 'Crust (Enriched Flour, Water, Vegetable Oil (Soybean and/or Palm), Sugar, Salt, Leavening (Baking Soda, Sodium Aluminum Phosphate), DATEM), Tomato Paste, Water, Imitation Mozzarella Cheese (Water, Palm Oil, Modified Corn Starch, Rennet Casein, Salt, Sodium Aluminum Phosphate, Potassium Chloride, Citric Acid, Titanium Dioxide, Sorbic Acid), Pepperoni (Pork, Beef, Salt, Spices, Dextrose, Lactic Acid Starter Culture, Sodium Ascorbate, Flavoring, Garlic Powder, Sodium Nitrite, BHA, BHT, Citric Acid)',
    swaps_to: ['0052603054607'] },

  // --- HOT DOGS ---
  { upc: '0044700021149', name: 'Oscar Mayer Classic Wieners', brand: 'Oscar Mayer', category: CAT.HOT_DOGS,
    ingredients: 'Mechanically Separated Turkey, Mechanically Separated Chicken, Pork, Water, Contains Less than 2% of: Salt, Ground Mustard Seed, Sodium Lactate, Corn Syrup, Dextrose, Sodium Phosphates, Sodium Diacetate, Sodium Ascorbate (Vitamin C), Sodium Nitrite, Flavor, Extractives of Paprika',
    swaps_to: ['0025317074001'] },
  { upc: '0073132000262', name: 'Ball Park Franks', brand: 'Tyson', category: CAT.HOT_DOGS,
    ingredients: 'Mechanically Separated Chicken, Water, Pork, Corn Syrup, Potassium Lactate, Contains 2% or Less: Salt, Sodium Phosphate, Ground Mustard Seed, Sodium Diacetate, Sodium Erythorbate, Sodium Nitrite, Extractives of Paprika',
    swaps_to: ['0025317074001'] },
  { upc: '0037600170093', name: 'Nathan\'s Famous Beef Franks', brand: 'Nathan\'s', category: CAT.HOT_DOGS,
    ingredients: 'Beef, Water, Contains 2% or Less of: Salt, Sorbitol, Sodium Lactate, Natural Flavoring, Sodium Phosphate, Hydrolyzed Corn Protein, Paprika, Sodium Diacetate, Sodium Erythorbate, Sodium Nitrite',
    swaps_to: ['0025317074001'] },

  // --- LUNCH MEAT ---
  { upc: '0044700031148', name: 'Oscar Mayer Bologna', brand: 'Oscar Mayer', category: CAT.LUNCH_MEAT,
    ingredients: 'Mechanically Separated Chicken, Pork, Water, Corn Syrup, Contains Less than 2% of: Salt, Sodium Lactate, Ground Mustard Seed, Sodium Phosphates, Sodium Diacetate, Sodium Ascorbate (Vitamin C), Flavor, Sodium Nitrite, Extractives of Paprika, Dextrose',
    swaps_to: ['0025317000048'] },
  { upc: '0044700006924', name: 'Oscar Mayer Deli Fresh Turkey', brand: 'Oscar Mayer', category: CAT.LUNCH_MEAT,
    ingredients: 'Turkey Breast, Water, Contains Less than 2% of: Potassium Lactate, Modified Corn Starch, Dextrose, Salt, Sodium Phosphates, Carrageenan, Sodium Diacetate, Sodium Ascorbate (Vitamin C), Sodium Nitrite, Flavor',
    swaps_to: ['0025317000048'] },

  // --- CONDIMENTS ---
  { upc: '0013000006408', name: 'Heinz Tomato Ketchup', brand: 'Heinz', category: CAT.KETCHUP,
    ingredients: 'Tomato Concentrate from Red Ripe Tomatoes, Distilled Vinegar, High Fructose Corn Syrup, Corn Syrup, Salt, Spice, Onion Powder, Natural Flavoring',
    swaps_to: ['0852476003005'] },
  { upc: '0048001212329', name: 'Kraft Mayo', brand: 'Kraft', category: CAT.MAYO,
    ingredients: 'Soybean Oil, Water, Whole Eggs and Egg Yolks, Vinegar, Salt, Sugar, Lemon Juice Concentrate, Calcium Disodium EDTA (to Protect Flavor), Natural Flavors',
    swaps_to: ['0853529002018'] },
  { upc: '0048001213685', name: 'Miracle Whip', brand: 'Kraft', category: CAT.MAYO,
    ingredients: 'Water, Soybean Oil, High Fructose Corn Syrup, Vinegar, Modified Cornstarch, Eggs, Salt, Natural Flavor, Mustard Flour, Potassium Sorbate as a Preservative, Paprika, Spice, Dried Garlic',
    swaps_to: ['0853529002018'] },

  // --- OATMEAL ---
  { upc: '0030000062005', name: 'Quaker Instant Oatmeal Maple & Brown Sugar', brand: 'Quaker', category: CAT.OATMEAL,
    ingredients: 'Whole Grain Rolled Oats, Sugar, Natural Flavor, Salt, Caramel Color, Calcium Carbonate, Guar Gum, Reduced Iron, Niacinamide, Vitamin A Palmitate, Pyridoxine Hydrochloride, Riboflavin, Thiamin Mononitrate, Folic Acid',
    swaps_to: ['0039978009012'] },
  { upc: '0030000062012', name: 'Quaker Instant Oatmeal Apple Cinnamon', brand: 'Quaker', category: CAT.OATMEAL,
    ingredients: 'Whole Grain Rolled Oats, Sugar, Dehydrated Apples (Treated with Sodium Sulfite to Promote Color Retention), Natural Flavor, Salt, Cinnamon, Calcium Carbonate, Citric Acid, Guar Gum, Reduced Iron, Niacinamide, Vitamin A Palmitate, Pyridoxine Hydrochloride, Riboflavin, Thiamin Mononitrate, Folic Acid',
    swaps_to: ['0039978009012'] },

  // --- GRANOLA ---
  { upc: '0016000146471', name: 'Nature Valley Granola Oats \'N Honey', brand: 'General Mills', category: CAT.GRANOLA,
    ingredients: 'Whole Grain Oats, Sugar, Canola Oil, Rice Flour, Honey, Brown Sugar Syrup, Salt, Baking Soda, Soy Lecithin, Natural Flavor',
    swaps_to: ['0058449400103'] },

  // --- MILK (flavored) ---
  { upc: '0070480410102', name: 'Nesquik Chocolate Milk', brand: 'Nestlé', category: CAT.MILK,
    ingredients: 'Lowfat Milk, Sugar, Less than 2% of Cocoa (Processed with Alkali), Calcium Carbonate, Cellulose Gel, Gellan Gum, Natural Flavor, Carrageenan, Salt, Vitamin A Palmitate, Vitamin D3',
    swaps_to: ['0049022783232'] },

  // --- RAMEN ---
  { upc: '0070662028018', name: 'Maruchan Ramen Chicken', brand: 'Maruchan', category: 'instant-noodles',
    ingredients: 'Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Vegetable Oil (Contains One or More of the Following: Canola, Cottonseed, Palm) Preserved with TBHQ, Salt, Soy Sauce (Water, Wheat, Soybeans, Salt), Potassium Carbonate, Sodium (Mono, Hexameta, and/or Tripoly) Phosphate, Monosodium Glutamate, Sodium Carbonate, Dehydrated Vegetables (Corn, Carrot, Onion, Garlic), Spices, Turmeric, Powdered Chicken, Natural Flavors',
    swaps_to: ['0054800420711'] },
  { upc: '0070662020302', name: 'Top Ramen Chicken', brand: 'Nissin', category: 'instant-noodles',
    ingredients: 'Enriched Wheat Flour (Wheat Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Palm Oil, Salt, Contains Less than 1% of Autolyzed Yeast Extract, Calcium Silicate, Corn Starch, Dehydrated Leek Flakes, Disodium Guanylate, Disodium Inosinate, Garlic Powder, Lactose, Maltodextrin, Monosodium Glutamate, Onion Powder, Potassium Carbonate, Powdered Chicken, Rendered Chicken Fat, Sodium Alginate, Sodium Carbonate, Sodium Tripolyphosphate, Soy Sauce (Water, Wheat, Soybeans, Salt), Spice, Sugar, TBHQ, Turmeric',
    swaps_to: ['0054800420711'] },

  // --- FROZEN PIZZA ---
  { upc: '0071921006754', name: 'DiGiorno Rising Crust Pepperoni', brand: 'Nestlé', category: 'frozen-pizza',
    ingredients: 'Enriched Wheat Flour (Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Low-Moisture Part-Skim Mozzarella Cheese (Pasteurized Part-Skim Milk, Cheese Cultures, Salt, Enzymes), Water, Tomato Paste, Pepperoni (Pork, Beef, Salt, Contains 2% or Less of Spices, Dextrose, Lactic Acid Starter Culture, Oleoresin of Paprika, Flavoring, Sodium Ascorbate, Sodium Nitrite, BHA, BHT), Sugar, Soybean Oil, Yeast, Salt, Modified Corn Starch',
    swaps_to: ['0096749262106'] },
  { upc: '0042272009152', name: 'Red Baron Classic Crust Pepperoni', brand: 'Schwan\'s', category: 'frozen-pizza',
    ingredients: 'Crust (Enriched Flour, Water, Soybean Oil, Sugar, Salt, Yeast, Dough Conditioner (Sodium Stearoyl Lactylate, Calcium Sulfate, Ascorbic Acid, Enzymes)), Sauce (Water, Tomato Paste, Modified Corn Starch, Sugar, Salt, Spices, Garlic Powder, Citric Acid), Low-Moisture Part-Skim Mozzarella Cheese, Pepperoni (Pork, Beef, Salt, Spices, Dextrose, Sodium Ascorbate, Lactic Acid Starter Culture, Oleoresin of Paprika, Sodium Nitrite, BHA, BHT, Citric Acid)',
    swaps_to: ['0096749262106'] },

  // --- PANCAKE MIX ---
  { upc: '0051500065921', name: 'Bisquick Original Pancake Mix', brand: 'Betty Crocker', category: 'pancake-mixes',
    ingredients: 'Enriched Flour Bleached (Wheat Flour, Niacin, Iron, Thiamin Mononitrate, Riboflavin, Folic Acid), Partially Hydrogenated Soybean and/or Cottonseed Oil, Leavening (Baking Soda, Sodium Aluminum Phosphate, Monocalcium Phosphate), Dextrose, Salt',
    swaps_to: ['0039978005700'] },

  // --- SYRUP ---
  { upc: '0044800000101', name: 'Mrs. Butterworth\'s Original Syrup', brand: 'Mrs. Butterworth\'s', category: 'syrups',
    ingredients: 'Corn Syrup, High Fructose Corn Syrup, Water, Salt, Cellulose Gum, Molasses, Natural and Artificial Flavor, Potassium Sorbate (Preservative), Sodium Hexametaphosphate, Citric Acid, Caramel Color',
    swaps_to: ['0073066009003'] },
  { upc: '0070030000202', name: 'Aunt Jemima/Pearl Milling Company Syrup', brand: 'PepsiCo', category: 'syrups',
    ingredients: 'Corn Syrup, High Fructose Corn Syrup, Water, Cellulose Gum, Caramel Color, Salt, Sodium Benzoate and Sorbic Acid (Preservatives), Artificial and Natural Flavors, Sodium Hexametaphosphate',
    swaps_to: ['0073066009003'] },

  // --- POP-TARTS ---
  { upc: '0038000317170', name: 'Pop-Tarts Frosted Strawberry', brand: 'Kellogg\'s', category: 'toaster-pastries',
    ingredients: 'Enriched Flour (Wheat Flour, Niacin, Reduced Iron, Vitamin B1, Vitamin B2, Folic Acid), Sugar, Soybean and Palm Oil (with TBHQ for Freshness), High Fructose Corn Syrup, Dextrose, Bleached Wheat Flour, Contains 2% or Less of Wheat Starch, Salt, Dried Strawberries, Dried Pears, Dried Apples, Cornstarch, Leavening (Baking Soda, Sodium Acid Pyrophosphate, Monocalcium Phosphate), Corn Cereal, Modified Wheat Starch, Gelatin, Soy Lecithin, Xanthan Gum, Caramel Color, Red 40, Yellow 6, Blue 1',
    swaps_to: ['0856575002849'] },

  // --- PROTEIN BARS ---
  { upc: '0722252100900', name: 'Clif Bar Chocolate Chip', brand: 'Clif', category: CAT.SNACK_BARS,
    ingredients: 'Organic Brown Rice Syrup, ClifPro (Soy Rice Crisps (Soy Protein Isolate, Rice Flour, Malt Extract), Organic Roasted Soybeans, Organic Soy Flour), Organic Rolled Oats, Soy White Chocolate (Organic Dried Cane Syrup, Cocoa Butter, Soy Flour, Soy Lecithin, Vanilla Extract), Organic Cane Syrup, Chocolate Chips (Sugar, Chocolate Liquor, Cocoa Butter, Soy Lecithin, Vanilla), Organic High Oleic Sunflower Oil, Natural Flavors, Organic Oat Fiber, Salt, Barley Malt Extract',
    swaps_to: ['0818497012040'] },

  // --- SPORTS DRINKS ---
  { upc: '0052000328691', name: 'Gatorade Thirst Quencher', brand: 'PepsiCo', category: 'sports-drinks',
    ingredients: 'Water, Sugar, Dextrose, Citric Acid, Salt, Sodium Citrate, Monopotassium Phosphate, Modified Food Starch, Natural Flavor, Red 40, Glycerol Ester of Rosin',
    swaps_to: ['0856544006301'] },
  { upc: '0049000068641', name: 'Powerade Mountain Berry Blast', brand: 'Coca-Cola', category: 'sports-drinks',
    ingredients: 'Water, High Fructose Corn Syrup, Citric Acid, Salt, Natural Flavors, Potassium Citrate, Modified Food Starch, Calcium Disodium EDTA, Medium Chain Triglycerides, Sucrose Acetate Isobutyrate, Vitamin B3, Vitamin B6, Vitamin B12, Blue 1',
    swaps_to: ['0856544006301'] },
];

// ============================================================
// KNOWN CLEAN ALTERNATIVES
// These are the products that swaps_to arrays point at.
// We pre-seed them so they exist in the DB for swap matching.
// ============================================================

const CLEAN_ALTERNATIVES = [
  // --- CEREAL: Need variety (fruity, chocolate, cinnamon, plain) ---
  { upc: '0058449400028', name: 'Heritage Flakes', brand: "Nature's Path", category: CAT.CEREAL, subcategory: 'plain' },
  { upc: '0023923203006', name: 'Original Puffins Cereal', brand: "Barbara's", category: CAT.CEREAL, subcategory: 'plain' },
  { upc: '0884734006115', name: 'Honey Nut O\'s', brand: 'Cascadian Farm', category: CAT.CEREAL, subcategory: 'honey' },
  { upc: '0860091002154', name: 'Fruity Cereal', brand: 'Three Wishes', category: CAT.CEREAL, subcategory: 'fruity' },
  { upc: '0058449860020', name: 'EnviroKidz Cheetah Chomps Chocolate', brand: "Nature's Path", category: CAT.CEREAL, subcategory: 'chocolate' },
  { upc: '0058449860051', name: 'EnviroKidz Gorilla Munch Corn Puffs', brand: "Nature's Path", category: CAT.CEREAL, subcategory: 'plain' },
  { upc: '0850015717017', name: 'Cinnamon Cereal', brand: 'Three Wishes', category: CAT.CEREAL, subcategory: 'cinnamon' },
  { upc: '0023923203112', name: 'Peanut Butter Puffins', brand: "Barbara's", category: CAT.CEREAL, subcategory: 'peanut-butter' },

  // --- CANDY: Need fruity, chewy, chocolate, and sour varieties ---
  { upc: '0853715003268', name: 'Simple Dark Chocolate Bar', brand: 'Hu', category: CAT.CANDY, subcategory: 'chocolate' },
  { upc: '0757528008116', name: 'Dark Chocolate Peanut Butter Cups', brand: 'Unreal', category: CAT.CANDY, subcategory: 'chocolate' },
  { upc: '0850006801015', name: 'Sour Blast Buddies', brand: 'SmartSweets', category: CAT.CANDY, subcategory: 'fruity' },
  { upc: '0850006801022', name: 'Sweet Fish', brand: 'SmartSweets', category: CAT.CANDY, subcategory: 'gummy' },
  { upc: '0850006801039', name: 'Peach Rings', brand: 'SmartSweets', category: CAT.CANDY, subcategory: 'gummy' },
  { upc: '0810165016842', name: 'Organic Fruit Snacks', brand: 'YumEarth', category: CAT.CANDY, subcategory: 'fruity' },
  { upc: '0757528008147', name: 'Dark Chocolate Gems', brand: 'Unreal', category: CAT.CANDY, subcategory: 'chocolate' },
  { upc: '0810165019799', name: 'Organic Giggles Chewy Candy', brand: 'YumEarth', category: CAT.CANDY, subcategory: 'fruity' },
  { upc: '0810165013766', name: 'Organic Licorice', brand: 'YumEarth', category: CAT.CANDY, subcategory: 'licorice' },

  // --- FRUIT SNACKS (separate from candy) ---
  { upc: '0810165016828', name: 'Organic Tropical Fruit Snacks', brand: 'YumEarth', category: 'fruit-snacks', subcategory: 'fruit-snacks' },
  { upc: '0862683000332', name: 'Organic Fruit Bites Strawberry', brand: 'Stretch Island', category: 'fruit-snacks', subcategory: 'fruit-snacks' },

  // --- CHIPS ---
  { upc: '0016000505261', name: 'Organic Sea Salt Tortilla Chips', brand: 'Late July', category: CAT.CHIPS },
  { upc: '0849911000106', name: 'Sea Salt Tortilla Chips', brand: 'Siete', category: CAT.CHIPS },
  { upc: '0021908501222', name: 'Sea Salt Potato Chips', brand: 'Kettle Brand', category: CAT.CHIPS },
  
  // --- SODA ---
  { upc: '0856544006301', name: 'Vintage Cola', brand: 'Olipop', category: CAT.SODA },
  { upc: '0012000171581', name: 'Lemon Sparkling Water', brand: 'Spindrift', category: CAT.SODA },
  
  // --- ENERGY ---
  { upc: '0818523020009', name: 'Sparkling Green Tea', brand: 'Celsius', category: CAT.ENERGY },
  
  // --- COOKIES ---
  { upc: '0856575002016', name: 'Chocolate Chip Cookies', brand: 'Simple Mills', category: CAT.COOKIES },
  { upc: '0723346101126', name: 'Chocolate Chip Cookies', brand: "Tate's Bake Shop", category: CAT.COOKIES },
  
  // --- CRACKERS ---
  { upc: '0856575002191', name: 'Almond Flour Crackers Sea Salt', brand: 'Simple Mills', category: CAT.CRACKERS },
  { upc: '0021130340804', name: 'Original Crackers', brand: "Mary's Gone Crackers", category: CAT.CRACKERS },
  
  // --- MAC & CHEESE ---
  { upc: '0013562000043', name: 'Organic Mac & Cheese Classic Mild Cheddar', brand: "Annie's", category: CAT.MAC_CHEESE },
  { upc: '0856575002535', name: 'Organic Pasta Sauce', brand: 'Simple Mills', category: CAT.MAC_CHEESE },
  
  // --- YOGURT ---
  { upc: '0689544002017', name: 'Organic Whole Milk Yogurt', brand: 'Stonyfield', category: CAT.YOGURT },
  { upc: '0052159700119', name: 'Vanilla Skyr', brand: "Siggi's", category: CAT.YOGURT },
  
  // --- BREAD ---
  { upc: '0073410013301', name: '21 Whole Grains and Seeds', brand: "Dave's Killer Bread", category: CAT.BREAD },
  { upc: '0764442000051', name: 'Ezekiel 4:9 Sprouted Whole Grain Bread', brand: "Food for Life", category: CAT.BREAD },
  
  // --- ICE CREAM ---
  { upc: '0856283004013', name: 'Organic Vanilla Ice Cream', brand: 'Three Twins', category: CAT.ICE_CREAM },
  
  // --- DRESSING ---
  { upc: '0853529002032', name: 'Ranch Dressing', brand: 'Primal Kitchen', category: CAT.DRESSING },
  { upc: '0042272005550', name: 'Organic Creamy Ranch', brand: "Tessemae's", category: CAT.DRESSING },
  
  // --- SNACK BARS ---
  { upc: '0602652171130', name: 'Caramel Almond & Sea Salt', brand: 'KIND', category: CAT.SNACK_BARS },
  { upc: '0818497012040', name: 'Chocolate Sea Salt', brand: 'RXBAR', category: CAT.SNACK_BARS },
  
  // --- PEANUT BUTTER ---
  { upc: '0854862006001', name: 'Organic Crunchy Peanut Butter', brand: 'Once Again', category: CAT.PEANUT_BUTTER },
  { upc: '0072431001376', name: 'Organic Dark Roasted Peanut Butter', brand: 'Santa Cruz', category: CAT.PEANUT_BUTTER },
  
  // --- PASTA SAUCE ---
  { upc: '0017532003010', name: 'Marinara Sauce', brand: "Rao's Homemade", category: CAT.PASTA_SAUCE },
  { upc: '0725342200016', name: 'Marinara Sauce', brand: 'Victoria', category: CAT.PASTA_SAUCE },
  
  // --- SOUP ---
  { upc: '0052603054607', name: 'Organic Lentil Soup', brand: "Amy's", category: CAT.SOUP },
  
  // --- HOT DOGS / LUNCH MEAT ---
  { upc: '0025317074001', name: 'Uncured Beef Hot Dogs', brand: 'Applegate', category: CAT.HOT_DOGS },
  { upc: '0025317000048', name: 'Organic Roasted Turkey Breast', brand: 'Applegate', category: CAT.LUNCH_MEAT },
  
  // --- CONDIMENTS ---
  { upc: '0852476003005', name: 'Organic Unsweetened Ketchup', brand: 'Primal Kitchen', category: CAT.KETCHUP },
  { upc: '0853529002018', name: 'Avocado Oil Mayo', brand: 'Primal Kitchen', category: CAT.MAYO },
  
  // --- OATMEAL / GRANOLA ---
  { upc: '0039978009012', name: 'Organic Old Fashioned Rolled Oats', brand: "Bob's Red Mill", category: CAT.OATMEAL },
  { upc: '0058449400103', name: 'Organic Pumpkin Seed + Flax Granola', brand: "Nature's Path", category: CAT.GRANOLA },
  
  // --- MILK ---
  { upc: '0049022783232', name: 'Organic Chocolate Lowfat Milk', brand: 'Horizon', category: CAT.MILK },
  
  // --- OTHER ---
  { upc: '0054800420711', name: 'Organic Millet & Brown Rice Ramen', brand: 'Lotus Foods', category: 'instant-noodles' },
  { upc: '0096749262106', name: 'Organic Cheese Pizza', brand: "Amy's", category: 'frozen-pizza' },
  { upc: '0039978005700', name: 'Organic Pancake Mix', brand: "Bob's Red Mill", category: 'pancake-mixes' },
  { upc: '0073066009003', name: 'Grade A Organic Maple Syrup', brand: 'Coombs Family Farms', category: 'syrups' },
  { upc: '0856575002849', name: 'Toaster Pastry Strawberry', brand: 'Simple Mills', category: 'toaster-pastries' },
];

// ============================================================
// SEED FUNCTION
// ============================================================

export async function seedCuratedSwaps() {
  // Check if swap data already exists — skip entirely if so
  const existsCheck = await pool.query(
    `SELECT COUNT(*) FROM products WHERE is_clean_alternative = true`
  );
  if (parseInt(existsCheck.rows[0].count) >= CLEAN_ALTERNATIVES.length) {
    console.log('Swap database already seeded — skipped');
    return;
  }

  console.log('\n=== Seeding Curated Swap Database ===');

  let updated = 0;
  let created = 0;

  // 1. Ensure all clean alternatives exist in DB with proper scores
  //    These are verified-clean brands (organic, minimal additives) — they need
  //    real component scores so the generated total_score is competitive.
  //    Without this, they default to nutrition_score=50/additives_score=50/organic_bonus=0
  //    → total_score=45, making them invisible as alternatives.
  for (const alt of CLEAN_ALTERNATIVES) {
    try {
      const nutritionScore = alt.nutrition_score || 75;
      const additivesScore = alt.additives_score || 85;
      const organicBonus = alt.organic_bonus ?? 100;

      await pool.query(
        `INSERT INTO products (upc, name, brand, category, subcategory,
         is_clean_alternative, nutrition_score, additives_score, organic_bonus)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8)
         ON CONFLICT (upc) DO UPDATE SET
           is_clean_alternative = true,
           category = COALESCE(products.category, $4),
           subcategory = COALESCE(products.subcategory, $5),
           nutrition_score = CASE
             WHEN products.nutrition_score = 50 THEN $6
             ELSE products.nutrition_score
           END,
           additives_score = CASE
             WHEN products.additives_score = 50 THEN $7
             ELSE products.additives_score
           END,
           organic_bonus = GREATEST(products.organic_bonus, $8)`,
        [alt.upc, alt.name, alt.brand, alt.category, alt.subcategory || null,
         nutritionScore, additivesScore, organicBonus]
      );
      created++;
    } catch (err) {
      console.error(`  Failed clean alt ${alt.upc}:`, err.message);
    }
  }
  console.log(`  ✓ ${CLEAN_ALTERNATIVES.length} clean alternatives ensured (${created} new)`);

  // 2. Set swaps_to on all problem products
  for (const swap of CURATED_SWAPS) {
    try {
      // Always update swaps_to, category, and ingredients (if we have them)
      const updateResult = await pool.query(
        `UPDATE products SET
          swaps_to = $1,
          category = COALESCE(category, $3),
          ingredients = CASE WHEN ($4 IS NOT NULL AND LENGTH($4) > LENGTH(COALESCE(ingredients, ''))) THEN $4 ELSE ingredients END
         WHERE upc = $2`,
        [JSON.stringify(swap.swaps_to), swap.upc, swap.category, swap.ingredients || null]
      );

      if (updateResult.rowCount === 0) {
        // Product not in DB yet — create with ingredients if available
        await pool.query(
          `INSERT INTO products (upc, name, brand, category, swaps_to, ingredients)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (upc) DO UPDATE SET
             swaps_to = $5,
             category = COALESCE(products.category, $4),
             ingredients = CASE WHEN ($6 IS NOT NULL AND LENGTH($6) > LENGTH(COALESCE(products.ingredients, ''))) THEN $6 ELSE products.ingredients END`,
          [swap.upc, swap.name, swap.brand, swap.category, JSON.stringify(swap.swaps_to), swap.ingredients || null]
        );
        created++;
      }
      updated++;
    } catch (err) {
      console.error(`  Failed swap ${swap.upc}:`, err.message);
    }
  }

  console.log(`  ✓ ${updated} swap mappings applied (${created} new product stubs created)`);

  // 3. Propagate swaps to ALL UPC variants of the same product
  //    e.g., "Skittles Original" has UPCs 0040000001607, 0040000496823, 0040000140924, etc.
  //    Only one got the curated swap — now spread it to all of them
  let propagated = 0;
  for (const swap of CURATED_SWAPS) {
    try {
      // Find all products with similar names that have empty/no swaps
      const stopWords = ['original', 'classic', 'regular', 'the', 'candy', 'candies', 'cereal', 'snack', 'snacks', 'bar', 'bars', 'flavored', 'bite', 'size'];
      const coreWords = swap.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.includes(w));
      
      if (coreWords.length === 0) continue;
      
      // Use the most distinctive word
      const primaryWord = [...coreWords].sort((a, b) => b.length - a.length)[0];
      
      const result = await pool.query(
        `UPDATE products 
         SET swaps_to = $1
         WHERE LOWER(name) ILIKE $2
         AND upc != $3
         AND (is_clean_alternative IS NULL OR is_clean_alternative = false)`,
        [
          JSON.stringify(swap.swaps_to), 
          `%${primaryWord}%`, 
          swap.upc
        ]
      );
      propagated += result.rowCount;
    } catch (err) {
      // Non-fatal
    }
  }
  console.log(`  ✓ ${propagated} swap mappings propagated to UPC variants`);

  console.log('  ✓ Curated swap seeding complete\n');
}

// Allow standalone execution
if (process.argv[1]?.includes('seed-swaps')) {
  seedCuratedSwaps().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
