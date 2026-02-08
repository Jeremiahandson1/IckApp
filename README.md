# ScanAndSwap

**Scan food. Know better. Swap smarter.**

A food scanner app targeting kids' food with corporate accountability. Scan a barcode to see harmful ingredients, why they exist (corporate cost-cutting), where they're banned, and get healthier swaps with local availability.

## Features

### Core Functionality
- **Barcode Scanning** - Scan any food product to get instant health analysis
- **Health Scoring** - 5-dimension algorithm (Harmful Ingredients 35%, Banned Elsewhere 20%, Transparency 15%, Processing 15%, Company Behavior 15%)
- **Pantry Management** - Track everything in your home with health reports
- **Smart Swaps** - Get personalized recommendations for healthier alternatives
- **Homemade Recipes** - DIY alternatives with cost comparisons
- **Shopping Lists** - Velocity-predicted shopping with in-store mode
- **Progress Tracking** - Achievements, health score trends, box qualification

### Score Ratings
- 🌟 **Excellent (86-100)**: Serenity Kids, Three Wishes, Unreal
- 🟢 **Good (71-85)**: Annie's, Cheerios, Cascadian Farm
- 🟡 **Okay (51-70)**: KIND Bar, Capri Sun, Gerber
- 🟠 **Poor (31-50)**: Welch's, Cheetos
- 🔴 **Avoid (0-30)**: Skittles, Froot Loops, Lucky Charms

## Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: Express.js + PostgreSQL
- **Mobile**: PWA (iOS) + Capacitor (Android APK)
- **Barcode**: html5-qrcode + @zxing/library

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://user:password@localhost:5432/scanandswap
JWT_SECRET=your-secret-key-here
PORT=3001
FRONTEND_URL=http://localhost:3000
EOF

# Initialize database
npm run db:init

# Seed with sample data
npm run db:seed

# Start server
npm start
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
VITE_API_URL=http://localhost:3001/api
EOF

# Start dev server
npm run dev
```

Visit `http://localhost:3000`

## Building for Production

### PWA Build (iOS + Web)

```bash
cd frontend
npm run build
```

The `dist/` folder contains a complete PWA ready for deployment.

**iOS Installation:**
1. Deploy to any HTTPS hosting (Netlify, Vercel, etc.)
2. Open in Safari on iPhone
3. Tap Share → "Add to Home Screen"
4. App installs with icon, runs fullscreen

### Android APK Build

```bash
cd frontend

# Build web assets
npm run build

# Initialize Capacitor (first time only)
npx cap init ScanAndSwap com.scanandswap.app --web-dir dist

# Add Android platform
npx cap add android

# Sync web assets to Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

In Android Studio:
1. Build → Build Bundle(s) / APK(s) → Build APK(s)
2. APK will be in `android/app/build/outputs/apk/debug/`

## Deployment

### Backend (Render)

1. Create PostgreSQL database on Render
2. Create Web Service:
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment variables:
     - `DATABASE_URL`: Your PostgreSQL connection string
     - `JWT_SECRET`: Random secure string
     - `FRONTEND_URL`: Your frontend URL

### Frontend (Netlify/Vercel)

1. Connect your repository
2. Build settings:
   - Build command: `cd frontend && npm install && npm run build`
   - Publish directory: `frontend/dist`
3. Environment variables:
   - `VITE_API_URL`: Your backend URL + `/api`

## Project Structure

```
scanandswap/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── init.js      # Database schema
│   │   │   └── seed.js      # Sample data
│   │   ├── middleware/
│   │   │   └── auth.js      # JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.js      # Login/register
│   │   │   ├── products.js  # Product lookup/scoring
│   │   │   ├── pantry.js    # Pantry management
│   │   │   ├── swaps.js     # Swap recommendations
│   │   │   ├── recipes.js   # Homemade alternatives
│   │   │   ├── shopping.js  # Shopping lists
│   │   │   ├── velocity.js  # Consumption tracking
│   │   │   └── progress.js  # Achievements/stats
│   │   └── index.js         # Express server
│   └── package.json
│
└── frontend/
    ├── public/
    │   ├── icons/           # PWA icons
    │   ├── splash/          # iOS splash screens
    │   ├── manifest.json    # PWA manifest
    │   └── sw.js            # Service worker
    ├── src/
    │   ├── components/
    │   │   ├── common/      # Reusable components
    │   │   └── layout/      # App layout
    │   ├── contexts/
    │   │   ├── AuthContext.jsx
    │   │   └── ToastContext.jsx
    │   ├── pages/
    │   │   ├── Landing.jsx
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Scan.jsx
    │   │   ├── ProductResult.jsx
    │   │   ├── Pantry.jsx
    │   │   ├── PantryAudit.jsx
    │   │   ├── Swaps.jsx
    │   │   ├── Recipes.jsx
    │   │   ├── RecipeDetail.jsx
    │   │   ├── Shopping.jsx
    │   │   ├── ShoppingList.jsx
    │   │   ├── ShoppingMode.jsx
    │   │   ├── Progress.jsx
    │   │   └── Profile.jsx
    │   ├── utils/
    │   │   ├── api.js       # API client
    │   │   └── helpers.js   # Utility functions
    │   ├── App.jsx          # Routes
    │   └── main.jsx         # Entry point
    ├── capacitor.config.ts
    ├── vite.config.js
    └── package.json
