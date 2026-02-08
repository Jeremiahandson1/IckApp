import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database connection
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected:', res.rows[0].now);
  }
});

// Schema initialization
export async function initDatabase() {
  const schema = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      zip_code VARCHAR(10),
      household_size INT DEFAULT 1,
      has_kids BOOLEAN DEFAULT false,
      kids_ages JSONB DEFAULT '[]',
      allergen_alerts JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- User engagement tracking
    CREATE TABLE IF NOT EXISTS user_engagement (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      total_products_scanned INT DEFAULT 0,
      total_swaps_clicked INT DEFAULT 0,
      total_swaps_purchased INT DEFAULT 0,
      total_recipes_viewed INT DEFAULT 0,
      products_with_velocity INT DEFAULT 0,
      velocity_confidence_avg DECIMAL(3,2) DEFAULT 0,
      top_categories JSONB DEFAULT '[]',
      price_tier VARCHAR(20) DEFAULT 'moderate',
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Harmful ingredients database
    CREATE TABLE IF NOT EXISTS harmful_ingredients (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      aliases JSONB DEFAULT '[]',
      severity INT CHECK (severity >= 1 AND severity <= 10),
      category VARCHAR(100),
      health_effects TEXT,
      banned_in JSONB DEFAULT '[]',
      why_used TEXT,
      source_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Company behavior database
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      parent_company VARCHAR(255),
      behavior_score INT CHECK (behavior_score >= 0 AND behavior_score <= 100),
      controversies TEXT,
      positive_actions TEXT,
      lobbying_history TEXT,
      transparency_rating VARCHAR(20),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Products database
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      upc VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      brand VARCHAR(255),
      company_id INT REFERENCES companies(id),
      category VARCHAR(100),
      subcategory VARCHAR(100),
      image_url TEXT,
      
      -- OLD scoring components (kept for backward compat, no longer in total_score formula)
      harmful_ingredients_score INT DEFAULT 50,
      banned_elsewhere_score INT DEFAULT 50,
      transparency_score INT DEFAULT 50,
      processing_score INT DEFAULT 50,
      company_behavior_score INT DEFAULT 50,
      
      -- NEW scoring model: Nutrition 60% + Additives 30% + Organic 10%
      nutrition_score INT DEFAULT 50,
      additives_score INT DEFAULT 50,
      organic_bonus INT DEFAULT 0,
      
      -- Final weighted score (Yuka-aligned: nutrition 60%, additives 30%, organic 10%)
      total_score INT GENERATED ALWAYS AS (
        ROUND(nutrition_score * 0.60 + additives_score * 0.30 + organic_bonus * 0.10)
      ) STORED,
      
      -- Raw data
      ingredients TEXT,
      ingredients_list JSONB DEFAULT '[]',
      harmful_ingredients_found JSONB DEFAULT '[]',
      nutrition_facts JSONB DEFAULT '{}',
      
      -- Allergens
      allergens_tags JSONB DEFAULT '[]',
      
      -- Metadata
      is_organic BOOLEAN DEFAULT false,
      is_non_gmo BOOLEAN DEFAULT false,
      certifications JSONB DEFAULT '[]',
      
      -- Swap data
      is_clean_alternative BOOLEAN DEFAULT false,
      swaps_to JSONB DEFAULT '[]',
      
      -- Pricing
      typical_price DECIMAL(8,2),
      price_per_oz DECIMAL(8,4),

      -- Open Food Facts enrichment
      nutriscore_grade VARCHAR(1),
      nova_group INT,
      
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- User pantry items
    CREATE TABLE IF NOT EXISTS pantry_items (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id),
      upc VARCHAR(20),
      custom_name VARCHAR(255),
      quantity INT DEFAULT 1,
      
      -- Velocity tracking
      added_at TIMESTAMP DEFAULT NOW(),
      finished_at TIMESTAMP,
      days_to_consume INT,
      
      -- Status
      status VARCHAR(20) DEFAULT 'active',
      
      UNIQUE(user_id, product_id, added_at)
    );

    -- Consumption velocity tracking
    CREATE TABLE IF NOT EXISTS consumption_velocity (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id),
      upc VARCHAR(20) NOT NULL,
      
      -- Velocity stats
      avg_days_to_consume DECIMAL(5,1),
      consumption_count INT DEFAULT 0,
      confidence VARCHAR(20) DEFAULT 'low',
      last_consumed_at TIMESTAMP,
      next_predicted_empty DATE,
      
      -- Trend
      velocity_trend VARCHAR(20) DEFAULT 'stable',
      
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      
      UNIQUE(user_id, upc)
    );

    -- Kid approval ratings
    CREATE TABLE IF NOT EXISTS kid_ratings (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id),
      upc VARCHAR(20) NOT NULL,
      
      kid_name VARCHAR(100),
      kid_age INT,
      rating INT CHECK (rating >= 1 AND rating <= 5),
      would_eat_again BOOLEAN,
      notes TEXT,
      
      created_at TIMESTAMP DEFAULT NOW(),
      
      UNIQUE(user_id, upc, kid_name)
    );

    -- Shopping lists
    CREATE TABLE IF NOT EXISTS shopping_lists (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) DEFAULT 'My List',
      store VARCHAR(255),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP
    );

    -- Shopping list items
    CREATE TABLE IF NOT EXISTS shopping_list_items (
      id SERIAL PRIMARY KEY,
      list_id INT REFERENCES shopping_lists(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id),
      upc VARCHAR(20),
      custom_name VARCHAR(255),
      quantity INT DEFAULT 1,
      
      -- From velocity prediction
      predicted_need BOOLEAN DEFAULT false,
      
      -- Store location
      aisle VARCHAR(50),
      section VARCHAR(100),
      
      -- Status
      checked BOOLEAN DEFAULT false,
      checked_at TIMESTAMP,
      
      -- Price tracking
      price_paid DECIMAL(8,2),
      
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Homemade recipes (swap alternatives)
    CREATE TABLE IF NOT EXISTS recipes (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      
      -- What it replaces
      replaces_category VARCHAR(100),
      replaces_products JSONB DEFAULT '[]',
      
      -- Recipe details
      prep_time_minutes INT,
      cook_time_minutes INT,
      total_time_minutes INT,
      servings INT,
      difficulty VARCHAR(20),
      
      -- Cost
      estimated_cost DECIMAL(8,2),
      cost_per_serving DECIMAL(8,2),
      
      -- Content
      ingredients JSONB NOT NULL,
      instructions JSONB NOT NULL,
      tips JSONB DEFAULT '[]',
      
      -- Nutrition comparison
      health_benefits JSONB DEFAULT '[]',
      vs_store_bought TEXT,
      
      -- Media
      image_url TEXT,
      video_url TEXT,
      
      -- Metadata
      kid_friendly BOOLEAN DEFAULT true,
      allergens JSONB DEFAULT '[]',
      dietary_tags JSONB DEFAULT '[]',
      
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- User recipe history
    CREATE TABLE IF NOT EXISTS user_recipes (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      recipe_id INT REFERENCES recipes(id) ON DELETE CASCADE,
      
      viewed_at TIMESTAMP DEFAULT NOW(),
      made_it BOOLEAN DEFAULT false,
      made_at TIMESTAMP,
      rating INT CHECK (rating >= 1 AND rating <= 5),
      notes TEXT,
      
      UNIQUE(user_id, recipe_id)
    );

    -- Local availability (community sightings)
    CREATE TABLE IF NOT EXISTS local_sightings (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      product_id INT REFERENCES products(id),
      upc VARCHAR(20) NOT NULL,
      
      store_name VARCHAR(255) NOT NULL,
      store_address TEXT,
      store_city VARCHAR(100),
      store_state VARCHAR(2),
      store_zip VARCHAR(10),
      
      aisle VARCHAR(50),
      price DECIMAL(8,2),
      in_stock BOOLEAN DEFAULT true,
      
      reported_at TIMESTAMP DEFAULT NOW(),
      verified_count INT DEFAULT 1,
      last_verified_at TIMESTAMP DEFAULT NOW()
    );

    -- Swap clicks tracking
    CREATE TABLE IF NOT EXISTS swap_clicks (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      from_product_id INT REFERENCES products(id),
      to_product_id INT REFERENCES products(id),
      from_upc VARCHAR(20),
      to_upc VARCHAR(20),
      
      clicked_at TIMESTAMP DEFAULT NOW(),
      purchased BOOLEAN DEFAULT false,
      purchased_at TIMESTAMP
    );

    -- User subscriptions
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      plan VARCHAR(20) NOT NULL DEFAULT 'free',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      trial_started_at TIMESTAMP,
      trial_ends_at TIMESTAMP,
      subscribed_at TIMESTAMP,
      expires_at TIMESTAMP,
      stripe_customer_id VARCHAR(255),
      stripe_subscription_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_products_upc ON products(upc);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_score ON products(total_score);
    CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_velocity_user ON consumption_velocity(user_id);
    CREATE INDEX IF NOT EXISTS idx_velocity_upc ON consumption_velocity(upc);
    CREATE INDEX IF NOT EXISTS idx_sightings_zip ON local_sightings(store_zip);
    CREATE INDEX IF NOT EXISTS idx_sightings_upc ON local_sightings(upc);
    CREATE INDEX IF NOT EXISTS idx_harmful_name ON harmful_ingredients(name);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

    -- Scan logs for rate limiting free users
    CREATE TABLE IF NOT EXISTS scan_logs (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      upc VARCHAR(20) NOT NULL,
      scanned_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_scan_logs_user_date ON scan_logs(user_id, scanned_at);

    -- User favorites
    CREATE TABLE IF NOT EXISTS user_favorites (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      upc VARCHAR(20) NOT NULL,
      product_id INT REFERENCES products(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, upc)
    );
    CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);

    -- Product contributions (user-submitted missing products)
    CREATE TABLE IF NOT EXISTS product_contributions (
      id SERIAL PRIMARY KEY,
      upc VARCHAR(20) NOT NULL,
      name VARCHAR(255),
      brand VARCHAR(255),
      image_url TEXT,
      ingredients_text TEXT,
      submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_contributions_upc ON product_contributions(upc);

    -- Analytics events
    CREATE TABLE IF NOT EXISTS analytics_events (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(50) NOT NULL,
      event_data JSONB DEFAULT '{}',
      session_id VARCHAR(64),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_events(created_at);

    -- Family profiles (multiple allergen/diet profiles per account)
    CREATE TABLE IF NOT EXISTS family_profiles (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      avatar VARCHAR(20) DEFAULT '👤',
      allergen_alerts JSONB DEFAULT '[]',
      dietary_prefs JSONB DEFAULT '[]',
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_family_user ON family_profiles(user_id);
  `;

  try {
    await pool.query(schema);
    console.log('Database schema initialized successfully');

    // ============================================================
    // MIGRATION: Real scoring model (Nutri-Score 60% + Additives 30% + Organic 10%)
    // Runs idempotently — safe to re-run on existing databases
    // ============================================================
    await pool.query(`
      -- Add new scoring columns
      ALTER TABLE products ADD COLUMN IF NOT EXISTS nutrition_score INT DEFAULT 50;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS additives_score INT DEFAULT 50;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS organic_bonus INT DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS allergens_tags JSONB DEFAULT '[]';

      -- Add source_url to harmful ingredients for scientific credibility
      ALTER TABLE harmful_ingredients ADD COLUMN IF NOT EXISTS source_url TEXT;
      
      -- Migrate health_effects from JSONB to TEXT for existing databases
      ALTER TABLE harmful_ingredients ALTER COLUMN health_effects TYPE TEXT USING health_effects::TEXT;
      
      -- Add dietary preference columns to users
      ALTER TABLE users ADD COLUMN IF NOT EXISTS allergen_alerts JSONB DEFAULT '[]';
      
      -- Push notification subscriptions
      ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription JSONB;
    `);

    // Check if total_score still uses old formula (5 columns)
    // If so, drop and recreate with new 3-column formula
    const colCheck = await pool.query(`
      SELECT pg_get_expr(adbin, adrelid) as expr
      FROM pg_attrdef
      JOIN pg_attribute ON pg_attribute.attnum = pg_attrdef.adnum
        AND pg_attribute.attrelid = pg_attrdef.adrelid
      WHERE pg_attribute.attrelid = 'products'::regclass
        AND pg_attribute.attname = 'total_score'
    `);

    const currentExpr = colCheck.rows[0]?.expr || '';
    if (currentExpr.includes('harmful_ingredients_score') || currentExpr.includes('banned_elsewhere_score')) {
      console.log('Migrating total_score to new formula (nutrition 60% + additives 30% + organic 10%)...');
      await pool.query(`
        ALTER TABLE products DROP COLUMN total_score;
        ALTER TABLE products ADD COLUMN total_score INT GENERATED ALWAYS AS (
          ROUND(nutrition_score * 0.60 + additives_score * 0.30 + organic_bonus * 0.10)
        ) STORED;
      `);
      // Recreate the index
      await pool.query('CREATE INDEX IF NOT EXISTS idx_products_score ON products(total_score)');
      console.log('  ✓ total_score migrated to new formula');
    }

    console.log('Database migrations complete');
  } catch (err) {
    console.error('Error initializing database schema:', err);
    throw err;
  }
}

// Run if called directly
if (process.argv[1]?.includes('init.js')) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default pool;
