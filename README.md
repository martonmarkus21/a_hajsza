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
- ✅ WebSocket (Socket.IO) valós idejű frissítések (`positionUpdate`, `distanceUpdate`, `savedPositionSample`, stb.)
- ✅ PostgreSQL adatbázis (pozícióminták, üzleti adatok)
- ✅ Redis: élő pár-pozíciók + geofence gyorsítótár; ugyanazon példányon Bull/BullMQ is futhat
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
- ✅ Elfogás (bilincs) API: szigorúbb validáció, idempotencia, elfogás részletei modal (hely, rögzítő, információs szöveg)
- ✅ Admin panel (teljes funkcionalitással)
- ✅ Admin **Eseménynapló** (audit lista, szűrés, CSV export, törlés; menü csak **admin** számára)
- ✅ Admin listák: közös táblázat-kártya (`AdminDataTableCard`), `AdminTableKit` (egységes `mw-table` váz, lapozó, rendezhető fejléc), lapozás a párok / eszközök / felhasználók tábláin is
- ✅ Modern UI (fekete-narancs színséma)

### Android App
- ✅ Device bejelentkezés (POST /api/devices/login)
- ✅ Háttér service (20 percenkénti pozícióküldés)
- ✅ FCM push fogadás
- ✅ Offline működés

## 📱 Telefonos bejelentkezés

**API Endpoint**: `POST /api/devices/login`

**Request** (a `deviceId` kötelező; tipikusan Android `ANDROID_ID`):
```json
{
  "username": "1",
  "password": "1",
  "deviceId": "android_id_or_stable_string",
  "fcmToken": null
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
