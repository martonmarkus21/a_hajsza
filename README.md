# Célkereszt - A hajsza

<p align="center">
  <img src="frontend/src/assets/images/celkereszt_logo.png" alt="Célkereszt logó" width="520" />
</p>

<p align="center">
  Többplatformos, valós idejű pályafelügyeleti és játékmenet-koordinációs rendszer.
</p>

## Technológiai stack

![Backend](https://img.shields.io/badge/Backend-NestJS-E0234E?logo=nestjs&logoColor=white)
![Frontend](https://img.shields.io/badge/Frontend-React-20232A?logo=react&logoColor=61DAFB)
![Android](https://img.shields.io/badge/Android-Kotlin%20%2B%20Compose-3DDC84?logo=android&logoColor=white)
![Database](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql&logoColor=white)
![Cache](https://img.shields.io/badge/Cache-Redis-DC382D?logo=redis&logoColor=white)
![Realtime](https://img.shields.io/badge/Realtime-Socket.IO-010101?logo=socketdotio&logoColor=white)
![Messaging](https://img.shields.io/badge/Messaging-Firebase%20FCM-FFCA28?logo=firebase&logoColor=black)

## Tartalom

- [Mi ez a rendszer](#mi-ez-a-rendszer)
- [Mit tud a gyakorlatban](#mit-tud-a-gyakorlatban)
- [Játékfolyamat lépésről lépésre](#játékfolyamat-lépésről-lépésre)
- [Architektúra áttekintés](#architektúra-áttekintés)
- [Gyors indulás](#gyors-indulás)
- [Projekt struktúra](#projekt-struktúra)
- [Dokumentáció](#dokumentáció)

## Mi ez a rendszer

A Célkereszt egy komplett operációs platform olyan játékokhoz vagy eseményekhez, ahol:

- több páros mobil kliens valós időben mozog,
- központi operátorok térképen követik a folyamatot,
- szabályok (terület, idő, járműhasználat) automatikusan kiértékelődnek,
- a rendszer minden fontos eseményt naplóz, visszakereshetően.

Röviden: a platform összeköti a terepi mobil használatot, az admin felügyeletet és az automatizált játékmotort.

## Mit tud a gyakorlatban

### Operátori oldal (web)

- párok kezelése és státuszkövetés,
- élő térképes nézet és visszakereshető mentett pozíciók,
- geofence és játéktér konfiguráció,
- riasztások, szabályszegések és jelölések kezelése,
- auditnapló, szűrés, export.

### Mobil oldal (Android)

- biztonságos első párosítás (URL + titok / QR),
- eszközazonosított bejelentkezés,
- háttér helyzetküldés,
- push értesítések és helyi eseménylista,
- dedikált kliensműveletek (segítségkérés, jármű mód lejárati jelzés).

### Backend oldal

- REST API és WebSocket események,
- ciklus- és játéknap-vezérelt logika,
- valós idejű állapot Redisben, történeti adatok PostgreSQL-ben,
- szerepkör alapú hitelesítés és jogosultságkezelés.

## Játékfolyamat lépésről lépésre

1. **Előkészítés**
   - Admin létrehozza a párokat, geofence-eket és játéknapokat.
2. **Mobil párosítás**
   - Android kliens beolvassa vagy megkapja a szerverkapcsolati adatokat.
3. **Aktív játék**
   - Páros kliens pozíciót küld, backend validál és állapotot számol.
   - Webes felület realtime frissítéseket kap.
4. **Szabályfigyelés**
   - A rendszer automatikusan jelzi a terület- vagy időalapú eltéréseket.
5. **Admin beavatkozás**
   - Operátor jelöl, üzenetet küld, eseményt rögzít.
6. **Utókövetés**
   - Audit és történeti pozíciók alapján teljes visszajátszhatóság.

## Architektúra áttekintés

- **`backend/`**: NestJS API, játékmotor, WebSocket, audit, enrollment, FCM.
- **`frontend/`**: React admin UI, térképes és listás felügyelet.
- **`android-app/`**: Compose kliens, dinamikus szerverkapcsolat, háttér location.
- **Infra**: PostgreSQL + Redis + opcionális Docker alapú lokális stack.

<p align="center">
  <img src="frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

## Gyors indulás

### Előfeltételek

- Node.js 18+
- Docker + Docker Compose
- Android Studio (Android modulhoz)

### 1) Infrastruktúra

```bash
docker compose up -d postgres redis
```

### 2) Backend

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Webes felület: **`http://localhost:3001`**

**Teljes stack Dockerben:** [docs/INSTALLATION.md §4](docs/INSTALLATION.md#4-út-b--minden-dockerben).

### 4) Android

1. Nyisd meg az `android-app` mappát Android Studio-ban.
2. Másold be a `google-services.json` fájlt az `android-app/app` mappába.
3. Első induláskor add meg a szerver URL-t és az enrollment titkot (`x-ck-enrollment-secret` HTTP fejléc az API hívásokon).

## Projekt struktúra

```text
a_hajsza/
├── backend/
├── frontend/
├── android-app/
├── docs/
├── docker/
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
├── docker-compose.yml
└── docker-compose.stack.yml
```

## Dokumentáció

- [Dokumentációs index](docs/README.md)
- [Telepítési útmutató](docs/INSTALLATION.md)
- [Production deployment](docs/DEPLOYMENT.md)
- [API specifikáció](docs/API_SPEC.md)
- [WebSocket események](docs/WEBSOCKET_EVENTS.md)
- [Adatbázis séma](docs/DATABASE_SCHEMA.md)
- [Firebase / FCM beállítás](docs/FIREBASE_SETUP.md)
- [Android kliens dokumentáció](android-app/README.md)