```

## Database Schema

### Core Tables
- `users` - User accounts with household info
- `harmful_ingredients` - 50+ tracked harmful ingredients
- `companies` - Company health scores and practices
- `products` - Scanned products with scores
- `pantry_items` - User pantry with quantity tracking

### Tracking Tables
- `consumption_velocity` - Usage patterns for predictions
- `shopping_lists` - Lists with completion tracking
- `shopping_list_items` - Items with price tracking
- `recipes` - Homemade alternatives
- `user_engagement` - Scan/swap/recipe activity

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user

### Products
- `GET /api/products/scan/:upc` - Scan product
- `GET /api/products/search?query=` - Search products
- `GET /api/products/ingredients/harmful` - List harmful ingredients

### Pantry
- `GET /api/pantry` - List pantry items
- `POST /api/pantry` - Add item
- `POST /api/pantry/bulk` - Bulk add items
- `PUT /api/pantry/:id/finish` - Mark finished
- `DELETE /api/pantry/:id` - Remove item
- `GET /api/pantry/audit` - Health report

### Swaps
- `GET /api/swaps/for/:upc` - Get swaps for product
- `GET /api/swaps/recommendations` - Personalized recommendations
- `POST /api/swaps/click` - Track swap click
- `POST /api/swaps/purchased` - Track purchase

### Recipes
- `GET /api/recipes` - List recipes
- `GET /api/recipes/:id` - Get recipe
- `GET /api/recipes/for/:upc` - Recipes for product
- `POST /api/recipes/:id/made` - Mark as made

### Shopping
- `GET /api/shopping/lists` - Get lists
- `POST /api/shopping/lists` - Create list
- `POST /api/shopping/lists/generate` - Auto-generate from velocity
- `PUT /api/shopping/items/:id/check` - Check off item
- `PUT /api/shopping/lists/:id/complete` - Complete trip

### Velocity
- `GET /api/velocity` - All velocity data
- `GET /api/velocity/running-low` - Items running low
- `POST /api/velocity/log` - Log consumption
- `GET /api/velocity/summary` - Summary stats

### Progress
- `GET /api/progress/dashboard` - Dashboard data
- `GET /api/progress/achievements` - User achievements
- `GET /api/progress/box-status` - Box qualification

## Revenue Model

### Phase 1: Free App
- Affiliate links to healthier products (Amazon 3-8%, Thrive $20-30)
- Target: $750-3K/month at 10K users

### Phase 2: Sample Box
- Brand-funded samples, $4.99 shipping
- Brands pay $2.50-5/sample
- Target: $5K-15K/month at 10-25K users

### Phase 3: Buying Club
- $45/month membership
- Wholesale products, velocity-curated boxes
- Target: $25K+/month at 50K users

## License

MIT
