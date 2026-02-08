import pool from './init.js';
import { scoreProduct } from '../utils/scoring.js';
import { seedCuratedSwaps } from './seed-swaps.js';

// ============================================================
// HARMFUL INGREDIENTS DATABASE
// Now with source_url for scientific credibility
// ============================================================

const HARMFUL_INGREDIENTS = [
  // --- ARTIFICIAL COLORS ---
  { name: 'Red 40', aliases: ['Allura Red', 'FD&C Red 40', 'E129', 'CI 16035'], severity: 8, category: 'artificial_color', health_effects: 'Hyperactivity in children, allergic reactions, potential carcinogen', banned_in: ['EU (requires warning label)', 'Austria', 'Belgium', 'Denmark', 'France', 'Germany', 'Switzerland', 'Sweden', 'Norway'], why_used: 'Cheaper than natural colorings like beet juice. Costs ~$3/kg vs $30/kg for natural alternatives.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/22214442/' },
  { name: 'Yellow 5', aliases: ['Tartrazine', 'FD&C Yellow 5', 'E102', 'CI 19140'], severity: 7, category: 'artificial_color', health_effects: 'Hyperactivity, asthma, hives, linked to behavioral issues in children', banned_in: ['Austria', 'Norway', 'EU (warning label required)'], why_used: 'Bright stable color at 1/10th the cost of turmeric-based alternatives.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/17825405/' },
  { name: 'Yellow 6', aliases: ['Sunset Yellow', 'FD&C Yellow 6', 'E110', 'CI 15985'], severity: 7, category: 'artificial_color', health_effects: 'Hyperactivity, allergic reactions, potential carcinogen contaminants', banned_in: ['Finland', 'Norway', 'EU (warning label required)'], why_used: 'Cheap orange/yellow coloring for snacks, cereals, and candy.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/17825405/' },
  { name: 'Blue 1', aliases: ['Brilliant Blue', 'FD&C Blue 1', 'E133', 'CI 42090'], severity: 5, category: 'artificial_color', health_effects: 'Allergic reactions, chromosomal damage in studies', banned_in: ['Austria', 'Belgium', 'France', 'Germany', 'Norway', 'Sweden', 'Switzerland'], why_used: 'Extremely cheap synthetic dye for beverages and candy.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/22214442/' },
  { name: 'Blue 2', aliases: ['Indigotine', 'FD&C Blue 2', 'E132', 'CI 73015'], severity: 5, category: 'artificial_color', health_effects: 'Brain tumors in animal studies, allergic reactions', banned_in: ['Norway'], why_used: 'Low-cost coloring for pet foods, candy, beverages.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/22214442/' },
  { name: 'Red 3', aliases: ['Erythrosine', 'FD&C Red 3', 'E127', 'CI 45430'], severity: 9, category: 'artificial_color', health_effects: 'Thyroid tumors in animals, recognized carcinogen by FDA', banned_in: ['EU (limited use)', 'FDA banned in cosmetics but still allowed in food'], why_used: 'Very cheap cherry/pink coloring. FDA proposed ban in 1990 but never finalized.', source_url: 'https://www.fda.gov/food/food-additives-petitions/red-no-3' },
  { name: 'Green 3', aliases: ['Fast Green FCF', 'FD&C Green 3', 'E143'], severity: 5, category: 'artificial_color', health_effects: 'Bladder tumors in animal studies', banned_in: ['EU', 'Japan'], why_used: 'Cheap green coloring for beverages, candy, ice cream.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/22214442/' },
  { name: 'Citrus Red 2', aliases: ['CI 12156'], severity: 7, category: 'artificial_color', health_effects: 'Potential carcinogen, bladder tumors in animals', banned_in: ['EU', 'Many countries'], why_used: 'Used to color orange peels to make them look riper.', source_url: 'https://monographs.iarc.who.int/list-of-classifications' },
  { name: 'Caramel Color (Class III/IV)', aliases: ['E150c', 'E150d', 'ammonia caramel', '4-MEI'], severity: 6, category: 'artificial_color', health_effects: 'Contains 4-MEI, a potential carcinogen. California requires cancer warning above certain levels.', banned_in: ['Not banned but regulated differently globally'], why_used: 'Universal brown coloring for cola, soy sauce, baked goods. Extremely cheap.', source_url: 'https://oehha.ca.gov/proposition-65/chemicals/4-methylimidazole' },

  // --- ARTIFICIAL SWEETENERS ---
  { name: 'Aspartame', aliases: ['Equal', 'NutraSweet', 'E951', 'APM'], severity: 6, category: 'artificial_sweetener', health_effects: 'WHO classified as "possibly carcinogenic" (Group 2B) in 2023. Headaches, neurological concerns.', banned_in: ['Not banned but carries warnings in EU', 'Japan (restricted use)'], why_used: '200x sweeter than sugar at fraction of cost. Major profit driver for diet products.', source_url: 'https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment-results-released' },
  { name: 'Sucralose', aliases: ['Splenda', 'E955'], severity: 5, category: 'artificial_sweetener', health_effects: 'Gut microbiome disruption, inflammatory markers, genotoxic metabolites found in 2023 studies', banned_in: ['Not currently banned'], why_used: '600x sweeter than sugar. Allows "sugar-free" label claims that drive sales.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/37323144/' },
  { name: 'Acesulfame Potassium', aliases: ['Ace-K', 'Acesulfame K', 'E950', 'Sunett'], severity: 5, category: 'artificial_sweetener', health_effects: 'Contains methylene chloride, potential carcinogen. Disrupts metabolic processes.', banned_in: ['Not banned but restricted in some EU products'], why_used: 'Cheap sweetener often blended with other sweeteners to mask bitter aftertaste.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/28472038/' },
  { name: 'Saccharin', aliases: ['Sweet\'N Low', 'E954'], severity: 4, category: 'artificial_sweetener', health_effects: 'Was on carcinogen list until 2000. Bladder cancer in animal studies.', banned_in: ['Canada (banned in food, allowed as tabletop sweetener)'], why_used: 'Oldest artificial sweetener, extremely cheap, 300x sweeter than sugar.', source_url: 'https://ntp.niehs.nih.gov/ntp/roc/content/profiles/saccharin.pdf' },
  { name: 'Neotame', aliases: ['E961', 'Newtame'], severity: 5, category: 'artificial_sweetener', health_effects: 'Similar concerns to aspartame. Limited long-term human studies.', banned_in: ['Not widely banned'], why_used: '13,000x sweeter than sugar — incredibly cost-effective for manufacturers.', source_url: 'https://www.efsa.europa.eu/en/efsajournal/pub/581' },

  // --- PRESERVATIVES ---
  { name: 'BHA', aliases: ['Butylated Hydroxyanisole', 'E320'], severity: 8, category: 'preservative', health_effects: 'Reasonably anticipated carcinogen (NTP). Endocrine disruptor.', banned_in: ['Japan', 'EU (restricted)', 'UK (restricted)', 'Australia (restricted)'], why_used: 'Prevents fat from going rancid. Extends shelf life by months at pennies per unit.', source_url: 'https://ntp.niehs.nih.gov/ntp/roc/content/profiles/butylatedhydroxyanisole.pdf' },
  { name: 'BHT', aliases: ['Butylated Hydroxytoluene', 'E321'], severity: 7, category: 'preservative', health_effects: 'Liver and kidney damage, tumor promotion in animals, endocrine disruption', banned_in: ['Japan', 'Romania', 'Sweden', 'Australia (restricted)'], why_used: 'Works with BHA to extend shelf life. Costs <$5/kg for manufacturers.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/12042099/' },
  { name: 'TBHQ', aliases: ['Tertiary Butylhydroquinone', 'E319', 'tert-Butylhydroquinone'], severity: 7, category: 'preservative', health_effects: 'Liver enlargement, neurotoxic effects, possible carcinogen at high doses', banned_in: ['Japan', 'Some EU restrictions'], why_used: 'Prevents oxidation in cooking oils and processed foods at very low cost.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/34578276/' },
  { name: 'Sodium Nitrite', aliases: ['E250', 'nitrite'], severity: 7, category: 'preservative', health_effects: 'Forms carcinogenic nitrosamines in the body. Linked to colorectal cancer by IARC.', banned_in: ['EU (strict limits)', 'Denmark (very low limits)'], why_used: 'Preserves pink color in processed meats and prevents botulism. Alternatives exist but cost more.', source_url: 'https://monographs.iarc.who.int/wp-content/uploads/2018/06/mono114.pdf' },
  { name: 'Sodium Nitrate', aliases: ['E251', 'Chile saltpeter'], severity: 7, category: 'preservative', health_effects: 'Converts to nitrite in body. Same carcinogenic nitrosamine concern.', banned_in: ['EU (strict limits)', 'Norway (restricted)'], why_used: 'Curing agent for bacon, ham, hot dogs. Industry resists change due to cost.', source_url: 'https://monographs.iarc.who.int/wp-content/uploads/2018/06/mono114.pdf' },
  { name: 'Potassium Bromate', aliases: ['E924', 'bromated flour'], severity: 9, category: 'preservative', health_effects: 'Classified as possibly carcinogenic (IARC 2B). Kidney tumors in animals.', banned_in: ['EU', 'UK', 'Canada', 'Brazil', 'China', 'India', 'Japan', 'South Korea'], why_used: 'Makes bread dough rise higher and appear whiter. Costs pennies. US still allows it.', source_url: 'https://monographs.iarc.who.int/list-of-classifications' },
  { name: 'Sodium Benzoate', aliases: ['E211', 'benzoate of soda'], severity: 6, category: 'preservative', health_effects: 'Forms benzene (carcinogen) when combined with vitamin C. Hyperactivity in children.', banned_in: ['Not banned but EU requires warning label when combined with certain colors'], why_used: 'Very cheap preservative for acidic foods and soft drinks.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/17825405/' },
  { name: 'Potassium Sorbate', aliases: ['E202'], severity: 3, category: 'preservative', health_effects: 'Generally considered safe but can cause skin/eye irritation. Some genotoxicity concerns at high levels.', banned_in: ['Not banned'], why_used: 'Common mold inhibitor in baked goods, cheese, dried fruits.', source_url: 'https://www.efsa.europa.eu/en/efsajournal/pub/4144' },
  { name: 'Sulfur Dioxide', aliases: ['E220', 'sulfites', 'sodium sulfite', 'sodium bisulfite', 'sodium metabisulfite', 'E221', 'E222', 'E223', 'E224', 'E225', 'E226', 'E228'], severity: 6, category: 'preservative', health_effects: 'Severe reactions in asthmatics. Headaches, breathing difficulty, anaphylaxis.', banned_in: ['Banned on raw fruits/vegetables in US. EU requires labeling.'], why_used: 'Prevents browning in dried fruits, wine. Very cheap preservation method.', source_url: 'https://www.fda.gov/food/food-additives-petitions/sulfites' },

  // --- EMULSIFIERS ---
  { name: 'Carrageenan', aliases: ['E407', 'Irish moss extract'], severity: 6, category: 'emulsifier', health_effects: 'Gut inflammation, potential carcinogen (degraded form). IBS/IBD aggravation.', banned_in: ['EU (banned in infant formula)', 'Some organic standards'], why_used: 'Thickener/stabilizer in dairy alternatives, deli meats. Cheaper than alternatives like guar gum.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/28689669/' },
  { name: 'Polysorbate 80', aliases: ['E433', 'Tween 80', 'polyoxyethylene sorbitan monooleate'], severity: 6, category: 'emulsifier', health_effects: 'Gut microbiome disruption, intestinal inflammation, metabolic syndrome in animal studies', banned_in: ['Restricted in some EU organic standards'], why_used: 'Emulsifier in ice cream, sauces. Prevents separation at very low cost.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/25731162/' },
  { name: 'Mono- and Diglycerides', aliases: ['E471', 'monoglycerides', 'diglycerides', 'DATEM', 'E472e'], severity: 4, category: 'emulsifier', health_effects: 'May contain trans fats not listed on label. Gut microbiome disruption.', banned_in: ['Not banned (widely used globally)'], why_used: 'Improve texture, extend shelf life in baked goods. Very common and cheap.', source_url: 'https://www.ewg.org/foodscores/content/natural-vs-artificial-ingredients/' },

  // --- FLAVOR ENHANCERS ---
  { name: 'Monosodium Glutamate', aliases: ['MSG', 'E621', 'glutamic acid', 'hydrolyzed protein', 'autolyzed yeast'], severity: 4, category: 'flavor_enhancer', health_effects: 'Headaches, numbness, chest pain in sensitive individuals', banned_in: ['Not banned but restricted in baby food in EU'], why_used: 'Makes cheap/bland food taste better. Masks low quality ingredients.', source_url: 'https://www.fda.gov/food/food-additives-petitions/questions-and-answers-monosodium-glutamate-msg' },
  { name: 'Artificial Flavors', aliases: ['artificial flavoring', 'artificial flavor'], severity: 5, category: 'artificial_flavor', health_effects: 'Umbrella term hiding specific chemicals. Can include 100+ unnamed compounds per "flavor."', banned_in: ['EU requires more specific labeling'], why_used: 'One of the biggest cost-savers in food. Replaces real ingredients at 1/100th the cost.', source_url: 'https://www.ewg.org/foodscores/content/natural-vs-artificial-ingredients/' },
  { name: 'Diacetyl', aliases: ['2,3-butanedione'], severity: 7, category: 'artificial_flavor', health_effects: 'Causes "popcorn lung" (bronchiolitis obliterans). Respiratory damage.', banned_in: ['Restricted in occupational settings in EU/US. Still in some foods.'], why_used: 'Creates butter flavor in microwave popcorn, margarine at nearly zero cost.', source_url: 'https://www.cdc.gov/niosh/topics/flavorings/' },

  // --- TRANS FATS & OILS ---
  { name: 'Partially Hydrogenated Oils', aliases: ['PHO', 'partially hydrogenated soybean oil', 'partially hydrogenated cottonseed oil', 'trans fat'], severity: 10, category: 'trans_fat', health_effects: 'Directly causes heart disease. Raises LDL, lowers HDL. No safe level of consumption.', banned_in: ['US (banned 2018)', 'EU', 'Canada', 'Denmark', 'Iceland', 'Switzerland', 'Many countries'], why_used: 'Was the cheapest solid fat available. Some products still contain trace amounts.', source_url: 'https://www.who.int/news-room/fact-sheets/detail/trans-fat' },
  { name: 'Interesterified Fat', aliases: ['interesterified oil', 'high stearic fat'], severity: 5, category: 'trans_fat', health_effects: 'Raises blood glucose, depresses HDL, affects insulin. Replaced trans fats but may not be better.', banned_in: ['Not banned (relatively new, under-studied)'], why_used: 'Industry replacement for trans fats. Avoids "trans fat" labeling while keeping texture.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/17384331/' },

  // --- SWEETENERS & FILLERS ---
  { name: 'High Fructose Corn Syrup', aliases: ['HFCS', 'HFCS-55', 'HFCS-42', 'glucose-fructose syrup', 'corn sugar', 'isoglucose'], severity: 7, category: 'sweetener', health_effects: 'Liver fat accumulation, insulin resistance, obesity, metabolic syndrome.', banned_in: ['EU (production quotas until 2017, still limited)'], why_used: 'US corn subsidies make HFCS cheaper than sugar. Industry saves billions annually by substituting.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/23594708/' },
  { name: 'Maltodextrin', aliases: ['E1400'], severity: 4, category: 'filler', health_effects: 'Higher glycemic index than table sugar (GI of 95-136). Spikes blood sugar. Gut bacteria disruption.', banned_in: ['Not banned'], why_used: 'Cheap filler, thickener, preservative. Adds bulk without nutritional value.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/22450869/' },

  // --- HORMONES & PROCESSING AGENTS ---
  { name: 'rBGH/rBST', aliases: ['recombinant bovine growth hormone', 'recombinant bovine somatotropin', 'Posilac'], severity: 8, category: 'growth_hormone', health_effects: 'Increases IGF-1 levels linked to cancer. Causes mastitis in cows requiring more antibiotics.', banned_in: ['EU', 'Canada', 'Australia', 'New Zealand', 'Japan', 'Israel'], why_used: 'Increases milk production 10-15% per cow. Saves dairy industry hundreds of millions.', source_url: 'https://monographs.iarc.who.int/list-of-classifications' },
  { name: 'Ractopamine', aliases: ['Paylean', 'Optaflexx', 'Topmax'], severity: 8, category: 'growth_hormone', health_effects: 'Cardiovascular effects, banned in most countries. Animals show increased stress and injury.', banned_in: ['EU', 'China', 'Russia', 'Taiwan', '160+ countries'], why_used: 'Produces leaner meat faster, reducing feed costs by 10-20% for pork/beef producers.', source_url: 'https://www.efsa.europa.eu/en/efsajournal/pub/1041' },
  { name: 'Azodicarbonamide', aliases: ['ADA', 'E927a', 'azo'], severity: 7, category: 'processing_agent', health_effects: 'Breaks down into urethane (carcinogen) and semicarbazide during baking. Respiratory sensitizer.', banned_in: ['EU', 'UK', 'Australia', 'Singapore'], why_used: 'Bleaches flour and conditions dough. Known as the "yoga mat chemical." Costs pennies per batch.', source_url: 'https://www.who.int/foodsafety/chem/chemicals/en/' },
  { name: 'Titanium Dioxide', aliases: ['E171', 'TiO2', 'CI 77891'], severity: 7, category: 'processing_agent', health_effects: 'Genotoxic — damages DNA. Nanoparticle concerns. EFSA declared no longer safe in 2021.', banned_in: ['EU (banned as food additive 2022)', 'France (banned 2020)'], why_used: 'Makes foods appear whiter and brighter. Used in candy, frosting, coffee creamer.', source_url: 'https://www.efsa.europa.eu/en/efsajournal/pub/6585' },
  { name: 'Propylparaben', aliases: ['E217', 'propyl 4-hydroxybenzoate'], severity: 7, category: 'preservative', health_effects: 'Endocrine disruptor, estrogenic activity. Reproductive concerns.', banned_in: ['EU (banned in food 2006)'], why_used: 'Preservative in baked goods, tortillas. Still legal in US foods.', source_url: 'https://www.efsa.europa.eu/en/efsajournal/pub/83' },
  { name: 'Brominated Vegetable Oil', aliases: ['BVO', 'E443'], severity: 8, category: 'processing_agent', health_effects: 'Accumulates in body fat. Neurological effects, thyroid disruption. FDA banned in 2024.', banned_in: ['EU', 'Japan', 'India', 'US (banned 2024)'], why_used: 'Keeps citrus flavoring suspended in sodas. Was in Mountain Dew for decades.', source_url: 'https://www.fda.gov/food/cfsan-constituent-updates/fda-revokes-regulation-authorizing-use-brominated-vegetable-oil-food' },

  // --- PHOSPHATES ---
  { name: 'Sodium Phosphate', aliases: ['E339', 'trisodium phosphate', 'TSP', 'disodium phosphate', 'monosodium phosphate'], severity: 6, category: 'phosphate', health_effects: 'Cardiovascular disease risk, kidney damage, bone loss. Hidden phosphorus load.', banned_in: ['EU (restricted amounts)'], why_used: 'Retains moisture in processed meats, makes them heavier (sells water at meat prices).', source_url: 'https://pubmed.ncbi.nlm.nih.gov/22030226/' },
  { name: 'Sodium Tripolyphosphate', aliases: ['STPP', 'E451'], severity: 6, category: 'phosphate', health_effects: 'Water retention agent. Kidney toxicity concerns. Hides true protein content.', banned_in: ['EU (restricted in some applications)'], why_used: 'Makes seafood and meat absorb water, increasing weight and sale price by 10-30%.', source_url: 'https://pubmed.ncbi.nlm.nih.gov/22030226/' },

  // --- PACKAGING CHEMICALS ---
  { name: 'BPA', aliases: ['Bisphenol A', 'bisphenol'], severity: 8, category: 'packaging', health_effects: 'Endocrine disruptor. Linked to obesity, diabetes, reproductive issues, behavioral problems in children.', banned_in: ['EU (banned in food contact materials 2025)', 'France', 'Canada (baby bottles)'], why_used: 'Cheap can liner and plastic hardener. Industry fights bans due to replacement costs.', source_url: 'https://www.efsa.europa.eu/en/topics/topic/bisphenol' },
  { name: 'PFAS', aliases: ['forever chemicals', 'perfluoroalkyl', 'PFOA', 'PFOS'], severity: 9, category: 'packaging', health_effects: 'Cancer, liver damage, immune suppression, developmental effects. Never breaks down in body.', banned_in: ['EU (broad ban proposed)', 'Denmark (banned in food packaging)'], why_used: 'Grease-resistant coating for food packaging (microwave popcorn bags, fast food wrappers).', source_url: 'https://www.epa.gov/pfas' },

  // --- MISC ---
  { name: 'Cellulose', aliases: ['Powdered cellulose', 'microcrystalline cellulose', 'E460', 'wood pulp'], severity: 4, category: 'filler', health_effects: 'Not directly harmful but used as cheap filler. Reduces nutritional value per serving.', banned_in: ['EU (restricted amounts in some products)'], why_used: 'Literally wood pulp used as anti-caking agent and filler. Extremely cheap to add bulk.', source_url: 'https://www.fda.gov/food/food-additives-petitions/food-additive-status-list' },
  { name: 'Dimethylpolysiloxane', aliases: ['PDMS', 'E900', 'polydimethylsiloxane', 'dimethicone'], severity: 4, category: 'processing_agent', health_effects: 'Anti-foaming agent. Contains formaldehyde residue. Limited studies on food-grade safety.', banned_in: ['EU (restricted amounts)'], why_used: 'Prevents oil from foaming during frying. McDonald\'s, Chick-fil-A use it.', source_url: 'https://www.efsa.europa.eu/en/efsajournal/pub/1157' },
  { name: 'Propylene Glycol', aliases: ['E1520', 'PG', '1,2-propanediol'], severity: 4, category: 'processing_agent', health_effects: 'Generally recognized as safe at food levels but also used in antifreeze. Skin/eye irritant.', banned_in: ['EU (restricted amounts in food)'], why_used: 'Moisture retention, solvent for flavors and colors. Very cheap humectant.', source_url: 'https://www.atsdr.cdc.gov/toxprofiles/tp189.pdf' },
  { name: 'Soy Lecithin', aliases: ['E322', 'lecithin'], severity: 3, category: 'emulsifier', health_effects: 'Generally safe. Concern is soy is often GMO and highly processed. Allergen for soy-sensitive.', banned_in: ['Not banned'], why_used: 'Universal emulsifier in chocolate, baked goods. Dirt cheap byproduct of soybean oil processing.', source_url: 'https://www.efsa.europa.eu/en/efsajournal/pub/4144' },
  { name: 'Benzoyl Peroxide', aliases: ['flour bleaching agent'], severity: 5, category: 'processing_agent', health_effects: 'Destroys nutrients in flour (vitamin E, beta-carotene). Residual free radicals.', banned_in: ['EU', 'UK', 'China'], why_used: 'Whitens flour instantly instead of waiting for natural aging. Saves time = saves money.', source_url: 'https://www.efsa.europa.eu/en/efsajournal/pub/5013' },
];

