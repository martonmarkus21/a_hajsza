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
  - **Body** (kötelező mezők: `username`, `password`, `deviceId`; opcionális: `fcmToken`):
    - `deviceId`: stabil eszközazonosító a szerver `devices.imei_or_device_id` mezőjéhez (Android kliensen jellemzően `Settings.Secure.ANDROID_ID`).
  - **Példa**: `{ "username": "1", "password": "1", "deviceId": "android_id_…", "fcmToken": "…" }`
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

### Eseménynapló (audit_logs, Admin JWT)
- **`GET /api/audit-logs/admin/meta`** — egyedi `action_type` és `entity_type` értékek a szűrőkhöz, valamint az összes sor száma. **Response**: `{ "actionTypes": string[], "entityTypes": string[], "totalRecords": number }`.
- **`GET /api/audit-logs/admin/list`** — lapozott lista az `audit_logs` táblából, felhasználónévvel (`user` join).
  - **Query**: `page`, `pageSize` (max 500), `sortBy` (`timestamp` | `id` | `actionType` | `username` | `entityType` | `entityId` | `ipAddress`), `sortDir`, opcionálisan `userId`, `actionType`, `entityType` (üres vagy `all` = nincs szűrés), `from` / `to` (ISO), `q` (keresés: IP, user-agent, JSON szöveg, felhasználónév — ILIKE).
  - **Response**: `{ items: [...], total, page, pageSize }` — elemek: `id`, `userId`, `username`, `actionType`, `entityType`, `entityId`, `dataJson`, `ipAddress`, `userAgent`, `timestamp` (ISO).
- **`GET /api/audit-logs/admin/export`** — CSV letöltés (UTF-8 BOM), ugyanazok a szűrők és rendezés, mint a listánál; legfeljebb 8000 sor.
- **`DELETE /api/audit-logs/admin/:id`** — egy naplósor törlése; a törlés maga is naplózásra kerül (`audit_log_delete`), **kivéve** ha a törölt sor maga is `audit_log_delete` típusú volt (így nem keletkezik „örök” bejegyzés).
- **`POST /api/audit-logs/admin/bulk-delete`** — tömeges törlés. **Body**: `{ "scope": "filtered" | "all" }`. A `filtered` esetén a **query** ugyanaz, mint a listánál (szűrők, rendezés — a lapozás nem számít); az összes egyező sor törlődik. A `all` esetén a teljes `audit_logs` tábla ürül. Egy összefoglaló napló: `audit_log_bulk_delete`.

### Pozíciók
- **`POST /api/position`**
  - Menekülő app küldi a pozíciót.
  - **Body**: `{ "deviceId": "string", "pairId": 1, "lat": 47.4, "lon": 19.0, "accuracy": 10, "speed": 0, "timestamp": "...", "vehicleMode": false, "vehicleSessionRemaining": 0 }`
  - **Viselkedés (Redis + PostgreSQL)**:
    - Minden fogadott minta bekerül a **Redis** „élő pozíció” kulcsba (pár szerint), így a játéktér / szabályszegés ellenőrzés és a scheduler ebből is tud dolgozni.
    - **PostgreSQL** `positions` táblába nem minden kérés ír: sor a játékidőzítő és az `allowPositionUpdatesForMap` / ciklus-szabályok szerint keletkezik (lásd `PositionsService`). A `game_area_exit` szabályszegés lezáródásakor (pár vissza a játékterületre) **nem** jön létre önálló `positions` sor.
    - Amikor új `positions` sor keletkezik, a szerver elmenti a **mentéskor aktív játékterület(ek) pillanatképét** (`game_area_snapshot_json`) és azt, hogy **volt-e meg nem oldott szabályszegése** a párnak (`had_rule_violation_at_save`).
    - **WebSocket**: `distanceUpdate` gyakrabban megy ki (távolságszámítás a kliensen); `positionUpdate` csak akkor, ha a térképen szabad frissíteni (pl. nyitott „pozíció ablak”, vagy aktív `game_area_exit` folyamatos követés). Új PG-s minta után globálisan kimegy a `savedPositionSample` esemény is (`pairId`, `id`). Admin törlés után: `savedPositionsDeleted` (`pairId`, `deleted`) — a kliensek frissíthetik a mentett pozíciók listáját.
- **`GET /api/positions/admin/list`** (Admin JWT)
  - Mentett (PostgreSQL) pozíciók lapozott listája szűréssel és rendezéssel.
  - **Query**: `pairId` (opcionális), `from` / `to` (ISO timestamp, inkluzív), `page`, `pageSize` (max 5000), `sortBy` (`timestamp` | `id` | `pairId`), `sortDir` (`asc` | `desc`).
  - **Response**: `{ items: [...], total, page, pageSize }` — az elemek tartalmazzák a pár azonosítókat, koordinátákat, `gameAreaSnapshot`, `hadRuleViolationAtSave` mezőket.
