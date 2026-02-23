#!/usr/bin/env node
// Seed clean homemade recipes that replace common processed/ick-flagged products
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

const recipes = [
  {
    name: "Homemade Mac & Cheese",
    description: "Creamy, real-cheese mac & cheese with zero Yellow 5, Yellow 6, or TBHQ. Kids love it more than the box.",
    replaces_category: "boxed_mac",
    replaces_products: ["Kraft Mac & Cheese", "Velveeta Shells & Cheese"],
    prep_time_minutes: 5,
    cook_time_minutes: 15,
    total_time_minutes: 20,
    servings: 4,
    difficulty: "Easy",
    estimated_cost: 3.50,
    cost_per_serving: 0.88,
    ingredients: [
      { amount: "8 oz", item: "elbow macaroni (or any pasta)" },
      { amount: "2 tbsp", item: "butter" },
      { amount: "2 tbsp", item: "all-purpose flour" },
      { amount: "1.5 cups", item: "whole milk" },
      { amount: "2 cups", item: "sharp cheddar, shredded" },
      { amount: "1/2 tsp", item: "salt" },
      { amount: "1/4 tsp", item: "mustard powder (optional)" },
      { amount: "pinch", item: "paprika" }
    ],
    instructions: [
      "Cook pasta to package directions. Reserve 1/4 cup pasta water before draining.",
      "Melt butter in the same pot over medium heat. Whisk in flour and cook 1 minute.",
      "Slowly whisk in milk. Cook, stirring constantly, until thickened (3-4 min).",
      "Remove from heat. Stir in cheese until fully melted. Season with salt, mustard powder, and paprika.",
      "Add drained pasta. Stir to coat — add splash of pasta water if too thick."
    ],
    tips: ["Use a mix of cheddar and gruyere for extra depth", "Leftovers reheat well with a splash of milk", "Add steamed broccoli or peas to sneak in vegetables"],
    health_benefits: ["No artificial dyes (Yellow 5, Yellow 6)", "No TBHQ preservative", "Real cheese = actual calcium and protein", "No petroleum-derived additives"],
    vs_store_bought: "Kraft box has Yellow 5, Yellow 6 (require EU warning labels) and TBHQ (banned in Japan and EU). This version takes 5 more minutes and costs about the same.",
    tags: ["kid-friendly", "quick", "comfort-food"]
  },
  {
    name: "Real Ranch Dressing",
    description: "Creamy, tangy ranch with no titanium dioxide, no MSG, no mystery ingredients. Takes 5 minutes.",
    replaces_category: "salad_dressing",
    replaces_products: ["Hidden Valley Ranch", "Kraft Ranch"],
    prep_time_minutes: 5,
    cook_time_minutes: 0,
    total_time_minutes: 5,
    servings: 8,
    difficulty: "Easy",
    estimated_cost: 2.00,
    cost_per_serving: 0.25,
    ingredients: [
      { amount: "1/2 cup", item: "mayonnaise (real, not light)" },
      { amount: "1/2 cup", item: "sour cream or Greek yogurt" },
      { amount: "2 tbsp", item: "fresh dill (or 1 tsp dried)" },
      { amount: "1 tbsp", item: "fresh chives, chopped" },
      { amount: "1 clove", item: "garlic, minced (or 1/4 tsp powder)" },
      { amount: "1 tbsp", item: "lemon juice or white vinegar" },
      { amount: "1/4 tsp", item: "onion powder" },
      { amount: "salt & pepper", item: "to taste" },
      { amount: "2-4 tbsp", item: "milk (to thin as desired)" }
    ],
    instructions: [
      "Combine mayo and sour cream in a bowl and whisk smooth.",
      "Add dill, chives, garlic, lemon juice, onion powder, salt and pepper.",
      "Thin with milk to your preferred consistency.",
      "Refrigerate at least 30 minutes for flavors to meld. Keeps up to 1 week."
    ],
    tips: ["Greek yogurt instead of sour cream adds protein", "Double the garlic for a punchier version", "Works great as a veggie dip too"],
    health_benefits: ["No titanium dioxide (whitening agent, banned in EU)", "No artificial flavors or preservatives", "No EDTA", "Real herbs = actual flavor compounds"],
    vs_store_bought: "Hidden Valley contains titanium dioxide (banned in EU), EDTA, and artificial flavors. This version uses real ingredients and takes 5 minutes.",
    tags: ["dip", "dressing", "quick", "vegetarian"]
  },
  {
    name: "Clean Granola Bars",
    description: "Chewy, satisfying bars with no TBHQ, no BHA, no corn syrup. Batch makes 12 — cheaper than Kind bars.",
    replaces_category: "granola_bars",
    replaces_products: ["Quaker Chewy Granola Bars", "Nature Valley", "Kellogg's"],
    prep_time_minutes: 10,
    cook_time_minutes: 25,
    total_time_minutes: 35,
    servings: 12,
    difficulty: "Easy",
    estimated_cost: 6.00,
    cost_per_serving: 0.50,
    ingredients: [
      { amount: "2 cups", item: "old-fashioned rolled oats" },
      { amount: "1/2 cup", item: "honey or maple syrup" },
      { amount: "1/4 cup", item: "coconut oil or butter, melted" },
      { amount: "1/2 cup", item: "nut butter (peanut, almond, or sunflower)" },
      { amount: "1/2 cup", item: "mix-ins: chocolate chips, dried cranberries, seeds" },
      { amount: "1 tsp", item: "vanilla extract" },
      { amount: "1/2 tsp", item: "cinnamon" },
      { amount: "1/4 tsp", item: "salt" }
    ],
    instructions: [
      "Preheat oven to 350°F. Line an 8x8 pan with parchment paper.",
      "Toast oats on a baking sheet for 8 minutes, stirring once. Let cool slightly.",
      "Warm honey, coconut oil, and nut butter in a saucepan until smooth. Stir in vanilla.",
      "Combine oats, honey mixture, mix-ins, cinnamon, and salt. Mix well.",
      "Press firmly into prepared pan — very firmly, or bars will crumble.",
      "Bake 20-25 minutes until golden. Cool completely (at least 2 hours) before cutting."
    ],
    tips: ["Press HARD before baking — this is the key to bars that hold together", "Chill in the fridge before cutting for cleanest slices", "Wrap individually in parchment to grab-and-go all week"],
    health_benefits: ["No TBHQ (petroleum preservative, banned in EU/Japan)", "No BHA (possible carcinogen)", "No high-fructose corn syrup", "Whole grain oats = real fiber"],
    vs_store_bought: "Quaker Chewy bars contain BHT and corn syrup. These cost $0.50/bar vs $1.25+ for Kind bars.",
    tags: ["snack", "kid-friendly", "meal-prep", "gluten-free-option"]
  },
  {
    name: "Homemade Sports Drink",
    description: "Electrolyte drink with no brominated vegetable oil, no Red 40, no artificial dyes. Actually hydrating.",
    replaces_category: "sports_drinks",
    replaces_products: ["Gatorade", "Powerade", "Mountain Dew"],
    prep_time_minutes: 5,
    cook_time_minutes: 0,
    total_time_minutes: 5,
    servings: 4,
    difficulty: "Easy",
    estimated_cost: 0.50,
    cost_per_serving: 0.13,
    ingredients: [
      { amount: "4 cups", item: "water or coconut water" },
      { amount: "1/4 tsp", item: "salt (real electrolyte)" },
      { amount: "2 tbsp", item: "honey or maple syrup" },
      { amount: "1/4 cup", item: "fresh lemon or lime juice" },
      { amount: "pinch", item: "cream of tartar (potassium source, optional)" }
    ],
    instructions: [
      "Combine all ingredients and stir or shake until honey dissolves.",
      "Taste and adjust — more honey for sweeter, more citrus for tang.",
      "Chill before serving. Keeps refrigerated for 5 days."
    ],
    tips: ["Coconut water adds natural electrolytes and sweetness", "Freeze in ice cube trays and blend for a slushy version", "Add fresh mint or cucumber for variety"],
    health_benefits: ["No brominated vegetable oil (BVO, banned in EU/Japan/India)", "No artificial dyes (Red 40, Blue 1)", "Real electrolytes from salt and citrus", "No HFCS"],
    vs_store_bought: "Gatorade contains Red 40 and historically contained BVO. This costs pennies per serving and actually hydrates better.",
    tags: ["drink", "sports", "kid-friendly", "quick"]
  },
  {
    name: "Homemade Tomato Soup",
    description: "Rich, velvety tomato soup with no BPA-lined cans, no excess sodium, no artificial flavors.",
    replaces_category: "canned_soup",
    replaces_products: ["Campbell's Tomato Soup", "Progresso"],
    prep_time_minutes: 10,
    cook_time_minutes: 25,
    total_time_minutes: 35,
    servings: 4,
    difficulty: "Easy",
    estimated_cost: 4.00,
    cost_per_serving: 1.00,
    ingredients: [
      { amount: "2 lbs", item: "fresh tomatoes OR 28 oz can whole peeled tomatoes" },
      { amount: "1 medium", item: "onion, roughly chopped" },
      { amount: "4 cloves", item: "garlic" },
      { amount: "2 tbsp", item: "olive oil" },
      { amount: "1 cup", item: "vegetable or chicken broth" },
      { amount: "1 tbsp", item: "tomato paste" },
      { amount: "1 tsp", item: "sugar (balances acidity)" },
      { amount: "1/2 cup", item: "heavy cream or coconut cream (optional)" },
      { amount: "salt, pepper, basil", item: "to taste" }
    ],
    instructions: [
      "Heat olive oil in a large pot. Add onion and cook until soft, 5 minutes.",
      "Add garlic and tomato paste, cook 1 minute until fragrant.",
      "Add tomatoes, broth, sugar, salt, and pepper. Simmer 20 minutes.",
      "Blend with immersion blender (or carefully in batches in a regular blender) until smooth.",
      "Stir in cream if using. Taste and adjust seasoning."
    ],
    tips: ["Roasting the tomatoes and onion first at 400°F for 20 min deepens flavor dramatically", "Freeze in portions for quick weeknight meals", "A parmesan rind simmered in the soup adds incredible depth"],
    health_benefits: ["No BPA from can lining", "No MSG or artificial flavors", "Dramatically lower sodium than canned", "Lycopene from tomatoes = antioxidants"],
    vs_store_bought: "Campbell's has 890mg sodium per serving and artificial flavoring. This is real food.",
    tags: ["comfort-food", "meal-prep", "vegetarian", "freezer-friendly"]
  },
  {
    name: "Homemade Pancakes",
    description: "Fluffy, golden pancakes with no titanium dioxide, no artificial colors, no mystery leaveners.",
    replaces_category: "pancake_mix",
    replaces_products: ["Bisquick", "Hungry Jack", "Aunt Jemima"],
    prep_time_minutes: 5,
    cook_time_minutes: 15,
    total_time_minutes: 20,
    servings: 4,
    difficulty: "Easy",
    estimated_cost: 1.50,
    cost_per_serving: 0.38,
    ingredients: [
      { amount: "1 cup", item: "all-purpose flour" },
      { amount: "1 tbsp", item: "sugar" },
      { amount: "1 tsp", item: "baking powder" },
      { amount: "1/2 tsp", item: "baking soda" },
      { amount: "1/4 tsp", item: "salt" },
      { amount: "3/4 cup", item: "buttermilk (or milk + 1 tsp vinegar)" },
      { amount: "1 large", item: "egg" },
      { amount: "2 tbsp", item: "melted butter" },
      { amount: "1 tsp", item: "vanilla extract" }
    ],
    instructions: [
      "Whisk dry ingredients together in a large bowl.",
      "In a separate bowl, whisk buttermilk, egg, melted butter, and vanilla.",
      "Pour wet into dry. Stir gently — lumps are fine, do NOT overmix.",
      "Let batter rest 5 minutes. Heat a nonstick pan over medium heat.",
      "Cook until bubbles form and edges look set (2-3 min), flip, cook 1 more minute."
    ],
    tips: ["Resting the batter = fluffier pancakes, don't skip it", "Freeze leftover pancakes — toast them straight from frozen", "Add blueberries or chocolate chips after pouring onto the pan"],
    health_benefits: ["No titanium dioxide (whitening, banned in EU)", "No artificial flavors", "No partially hydrogenated oils", "Real ingredients you can actually pronounce"],
    vs_store_bought: "Bisquick contains partially hydrogenated oils and artificial flavors. This costs about $0.38/serving vs $0.75+ for mix.",
    tags: ["breakfast", "kid-friendly", "quick", "freezer-friendly"]
  },
  {
    name: "Homemade Chicken Nuggets",
    description: "Crispy, juicy nuggets with real chicken breast — no TBHQ, no dimethylpolysiloxane, no fillers.",
    replaces_category: "frozen_nuggets",
    replaces_products: ["McDonald's McNuggets", "Tyson Chicken Nuggets", "Perdue"],
    prep_time_minutes: 15,
    cook_time_minutes: 20,
    total_time_minutes: 35,
    servings: 4,
    difficulty: "Medium",
    estimated_cost: 8.00,
    cost_per_serving: 2.00,
    ingredients: [
      { amount: "1.5 lbs", item: "chicken breast, cut into nugget-sized pieces" },
      { amount: "1 cup", item: "panko breadcrumbs" },
      { amount: "1/2 cup", item: "parmesan, grated" },
      { amount: "1 tsp", item: "garlic powder" },
      { amount: "1 tsp", item: "smoked paprika" },
      { amount: "1/2 tsp", item: "salt" },
      { amount: "2 large", item: "eggs, beaten" },
      { amount: "2 tbsp", item: "olive oil or avocado oil spray" }
    ],
    instructions: [
      "Preheat oven to 425°F. Line a baking sheet with parchment, drizzle with oil.",
      "Mix panko, parmesan, garlic powder, paprika, and salt in a shallow bowl.",
      "Dip chicken pieces in egg, then coat thoroughly in breadcrumb mixture.",
      "Place on prepared baking sheet. Spray tops with oil for extra crispiness.",
      "Bake 18-22 minutes, flipping halfway, until golden and cooked through (165°F internal)."
    ],
    tips: ["Freeze before baking on a sheet, then bag — bake from frozen at 425°F for 25 min", "Air fryer works great: 400°F for 12 minutes", "Double coat (egg → breadcrumbs → egg → breadcrumbs) for extra crunch"],
    health_benefits: ["No TBHQ preservative (banned in EU/Japan)", "No dimethylpolysiloxane (anti-foaming agent from silicone)", "Real chicken breast, no fillers or mechanically separated meat", "No artificial flavors"],
    vs_store_bought: "McDonald's McNuggets and Tyson both contain TBHQ. These freeze and reheat perfectly.",
    tags: ["kid-friendly", "meal-prep", "freezer-friendly", "protein"]
  },
  {
    name: "Homemade Bread",
    description: "Simple no-knead bread with no potassium bromate, no dough conditioners. 5 minutes of work.",
    replaces_category: "bread",
    replaces_products: ["Wonder Bread", "Pepperidge Farm", "Arnold"],
    prep_time_minutes: 10,
    cook_time_minutes: 45,
    total_time_minutes: 780,
    servings: 12,
    difficulty: "Easy",
    estimated_cost: 1.50,
    cost_per_serving: 0.13,
    ingredients: [
      { amount: "3 cups", item: "all-purpose or bread flour" },
      { amount: "1/4 tsp", item: "instant yeast" },
      { amount: "1.25 tsp", item: "salt" },
      { amount: "1.5 cups", item: "water, room temperature" }
    ],
    instructions: [
      "Mix flour, yeast, and salt in a large bowl. Add water and stir until shaggy dough forms — no kneading.",
      "Cover bowl with plastic wrap and let rise at room temperature 12-18 hours.",
      "Preheat oven to 450°F with a dutch oven inside for 30 minutes.",
      "Turn dough onto floured surface, fold once or twice, place on parchment.",
      "Lower dough into hot dutch oven, cover, bake 30 min. Uncover, bake 15 more minutes until deep brown.",
      "Cool at least 1 hour before cutting — it's still cooking inside."
    ],
    tips: ["The long rise (12-18h) develops flavor better than any shortcut", "Score the top with a sharp knife right before baking for a beautiful crust", "Freeze half a loaf if you won't finish it in 2 days"],
    health_benefits: ["No potassium bromate (possible carcinogen, banned in 20+ countries)", "No calcium propionate preservative", "No dough conditioners (DATEM, monoglycerides)", "4 ingredients total"],
    vs_store_bought: "Most commercial bread contains potassium bromate, calcium propionate, and multiple dough conditioners. This has 4 ingredients.",
    tags: ["bread", "meal-prep", "vegan", "4-ingredients"]
  },
  {
    name: "Homemade Fruit Snacks",
    description: "Real fruit gummies with no Red 40, no Blue 1, no artificial dyes. Kids can't tell the difference.",
    replaces_category: "fruit_snacks",
    replaces_products: ["Welch's Fruit Snacks", "Betty Crocker Fruit Roll-Ups", "Motts"],
    prep_time_minutes: 10,
    cook_time_minutes: 10,
    total_time_minutes: 70,
    servings: 6,
    difficulty: "Easy",
    estimated_cost: 4.00,
    cost_per_serving: 0.67,
    ingredients: [
      { amount: "1 cup", item: "100% fruit juice (strawberry, mango, or grape)" },
      { amount: "3 tbsp", item: "honey" },
      { amount: "3 tbsp", item: "unflavored gelatin (about 3 packets)" },
      { amount: "1 tbsp", item: "fresh lemon juice" }
    ],
    instructions: [
      "Pour juice into a small saucepan. Sprinkle gelatin over top and let bloom 2 minutes.",
      "Heat over medium-low, stirring until gelatin fully dissolves (do not boil).",
      "Stir in honey and lemon juice.",
      "Pour into silicone molds or a parchment-lined 8x8 pan.",
      "Refrigerate 1 hour until set. Cut into shapes if using pan."
    ],
    tips: ["Silicone bear molds make these look exactly like store bought", "Blend in 1/2 cup fresh strawberries with the juice for more fruit flavor", "Store in an airtight container in the fridge up to 2 weeks"],
    health_benefits: ["No Red 40, Blue 1, Yellow 5 or Yellow 6 (all require EU warning labels)", "Real fruit juice instead of 'fruit flavored'", "Gelatin provides collagen — actually beneficial", "No high-fructose corn syrup"],
    vs_store_bought: "Welch's Fruit Snacks contain Red 40 and Blue 1 — both linked to hyperactivity in children and banned or requiring warning labels in EU.",
    tags: ["kid-friendly", "snack", "quick", "no-artificial-dyes"]
  },
  {
    name: "Homemade Popcorn",
    description: "Perfect stovetop popcorn with no PFAS-coated bags, no TBHQ, no diacetyl fake butter.",
    replaces_category: "microwave_popcorn",
    replaces_products: ["Orville Redenbacher Microwave", "Act II", "Pop Secret"],
    prep_time_minutes: 2,
    cook_time_minutes: 5,
    total_time_minutes: 7,
    servings: 4,
    difficulty: "Easy",
    estimated_cost: 0.50,
    cost_per_serving: 0.13,
    ingredients: [
      { amount: "1/3 cup", item: "popcorn kernels" },
      { amount: "2 tbsp", item: "coconut oil or avocado oil" },
      { amount: "2 tbsp", item: "real butter, melted" },
      { amount: "1/2 tsp", item: "salt (or more to taste)" }
    ],
    instructions: [
      "Heat oil in a large pot over medium-high heat.",
      "Add 3 test kernels, cover. When they pop, add remaining kernels in a single layer.",
      "Cover and shake pan every 30 seconds to prevent burning.",
      "Remove from heat when popping slows to 2-3 seconds between pops.",
      "Immediately drizzle with melted butter and toss with salt."
    ],
    tips: ["Nutritional yeast instead of butter = cheesy flavor with no dairy", "Try smoked paprika + cayenne for a spicy version", "Coconut sugar + cinnamon makes a killer kettle corn"],
    health_benefits: ["No PFAS/PFOA chemicals from microwave bag lining", "No diacetyl (artificial butter flavoring, linked to lung disease)", "No TBHQ preservative", "Whole grain — real fiber"],
    vs_store_bought: "Microwave popcorn bags are lined with PFAS chemicals that leach into food. This costs $0.13/serving vs $0.50+ per bag.",
    tags: ["snack", "quick", "vegan", "whole-grain"]
  },
];

