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
- ✅ WebSocket (Socket.IO) valós idejű frissítések (`positionUpdate`, `distanceUpdate`, `savedPositionSample`, `globalToast`, stb.)
- ✅ PostgreSQL adatbázis (pozícióminták, üzleti adatok)
- ✅ Redis: élő pár-pozíciók, üldöző böngésző-GPS (`pursuer-live`), maradási szabály állapota (anchor, kinti idő, következő napi térképreveláció), geofence gyorsítótár; ugyanazon példányon Bull/BullMQ is futhat
- ✅ Játéknapok közötti **maradási szabály** (percenkénti ellenőrzés, FCM, `end_of_day_stay` rekord, következő nap első 30 perces térképláthatóság)
- ✅ Ütemezett **játéknap** FCM / záró üzenetek, üldöző–pár távolság a nap végén (Redis üldöző pozíció alapján)
- ✅ Mobil **csatlakoztatás**: nyilvános `GET /api/mobile/verify` + admin által forgatott titok (QR), `game_settings.mobile_enrollment_secret`
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
- ✅ Admin **Eszközök**: Android kapcsolat (API alap URL + QR, titok rotálás), páros eszközlista
- ✅ **Üldöző élő hely** küldése böngészőből (`POST /api/positions/pursuer-live`) — térképes távolság a játéknap zárásánál
- ✅ Admin listák: közös táblázat-kártya (`AdminDataTableCard`), `AdminTableKit` (egységes `mw-table` váz, lapozó, rendezhető fejléc), lapozás a párok / eszközök / felhasználók tábláin is
- ✅ Modern UI (fekete-narancs színséma)

### Android App
- ✅ Egy aktivitás + **Jetpack Compose** UI (bejelentkezés, főképernyő, értesítések); első indításkor **szerver beállítás** (API URL + titok, opcionálisan QR)
- ✅ **EncryptedSharedPreferences** + dinamikus Retrofit alap URL (`ServerConnectionStore`)
- ✅ Device bejelentkezés (`POST /api/devices/login`), FCM token frissítés, segítségkérés, jármű idő lejárata jelzése
- ✅ **LocationService**: élő hely + jármű számláló mezők; a mintavételi gyakoriság a szerver játékmotorához igazodik
- ✅ Lokális események (Room), FCM / foreground kezelés

## 📱 Telefonos bejelentkezés

Az alkalmazás első konfigurálása: admin felületen generált **API URL + titok** (vagy QR). Részletek: `android-app/README.md`, `docs/API_SPEC.md` (`/api/mobile/verify`), `backend/.env.example` (`PUBLIC_API_BASE_URL`, `MOBILE_ENROLLMENT_SECRET`).

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
