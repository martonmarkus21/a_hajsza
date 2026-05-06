# API specifikáció

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Szerepe:** A NestJS backend HTTP végpontjainak leírása és tipikus auth / példa válaszok — a dokumentum **`backend/src/*controller*.ts`** (és route prefixek) állapotához igazítva.

---

### Tartalom

1. [Kapcsolati alapok](#1-kapcsolati-alapok)
2. [Hitelesítés](#2-hitelesítés)
3. [Modulok áttekintése](#3-modulok-áttekintése-module-prefixek)
4. [Teljes végpontlista](#4-teljes-végpontlista)
5. [Referencia példák](#5-referencia-példa-hívások)
6. [Hibaválaszok](#6-hibaválaszok)
7. [Integráció](#7-integrációs-megjegyzések)
8. [Kapcsolódó dokumentumok](#8-kapcsolódó-dokumentumok)

---

## 1. Kapcsolati alapok

| Mező | Érték (tipikus dev) |
|---|---|
| API gyökér | `http://localhost:3000` |
| Prefix | `/api/...` (a táblában feltüntetve) |
| Content-Type | `application/json` |
| WebSocket namespace | **`/ws/game`** → teljes példa `http://localhost:3000/ws/game` |

---

## 2. Hitelesítés

### Web (admin / officer)

- JWT a `POST /api/auth/login` után.
- Küldés: **`Authorization: Bearer <token>`**

```http
Authorization: Bearer <jwt>
```

JWT payload-ban a böngészethez **`sub`** = user id; a `JwtStrategy` a kérési kontextusban **`req.user.userId`** formát állít elő.

### Mobil eszköz

- Enrollment: **`MobileEnrollmentGuard`** — szükséges fejléc: **`x-ck-enrollment-secret`**
- **`POST /api/devices/login`** sikerét követően a válaszból a **`token`** mező értékét minden további, device‑védett kéréshez az `Authorization: Bearer <token>` fejlécbe kell elhelyezni (integrátor / mobil kliens feladata).

---

## 3. Modulok áttekintése (prefixek)

| Prefix | Funkció |
|---|---|
| `/api/auth` | Web belépés, profil |
| `/api/devices` | Eszköz auth, aktív állapot |
| `/api/pairs`, `/api/game-days`, `/api/game-settings` | Játékállapot és admin beállítások |
| `/api/position`, `/api/positions` | GPS és admin listák |
| `/api/capture`, `/api/rule-violations`, `/api/celkereszt` | Játékesemények |
| `/api/geofence`, `/api/game-area` | Területszabályok |
| `/api/audit-logs/admin` | Audit |
| `/api/mobile` | Publikus mobil ellenőrzés |

*(A pontos sorrendhez lásd az alábbi táblázatot.)*

---

## 4. Teljes végpontlista

A lista a jelenlegi kontrollerek route-jai alapján készült; új backend végpont felvételekor ezt a táblázatot érdemes együtt frissíteni.

### Speciális végpont

| Method | Endpoint | Megjegyzés |
|---|---|---|
| `GET` | `/api/mobile/verify` | Mobil első párosítás ellenőrzés. Effektív titok mellett küldött **`x-ck-enrollment-secret`** szükséges (ellenkező esetben 401). Válasz: `{ ok, enrollmentRequired }` — `backend/src/mobile/mobile-enrollment.service.ts` → `verifyForPublicPing`. |

### Összes route

| Method | Endpoint |
|---|---|
| `GET` | `/` |
| `GET` | `/health` |
| `POST` | `/api/auth/login` |
| `POST` | `/api/auth/register` |
| `GET` | `/api/auth/profile` |
| `PUT` | `/api/auth/profile` |
| `GET` | `/api/users` |
| `GET` | `/api/users/:id` |
| `POST` | `/api/users` |
| `PUT` | `/api/users/:id` |
| `DELETE` | `/api/users/:id` |
| `POST` | `/api/messages/send` |
| `GET` | `/api/positions/pair/:pairId/latest-saved` |
| `POST` | `/api/positions/pursuer-live` |
| `GET` | `/api/positions/admin/list` |
| `DELETE` | `/api/positions/admin/pair/:pairId` |
| `POST` | `/api/positions/admin/delete-by-ids` |
| `POST` | `/api/position` |
| `GET` | `/api/game-settings/countdown` |
| `GET` | `/api/game-settings` |
| `PUT` | `/api/game-settings` |
| `POST` | `/api/game-settings/timer/start` |
| `POST` | `/api/game-settings/timer/stop` |
| `POST` | `/api/capture` |
| `DELETE` | `/api/capture/:pairId` |
| `GET` | `/api/game-days` |
| `GET` | `/api/game-days/today` |
| `POST` | `/api/game-days` |
| `PUT` | `/api/game-days/:id` |
| `DELETE` | `/api/game-days/:id` |
| `GET` | `/api/rule-violations/active-game-area` |
| `GET` | `/api/rule-violations/list` |
| `DELETE` | `/api/rule-violations/:id` |
| `GET` | `/api/pairs` |
| `POST` | `/api/pairs` |
| `PUT` | `/api/pairs/:id` |
| `DELETE` | `/api/pairs/:id` |
| `PUT` | `/api/pairs/:id/name` |
| `GET` | `/api/game-area` |
| `GET` | `/api/game-area/counties` |
| `PUT` | `/api/game-area` |
| `POST` | `/api/celkereszt` |
| `DELETE` | `/api/celkereszt/:pairId` |
| `GET` | `/api/audit-logs/admin/meta` |
| `GET` | `/api/audit-logs/admin/list` |
| `GET` | `/api/audit-logs/admin/export` |
| `POST` | `/api/audit-logs/admin/bulk-delete` |
| `DELETE` | `/api/audit-logs/admin/:id` |
| `GET` | `/api/mobile/verify` |
| `GET` | `/api/devices/admin/mobile-connection` |
| `POST` | `/api/devices/admin/mobile-connection/regenerate` |
| `POST` | `/api/devices/login` |
| `GET` | `/api/devices/me` |
| `GET` | `/api/devices` |
| `GET` | `/api/devices/active` |
| `POST` | `/api/devices/logout` |
| `POST` | `/api/devices/fcm-token` |
| `POST` | `/api/devices/help-request` |
| `POST` | `/api/devices/vehicle-session-expired` |
| `POST` | `/api/devices/force-logout/:deviceId` |
| `DELETE` | `/api/devices/:id` |
| `GET` | `/api/geofence` |
| `POST` | `/api/geofence` |
| `PUT` | `/api/geofence/:id/activate` |
| `PUT` | `/api/geofence/:id/deactivate` |
| `PUT` | `/api/geofence/bulk-status` |
| `DELETE` | `/api/geofence/:id` |

---

## 5. Referencia példa hívások

### Admin / officer login

**`POST /api/auth/login`** — body: `LoginDto`

```json
{
  "username": "admin",
  "password": "StrongPassword123!"
}
```

Válasz: `AuthService.login()` → **`access_token`**, **`user`** (`id`, `username`, `email`, `role`).

---

### Device login

**`POST /api/devices/login`**

Fejléc: **`x-ck-enrollment-secret`**

Body: `DeviceLoginDto`

| Mező | Típus | Kötelező | Megjegyzés |
|---|---|---|---|
| `username` | string | igen | Pár **`assignedNumber`** stringként (pl. `"5"`) |
| `password` | string | igen | Jelen implementáció: ugyanaz a szám, mint **`username`** |
| `deviceId` | string | igen | Stabil Android / eszköz ID |
| `fcmToken` | string \| skip | nem | Opcionális |

```json
{
  "username": "5",
  "password": "5",
  "deviceId": "android-device-id-string"
}
```

Válasz: **`success`**, **`token`**, **`device`**: `{ id, pairId, pairNumber, pairName }`.

---

### Célkereszt jelölés

**`POST /api/celkereszt`** — JWT kötelező. Body **csak** `CreateCkFlagDto`:

```json
{ "pairId": 3 }
```

*`userId` a szerver állítja be a JWT alapján; a kérés törzsében nem szükséges és nem ajánlott.*

Aktív játék hiányában: `400`, `GAME_NOT_IN_PROGRESS`.

---

## 6. Hibaválaszok

NestJS standard forma:

```json
{
  "statusCode": 400,
  "message": "...",
  "error": "Bad Request"
}
```

| Kód | Jellemző ok |
|---|---|
| `400` | Validáció, üzleti szabály megsértése |
| `401` | Auth hiány |
| `403` | Szerepkör |
| `404` | Nincs ilyen erőforrás |
| `409` | Ütközés (pl. egy pár ⇄ egy eszköz) |
| `500` | Szerverhiba |

---

## 7. Integrációs megjegyzések

- Egységes HTTP kliens + egységes hiba- és Bearer-kezelő minden kliensen.
- Sok mutálás auditált admin oldalról történik — fejlesztői / teszt klienseknél is érdemes ugyanígy kezelni a tokent és a jogosultságot.

---

## 8. Kapcsolódó dokumentumok

| Dokumentum | Témakör |
|---|---|
| [WEBSOCKET_EVENTS.md](WEBSOCKET_EVENTS.md) | Realtime csatorna és eseménynevek |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Táblaszintű háttér |
| [INSTALLATION.md](INSTALLATION.md) | Helyi futtatás és környezeti fájlok |