async function seedRecipes() {
  console.log(`\nSeeding ${recipes.length} recipes...\n`);
  let inserted = 0;
  let skipped = 0;

  for (const r of recipes) {
    try {
      await pool.query(`
        INSERT INTO recipes (
          name, description, replaces_category, replaces_products,
          prep_time_minutes, cook_time_minutes, total_time_minutes,
          servings, difficulty, estimated_cost, cost_per_serving,
          ingredients, instructions, tips, health_benefits,
          vs_store_bought, dietary_tags
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          ingredients = EXCLUDED.ingredients,
          instructions = EXCLUDED.instructions,
          health_benefits = EXCLUDED.health_benefits,
          vs_store_bought = EXCLUDED.vs_store_bought
      `, [
        r.name, r.description, r.replaces_category,
        JSON.stringify(r.replaces_products),
        r.prep_time_minutes, r.cook_time_minutes, r.total_time_minutes,
        r.servings, r.difficulty, r.estimated_cost, r.cost_per_serving,
        JSON.stringify(r.ingredients), JSON.stringify(r.instructions),
        JSON.stringify(r.tips), JSON.stringify(r.health_benefits),
        r.vs_store_bought, JSON.stringify(r.tags || [])
      ]);
      console.log(`  ✓ ${r.name}`);
      inserted++;
    } catch (e) {
      console.log(`  ✗ ${r.name}: ${e.message}`);
      skipped++;
    }
  }

  const { rows: [{ c }] } = await pool.query('SELECT COUNT(*) as c FROM recipes');
  console.log(`\n  Done. ${inserted} inserted/updated, ${skipped} skipped.`);
  console.log(`  Total recipes in DB: ${c}`);
  await pool.end();
}

seedRecipes().catch(e => { console.error(e); process.exit(1); });