- **`DELETE /api/positions/admin/pair/:pairId`** (Admin JWT) — a megadott pár **összes** mentett pozíciójának törlése a `positions` táblából. **Response**: `{ "deleted": number }`. WebSocket: `savedPositionsDeleted`.
- **`POST /api/positions/admin/delete-by-ids`** (Admin JWT) — **Body**: `{ "pairId": number, "ids": number[] }` (minden ID-nek létező, ehhez a `pairId`-hez tartozó sornak kell lennie). **Response**: `{ "deleted": number }`. WebSocket: `savedPositionsDeleted`.
- **`GET /api/positions/pair/:pairId/latest-saved`** (JWT: **admin** vagy **officer**)
  - A megadott pár **legutóbbi mentett** pozíciósora (vagy `null`), ugyanazzal a mezőkészlettel, mint a list API elemek (pl. térkép modál / pár részletek).

### Párok
- **`GET /api/pairs`** - Összes pár lekérése (opcionális `?active=true` szűréssel).
  - **`lastPosition` a válaszban** (összefoglalva):
    - Futó időzítő és `lastLocationUpdate` mellett, ha a pár szerepel a ciklus „már küldött” listájában: alapból a **ciklus első** PG-s mintája; ha van **újabb** sor ugyanahhoz a párhez a `positions` táblában ugyanazon ciklusban (több időzítő szerinti mentés), akkor az kerül vissza.
    - Aktív, meg nem oldott **játékterület-elhagyás** szabályszegésnél: ha van élő Redis-pozíció, a `lastPosition` onnan jön (folyamatos követés).
    - Ha a fenti speciális esetek egyike sem ad pozíciót, de van legutóbbi mentett sor a `positions` táblában a párhez: **az** kerül vissza (pl. frissen indított számláló, még nincs `lastLocationUpdate`, vagy a pár még nem küldött a ciklusban — így a térkép és a pár modál nem marad üres).
    - Csak akkor `null`, ha egyáltalán nincs mentett pozíció a párhez. A részletes ágak a `PairsService` és a játékbeállítások összjátékától függnek.
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
  - **Body**: `{ "activateIds": number[], "deactivateIds": number[] }` (üres tömbök megengedettek).

### Játéktér (Belső területek/Megyék)
- **`GET /api/game-area`** - Jelenlegi játéktér és szabályok lekérése.
- **`GET /api/game-area/counties`** - Megyék geo adatainak lekérése.
- **`PUT /api/game-area`** - Játéktér módosítása (Admin).

### Játék Napok
- **`GET /api/game-days`** - Összes versenynap lekérése.
- **`GET /api/game-days/today`** - Mai versenynap beállításai.
- **`POST /api/game-days`** - Versenynap létrehozása/módosítása.

### Game Settings (Játék beállítások & Időzítők)
- **`GET /api/game-settings/countdown`** - Visszaszámláló és nyilvános mezők (JWT: bejelentkezett felhasználó, admin vagy officer).
- **`GET /api/game-settings`** - Teljes globális beállítások + countdown (JWT: **csak admin**).
- **`PUT /api/game-settings`** - Beállítások frissítése (JWT: **csak admin**). Sikeres mentés után napló: `game_settings_update` (`audit_logs`).
- **`POST /api/game-settings/timer/start`** — időzítő indítás (JWT: **csak admin**). Napló: `game_settings_timer_start`.
- **`POST /api/game-settings/timer/stop`** — időzítő leállítás (JWT: **csak admin**). Napló: `game_settings_timer_stop`.

> **Megjegyzés**: További admin műveletek is bekerülnek az eseménynaplóba (payload a `data_json` mezőben), például geofence aktiválás / deaktiválás / tömeges státusz (`geofence_activate`, `geofence_deactivate`, `geofence_bulk_status`), mentett pozíciók törlése (`position_delete_pair`, `position_delete_batch`), lezárt szabályszegés törlése (`rule_violation_delete`).

### Szabályszegések (Rule Violations)
- **`GET /api/rule-violations/active-game-area`** - Aktív játékterület-elhagyás szabályszegések lekérése.
- **`GET /api/rule-violations/list`** - Szabályszegések lapozott listája szűréssel és rendezéssel (Admin).
  - **Query params**: `page`, `pageSize`, `type` (`all` | `game_area_exit` | `vehicle_time_exceeded`), `status` (`all` | `active` | `resolved`), `search`, `sortBy`, `sortDir`.
- **`DELETE /api/rule-violations/:id`** - Lezárt szabályszegés törlése (Admin).

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