// ============================================================
// COMPANY BEHAVIOR DATABASE
// ============================================================

const COMPANIES = [
  { name: 'Nestlé', parent: null, score: 25, controversies: 'Baby formula marketing in developing countries, water privatization, child labor in cocoa supply chain, PFAS contamination', positive: 'Some reformulation efforts', lobbying: 'Major lobbying against labeling requirements', transparency: 'low' },
  { name: 'General Mills', parent: null, score: 45, controversies: 'Glyphosate in Cheerios, artificial ingredients in kids products, lobbied against GMO labeling', positive: 'Organic line (Annie\'s), some reformulation', lobbying: 'Spent $2.2M lobbying against GMO labeling', transparency: 'medium' },
  { name: 'Kellogg\'s', parent: null, score: 40, controversies: 'High sugar kids cereals, BHT in products, misleading health claims', positive: 'Some reduction in artificial ingredients', lobbying: 'Lobbied against front-of-pack nutrition labeling', transparency: 'medium' },
  { name: 'PepsiCo', parent: null, score: 35, controversies: 'BVO in drinks (until 2020), high sugar products targeting children, plastic pollution', positive: 'Some reformulation, low-sugar alternatives', lobbying: 'Major soda tax opposition', transparency: 'medium' },
  { name: 'Coca-Cola', parent: null, score: 30, controversies: 'Sugar addiction, funded research downplaying sugar risks, water depletion', positive: 'Mini can sizes, some zero-sugar options', lobbying: 'Spent millions fighting soda taxes', transparency: 'low' },
  { name: 'Kraft Heinz', parent: null, score: 35, controversies: 'Yellow 5 & 6 in US Mac & Cheese (removed in other countries), artificial ingredients', positive: 'Removed artificial dyes from some products under pressure', lobbying: 'Lobbied against SNAP restrictions', transparency: 'low' },
  { name: 'Unilever', parent: null, score: 55, controversies: 'Palm oil deforestation, some artificial ingredients', positive: 'Reformulated many products, sustainability commitments', lobbying: 'Moderate', transparency: 'medium' },
  { name: 'Mars Inc.', parent: null, score: 40, controversies: 'Titanium dioxide in Skittles (until EU ban), child labor in cocoa', positive: 'Removed TiO2 in some markets, cocoa sustainability programs', lobbying: 'Moderate lobbying activity', transparency: 'low' },
  { name: 'Mondelez International', parent: null, score: 35, controversies: 'Artificial ingredients, child labor in cocoa, deforestation', positive: 'Some reformulation in EU products', lobbying: 'Lobbied against front-of-pack labeling', transparency: 'low' },
  { name: 'Conagra Brands', parent: null, score: 40, controversies: 'BHA/BHT in products, artificial colors, sodium levels', positive: 'Some reformulation under consumer pressure', lobbying: 'Moderate', transparency: 'medium' },
  { name: 'Tyson Foods', parent: null, score: 30, controversies: 'Antibiotics overuse, water pollution, worker safety, ractopamine use', positive: 'Some antibiotic-free lines', lobbying: 'Lobbied against meat labeling reforms', transparency: 'low' },
  { name: 'Smucker\'s', parent: null, score: 45, controversies: 'HFCS in products, artificial ingredients', positive: 'Natural/organic product lines', lobbying: 'Minimal', transparency: 'medium' },
  { name: 'Annie\'s', parent: 'General Mills', score: 75, controversies: 'Owned by General Mills', positive: 'Organic, no artificial ingredients, transparent sourcing', lobbying: 'None direct', transparency: 'high' },
  { name: 'KIND', parent: 'Mars Inc.', score: 70, controversies: 'Owned by Mars. Some sugar content concerns.', positive: 'Simple ingredients, transparency, B-corp values', lobbying: 'Lobbied FOR updated "healthy" definitions', transparency: 'high' },
  { name: 'Applegate', parent: 'Hormel', score: 70, controversies: 'Owned by Hormel', positive: 'No antibiotics, no artificial ingredients, humane animal treatment', lobbying: 'None direct', transparency: 'high' },
  { name: 'Stonyfield', parent: 'Lactalis', score: 75, controversies: 'Owned by Lactalis', positive: 'Organic, no artificial ingredients, environmental commitment, no rBGH', lobbying: 'Advocates for organic standards', transparency: 'high' },
  { name: 'Nature\'s Path', parent: null, score: 80, controversies: 'Minimal', positive: 'Independent, organic, non-GMO, family-owned, environmental leadership', lobbying: 'Pro-organic advocacy', transparency: 'high' },
  { name: 'Simple Mills', parent: null, score: 80, controversies: 'Minimal', positive: 'Clean ingredients, grain-free options, transparent sourcing', lobbying: 'None', transparency: 'high' },
  { name: 'Once Upon a Farm', parent: null, score: 85, controversies: 'Minimal', positive: 'Cold-pressed organic baby/kids food, no preservatives, transparent', lobbying: 'None', transparency: 'high' },
  { name: 'Horizon Organic', parent: 'Danone', score: 60, controversies: 'Owned by Danone. Debated organic practices on large-scale farms.', positive: 'Organic, no antibiotics, no rBGH', lobbying: 'Moderate through Danone', transparency: 'medium' },
];

