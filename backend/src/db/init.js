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
      
      -- 5-dimension scoring model
      harmful_ingredients_score INT DEFAULT 50,
      banned_elsewhere_score INT DEFAULT 50,
      transparency_score INT DEFAULT 50,
      processing_score INT DEFAULT 50,
      company_behavior_score INT DEFAULT 50,

      -- Legacy columns (kept for backward compat, not used in total_score)
      nutrition_score INT DEFAULT 50,
      additives_score INT DEFAULT 50,
      organic_bonus INT DEFAULT 0,

      -- Final weighted score (computed by trigger on INSERT/UPDATE)
      total_score INT,
      
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
    -- Trigram indexes for fast ILIKE search (requires pg_trgm extension)
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_products_brand_trgm ON products USING gin(brand gin_trgm_ops);
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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_family_default ON family_profiles(user_id) WHERE is_default = true;

    -- Flyer crawler results (Flipp-sourced weekly ad data)
    CREATE TABLE IF NOT EXISTS flyer_availability (
      id SERIAL PRIMARY KEY,
      upc VARCHAR(20),
      product_id INT REFERENCES products(id) ON DELETE SET NULL,
      our_product_name VARCHAR(255),
      merchant VARCHAR(255) NOT NULL,
      flyer_product_name VARCHAR(255),
      brand VARCHAR(255),
      price DECIMAL(8,2),
      price_text VARCHAR(100),
      sale_story TEXT,
      valid_from TIMESTAMP,
      valid_to TIMESTAMP,
      image_url TEXT,
      flyer_item_id VARCHAR(100),
      search_zip VARCHAR(10),
      region VARCHAR(100),
      crawled_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_flyer_upc ON flyer_availability(upc);
    CREATE INDEX IF NOT EXISTS idx_flyer_expires ON flyer_availability(expires_at);
    CREATE INDEX IF NOT EXISTS idx_flyer_merchant ON flyer_availability(merchant);

    -- Curated ground-truth availability (manually verified store data)
    CREATE TABLE IF NOT EXISTS curated_availability (
      id SERIAL PRIMARY KEY,
      upc VARCHAR(20) NOT NULL,
      store_name VARCHAR(255) NOT NULL,
      store_chain VARCHAR(100),
      source VARCHAR(50) DEFAULT 'curated',
      verified_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(upc, store_name)
    );
    CREATE INDEX IF NOT EXISTS idx_curated_upc ON curated_availability(upc);

    -- Online purchase links (Amazon, Thrive Market, brand sites, etc.)
    CREATE TABLE IF NOT EXISTS online_links (
      id SERIAL PRIMARY KEY,
      upc VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      link_type VARCHAR(50) DEFAULT 'marketplace',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(upc, name)
    );
    CREATE INDEX IF NOT EXISTS idx_online_links_upc ON online_links(upc);

    -- Refresh tokens for JWT rotation
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) UNIQUE NOT NULL,
      revoked BOOLEAN DEFAULT false,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

    -- Login attempts for brute-force protection
    CREATE TABLE IF NOT EXISTS login_attempts (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      ip VARCHAR(45),
      success BOOLEAN DEFAULT false,
      attempted_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, attempted_at);

    -- Password reset tokens
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) UNIQUE NOT NULL,
      used_at TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
  `;

  const t0 = Date.now();
  try {
    // Step 1: Create all tables + indexes in one round trip
    await pool.query(schema);
    console.log(`  schema created (${Date.now() - t0}ms)`);

    // Ensure users.id has a PRIMARY KEY constraint.
    // If the users table was created by old code (or a partial migration) without PK,
    // CREATE TABLE IF NOT EXISTS silently skips it, leaving id without a unique
    // constraint. Then every REFERENCES users(id) in later tables fails with:
    //   "there is no unique constraint matching given keys for referenced table users"
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'users'::regclass AND contype = 'p'
        ) THEN
          ALTER TABLE users ADD PRIMARY KEY (id);
        END IF;
      END $$;
    `);
    // Same guard for products — many tables reference products(id)
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'products'::regclass AND contype = 'p'
        ) THEN
          ALTER TABLE products ADD PRIMARY KEY (id);
        END IF;
      END $$;
    `);

    // Repair missing UNIQUE constraints that ON CONFLICT clauses depend on.
    // Tables created by old schema versions kept their rows but lost (or never
    // had) these constraints — CREATE TABLE IF NOT EXISTS silently skips them,
    // and then every upsert against the table throws "no unique or exclusion
    // constraint matching the ON CONFLICT specification". On prod this broke
    // registration itself (user_engagement + subscriptions inserts run inside
    // the register handler). Every entry here mirrors an ON CONFLICT target
    // actually used in the codebase.
    const uniqueTargets = [
      ['user_engagement',     ['user_id'],                                    'user_engagement_user_id_uniq'],
      ['subscriptions',       ['user_id'],                                    'subscriptions_user_id_uniq'],
      ['consumption_velocity',['user_id', 'upc'],                             'consumption_velocity_user_id_upc_uniq'],
      ['harmful_ingredients', ['name'],                                       'harmful_ingredients_name_uniq'],
      ['kid_ratings',         ['user_id', 'upc', 'kid_name'],                 'kid_ratings_user_upc_kid_uniq'],
      ['curated_availability',['upc', 'store_name'],                          'curated_availability_upc_store_uniq'],
      ['flyer_availability',  ['upc', 'merchant', 'search_zip', 'flyer_item_id'], 'flyer_availability_upsert_uniq'],
    ];
    for (const [table, cols, conname] of uniqueTargets) {
      try {
        // Any non-partial unique/PK index covering exactly these columns satisfies ON CONFLICT
        const existing = await pool.query(
          `SELECT 1 FROM pg_index i
           WHERE i.indrelid = $1::regclass
             AND (i.indisunique OR i.indisprimary)
             AND i.indpred IS NULL
             AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                  FROM pg_attribute a
                  WHERE a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)) = $2::text[]`,
          [table, [...cols].sort()]
        );
        if (existing.rows.length === 0) {
          await pool.query(`ALTER TABLE ${table} ADD CONSTRAINT ${conname} UNIQUE (${cols.join(', ')})`);
          console.log(`  repaired: added UNIQUE (${cols.join(', ')}) to ${table}`);
        }
      } catch (e) {
        // Duplicate rows would land here — surface loudly, the upserts on this
        // table will keep failing until resolved
        console.error(`  FAILED to add UNIQUE (${cols.join(', ')}) on ${table}:`, e.message);
      }
    }

    // Trigger: auto-compute total_score on every INSERT/UPDATE to products
    await pool.query(`
      CREATE OR REPLACE FUNCTION compute_total_score()
      RETURNS TRIGGER AS $fn$
      BEGIN
        NEW.total_score := ROUND(
          NEW.harmful_ingredients_score * 0.40 +
          NEW.banned_elsewhere_score * 0.20 +
          NEW.transparency_score * 0.15 +
          NEW.processing_score * 0.15 +
          NEW.company_behavior_score * 0.10
        );
        RETURN NEW;
      END;
      $fn$ LANGUAGE plpgsql;

      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'trg_total_score'
        ) THEN
          CREATE TRIGGER trg_total_score
            BEFORE INSERT OR UPDATE ON products
            FOR EACH ROW
            EXECUTE FUNCTION compute_total_score();
        END IF;
      END $$;
    `);

    // Step 2: Lightweight column additions + extra tables (all IF NOT EXISTS — no data rewrites)
    const t1 = Date.now();
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS nutrition_score INT DEFAULT 50;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS additives_score INT DEFAULT 50;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS organic_bonus INT DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS allergens_tags JSONB DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS swap_discovery_type VARCHAR(50);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS swap_discovered_at TIMESTAMP;

      ALTER TABLE harmful_ingredients ADD COLUMN IF NOT EXISTS source_url TEXT;

      -- Ensure companies.name has UNIQUE constraint (may be missing on older DBs)
      DO $$ BEGIN
        ALTER TABLE companies ADD CONSTRAINT companies_name_key UNIQUE (name);
      EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
      END $$;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS allergen_alerts JSONB DEFAULT '[]';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription JSONB;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(64);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS native_push_token VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_store VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_store_zip VARCHAR(10);

      ALTER TABLE product_contributions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

      ALTER TABLE flyer_availability ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL;
      ALTER TABLE flyer_availability ADD COLUMN IF NOT EXISTS flyer_product_name VARCHAR(255);
      ALTER TABLE flyer_availability ADD COLUMN IF NOT EXISTS brand VARCHAR(255);
      ALTER TABLE flyer_availability ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP;
      ALTER TABLE flyer_availability ADD COLUMN IF NOT EXISTS valid_to TIMESTAMP;
      ALTER TABLE flyer_availability ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE flyer_availability ADD COLUMN IF NOT EXISTS flyer_item_id VARCHAR(100);

      ALTER TABLE curated_availability ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'curated';

      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'online_links_upc_url_key'
        ) THEN
          ALTER TABLE online_links DROP CONSTRAINT online_links_upc_url_key;
        END IF;
      END $$;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_online_links_upc_name ON online_links(upc, name);

      ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS price_paid DECIMAL(8,2);
      ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS store_name VARCHAR(255);
      ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS receipt_id INT;

      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        store_name VARCHAR(255),
        store_address TEXT,
        receipt_date DATE,
        subtotal DECIMAL(10,2),
        tax DECIMAL(10,2),
        total DECIMAL(10,2),
        payment_method VARCHAR(50),
        image_url TEXT,
        raw_text TEXT,
        parsed_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(user_id, receipt_date);

      CREATE TABLE IF NOT EXISTS receipt_items (
        id SERIAL PRIMARY KEY,
        receipt_id INT REFERENCES receipts(id) ON DELETE CASCADE,
        line_text VARCHAR(500),
        item_name VARCHAR(255),
        quantity DECIMAL(8,3) DEFAULT 1,
        unit_price DECIMAL(8,2),
        total_price DECIMAL(8,2),
        upc VARCHAR(20),
        product_id INT REFERENCES products(id) ON DELETE SET NULL,
        matched BOOLEAN DEFAULT false,
        added_to_pantry BOOLEAN DEFAULT false,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items(receipt_id);

      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'refresh_tokens'::regclass
          AND contype = 'u'
          AND conname LIKE '%token_hash%'
        ) THEN
          ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS result_cache (
        upc VARCHAR(20) NOT NULL,
        cache_type VARCHAR(30) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (upc, cache_type)
      );

      CREATE TABLE IF NOT EXISTS conditions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        sub_types JSONB,
        scoring_config JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS user_conditions (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        condition_id INT REFERENCES conditions(id) ON DELETE CASCADE,
        sub_type VARCHAR(50),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, condition_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_conditions_user ON user_conditions(user_id);
      CREATE TABLE IF NOT EXISTS product_condition_scores (
        id SERIAL PRIMARY KEY,
        product_id INT REFERENCES products(id) ON DELETE CASCADE,
        condition_slug VARCHAR(50) NOT NULL,
        sub_type VARCHAR(50),
        score INT CHECK (score >= 0 AND score <= 100),
        flags JSONB DEFAULT '[]',
        cached_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pcs_product ON product_condition_scores(product_id);
      CREATE INDEX IF NOT EXISTS idx_pcs_slug ON product_condition_scores(condition_slug);

      -- Family groups (multi-user household management)
      CREATE TABLE IF NOT EXISTS family_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_family_groups_owner ON family_groups(owner_id);

      CREATE TABLE IF NOT EXISTS family_members (
        id SERIAL PRIMARY KEY,
        group_id INT REFERENCES family_groups(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        invite_token UUID DEFAULT gen_random_uuid(),
        invite_email VARCHAR(255),
        invite_phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'pending',
        role VARCHAR(20) DEFAULT 'member',
        joined_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_family_members_group ON family_members(group_id);
      CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_family_members_token ON family_members(invite_token);

      CREATE TABLE IF NOT EXISTS family_member_profiles (
        id SERIAL PRIMARY KEY,
        family_member_id INT REFERENCES family_members(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        diseases JSONB DEFAULT '[]',
        allergies JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fmp_member ON family_member_profiles(family_member_id);

      INSERT INTO conditions (name, slug, description, sub_types) VALUES
        ('Thyroid Disease', 'thyroid', 'Scoring follows ATA and AACE guidelines: real iodine restrictions for hyperthyroidism, medication-timing flags for hypothyroidism and Hashimoto''s.', '["hypo","hyper","hashimotos"]'),
        ('Diabetes / Blood Sugar', 'diabetes', 'Scores based on added sugar, carbohydrate quality, and fiber per ADA Standards of Care.', NULL),
        ('Heart Disease / Cholesterol', 'heart', 'Evaluates saturated fat, trans fat, sodium, processed meat, and heart-healthy ingredients per AHA 2021 dietary guidance.', NULL),
        ('Kidney Disease', 'kidney', 'Phosphate additives, sodium, and stage-specific protein/potassium per KDOQI 2020.', '["general","ckd-3-4","dialysis","stones"]'),
        ('Celiac / Gluten Intolerance', 'celiac', 'Detects wheat, barley, rye, oats cross-contamination, and ambiguous gluten sources per FDA GF rule and Celiac Disease Foundation.', NULL)
      ON CONFLICT (slug) DO NOTHING;

      -- Idempotent updates for previously-seeded rows (descriptions + new sub_types for kidney)
      UPDATE conditions SET sub_types = '["general","ckd-3-4","dialysis","stones"]'
        WHERE slug = 'kidney' AND (sub_types IS NULL OR sub_types::text = 'null');
      UPDATE conditions SET description = 'Scoring follows ATA and AACE guidelines: real iodine restrictions for hyperthyroidism, medication-timing flags for hypothyroidism and Hashimoto''s.' WHERE slug = 'thyroid';
      UPDATE conditions SET description = 'Scores based on added sugar, carbohydrate quality, and fiber per ADA Standards of Care.' WHERE slug = 'diabetes';
      UPDATE conditions SET description = 'Evaluates saturated fat, trans fat, sodium, processed meat, and heart-healthy ingredients per AHA 2021 dietary guidance.' WHERE slug = 'heart';
      UPDATE conditions SET description = 'Phosphate additives, sodium, and stage-specific protein/potassium per KDOQI 2020.' WHERE slug = 'kidney';
      UPDATE conditions SET description = 'Detects wheat, barley, rye, oats cross-contamination, and ambiguous gluten sources per FDA GF rule and Celiac Disease Foundation.' WHERE slug = 'celiac';

      -- Track which rules version produced each cached score (v1 rows have NULL; v2 stamps '2.0.0')
      ALTER TABLE product_condition_scores ADD COLUMN IF NOT EXISTS rules_version VARCHAR(20);

      -- Generic recipe-API result cache (Spoonacular search, from-pantry, etc.)
      -- Keyed by an arbitrary string (e.g. hash of query+filters, or user+pantry fingerprint).
      CREATE TABLE IF NOT EXISTS recipe_cache (
        cache_key VARCHAR(128) PRIMARY KEY,
        cache_type VARCHAR(32) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_recipe_cache_type ON recipe_cache(cache_type, created_at);

      -- Track recipe provenance (curated by us vs imported from Wikibooks / USDA / etc.)
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source VARCHAR(32) DEFAULT 'curated';
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_url TEXT;
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_attribution TEXT;
      -- Per-serving nutrition (from imported sources that publish nutrition data)
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS nutrition_facts JSONB;
      CREATE INDEX IF NOT EXISTS idx_recipes_source ON recipes(source);

      -- Postgres extensions needed for company-behavior brand matching.
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE EXTENSION IF NOT EXISTS unaccent;

      -- brand_aliases maps normalized brand strings → parent company.
      -- Filled by seed-brand-portfolios.js.
      CREATE TABLE IF NOT EXISTS brand_aliases (
        alias        VARCHAR(255) PRIMARY KEY,
        alias_display VARCHAR(255) NOT NULL,
        company_id   INT REFERENCES companies(id) ON DELETE CASCADE,
        created_at   TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_brand_aliases_company ON brand_aliases(company_id);
      CREATE INDEX IF NOT EXISTS idx_brand_aliases_trgm ON brand_aliases USING gin (alias gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);

      -- Admin audit log: every gated mutation (toggle admin, grant trial,
      -- edit company score, delete recipe, etc.) is recorded so we can
      -- answer "who changed what, when, and from where".
      CREATE TABLE IF NOT EXISTS admin_actions (
        id SERIAL PRIMARY KEY,
        admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        admin_email VARCHAR(255),          -- denormalized for log readability after user delete
        action VARCHAR(64) NOT NULL,        -- e.g. 'toggle_admin', 'grant_trial', 'update_company'
        target_type VARCHAR(32),            -- e.g. 'user', 'company', 'recipe'
        target_id VARCHAR(64),              -- stringified id (UUID or int)
        details JSONB,                       -- arbitrary context (before/after, params)
        ip_address VARCHAR(64),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_type, target_id);

      -- Runtime feature flags: simple key/value switches for kill-switches,
      -- maintenance mode, etc. Code paths check getFlag('disable_receipt_scanning')
      -- and similar.
      CREATE TABLE IF NOT EXISTS feature_flags (
        key VARCHAR(64) PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT false,
        description TEXT,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      );

      -- Seed a baseline set of flags (idempotent)
      INSERT INTO feature_flags (key, enabled, description) VALUES
        ('maintenance_mode',         false, 'Site-wide maintenance banner + read-only mode'),
        ('disable_receipt_scanning', false, 'Kill switch for /receipts/scan (OpenAI cost control)'),
        ('disable_spoonacular',      false, 'Kill switch for /recipes/spoonacular/* endpoints'),
        ('disable_family_invites',   false, 'Hide family-group invite UI'),
        ('disable_swap_discovery',   false, 'Disable on-the-fly OFF lookups for swaps'),
        ('show_beta_banner',         false, 'Show "beta" banner at top of every page')
      ON CONFLICT (key) DO NOTHING;
    `);

    // normalize_brand() — used by both the in-memory matcher (mirror in
    // JS) and the SQL backfill index. Strips diacritics, corporate
    // suffixes (LLC, Inc, USA, etc.), and non-alphanumeric chars.
    await pool.query(`
      CREATE OR REPLACE FUNCTION normalize_brand(s text) RETURNS text AS $body$
        SELECT regexp_replace(
          regexp_replace(
            public.unaccent(lower(coalesce(s, ''))),
            '\\m(inc|llc|ltd|corp|corporation|co|company|usa|us|na|north[ -]america|n[ -]a|brands|foods|group|holdings|gmbh|sa|ag|plc|llp|limited)\\M',
            ' ', 'g'
          ),
          '[^a-z0-9]', '', 'g'
        )
      $body$ LANGUAGE SQL IMMUTABLE;
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_brand_norm ON products (normalize_brand(brand))`);
    console.log(`  migrations applied (${Date.now() - t1}ms)`);

    console.log(`Database initialized in ${Date.now() - t0}ms`);
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
