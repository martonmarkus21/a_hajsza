# Telepítési útmutató

## Előfeltételek

- Node.js 18+
- Docker és Docker Compose
- PostgreSQL 15+ (vagy Docker)
- Redis (vagy Docker)
- Android Studio (Android app fejlesztéshez)

## Backend telepítés

```bash
cd backend
npm install
cp .env.example .env
# Szerkeszd a .env fájlt a saját beállításaiddal
npm run start:dev
```

## Frontend telepítés

```bash
cd frontend
npm install
npm run dev
```

## Adatbázis indítása (Docker)

```bash
docker compose up -d postgres redis
```

## Android App

1. Nyisd meg Android Studio-ban az `android-app` mappát
2. Állítsd be a Firebase projektet:
   - Töltsd le a `google-services.json` fájlt a Firebase konzolból
   - Helyezd el az `app/` mappába
3. Futtasd az alkalmazást

## Környezeti változók

### Backend (.env)

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=most_wanted
DB_PASSWORD=password
DB_DATABASE=most_wanted

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

PORT=3000
NODE_ENV=development

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

CORS_ORIGIN=http://localhost:3001
```

## Fejlesztési workflow

1. Indítsd el a PostgreSQL-t és Redis-t: `docker compose up -d`
2. Indítsd el a backend-et: `cd backend && npm run start:dev`
3. Indítsd el a frontend-et: `cd frontend && npm run dev`
4. Nyisd meg a böngészőt: `http://localhost:3001`