// ============================================================
// SEED FUNCTIONS
// ============================================================

async function seedHarmfulIngredients() {
  console.log(`Seeding ${HARMFUL_INGREDIENTS.length} harmful ingredients...`);
  let inserted = 0;
  for (const ing of HARMFUL_INGREDIENTS) {
    try {
      await pool.query(
        `INSERT INTO harmful_ingredients (name, aliases, severity, category, health_effects, banned_in, why_used, source_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (name) DO UPDATE SET
           aliases = $2, severity = $3, category = $4, health_effects = $5,
           banned_in = $6, why_used = $7, source_url = $8`,
        [ing.name, JSON.stringify(ing.aliases), ing.severity, ing.category,
         ing.health_effects, JSON.stringify(ing.banned_in), ing.why_used, ing.source_url || null]
      );
      inserted++;
    } catch (err) {
      console.error(`  Failed: ${ing.name}:`, err.message);
    }
  }
  console.log(`  ✓ ${inserted}/${HARMFUL_INGREDIENTS.length} harmful ingredients seeded`);
}

async function seedCompanies() {
  console.log(`Seeding ${COMPANIES.length} companies...`);
  let inserted = 0;
  for (const co of COMPANIES) {
    try {
      await pool.query(
        `INSERT INTO companies (name, parent_company, behavior_score, controversies, positive_actions, lobbying_history, transparency_rating)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (name) DO UPDATE SET
           parent_company = $2, behavior_score = $3, controversies = $4,
           positive_actions = $5, lobbying_history = $6, transparency_rating = $7`,
        [co.name, co.parent, co.score, co.controversies, co.positive, co.lobbying, co.transparency]
      );
      inserted++;
    } catch (err) {
      console.error(`  Failed: ${co.name}:`, err.message);
    }
  }
  console.log(`  ✓ ${inserted}/${COMPANIES.length} companies seeded`);
}

