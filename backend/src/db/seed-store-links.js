#!/usr/bin/env node
// ============================================================
// SEED STORE AVAILABILITY + ONLINE LINKS
//
// Populates curated_availability and online_links tables for
// all clean alternative products in the swap database.
//
// Run from Render shell:
//   cd /opt/render/project/src/backend
//   node src/db/seed-store-links.js
// ============================================================

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : undefined,
});

// ============================================================
// DATA
// Format: upc → { stores: [...], online: [...] }
// Stores = chains that generally carry this product
// Online = buy links (Amazon, Walmart, Thrive, brand DTC)
// ============================================================

const STORE_DATA = {

  // ── CEREALS ──

  // Nature's Path Heritage Flakes
  '0058449400028': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Kroger', 'Natural Grocers', 'Wegmans', 'Publix', 'Safeway'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=natures+path+heritage+flakes', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=natures+path+heritage+flakes', type: 'health' },
      { name: "Nature's Path (direct)", url: 'https://www.naturespath.com', type: 'brand' },
    ]
  },

  // Barbara's Puffins Original
  '0023923203006': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Kroger', 'Wegmans', 'Natural Grocers', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=barbaras+puffins+cereal+original', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=barbaras+puffins', type: 'health' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=barbaras+puffins+cereal', type: 'marketplace' },
    ]
  },

  // Cascadian Farm Honey Nut O's
  '0884734006115': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Natural Grocers', 'Wegmans', 'Publix', 'Safeway'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=cascadian+farm+honey+nut+os', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=cascadian+farm', type: 'health' },
    ]
  },

  // Three Wishes Fruity Cereal
  '0860091002154': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Walmart', 'Wegmans', 'HEB', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/dp/B08R7Z1KPP', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=three+wishes+cereal', type: 'health' },
      { name: 'Three Wishes (direct)', url: 'https://threewishescereal.com', type: 'brand' },
    ]
  },

  // Three Wishes Cinnamon Cereal
  '0850015717017': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Walmart', 'Wegmans', 'HEB', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/dp/B08R7Z1KPP', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/p/three-wishes-grain-free-cereal-cinnamon', type: 'health' },
      { name: 'Three Wishes (direct)', url: 'https://threewishescereal.com', type: 'brand' },
    ]
  },

  // Nature's Path EnviroKidz Cheetah Chomps (Chocolate)
  '0058449860020': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Kroger', 'Natural Grocers', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=envirokidz+cheetah+chomps', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=envirokidz', type: 'health' },
    ]
  },

  // Nature's Path EnviroKidz Gorilla Munch
  '0058449860051': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Kroger', 'Natural Grocers', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=envirokidz+gorilla+munch', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=envirokidz+gorilla', type: 'health' },
    ]
  },

  // Barbara's Peanut Butter Puffins
  '0023923203112': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Kroger', 'Wegmans', 'Natural Grocers'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=barbaras+peanut+butter+puffins', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=barbaras+puffins+peanut+butter', type: 'health' },
    ]
  },

  // ── CANDY ──

  // Hu Simple Dark Chocolate Bar
  '0853715003268': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'CVS', 'Natural Grocers', 'Fresh Market', 'Wegmans', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=hu+dark+chocolate+bar', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=hu+chocolate', type: 'health' },
      { name: 'Hu (direct)', url: 'https://www.hukitchen.com', type: 'brand' },
    ]
  },

  // Unreal Dark Chocolate Peanut Butter Cups
  '0757528008116': {
    stores: ['Target', 'Whole Foods', 'Kroger', 'CVS', 'Sprouts', 'Natural Grocers', 'Fresh Market', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=unreal+dark+chocolate+peanut+butter+cups', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=unreal+peanut+butter+cups', type: 'health' },
      { name: 'Unreal (direct)', url: 'https://www.unrealsnacks.com', type: 'brand' },
    ]
  },

  // SmartSweets Sour Blast Buddies
  '0850006801015': {
    stores: ['Target', 'Walmart', 'Kroger', 'CVS', 'Walgreens', 'Whole Foods', 'Sprouts', 'HEB', 'Meijer', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=smartsweets+sour+blast+buddies', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=smartsweets+candy', type: 'marketplace' },
      { name: 'SmartSweets (direct)', url: 'https://smartsweets.com', type: 'brand' },
    ]
  },

  // SmartSweets Sweet Fish
  '0850006801022': {
    stores: ['Target', 'Walmart', 'Kroger', 'CVS', 'Walgreens', 'Whole Foods', 'Sprouts', 'HEB'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=smartsweets+sweet+fish', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=smartsweets+sweet+fish', type: 'marketplace' },
      { name: 'SmartSweets (direct)', url: 'https://smartsweets.com', type: 'brand' },
    ]
  },

  // SmartSweets Peach Rings
  '0850006801039': {
    stores: ['Target', 'Walmart', 'Kroger', 'CVS', 'Walgreens', 'Whole Foods', 'Sprouts'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=smartsweets+peach+rings', type: 'marketplace' },
      { name: 'SmartSweets (direct)', url: 'https://smartsweets.com', type: 'brand' },
    ]
  },

  // YumEarth Organic Fruit Snacks
  '0810165016842': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'CVS', 'Walgreens', 'HEB', 'Publix', 'Safeway', 'Meijer'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=yumearth+organic+fruit+snacks', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=yumearth+fruit+snacks', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=yumearth', type: 'health' },
    ]
  },

  // Unreal Dark Chocolate Gems (M&M swap)
  '0757528008147': {
    stores: ['Target', 'Whole Foods', 'Kroger', 'CVS', 'Sprouts', 'Natural Grocers', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/dp/B00JKJK4QE', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=unreal+gems', type: 'health' },
      { name: 'Unreal (direct)', url: 'https://www.unrealsnacks.com', type: 'brand' },
    ]
  },

  // YumEarth Organic Giggles
  '0810165019799': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'CVS'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=yumearth+giggles+candy', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=yumearth+giggles', type: 'health' },
    ]
  },

  // YumEarth Organic Licorice
  '0810165013766': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'CVS', 'Natural Grocers'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=yumearth+organic+licorice', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=yumearth+licorice', type: 'health' },
    ]
  },

  // ── FRUIT SNACKS ──

  // YumEarth Organic Tropical Fruit Snacks
  '0810165016828': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'CVS', 'Walgreens'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=yumearth+tropical+fruit+snacks', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=yumearth+tropical', type: 'health' },
    ]
  },

  // Stretch Island Fruit Bites Strawberry
  '0862683000332': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Publix', 'Safeway'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=stretch+island+fruit+bites', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=stretch+island+fruit+snacks', type: 'marketplace' },
    ]
  },

  // ── CHIPS ──

  // Late July Organic Sea Salt Tortilla Chips
  '0016000505261': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'Publix', 'Safeway', 'HEB', 'Wegmans', 'Meijer'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=late+july+organic+tortilla+chips', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=late+july+chips', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=late+july+chips', type: 'health' },
    ]
  },

  // Siete Sea Salt Tortilla Chips
  '0849911000106': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Natural Grocers', 'HEB', 'Wegmans', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=siete+sea+salt+tortilla+chips', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=siete+chips', type: 'health' },
      { name: 'Siete (direct)', url: 'https://sietefoods.com', type: 'brand' },
    ]
  },

  // Kettle Brand Sea Salt Potato Chips
  '0021908501222': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Publix', 'Safeway', 'HEB', 'Meijer', 'Wegmans', 'Costco'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=kettle+brand+sea+salt+chips', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=kettle+brand+sea+salt+chips', type: 'marketplace' },
    ]
  },

  // ── SODA ──

  // Olipop Vintage Cola
  '0856544006301': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Walmart', 'CVS', 'HEB', 'Publix', 'Wegmans', 'Meijer'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=olipop+vintage+cola', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=olipop+soda', type: 'marketplace' },
      { name: 'Olipop (direct)', url: 'https://drinkolipop.com', type: 'brand' },
    ]
  },

  // Spindrift Sparkling Water
  '0012000171581': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Costco', 'CVS', 'Publix', 'Safeway', 'HEB', 'Meijer'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=spindrift+sparkling+water', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=spindrift+sparkling+water', type: 'marketplace' },
      { name: 'Spindrift (direct)', url: 'https://spindriftfresh.com', type: 'brand' },
    ]
  },

  // ── ENERGY ──

  // Celsius Sparkling Green Tea
  '0818523020009': {
    stores: ['Walmart', 'Target', 'Kroger', '7-Eleven', 'CVS', 'Walgreens', 'Costco', 'HEB', 'Publix', 'Safeway', 'Meijer', 'Dollar General'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=celsius+sparkling+green+tea', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=celsius+energy+drink', type: 'marketplace' },
    ]
  },

  // ── COOKIES ──

  // Simple Mills Chocolate Chip Cookies
  '0856575002016': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Walmart', 'Natural Grocers', 'HEB', 'Publix', 'Safeway', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=simple+mills+chocolate+chip+cookies', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=simple+mills+cookies', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=simple+mills+cookies', type: 'health' },
    ]
  },

  // Tate's Bake Shop Chocolate Chip Cookies
  '0723346101126': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Publix', 'Safeway', 'Costco', 'HEB', 'Wegmans', 'Stop & Shop'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=tates+bakeshop+chocolate+chip+cookies', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=tates+cookies', type: 'marketplace' },
    ]
  },

  // ── CRACKERS ──

  // Simple Mills Almond Flour Crackers
  '0856575002191': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Walmart', 'Natural Grocers', 'HEB', 'Publix', 'Safeway', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=simple+mills+almond+flour+crackers', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=simple+mills+crackers', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=simple+mills+crackers', type: 'health' },
    ]
  },

  // Mary's Gone Crackers Original
  '0021130340804': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Kroger', 'Natural Grocers', 'Wegmans', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=marys+gone+crackers+original', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=marys+gone+crackers', type: 'health' },
    ]
  },

  // ── MAC & CHEESE ──

  // Annie's Organic Mac & Cheese
  '0013562000043': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'Publix', 'Safeway', 'Meijer', 'HEB', 'Wegmans', "Trader Joe's"],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/dp/B000HDJZWO', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=annies+organic+mac+cheese', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=annies+mac+cheese', type: 'health' },
    ]
  },

  // ── YOGURT ──

  // Stonyfield Organic Whole Milk Yogurt
  '0689544002017': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'Publix', 'Safeway', 'HEB', 'Wegmans', 'Meijer'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=stonyfield+organic+yogurt', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=stonyfield+organic+yogurt', type: 'marketplace' },
      { name: 'Instacart', url: 'https://www.instacart.com/store/search_v3/stonyfield+yogurt', type: 'delivery' },
    ]
  },

  // Siggi's Vanilla Skyr
  '0052159700119': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'Publix', 'Safeway', 'HEB', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=siggis+vanilla+yogurt', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=siggis+yogurt', type: 'marketplace' },
      { name: 'Instacart', url: 'https://www.instacart.com/store/search_v3/siggis+yogurt', type: 'delivery' },
    ]
  },

  // ── BREAD ──

  // Dave's Killer Bread 21 Whole Grains
  '0073410013301': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Costco', 'Publix', 'Safeway', 'HEB', 'Meijer', 'Wegmans', 'Albertsons'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=daves+killer+bread+21+grains', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=daves+killer+bread', type: 'marketplace' },
      { name: 'Instacart', url: 'https://www.instacart.com/store/search_v3/daves+killer+bread', type: 'delivery' },
    ]
  },

  // Ezekiel 4:9 Sprouted Bread
  '0764442000051': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Kroger', 'Natural Grocers', 'Publix', 'Safeway', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=ezekiel+sprouted+bread', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=ezekiel+bread', type: 'health' },
      { name: 'Food for Life (direct)', url: 'https://www.foodforlife.com', type: 'brand' },
    ]
  },

  // ── ICE CREAM ──

  // Three Twins Organic Vanilla Ice Cream
  '0856283004013': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Natural Grocers', 'Fresh Market', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=three+twins+organic+ice+cream', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=three+twins+ice+cream', type: 'health' },
    ]
  },

  // ── DRESSING ──

  // Primal Kitchen Ranch Dressing
  '0853529002032': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Walmart', 'Natural Grocers', 'HEB', 'Publix', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=primal+kitchen+ranch+dressing', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=primal+kitchen+ranch', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=primal+kitchen+ranch', type: 'health' },
      { name: 'Primal Kitchen (direct)', url: 'https://www.primalkitchen.com', type: 'brand' },
    ]
  },

  // Tessemae's Organic Creamy Ranch
  '0042272005550': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Natural Grocers', 'Wegmans', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=tessemaes+organic+ranch', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=tessemaes+ranch', type: 'health' },
    ]
  },

  // ── SNACK BARS ──

  // KIND Caramel Almond & Sea Salt Bar
  '0602652171130': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Costco', 'CVS', 'Walgreens', 'Publix', 'Safeway', 'HEB', 'Meijer', 'Wegmans', 'Dollar General', '7-Eleven'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=kind+caramel+almond+sea+salt+bar', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=kind+bar+caramel+almond', type: 'marketplace' },
      { name: 'KIND (direct)', url: 'https://www.kindsnacks.com', type: 'brand' },
    ]
  },

  // RXBAR Chocolate Sea Salt
  '0818497012040': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Costco', 'CVS', 'Walgreens', 'Publix', 'Safeway', 'HEB', 'Meijer'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=rxbar+chocolate+sea+salt', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=rxbar+chocolate+sea+salt', type: 'marketplace' },
      { name: 'RXBAR (direct)', url: 'https://www.rxbar.com', type: 'brand' },
    ]
  },

  // ── PEANUT BUTTER ──

  // Once Again Organic Crunchy Peanut Butter
  '0854862006001': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Kroger', 'Natural Grocers', 'Wegmans', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=once+again+organic+peanut+butter', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=once+again+peanut+butter', type: 'health' },
    ]
  },

  // Santa Cruz Organic Dark Roasted Peanut Butter
  '0072431001376': {
    stores: ['Walmart', 'Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Natural Grocers', 'Publix', 'Safeway', 'HEB'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=santa+cruz+organic+peanut+butter', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=santa+cruz+organic+peanut+butter', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=santa+cruz+peanut+butter', type: 'health' },
    ]
  },

  // ── PASTA SAUCE ──

  // Rao's Homemade Marinara
  '0017532003010': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Costco', 'Publix', 'Safeway', 'HEB', 'Meijer', 'Wegmans', 'Albertsons', 'Stop & Shop'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=raos+homemade+marinara+sauce', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=raos+marinara+sauce', type: 'marketplace' },
      { name: "Rao's (direct)", url: 'https://raos.com', type: 'brand' },
    ]
  },

  // Victoria Marinara Sauce
  '0725342200016': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Kroger', 'Natural Grocers', 'Wegmans', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=victoria+marinara+sauce', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=victoria+marinara', type: 'health' },
    ]
  },

  // ── SOUP / FROZEN ──

  // Amy's Organic Lentil Soup
  '0052603054607': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'Publix', 'Safeway', 'HEB', 'Meijer', 'Wegmans', 'Natural Grocers'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=amys+organic+lentil+soup', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=amys+organic+soup', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=amys+soup', type: 'health' },
    ]
  },

  // ── HOT DOGS / LUNCH MEAT ──

  // Applegate Uncured Beef Hot Dogs
  '0025317074001': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'Publix', 'Safeway', 'HEB', 'Meijer', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=applegate+uncured+beef+hot+dogs', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=applegate+hot+dogs', type: 'marketplace' },
      { name: 'Instacart', url: 'https://www.instacart.com/store/search_v3/applegate+hot+dogs', type: 'delivery' },
    ]
  },

  // Applegate Organic Roasted Turkey Breast
  '0025317000048': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'Publix', 'Safeway', 'HEB', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=applegate+organic+turkey+breast', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=applegate+organic+turkey', type: 'marketplace' },
    ]
  },

  // ── CONDIMENTS ──

  // Primal Kitchen Organic Ketchup
  '0852476003005': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Walmart', 'Natural Grocers', 'HEB', 'Publix', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=primal+kitchen+organic+ketchup', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=primal+kitchen+ketchup', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=primal+kitchen+ketchup', type: 'health' },
    ]
  },

  // Primal Kitchen Avocado Oil Mayo
  '0853529002018': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Walmart', 'Natural Grocers', 'HEB', 'Publix', 'Safeway', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=primal+kitchen+avocado+oil+mayo', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=primal+kitchen+mayo', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=primal+kitchen+mayo', type: 'health' },
    ]
  },

  // ── OATMEAL / GRANOLA ──

  // Bob's Red Mill Organic Rolled Oats
  '0039978009012': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'Publix', 'Safeway', 'HEB', 'Meijer', 'Wegmans', 'Natural Grocers', 'Costco'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=bobs+red+mill+organic+rolled+oats', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=bobs+red+mill+organic+oats', type: 'marketplace' },
      { name: "Bob's Red Mill (direct)", url: 'https://www.bobsredmill.com', type: 'brand' },
    ]
  },

  // Nature's Path Pumpkin Seed + Flax Granola
  '0058449400103': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Kroger', 'Natural Grocers', 'Wegmans', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=natures+path+pumpkin+seed+flax+granola', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=natures+path+granola', type: 'health' },
    ]
  },

  // ── MILK ──

  // Horizon Organic Chocolate Lowfat Milk
  '0049022783232': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Costco', 'Publix', 'Safeway', 'HEB', 'Meijer', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=horizon+organic+chocolate+milk', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=horizon+organic+chocolate+milk', type: 'marketplace' },
    ]
  },

  // ── OTHER ──

  // Lotus Foods Organic Millet & Brown Rice Ramen
  '0054800420711': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Natural Grocers', 'Wegmans', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=lotus+foods+organic+ramen', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=lotus+foods+ramen', type: 'health' },
      { name: 'Lotus Foods (direct)', url: 'https://www.lotusfoods.com', type: 'brand' },
    ]
  },

  // Amy's Organic Cheese Pizza
  '0096749262106': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'Publix', 'Safeway', 'HEB', 'Natural Grocers', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=amys+organic+cheese+pizza', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=amys+organic+pizza', type: 'marketplace' },
    ]
  },

  // Bob's Red Mill Organic Pancake Mix
  '0039978005700': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'Publix', 'Safeway', 'Natural Grocers'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=bobs+red+mill+organic+pancake+mix', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=bobs+red+mill+pancake+mix', type: 'marketplace' },
      { name: "Bob's Red Mill (direct)", url: 'https://www.bobsredmill.com', type: 'brand' },
    ]
  },

  // Coombs Family Farms Grade A Organic Maple Syrup
  '0073066009003': {
    stores: ['Whole Foods', 'Sprouts', 'Target', 'Kroger', 'Natural Grocers', 'Wegmans', 'Publix', 'Costco'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=coombs+family+farms+organic+maple+syrup', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=coombs+maple+syrup', type: 'health' },
    ]
  },

  // Simple Mills Toaster Pastry Strawberry
  '0856575002849': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Walmart', 'Natural Grocers', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=simple+mills+toaster+pastry', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=simple+mills+toaster+pastry', type: 'health' },
    ]
  },

  // Simple Mills Almond Flour Pasta Sauce (mac & cheese swap)
  '0856575002535': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Walmart', 'Natural Grocers', 'Wegmans', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=simple+mills+almond+flour+pasta', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=simple+mills+pasta', type: 'health' },
    ]
  },

  // Pirate's Booty White Cheddar
  '0015665601004': {
    stores: ['Walmart', 'Target', 'Kroger', 'Costco', 'Whole Foods', 'Publix', 'Safeway', 'Meijer', 'HEB', 'Wegmans', "Trader Joe's"],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/dp/B000F0GWXA', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=pirates+booty', type: 'marketplace' },
    ]
  },
};

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║   ICK — SEED STORE + ONLINE LINKS         ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');

  try {
    const r = await pool.query('SELECT COUNT(*) as c FROM products');
    console.log(`  ✓ DB connected. Products: ${r.rows[0].c}`);
  } catch (err) {
    console.error('  ✗ DB connection failed:', err.message);
    process.exit(1);
  }

  // Ensure tables exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS curated_availability (
      id SERIAL PRIMARY KEY,
      upc VARCHAR(20) NOT NULL,
      store_name VARCHAR(255) NOT NULL,
      store_chain VARCHAR(100),
      source VARCHAR(20) DEFAULT 'curated',
      verified_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(upc, store_name)
    );
    CREATE TABLE IF NOT EXISTS online_links (
      id SERIAL PRIMARY KEY,
      upc VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      link_type VARCHAR(50) DEFAULT 'marketplace',
      active BOOLEAN DEFAULT true,
      UNIQUE(upc, name)
    );
    CREATE INDEX IF NOT EXISTS idx_curated_upc ON curated_availability(upc);
    CREATE INDEX IF NOT EXISTS idx_online_links_upc ON online_links(upc);
  `);
  console.log('  ✓ Tables ready');

  let storeRows = 0;
  let linkRows = 0;
  let errors = 0;

  for (const [rawUpc, data] of Object.entries(STORE_DATA)) {
    // Normalize UPC to 13 digits (pad with leading zeros)
    const upc = rawUpc.replace(/[^0-9]/g, '').padStart(13, '0');

    // Also try the raw UPC as stored in DB (some are shorter)
    const upcsToTry = [upc, rawUpc.replace(/^0+/, '')];

    // Store availability
    for (const store of data.stores) {
      try {
        await pool.query(
          `INSERT INTO curated_availability (upc, store_name, source)
           VALUES ($1, $2, 'curated')
           ON CONFLICT (upc, store_name) DO NOTHING`,
          [upc, store]
        );
        storeRows++;
      } catch (e) {
        errors++;
      }
    }

    // Online links
    for (const link of (data.online || [])) {
      try {
        await pool.query(
          `INSERT INTO online_links (upc, name, url, link_type, active)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (upc, name) DO UPDATE SET url = EXCLUDED.url, active = true`,
          [upc, link.name, link.url, link.type]
        );
        linkRows++;
      } catch (e) {
        errors++;
      }
    }
  }

  console.log(`\n  ✓ Store listings inserted: ${storeRows}`);
  console.log(`  ✓ Online links inserted:   ${linkRows}`);
  if (errors > 0) console.log(`  ⚠ Errors:                  ${errors}`);

  // Verify final counts
  const storeCount = await pool.query('SELECT COUNT(*) as c FROM curated_availability');
  const linkCount = await pool.query('SELECT COUNT(*) as c FROM online_links');
  console.log(`\n  DB totals:`);
  console.log(`    curated_availability: ${storeCount.rows[0].c} rows`);
  console.log(`    online_links:         ${linkCount.rows[0].c} rows`);

  // Show which products now have store data
  const covered = await pool.query(`
    SELECT p.name, p.brand, COUNT(ca.store_name) as store_count
    FROM products p
    JOIN curated_availability ca ON p.upc = ca.upc
    GROUP BY p.id, p.name, p.brand
    ORDER BY store_count DESC
    LIMIT 20
  `);
  if (covered.rows.length > 0) {
    console.log('\n  Top products with store coverage:');
    covered.rows.forEach(r => {
      console.log(`    ${(r.name || 'Unknown').slice(0, 35).padEnd(36)} ${r.store_count} stores`);
    });
  }

  await pool.end();
  console.log('\n  ✓ Done!\n');
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
