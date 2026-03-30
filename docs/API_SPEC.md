# API Specifikáció

## Autentikáció

A rendszer kétféle autentikációt használ:
1. **Admin / Officer (Web/Panel)**: JWT token alapú (`Authorization: Bearer <token>`)
2. **Device (Android App)**: Külön device JWT token tárolása és azonosítása. Bár a pozícióküldés és az app hívásai ezen device tokeneken alapulnak, a formátum ugyanúgy Bearer token.

### Headers
```http
Authorization: Bearer <token>
Content-Type: application/json
```

---

## Endpointok

### Auth (Admin/Officer)
- **`POST /api/auth/login`**
  - Webes bejelentkezés Admin és Officer felhasználóknak.
  - **Body**: `{ "username": "admin", "password": "password" }`
  - **Response**: JWT token és user adatok.
- **`GET /api/auth/profile`** - Bejelentkezett felhasználó profil adatainak lekérése.
- **`PUT /api/auth/profile`**
  - Profil módosítása (email és/vagy jelszó).
  - **Body**: `{ "email": "uj@email.com", "currentPassword": "regi", "newPassword": "uj123" }`
  - Jelszóváltoztatáshoz a `currentPassword` megadása kötelező.

### Devices (Android App)
- **`POST /api/devices/login`**
  - Telefonos alkalmazás bejelentkezése.
  - **Body**: `{ "username": "1", "password": "1" }`
  - **Response**: JWT token és device info.
- **`GET /api/devices/me`** - Visszaadja a bejelentkezett eszköz adatait.
- **`GET /api/devices`** - Kilistázza az összes regisztrált eszközt (Admin).
- **`GET /api/devices/active`** - Visszaadja az online/aktív eszközöket (JWT: admin vagy officer).
- **`POST /api/devices/logout`** - Kijelentkezteti az aktuális eszközt.
- **`POST /api/devices/force-logout/:deviceId`** - Kijelentkeztet egy adott eszközt (Admin).

### Users (Admin)
- **`GET /api/users`** - Felhasználók (adminok/officerek) listázása.
- **`GET /api/users/:id`** - Egy felhasználó lekérése.
- **`POST /api/users`** - Új felhasználó létrehozása.
- **`PUT /api/users/:id`** - Felhasználó módosítása.
- **`DELETE /api/users/:id`** - Felhasználó törlése.

### Pozíciók
- **`POST /api/position`**
  - Menekülő app küldi a pozíciót.
  - **Body**: `{ "deviceId": "string", "pairId": 1, "lat": 47.4, "lon": 19.0, "accuracy": 10, "speed": 0, "timestamp": "...", "vehicleMode": false, "vehicleSessionRemaining": 0 }`
  - **Viselkedés (Redis + PostgreSQL)**:
    - Minden fogadott minta bekerül a **Redis** „élő pozíció” kulcsba (pár szerint), így a játéktér / szabályszegés ellenőrzés és a scheduler ebből is tud dolgozni.
    - **PostgreSQL** `positions` táblába nem minden kérés ír: sor akkor keletkezik, ha a játékidőzítő logikája szerint az adott pár **ebben a ciklusban először** küld térképes pozíciót (`pairsSentPositionThisCycle`), illetve a szabályszegés-kezelés (pl. játékterületre visszalépés) külön menthet sort.
    - Amikor új `positions` sor keletkezik, a szerver elmenti a **mentéskor aktív játékterület(ek) pillanatképét** (`game_area_snapshot_json`) és azt, hogy **volt-e meg nem oldott szabályszegése** a párnak (`had_rule_violation_at_save`).
    - **WebSocket**: `distanceUpdate` gyakrabban megy ki (távolságszámítás a kliensen); `positionUpdate` csak akkor, ha a térképen szabad frissíteni (pl. nyitott „pozíció ablak”, vagy aktív `game_area_exit` folyamatos követés). Új PG-s minta után globálisan kimegy a `savedPositionSample` esemény is (`pairId`, `id`).
- **`GET /api/positions/admin/list`** (Admin JWT)
  - Mentett (PostgreSQL) pozíciók lapozott listája szűréssel és rendezéssel.
  - **Query**: `pairId` (opcionális), `from` / `to` (ISO timestamp, inkluzív), `page`, `pageSize` (max 5000), `sortBy` (`timestamp` | `id` | `pairId`), `sortDir` (`asc` | `desc`).
  - **Response**: `{ items: [...], total, page, pageSize }` — az elemek tartalmazzák a pár azonosítókat, koordinátákat, `gameAreaSnapshot`, `hadRuleViolationAtSave` mezőket.
- **`GET /api/positions/pair/:pairId/latest-saved`** (JWT: **admin** vagy **officer**)
  - A megadott pár **legutóbbi mentett** pozíciósora (vagy `null`), ugyanazzal a mezőkészlettel, mint a list API elemek (pl. térkép modál / pár részletek).

