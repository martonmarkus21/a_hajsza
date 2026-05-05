# WebSocket események

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Szerepe:** Socket.IO események és payload-minták összefoglalója a **`backend/src/websocket/websocket.gateway.ts`** és kapcsolódó szolgáltatások alapján.

---

### Tartalom

1. [Kapcsolódás](#1-kapcsolódás)
2. [Esemény irányok](#2-esemény-irányok)
3. [Összes esemény](#3-összes-esemény-neve)
4. [Részletes példák](#4-részletes-példák-server--kliens)
5. [Kliens oldali irányelvek](#5-kliens-oldali-irányelvek)
6. [Hibakeresés](#6-hibakeresés)
7. [Kapcsolódó dokumentumok](#7-kapcsolódó-dokumentumok)

---

## 1. Kapcsolódás

| Beállítás | Érték |
|---|---|
| Protokoll | Socket.IO |
| Namespace | **`/ws/game`** |
| Példa teljes URL (dev) | `http://localhost:3000/ws/game` |
| Auth handshake | `auth.token` — opcionális JWT (gateway engedélyez token nélküli csatlakozást is) |

Ha a webes alkalmazás más API gyökért mutat meg, a végpont: **`<API_GYÖKÉR>/ws/game`** (`frontend/src/config/env.ts`: `WS_GAME_URL`).

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:3000/ws/game", {
  auth: { token: "<jwt>" },
});
```

---

## 2. Esemény irányok

- **Szerver → kliens:** broadcast típusú frissítések ( többség globálisan `emit`, a pozíciónál `positions` szoba ).
- **Kliens → szerver:** **`subscribe:positions`** / **`unsubscribe:positions`** (`@SubscribeMessage`).

A **`positions`** Socket.IO „szoba”: a pozíciós broadcastok ide mennek (**`broadcastPositionUpdate`**, **`broadcastDistanceUpdate`**).

---

## 3. Összes esemény neve

### Kliens → szerver (`@SubscribeMessage`)

- **`subscribe:positions`**
- **`unsubscribe:positions`**

Mindkét handler a **`positions`** room-hoz ad / onnan távolít (`websocket.gateway.ts`).

### Szerver → kliens (`emit`)

- `positionUpdate`, `distanceUpdate`
- `capture`, `captureReverted`
- `ckHighlight`
- `geofenceAlert`, `ruleViolation`
- `pairStatusUpdate`, `gameAreaUpdate`, `gameRuntimeUpdate`
- `globalToast`
- `savedPositionSample`, `savedPositionsDeleted`

---

## 4. Részletes példák (szerver → kliens)

### `positionUpdate`

Forrás: **`PositionsService`** → `broadcastPositionUpdate`.

```json
{
  "pairId": 3,
  "lat": 47.4979,
  "lon": 19.0402,
  "accuracy": 12.5,
  "speed": 1.2,
  "timestamp": "2026-05-05T18:40:00.000Z",
  "vehicleMode": false,
  "distanceToNearestOfficer": null
}
```

---

### `ruleViolation`

**Nincs egyetlen zárt séma:** a **`RuleViolationsService`** eltérő mezőket küldött esetek szerint.

Példa – játékterület elhagyás (`game_area_exit`):

```json
{
  "pairId": 3,
  "violationType": "game_area_exit",
  "description": "Pár kilépett a játéktérből",
  "continuousMode": true,
  "resolved": false,
  "timestamp": "2026-05-05T18:41:00.000Z",
  "createdAt": "2026-05-05T18:41:00.000Z"
}
```

---

### `ckHighlight`

Forrás: **`CkFlagsService`** → `broadcastCkHighlight`.

Új aktív jelölés minta:

```json
{
  "pairId": 3,
  "active": true,
  "flaggedBy": { "id": 2, "username": "Officer" },
  "timestamp": "2026-05-05T18:45:00.000Z"
}
```

*Megjegyzés:* a **`username`** jelen implementációban gyakran a fix **`"Officer"`** sztring (TODO a szolgáltatásban).

---

### `globalToast`

Gateway típus: **`{ message: string; variant?: string }`**. Példa segítségkérésre (`DevicesService.sendHelpRequestFromDevice`):

```json
{
  "message": "A(z) 5. pár segítséget kér.",
  "variant": "info"
}
```

---

## 5. Kliens oldali irányelvek

- Validáld a bejövő üzeneteket (sémaleíró könyvtárral), mert **`ruleViolation`** típus szerint változik.
- Kapcsolatvesztés: exponenciális reconnect.
- Válaszd szét élő állapot és perzisztens UI cache.

---

## 6. Hibakeresés

| Tünet | Teendő |
|---|---|
| Nincsenek események | JWT, namespace URL (`/ws/game`), room tagság |
| Token van, pozíció nincs | Authed kliensek auto **`positions`** csatlakozás; manuális **`subscribe:positions`** |
| Üres mező az eseményben | Adott broadcaster `*.service.ts` – Redis vs PostgreSQL állapot |

---

## 7. Kapcsolódó dokumentumok

| Dokumentum | Témakör |
|---|---|
| [INSTALLATION.md](INSTALLATION.md) | Helyi futtatás |
| [API_SPEC.md](API_SPEC.md) | REST végpontok |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Perzisztencia |
