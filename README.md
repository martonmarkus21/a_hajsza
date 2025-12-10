# Most Wanted - A hajsza

Teljes működőképes rendszer a "Most Wanted – A hajsza" tévéműsor technikai hátteréhez.

## 🚀 Gyors indítás

### 1. Adatbázis indítása

```powershell
docker-compose up -d
```

### 2. Backend indítása

```powershell
cd backend
npm install
npm run build
$env:SEED_DB="false"
node dist/main.js
```

### 3. Frontend indítása

```powershell
cd frontend
npm install
npm run build
serve -s dist -l 3001
```

### 4. Bejelentkezés

Nyisd meg: `http://localhost:3001`

**Demo felhasználók:**
- Admin: `admin` / `admin123`
- Officer1: `officer1` / `officer1123`

## ✨ Főbb funkciók

### Backend
- ✅ REST API (NestJS)
- ✅ WebSocket (Socket.IO) valós idejű frissítések
- ✅ PostgreSQL adatbázis
- ✅ Redis + Bull/BullMQ
- ✅ FCM (Firebase Cloud Messaging)
- ✅ JWT autentikáció (admin/officer és device)
- ✅ Device bejelentkezés rendszer
- ✅ Pár kezelés (létrehozás, törlés, aktiválás)
- ✅ Geofence kezelés (scenariók, játékterület, megyék)
- ✅ Üzenetküldés API

### Frontend
- ✅ Térkép (OpenStreetMap + React-Leaflet)
- ✅ Geofence-ek megjelenítése (polygon támogatással)
- ✅ Játék információk (állapot, idő, aktív párok, játékterület)
- ✅ Párok listája (csak aktív párok)
- ✅ Bilincs, MW, Név hozzárendelés, Üzenetküldés
- ✅ Pár részletek modal
- ✅ Admin panel (teljes funkcionalitással)
- ✅ Modern UI (fekete-narancs színséma)

### Android App
- ✅ Device bejelentkezés (POST /api/devices/login)
- ✅ Háttér service (20 percenkénti pozícióküldés)
- ✅ FCM push fogadás
- ✅ Offline működés

## 📱 Telefonos bejelentkezés

**API Endpoint**: `POST /api/devices/login`

**Request**:
```json
{
  "username": "1",  // Pár száma
  "password": "1"   // Pár száma stringként
}
```

**Response**:
```json
{
  "success": true,
  "token": "jwt_token",
  "device": {
    "id": 1,
    "pairId": 1,
    "pairNumber": 1
  }
}
```

## 📁 Projekt struktúra

```
most_wanted/
├── backend/          # NestJS backend API
├── frontend/         # React webapp
├── android-app/      # Android app
├── docs/             # Dokumentáció
└── docker-compose.yml
```

## 📚 Dokumentáció

- [API specifikáció](docs/API_SPEC.md)
- [Adatbázis séma](docs/DATABASE_SCHEMA.md)
- [WebSocket események](docs/WEBSOCKET_EVENTS.md)
- [Telepítési útmutató](docs/INSTALLATION.md)
- [Firebase beállítás](docs/FIREBASE_SETUP.md)

## ⚠️ Fontos megjegyzések

- A párok alapértelmezetten **inaktívak**, amíg a telefonos app nem jelentkezik be
- A seed script **nem hoz létre** automatikusan párokat (csak ha `SEED_PAIRS=true`)
- Firebase credentials nélkül az üzenetküldés nem működik, de nem hibázik
- A megyék polygon koordinátái egyszerűsítettek - pontosabb adatokért használj valós GeoJSON adatokat

## 🔐 Biztonság

- JWT token autentikáció
- Device-based auth a pozícióküldéshez
- Role-based access control (admin/officer)
- HTTPS ajánlott production-ben