### Párok
- **`GET /api/pairs`** - Összes pár lekérése (opcionális `?active=true` szűréssel).
  - **`lastPosition` a válaszban** (összefoglalva):
    - Futó időzítő és `lastLocationUpdate` mellett, ha a pár szerepel a ciklus „már küldött” listájában: alapból a **ciklus első** PG-s mintája; ha van **újabb** sor ugyanahhoz a párhez a `positions` táblában (pl. visszalépéskor mentett pont), akkor az kerül vissza.
    - Aktív, meg nem oldott **játékterület-elhagyás** szabályszegésnél: ha van élő Redis-pozíció, a `lastPosition` onnan jön (folyamatos követés).
    - Egyébként (nincs időzítő feltétel vagy nincs megjeleníthető minta) a mező lehet `null`. A pontos feltételek a `PairsService` és a játékbeállítások összjátékától függnek.
- **`POST /api/pairs`** - Új pár létrehozása (Admin).
- **`PUT /api/pairs/:id`** - Pár adatainak (pl. aktív státusz) módosítása.
- **`DELETE /api/pairs/:id`** - Pár törlése.
- **`PUT /api/pairs/:id/name`** - Pár nevének beállítása.

### Capture (Bilincs)
- **`POST /api/capture`**
  - Celebrendőr elfog egy párt.
  - **Body**: `{ "pairId": 1, "userId": 1 }`

### Most Wanted (MW)
- **`POST /api/mw`** - MW jelzés beállítása egy párra.
  - **Body**: `{ "pairId": 1, "userId": 1 }`
- **`DELETE /api/mw/:pairId`** - MW jelzés levétele (törlése).

### Messages (Üzenetküldés)
- **`POST /api/messages/send`**
  - Üzenet/Push notification küldése a telefonokra.
  - **Body**: A célpont (pairId vagy all) és a tartalom.

### Geofence
- **`GET /api/geofence`** - Aktív/összes geofence lekérése.
- **`POST /api/geofence`** - Új geofence létrehozása.
- **`PUT /api/geofence/:id/activate`** - Geofence aktiválása.
- **`PUT /api/geofence/:id/deactivate`** - Geofence deaktiválása.
- **`DELETE /api/geofence/:id`** - Geofence törlése.
- **`PUT /api/geofence/bulk-status`** - Több geofence atomikus aktiválása/deaktiválása (Admin).
  - **Body**: `{ "ids": [1, 2, 3], "active": true }`

### Játéktér (Belső területek/Megyék)
- **`GET /api/game-area`** - Jelenlegi játéktér és szabályok lekérése.
- **`GET /api/game-area/counties`** - Megyék geo adatainak lekérése.
- **`PUT /api/game-area`** - Játéktér módosítása (Admin).

### Játék Napok
- **`GET /api/game-days`** - Összes versenynap lekérése.
- **`GET /api/game-days/today`** - Mai versenynap beállításai.
- **`POST /api/game-days`** - Versenynap létrehozása/módosítása.

### Game Settings (Játék beállítások & Időzítők)
- **`GET /api/game-settings`** - Globális játékbeállítások lekérése.
- **`PUT /api/game-settings`** - Beállítások frissítése.
- **`GET /api/game-settings/countdown`** - Visszaszámláló infó.
- **`POST /api/game-settings/timer/start`** - Játékidő / stopper indítása.
- **`POST /api/game-settings/timer/stop`** - Globális időzítő leállítása.

### Szabályszegések (Rule Violations)
- **`GET /api/rule-violations/active-game-area`** - Aktív játékterület-elhagyás szabályszegések lekérése.
- **`GET /api/rule-violations/list`** - Szabályszegések lapozott listája szűréssel és rendezéssel (Admin).
  - **Query params**: `page`, `pageSize`, `type` (`all` | `game_area_exit` | `vehicle_time_exceeded`), `status` (`all` | `active` | `resolved`), `search`, `sortBy`, `sortDir`.
- **`DELETE /api/rule-violations/:id`** - Lezárt szabályszegés törlése (Admin).

### Audit log
- **`GET /api/audit-logs`** - Rendszernaplók lekérése (Admin).

---

## Hibakezelés

Minden hiba esetén az alábbi JSON response formátum várható:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Hibaüzenet",
    "details": {}
  }
}
```

### Gyakori hibakódok
- `UNAUTHORIZED`: Nincs jogosultság a művelethez
- `VALIDATION_ERROR`: Hiányzó vagy hibás formátumú adatok (Body)
- `NOT_FOUND`: Erőforrás (user, pár, geofence) nem található
- `INTERNAL_ERROR`: Szerver / Adatbázis hiba
- `RULE_VIOLATION`: Játékszabály megszegése (pl. túl hosszú autózás)
