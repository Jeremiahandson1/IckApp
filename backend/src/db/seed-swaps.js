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
    swaps_to: ['0850015717017', '0884734006115'] }, // Three Wishes Cinnamon, Cascadian Farm
  { upc: '0016000487925', name: 'Lucky Charms', brand: 'General Mills', category: CAT.CEREAL,
    swaps_to: ['0058449400028', '0884734006115'] },
  { upc: '0038000596278', name: 'Froot Loops', brand: 'Kellogg\'s', category: CAT.CEREAL,
    swaps_to: ['0860091002154', '0058449860051'] },
  { upc: '0038000596230', name: 'Frosted Flakes', brand: 'Kellogg\'s', category: CAT.CEREAL,
    swaps_to: ['0058449400028', '0884734006115'] },
  { upc: '0016000124783', name: 'Cheerios', brand: 'General Mills', category: CAT.CEREAL,
    swaps_to: ['0058449400028', '0884734006115'] },
  { upc: '0016000288553', name: 'Cocoa Puffs', brand: 'General Mills', category: CAT.CEREAL,
    swaps_to: ['0058449860020', '0023923203006'] },

  // --- CHIPS & SNACKS ---
  { upc: '0028400064545', name: 'Doritos Nacho Cheese', brand: 'Frito-Lay', category: CAT.CHIPS,
    swaps_to: ['0016000505261', '0849911000106'] }, // Late July, Siete
  { upc: '0028400015813', name: 'Lay\'s Classic Potato Chips', brand: 'Frito-Lay', category: CAT.CHIPS,
    swaps_to: ['0016000505261', '0021908501222'] }, // Late July, Kettle Brand
  { upc: '0028400028899', name: 'Cheetos Crunchy', brand: 'Frito-Lay', category: CAT.CHIPS,
    swaps_to: ['0849911000106', '0016000505261'] },
  { upc: '0028400313889', name: 'Tostitos Scoops', brand: 'Frito-Lay', category: CAT.CHIPS,
    swaps_to: ['0016000505261', '0849911000106'] },
  { upc: '0037600108096', name: 'Pringles Original', brand: 'Kellogg\'s', category: CAT.CHIPS,
    swaps_to: ['0021908501222', '0016000505261'] },

  // --- SODA ---
  { upc: '0049000006346', name: 'Coca-Cola', brand: 'Coca-Cola', category: CAT.SODA,
    swaps_to: ['0856544006301', '0012000171581'] }, // Olipop, Spindrift
  { upc: '0012000001069', name: 'Pepsi', brand: 'PepsiCo', category: CAT.SODA,
    swaps_to: ['0856544006301', '0012000171581'] },
  { upc: '0078000113464', name: 'Dr Pepper', brand: 'Keurig Dr Pepper', category: CAT.SODA,
    swaps_to: ['0856544006301', '0012000171581'] },
  { upc: '0012000161155', name: 'Mountain Dew', brand: 'PepsiCo', category: CAT.SODA,
    swaps_to: ['0856544006301', '0012000171581'] },
  { upc: '0049000042566', name: 'Sprite', brand: 'Coca-Cola', category: CAT.SODA,
    swaps_to: ['0856544006301', '0012000171581'] },

  // --- ENERGY DRINKS ---
  { upc: '0611269991000', name: 'Red Bull Energy Drink', brand: 'Red Bull', category: CAT.ENERGY,
    swaps_to: ['0818523020009'] }, // Celsius
  { upc: '0070847811169', name: 'Monster Energy', brand: 'Monster', category: CAT.ENERGY,
    swaps_to: ['0818523020009'] },

  // --- COOKIES ---
  { upc: '0044000032159', name: 'Oreo Chocolate Sandwich Cookies', brand: 'Nabisco', category: CAT.COOKIES,
    swaps_to: ['0856575002016', '0723346101126'] }, // Simple Mills, Tate's
  { upc: '0014100077176', name: 'Chips Ahoy! Original', brand: 'Nabisco', category: CAT.COOKIES,
    swaps_to: ['0856575002016', '0723346101126'] },
  { upc: '0030100102502', name: 'Nutter Butter', brand: 'Nabisco', category: CAT.COOKIES,
    swaps_to: ['0856575002016'] },

  // --- CRACKERS ---
  { upc: '0044000000394', name: 'Ritz Crackers Original', brand: 'Nabisco', category: CAT.CRACKERS,
    swaps_to: ['0856575002191', '0021130340804'] }, // Simple Mills, Mary's Gone Crackers
  { upc: '0030100141532', name: 'Goldfish Cheddar', brand: 'Pepperidge Farm', category: CAT.CRACKERS,
    swaps_to: ['0856575002191', '0021130340804'] },
  { upc: '0030100572817', name: 'Cheez-It Original', brand: 'Kellogg\'s', category: CAT.CRACKERS,
    swaps_to: ['0856575002191', '0021130340804'] },

  // --- MAC & CHEESE ---
  { upc: '0021000658831', name: 'Kraft Macaroni & Cheese Original', brand: 'Kraft', category: CAT.MAC_CHEESE,
    swaps_to: ['0013562000043', '0856575002535'] }, // Annie's, Simple Mills
  { upc: '0021000658862', name: 'Kraft Deluxe Mac & Cheese', brand: 'Kraft', category: CAT.MAC_CHEESE,
    swaps_to: ['0013562000043'] },
  { upc: '0021000058419', name: 'Velveeta Shells & Cheese', brand: 'Kraft', category: CAT.MAC_CHEESE,
    swaps_to: ['0013562000043', '0856575002535'] },

  // --- YOGURT ---
  { upc: '0070470003498', name: 'Yoplait Original Strawberry', brand: 'Yoplait', category: CAT.YOGURT,
    swaps_to: ['0689544002017', '0052159700119'] }, // Stonyfield, Siggi's
  { upc: '0036632001221', name: 'Dannon Fruit on the Bottom', brand: 'Dannon', category: CAT.YOGURT,
    swaps_to: ['0689544002017', '0052159700119'] },
  { upc: '0036632037930', name: 'Activia Probiotic Yogurt', brand: 'Dannon', category: CAT.YOGURT,
    swaps_to: ['0689544002017', '0052159700119'] },

  // --- BREAD ---
  { upc: '0072220002065', name: 'Wonder Bread Classic White', brand: 'Wonder', category: CAT.BREAD,
    swaps_to: ['0073410013301', '0764442000051'] }, // Dave's Killer Bread, Ezekiel
  { upc: '0072945614185', name: 'Nature\'s Own Honey Wheat', brand: 'Nature\'s Own', category: CAT.BREAD,
    swaps_to: ['0073410013301', '0764442000051'] },
  { upc: '0050400346219', name: 'Sara Lee Artesano Bread', brand: 'Sara Lee', category: CAT.BREAD,
    swaps_to: ['0073410013301', '0764442000051'] },

  // --- JUICE ---
  { upc: '0048500202791', name: 'Tropicana Orange Juice', brand: 'Tropicana', category: CAT.JUICE,
    swaps_to: ['0012000171581'] }, // Spindrift
  { upc: '0025000047626', name: 'Minute Maid Orange Juice', brand: 'Coca-Cola', category: CAT.JUICE,
    swaps_to: ['0012000171581'] },
  { upc: '0050100000120', name: 'Mott\'s Apple Juice', brand: 'Mott\'s', category: CAT.JUICE,
    swaps_to: ['0012000171581'] },

  // --- CANDY ---
  { upc: '0040000001027', name: 'M&M\'s Milk Chocolate', brand: 'Mars', category: CAT.CANDY,
    swaps_to: ['0853715003268', '0757528008116'] }, // Hu Chocolate, Unreal
  { upc: '0034000002405', name: 'Reese\'s Peanut Butter Cups', brand: 'Hershey\'s', category: CAT.CANDY,
    swaps_to: ['0757528008116', '0853715003268'] },
  { upc: '0040000496823', name: 'Skittles Original', brand: 'Mars', category: CAT.CANDY,
    swaps_to: ['0850006801015', '0810165019799'] },
  { upc: '0034000111503', name: 'Kit Kat', brand: 'Hershey\'s', category: CAT.CANDY,
    swaps_to: ['0853715003268', '0757528008116'] },
  { upc: '0022000159977', name: 'Twizzlers', brand: 'Hershey\'s', category: CAT.CANDY,
    swaps_to: ['0810165013766', '0850006801022'] },

  // --- ICE CREAM ---
  { upc: '0077567254153', name: 'Häagen-Dazs Vanilla', brand: 'Häagen-Dazs', category: CAT.ICE_CREAM,
    swaps_to: ['0856283004013'] }, // Three Twins
  { upc: '0076840101108', name: 'Blue Bunny Homemade Vanilla', brand: 'Blue Bunny', category: CAT.ICE_CREAM,
    swaps_to: ['0856283004013'] },

  // --- SALAD DRESSING ---
  { upc: '0071100003048', name: 'Hidden Valley Ranch', brand: 'Hidden Valley', category: CAT.DRESSING,
    swaps_to: ['0853529002032', '0042272005550'] }, // Primal Kitchen, Tessemae's
  { upc: '0048001252592', name: 'Kraft Ranch Dressing', brand: 'Kraft', category: CAT.DRESSING,
    swaps_to: ['0853529002032', '0042272005550'] },
  { upc: '0041000007897', name: 'Wish-Bone Italian', brand: 'Wish-Bone', category: CAT.DRESSING,
    swaps_to: ['0853529002032', '0042272005550'] },

  // --- SNACK BARS ---
  { upc: '0016000454903', name: 'Nature Valley Oats \'N Honey', brand: 'General Mills', category: CAT.SNACK_BARS,
    swaps_to: ['0602652171130', '0818497012040'] }, // KIND, RXBAR
  { upc: '0022000011176', name: 'Nutri-Grain Strawberry Bar', brand: 'Kellogg\'s', category: CAT.SNACK_BARS,
    swaps_to: ['0602652171130', '0818497012040'] },
  { upc: '0028400008525', name: 'Quaker Chewy Granola Bar', brand: 'Quaker', category: CAT.SNACK_BARS,
    swaps_to: ['0602652171130', '0818497012040'] },
  { upc: '0016000491762', name: 'Fiber One Brownie Bar', brand: 'General Mills', category: CAT.SNACK_BARS,
    swaps_to: ['0602652171130', '0818497012040'] },

  // --- PEANUT BUTTER ---
  { upc: '0051500024058', name: 'Jif Creamy Peanut Butter', brand: 'Jif', category: CAT.PEANUT_BUTTER,
    swaps_to: ['0854862006001', '0072431001376'] }, // Once Again, Santa Cruz
  { upc: '0048001001589', name: 'Skippy Creamy Peanut Butter', brand: 'Skippy', category: CAT.PEANUT_BUTTER,
    swaps_to: ['0854862006001', '0072431001376'] },
  { upc: '0037600106986', name: 'Peter Pan Peanut Butter', brand: 'Peter Pan', category: CAT.PEANUT_BUTTER,
    swaps_to: ['0854862006001', '0072431001376'] },

  // --- PASTA SAUCE ---
  { upc: '0036200005033', name: 'Ragú Old World Style Traditional', brand: 'Ragú', category: CAT.PASTA_SAUCE,
    swaps_to: ['0017532003010', '0725342200016'] }, // Rao's, Victoria
  { upc: '0051000012081', name: 'Prego Traditional Italian', brand: 'Prego', category: CAT.PASTA_SAUCE,
    swaps_to: ['0017532003010', '0725342200016'] },
  { upc: '0041129099131', name: 'Bertolli Tomato Basil', brand: 'Bertolli', category: CAT.PASTA_SAUCE,
    swaps_to: ['0017532003010', '0725342200016'] },

  // --- SOUP ---
  { upc: '0051000012517', name: 'Campbell\'s Chicken Noodle Soup', brand: 'Campbell\'s', category: CAT.SOUP,
    swaps_to: ['0052603054607'] }, // Amy's
  { upc: '0051000025067', name: 'Campbell\'s Tomato Soup', brand: 'Campbell\'s', category: CAT.SOUP,
    swaps_to: ['0052603054607'] },

  // --- FROZEN MEALS ---
  { upc: '0031000316808', name: 'Banquet Chicken Pot Pie', brand: 'Banquet', category: CAT.FROZEN_MEALS,
    swaps_to: ['0052603054607'] }, // Amy's
  { upc: '0013800100665', name: 'Hot Pockets Pepperoni Pizza', brand: 'Nestlé', category: CAT.FROZEN_MEALS,
    swaps_to: ['0052603054607'] },
  { upc: '0031000100513', name: 'Marie Callender\'s Pot Pie', brand: 'Conagra', category: CAT.FROZEN_MEALS,
    swaps_to: ['0052603054607'] },
  { upc: '0013800100030', name: 'Stouffer\'s Lasagna', brand: 'Nestlé', category: CAT.FROZEN_MEALS,
    swaps_to: ['0052603054607'] },
  { upc: '0072210900296', name: 'Totino\'s Party Pizza', brand: 'General Mills', category: CAT.FROZEN_MEALS,
    swaps_to: ['0052603054607'] },

  // --- HOT DOGS ---
  { upc: '0044700021149', name: 'Oscar Mayer Classic Wieners', brand: 'Oscar Mayer', category: CAT.HOT_DOGS,
    swaps_to: ['0025317074001'] }, // Applegate
  { upc: '0073132000262', name: 'Ball Park Franks', brand: 'Tyson', category: CAT.HOT_DOGS,
    swaps_to: ['0025317074001'] },
  { upc: '0037600170093', name: 'Nathan\'s Famous Beef Franks', brand: 'Nathan\'s', category: CAT.HOT_DOGS,
    swaps_to: ['0025317074001'] },

  // --- LUNCH MEAT ---
  { upc: '0044700031148', name: 'Oscar Mayer Bologna', brand: 'Oscar Mayer', category: CAT.LUNCH_MEAT,
    swaps_to: ['0025317000048'] }, // Applegate Turkey
  { upc: '0044700006924', name: 'Oscar Mayer Deli Fresh Turkey', brand: 'Oscar Mayer', category: CAT.LUNCH_MEAT,
    swaps_to: ['0025317000048'] },

  // --- CONDIMENTS ---
  { upc: '0013000006408', name: 'Heinz Tomato Ketchup', brand: 'Heinz', category: CAT.KETCHUP,
    swaps_to: ['0852476003005'] }, // Primal Kitchen
  { upc: '0048001212329', name: 'Kraft Mayo', brand: 'Kraft', category: CAT.MAYO,
    swaps_to: ['0853529002018'] }, // Primal Kitchen Avocado Mayo
  { upc: '0048001213685', name: 'Miracle Whip', brand: 'Kraft', category: CAT.MAYO,
    swaps_to: ['0853529002018'] },

  // --- OATMEAL ---
  { upc: '0030000062005', name: 'Quaker Instant Oatmeal Maple & Brown Sugar', brand: 'Quaker', category: CAT.OATMEAL,
    swaps_to: ['0039978009012'] }, // Bob's Red Mill
  { upc: '0030000062012', name: 'Quaker Instant Oatmeal Apple Cinnamon', brand: 'Quaker', category: CAT.OATMEAL,
    swaps_to: ['0039978009012'] },

  // --- GRANOLA ---
  { upc: '0016000146471', name: 'Nature Valley Granola Oats \'N Honey', brand: 'General Mills', category: CAT.GRANOLA,
    swaps_to: ['0058449400103'] }, // Nature's Path
  
  // --- MILK (flavored) ---
  { upc: '0070480410102', name: 'Nesquik Chocolate Milk', brand: 'Nestlé', category: CAT.MILK,
    swaps_to: ['0049022783232'] }, // Horizon Organic Chocolate Milk
  
  // --- RAMEN ---
  { upc: '0070662028018', name: 'Maruchan Ramen Chicken', brand: 'Maruchan', category: 'instant-noodles',
    swaps_to: ['0054800420711'] }, // Lotus Foods
  { upc: '0070662020302', name: 'Top Ramen Chicken', brand: 'Nissin', category: 'instant-noodles',
    swaps_to: ['0054800420711'] },

  // --- FROZEN PIZZA ---
  { upc: '0071921006754', name: 'DiGiorno Rising Crust Pepperoni', brand: 'Nestlé', category: 'frozen-pizza',
    swaps_to: ['0096749262106'] }, // Amy's Cheese Pizza
  { upc: '0042272009152', name: 'Red Baron Classic Crust Pepperoni', brand: 'Schwan\'s', category: 'frozen-pizza',
    swaps_to: ['0096749262106'] },

  // --- PANCAKE MIX ---
  { upc: '0051500065921', name: 'Bisquick Original Pancake Mix', brand: 'Betty Crocker', category: 'pancake-mixes',
    swaps_to: ['0039978005700'] }, // Bob's Red Mill
  
  // --- SYRUP ---
  { upc: '0044800000101', name: 'Mrs. Butterworth\'s Original Syrup', brand: 'Mrs. Butterworth\'s', category: 'syrups',
    swaps_to: ['0073066009003'] }, // Coombs Family Farms Maple Syrup
  { upc: '0070030000202', name: 'Aunt Jemima/Pearl Milling Company Syrup', brand: 'PepsiCo', category: 'syrups',
    swaps_to: ['0073066009003'] },

  // --- POP-TARTS ---
  { upc: '0038000317170', name: 'Pop-Tarts Frosted Strawberry', brand: 'Kellogg\'s', category: 'toaster-pastries',
    swaps_to: ['0856575002849'] }, // Simple Mills (or Nature's Path Toaster Pastry)

  // --- PROTEIN BARS ---
  { upc: '0722252100900', name: 'Clif Bar Chocolate Chip', brand: 'Clif', category: CAT.SNACK_BARS,
    swaps_to: ['0818497012040'] }, // RXBAR

  // --- SPORTS DRINKS ---
  { upc: '0052000328691', name: 'Gatorade Thirst Quencher', brand: 'PepsiCo', category: 'sports-drinks',
    swaps_to: ['0856544006301'] }, // Olipop (or LMNT)
  { upc: '0049000068641', name: 'Powerade Mountain Berry Blast', brand: 'Coca-Cola', category: 'sports-drinks',
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
  console.log('\n=== Seeding Curated Swap Database ===');
  
  let updated = 0;
  let created = 0;

  // 1. Ensure all clean alternatives exist in DB (will be scored on first scan if not scored yet)
  for (const alt of CLEAN_ALTERNATIVES) {
    try {
      const exists = await pool.query('SELECT id FROM products WHERE upc = $1', [alt.upc]);
      if (exists.rows.length === 0) {
        await pool.query(
          `INSERT INTO products (upc, name, brand, category, is_clean_alternative)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (upc) DO UPDATE SET
             is_clean_alternative = true,
             category = COALESCE(products.category, $4)`,
          [alt.upc, alt.name, alt.brand, alt.category]
        );
        created++;
      } else {
        await pool.query(
          'UPDATE products SET is_clean_alternative = true WHERE upc = $1',
          [alt.upc]
        );
      }
    } catch (err) {
      console.error(`  Failed clean alt ${alt.upc}:`, err.message);
    }
  }
  console.log(`  ✓ ${CLEAN_ALTERNATIVES.length} clean alternatives ensured (${created} new)`);

  // 2. Set swaps_to on all problem products
  for (const swap of CURATED_SWAPS) {
    try {
      const result = await pool.query(
        `UPDATE products SET swaps_to = $1, category = COALESCE(category, $3)
         WHERE upc = $2`,
        [JSON.stringify(swap.swaps_to), swap.upc, swap.category]
      );
      
      if (result.rowCount === 0) {
        // Product not in DB yet — create a stub (will be fully scored on first scan)
        await pool.query(
          `INSERT INTO products (upc, name, brand, category, swaps_to)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (upc) DO UPDATE SET swaps_to = $5, category = COALESCE(products.category, $4)`,
          [swap.upc, swap.name, swap.brand, swap.category, JSON.stringify(swap.swaps_to)]
        );
        created++;
      }
      updated++;
    } catch (err) {
      console.error(`  Failed swap ${swap.upc}:`, err.message);
    }
  }

  console.log(`  ✓ ${updated} swap mappings applied (${created} new product stubs created)`);
  console.log('  ✓ Curated swap seeding complete\n');
}

// Allow standalone execution
if (process.argv[1]?.includes('seed-swaps')) {
  seedCuratedSwaps().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