// ============================================================
// IMPORT FROM OPEN FOOD FACTS (v2 — batched, with nutrition)
// ============================================================

async function importFromOpenFoodFacts(limit = 50000, startPage = 1) {
  console.log(`\nImporting up to ${limit} US products from Open Food Facts (starting page ${startPage})...`);

  const pageSize = 100;
  const maxPages = Math.ceil(limit / pageSize);
  let totalImported = 0;
  let totalSkipped = 0;
  let page = startPage;
  let consecutiveErrors = 0;

  // Fields we need from OFF (includes nutrition, allergens, labels)
  const fields = [
    'code', 'product_name', 'brands', 'categories_tags',
    'image_url', 'image_front_url',
    'ingredients_text', 'ingredients_text_en',
    'nutriscore_grade', 'nova_group',
    'nutriments',           // Full nutritional data
    'allergens_tags',       // Allergen information
    'labels_tags',          // Organic, non-GMO, etc.
    'additives_tags',       // OFF's own additive detection
  ].join(',');

  while (page <= maxPages && totalImported + (startPage - 1) * pageSize < limit) {
    try {
      const url = `https://us.openfoodfacts.org/cgi/search.pl?action=process&tagtype_0=countries&tag_contains_0=contains&tag_0=united-states&sort_by=unique_scans_n&page_size=${pageSize}&page=${page}&json=true&fields=${fields}`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Ick/2.0 (hello@ickapp.com)' },
        signal: AbortSignal.timeout(30000) // 30s timeout per request
      });

      if (!response.ok) {
        consecutiveErrors++;
        console.error(`  API error on page ${page}: ${response.status} (attempt ${consecutiveErrors}/5)`);
        if (consecutiveErrors >= 5) {
          console.error(`  Too many consecutive errors. Stopping at page ${page}.`);
          break;
        }
        // Wait longer on errors, then retry next page
        await new Promise(r => setTimeout(r, 2000 * consecutiveErrors));
        page++;
        continue;
      }

      consecutiveErrors = 0; // Reset on success

      const data = await response.json();
      const products = data.products || [];
      if (products.length === 0) {
        console.log(`  No more products at page ${page}`);
        break;
      }

      // Batch: score all products, then bulk insert
      const rows = [];
      for (const p of products) {
        const upc = p.code;
        const name = p.product_name;
        if (!upc || !name || upc.length < 8) { totalSkipped++; continue; }

        const ingredients = p.ingredients_text_en || p.ingredients_text || '';
        const brand = p.brands || 'Unknown Brand';
        const category = p.categories_tags?.[0]?.replace('en:', '') || 'Unknown';
        const imageUrl = p.image_url || p.image_front_url;

        // Score with full OFF data
        let scores = null;
        try {
          scores = await scoreProduct({
            ingredients,
            brand,
            nutriscore_grade: p.nutriscore_grade || null,
            nova_group: p.nova_group || null,
            nutriments: p.nutriments || null,
            labels: p.labels_tags || [],
            allergens_tags: p.allergens_tags || [],
          });
        } catch (e) { /* scoring failed, still import with defaults */ }

        rows.push([
          upc, name, brand, category, imageUrl, ingredients,
          scores?.nutrition_score ?? null,
          scores?.additives_score ?? null,
          scores?.organic_bonus ?? 0,
          scores?.harmful_ingredients_score ?? null,
          scores?.banned_elsewhere_score ?? null,
          scores?.transparency_score ?? null,
          scores?.processing_score ?? null,
          scores?.company_behavior_score ?? null,
          scores?.harmful_ingredients_found ? JSON.stringify(scores.harmful_ingredients_found) : '[]',
          scores?.nutrition_facts ? JSON.stringify(scores.nutrition_facts) : '{}',
          scores?.allergens_tags ? JSON.stringify(scores.allergens_tags) : '[]',
          p.nutriscore_grade || null,
          p.nova_group || null,
          scores?.is_organic || false,
        ]);
      }

      // Batch insert with ON CONFLICT
      for (const row of rows) {
        try {
          await pool.query(
            `INSERT INTO products (upc, name, brand, category, image_url, ingredients,
             nutrition_score, additives_score, organic_bonus,
             harmful_ingredients_score, banned_elsewhere_score, transparency_score, processing_score, company_behavior_score,
             harmful_ingredients_found, nutrition_facts, allergens_tags,
             nutriscore_grade, nova_group, is_organic)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
             ON CONFLICT (upc) DO UPDATE SET
               nutrition_score = EXCLUDED.nutrition_score,
               additives_score = EXCLUDED.additives_score,
               organic_bonus = EXCLUDED.organic_bonus,
               harmful_ingredients_found = EXCLUDED.harmful_ingredients_found,
               nutrition_facts = EXCLUDED.nutrition_facts,
               allergens_tags = EXCLUDED.allergens_tags,
               nutriscore_grade = EXCLUDED.nutriscore_grade,
               nova_group = EXCLUDED.nova_group,
               is_organic = EXCLUDED.is_organic,
               updated_at = NOW()`,
            row
          );
          totalImported++;
        } catch (e) {
          totalSkipped++;
        }
      }

      console.log(`  Page ${page}: +${rows.length} processed, ${totalImported} total imported`);
      page++;

      // Rate limit: be nice to OFF API
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`  Error on page ${page}:`, err.message);
      page++;
    }
  }

  // Mark clean alternatives: products with score >= 75 and no high-severity additives
  console.log('\nMarking clean alternatives...');
  const cleanResult = await pool.query(`
    UPDATE products SET is_clean_alternative = true
    WHERE total_score >= 75
    AND (harmful_ingredients_found IS NULL 
         OR harmful_ingredients_found = '[]'
         OR NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(harmful_ingredients_found) elem
           WHERE (elem->>'severity')::int >= 7
         ))
  `);
  console.log(`  ✓ ${cleanResult.rowCount} products marked as clean alternatives`);

  console.log(`\n✓ Import complete: ${totalImported} products imported, ${totalSkipped} skipped`);
  return totalImported;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const startPageArg = args.find(a => a.startsWith('--start-page='));
  const isFull = args.includes('--full');
  const limit = isFull ? 999999 : (limitArg ? parseInt(limitArg.split('=')[1]) : 50000);
  const startPage = startPageArg ? parseInt(startPageArg.split('=')[1]) : 1;

  console.log('=== Ick Data Import v2 ===\n');

  try {
    await seedHarmfulIngredients();
    await seedCompanies();
    await importFromOpenFoodFacts(limit, startPage);
    await seedCuratedSwaps();

    console.log('\n=== Import Complete ===');

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN total_score IS NOT NULL THEN 1 END) as scored_products,
        COUNT(CASE WHEN nutrition_score IS NOT NULL THEN 1 END) as with_nutrition,
        COUNT(CASE WHEN is_clean_alternative THEN 1 END) as clean_alternatives,
        ROUND(AVG(total_score)) as avg_score
      FROM products
    `);
    console.log('\nDatabase stats:', stats.rows[0]);

    const ingredientCount = await pool.query('SELECT COUNT(*) FROM harmful_ingredients');
    console.log('Harmful ingredients tracked:', ingredientCount.rows[0].count);

    const companyCount = await pool.query('SELECT COUNT(*) FROM companies');
    console.log('Companies tracked:', companyCount.rows[0].count);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }

  process.exit(0);
}

main();
