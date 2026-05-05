# Telepítési útmutató

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Cél:** Első futtatás házi gépen — két egyszerű út: fejlesztői (npm) vagy teljes stack Dockerrel.

---

### Tartalom

1. [Előfeltételek](#1-előfeltételek)
2. [Melyik út?](#2-melyik-út-röviden)
3. [Út A — Fejlesztés (npm, ajánlott)](#3-út-a--fejlesztés-npm-ajánlott)
4. [Út B — Minden Dockerben](#4-út-b--minden-dockerben)
5. [Hol mit állítok? (env fájlok)](#5-hol-mit-állítok-env-fájlok)
6. [Fontos fájlok](#6-fontos-fájlok)
7. [Frontend](#7-frontend)
8. [Android](#8-android-kliens)
9. [Ellenőrzés](#9-működés-ellenőrzése)
10. [Gyakori hibák](#10-gyakori-hibák)
11. [Éles környezet](#11-éles-környezet)
12. [Kapcsolódó dokumentumok](#12-kapcsolódó-dokumentumok)

---

## 1. Előfeltételek

- **Node.js 18+**, `npm`, **Git**
- **Docker** + **Docker Compose** (PostgreSQL és Redis miatt)
- Opcionálisan: **Android Studio** (mobil)

---

## 2. Melyik út? (röviden)

| Óhaj | Parancs és config |
|---|---|
| **Kódot szerkesztek, hot reload kell** | **Út A** — csak DB+Redis Dockerben, backend/frontend `npm` |
| **Nem nyúlok npm-hez, egyben akarom** | **Út B** — `docker compose -f docker-compose.stack.yml`; részletek és env: **§4** |

---

## 3. Út A — Fejlesztés (npm, ajánlott)

### 3.1 Adatbázis és Redis

```bash
git clone <repo-url>
cd a_hajsza
docker compose up -d postgres redis
```

### 3.2 Backend

```bash
cd backend
npm install
cp .env.example .env
# szerkeszd a backend/.env fájlt (DB_HOST=localhost maradhat)
npm run start:dev
```

Admin (ha üres az adatbázis): **`admin`** / **`admin123`** — éles előtt változtasd meg.

### 3.3 Frontend

```bash
cd frontend
npm install
npm run dev
```

Böngésző: **`http://localhost:3001`**. Ha más API-címet akarsz: **`frontend/.env.example`** → **`.env`**, **`VITE_API_URL`**; a backend **`CORS_ORIGIN`** legyen **`http://localhost:3001`**.

---

## 4. Út B — Minden Dockerben

A háttérben indul: **Postgres**, **Redis**, **backend**, **frontend** (Nginx). Környezeti változók: **`docker/env/backend.stack.env`** (létrehozás: másold **`docker/env/backend.stack.env.example`** → **`docker/env/backend.stack.env`** — lentebb § „Docker stack tesztelése”).

Elérés indulás után:

- **REST / health:** `http://localhost:3000` (health: **`http://localhost:3000/health`**)
- **Web admin:** `http://localhost:8080`

**Figyelem:** a stack kipublikálja a **5432** és **6379** portot is. Ha közben már futott a sima **`docker compose up -d postgres redis`**, állítsd le: a repó gyökerében **`docker compose down`**, különben **portfoglaltság**.

### Docker stack tesztelése lépésről lépésre

Minden parancsot a **repó gyökeréből** futtass (`a_hajsza` mappa, ahol a **`docker-compose.stack.yml`** van). **PowerShell** és **bash** egyaránt jó.

**1. Ellenőrizd, hogy a Docker fut** (Docker Desktop vagy Engine).

**2. Környezeti fájl egyszeri létrehozása** (ha még nincs):

```bash
cp docker/env/backend.stack.env.example docker/env/backend.stack.env
```

Ezután szerkeszd **`docker/env/backend.stack.env`** ( **`FIREBASE_*`**, **JWT_SECRET**, stb.). Csak web + API próbához a sablon szerinti üres / placeholder értékek is indulhatnak; FCM teszthez állítsd be a három **`FIREBASE_*`** értékét.

**3. Indítás image-építéssel** (első alkalom sokáig tarthat: base image + `npm ci` + build):

```bash
docker compose -f docker-compose.stack.yml up -d --build
```

**4. Konténerek állapota:**

```bash
docker compose -f docker-compose.stack.yml ps
```

Mind a négy szolgáltatásnak **Up** vagy **running** kell lennie; a **backend** csak akkor indul el, ha Postgres és Redis **healthy**.

**5. Ha valami nem indul, backend log** (hibakereséshez):

```bash
docker compose -f docker-compose.stack.yml logs backend --tail 100
```

Futó napló követése: ugyanez **`logs -f backend`**; kilépés: Ctrl+C.

**6. Gyors health check** (böngésző vagy curl):

- `http://localhost:3000/health`

**7. Web felület:** `http://localhost:8080` — bejelentkezés **`admin`** / **`admin123`**, ha az adatbázis friss (első indulás).

**8. Leállítás** (konténerek le, adat a volume-okban megmarad):

```bash
docker compose -f docker-compose.stack.yml down
```

Postgres adat **törlése** is (új „üres” teszt): **`docker compose -f docker-compose.stack.yml down -v`**.

**Megjegyzés:** ha a weben „API hiba” látszik, ellenőrizd, hogy a **`CORS_ORIGIN`** a **`docker/env/backend.stack.env`** fájlban **`http://localhost:8080`** (stack alapértelmezés — így van beállítva).

**Frontend más API-címre építésekor** (pl. HTTPS): szerkeszd **`docker-compose.stack.yml`** → **`frontend` → `build` → `args` → `VITE_API_URL`**, majd:

```bash
docker compose -f docker-compose.stack.yml build --no-cache frontend
docker compose -f docker-compose.stack.yml up -d
```

---

## 5. Hol mit állítok? (env fájlok)

| Mit csinálsz | Fájl | Megjegyzés |
|---|---|---|
| **Út A, backend npm** | **`backend/.env`** | **`cp .env.example .env`** |
| **Út B, Docker stack** | **`docker/env/backend.stack.env`** | **`cp docker/env/backend.stack.env.example docker/env/backend.stack.env`**, majd szerkesztés |
| Sablon (**Út B**-hez) | **`docker/env/backend.stack.env.example`** | Kiindulás a másolathoz |
| **Út A, más API URL a fronton** | **`frontend/.env`** | **`VITE_API_URL`** (**`frontend/.env.example`**) |

**Firebase (push)** — a teljes platform (köztük az Android háttérértesítések) szerint ehhez kötelező a helyesen kitöltött **`FIREBASE_*`** három változó:

- **Út A:** **`backend/.env`** másolása **`backend/.env.example`** alapján, Firebase mezők cseréje.
- **Út B:** **`docker/env/backend.stack.env`** (§4 lépés).

Androidon emellett **`google-services.json`** → **`android-app/app/`** — **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**, **[android-app/README.md](../android-app/README.md)**.

**Ügyelj:** a **`backend/.env`** nem kerül be a backend **Docker image** építésébe (**.dockerignore**). A stackben futó backend a **`docker/env/backend.stack.env`** tartalmát kapja a Compose-tól.

---

## 6. Fontos fájlok

### `backend/data/counties.geojson`

**Kötelező**, commitolva a repóban. A szerver induláskor ellenőrzi; nélkül hibával leáll.

### Firebase + Android

- Backend: **`FIREBASE_PROJECT_ID`**, **`FIREBASE_PRIVATE_KEY`**, **`FIREBASE_CLIENT_EMAIL`** (Út A: **`backend/.env`**, Út B: **`docker/env/backend.stack.env`**).
- Mobil: **`google-services.json`** → **`android-app/app/`**. Enélkül az Android alkalmazás nem indul Firebase miatt ([android-app/README.md](../android-app/README.md)).

### Parancs–összehasonlítás

| Szituáció | Backend | Frontend |
|---|---|---|
| Napi dev | **`npm run start:dev`** | **`npm run dev`** (3001) |
| Produkciós jar build Docker nélkül | **`npm run build`** → **`npm run start:prod`** | **`npm run build`**, opcionálisan **`npm run preview`** |
| Teljes Docker stack | Compose stack fentebb | Automatikusan a stackben |

---

## 7. Frontend

Lásd **Út A** és **Út B** felül.

---

## 8. Android kliens

Rövid összegzés: **[../android-app/README.md](../android-app/README.md)**.

---

## 9. Működés ellenőrzése

| Ellenőrzés | Elvárás |
|---|---|
| Backend | Elérhető a beállított host:port |
| Frontend | Bejelentkezés OK, REST nem 404 |
| Android | Enrollment + login |
| Élő térkép / realtime | **[WEBSOCKET_EVENTS.md](WEBSOCKET_EVENTS.md)** |

---

## 10. Gyakori hibák

### „API nem elérhető” (web)

- Fut-e a backend?
- **`CORS_ORIGIN`** tartalmazza-e a böngésző (**`http://localhost:3001`** vagy **`:8080`**) **origin** címét?

### Firebase / push

- **Út A:** **`backend/.env`** — **Út B:** **`docker/env/backend.stack.env`**
- **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**

### Port foglalt

- Vagy infra compose, vagy stack compose fut — ne mindkettő egyszerre ugyanazokkal a külső portokkal.

---

## 11. Éles környezet

Image buildek, titokkezelés, checklist: **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## 12. Kapcsolódó dokumentumok

| Dokumentum |
|---|
| [API_SPEC.md](API_SPEC.md) |
| [WEBSOCKET_EVENTS.md](WEBSOCKET_EVENTS.md) |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) |
| [FIREBASE_SETUP.md](FIREBASE_SETUP.md) |
| [DEPLOYMENT.md](DEPLOYMENT.md) |
| [../android-app/README.md](../android-app/README.md) |
