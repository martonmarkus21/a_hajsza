# Éles üzemeltetés (deployment)

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Cél:** Image buildek, környezeti változók, éles architektúra. **Lokális Docker stack és „mit hova írjak”**: kezd **[INSTALLATION.md](INSTALLATION.md)** — ez a fő belépő.

---

### Tartalom

1. [Felépítés](#1-felépítés)
2. [Image build parancsok](#2-image-build-parancsok)
3. [Env — build és futás között](#3-env--build-és-futás-között)
4. [Éles változók](#4-éles-változók)
5. [Docker Compose (megjegyzés)](#5-docker-compose-megjegyzés)
6. [Release checklist](#6-release-checklist)
7. [Biztonság](#7-biztonság)
8. [Kapcsolódó](#8-kapcsolódó)

---

## 1. Felépítés

| Réteg | Jellemző |
|---|---|
| Backend | Konténer: **`node dist/main.js`** (Nest build → **`backend/tsconfig.build.json`**) |
| Frontend | Vite **`npm run build`** → statikus fájlok **Nginx** image-ben |
| Adat | **PostgreSQL**, **Redis** — élesben gyakran külön felügyelt szolgáltatás |
| TLS | Reverse proxy / felhős load balancer |

---

## 2. Image build parancsok

Backend:

```bash
docker build -f docker/Dockerfile.backend -t celkereszt-backend:latest ./backend
```

Frontend (**`VITE_API_URL`** ezáltal a bundle része — változáskor **újra kell építeni**):

```bash
docker build -f docker/Dockerfile.frontend -t celkereszt-frontend:latest \
  --build-arg VITE_API_URL=https://api.pelda.hu \
  ./frontend
```

**Frontend bundle:** **`Dockerfile.frontend`**: **`ARG VITE_API_URL`** → **`ENV`**, ezután **`npm run build`**.

**`docker build`** nem veszi át magától a géped shell env-jét. Értékadás: **`--build-arg`**, a stackben **`frontend.build.args`**, vagy **`.env.production`** a build kontextusban. **`frontend/.dockerignore`**: **`.env`** / **`.env.local`** / **`.env.*.local`** kiesnek — ezért lokálisból nem „csurognak át”.

---

## 3. Env — build és futás között

- **`backend/.dockerignore`** nem engedi **`backend/.env`**-nek az **imageépítő kontextusban** részt venni — ez biztonság és méret. Ez **nem** tiltja meg, hogy a futó konténer megkapjon env-et: például Compose **`env_file`** vagy **`environment`**, Kubernetes secret.
- Lokális demó compose: **[INSTALLATION.md §4 „Út B”](INSTALLATION.md#4-út-b--minden-dockerben)** (env fájl, **`docker compose -f docker-compose.stack.yml`**).
- Minden változó **név szerint egyezés** **`backend/.env.example`** dokumentációjával (magyarázatok ott).

---

## 4. Éles változók

| Beállítás | Megjegyzés |
|---|---|
|`NODE_ENV=production`|TypeORM **`synchronize` ki** (`app.module.ts`) — séma migráció szükséges|
|`DB_*`, `REDIS_*`|Valódi éles végpont és jó jelszavak|
|`JWT_SECRET`|Erős véletlen érték|
|`CORS_ORIGIN`|Pontosan a publikus admin web **`https://...` originje|
|`FIREBASE_*`|Teljes funkció és Android push szerint kötelező; hiányában a backend fut, FCM nélkül — éles kulcs titok managerben|

További mezők: **`backend/.env.example`**.

---

## 5. Docker Compose (megjegyzés)

A **`docker-compose.stack.yml`** főleg **lokális / demó** — éles gyakran előre épített image + külön secret store + saját Postgres/Redis. Példa két konténerszolgáltatásra (backend + frontend előre tagelt imagel):

```yaml
services:
  backend:
    image: celkereszt-backend:v1.2.3
    env_file:
      - ./secrets/backend.production.env
    ports:
      - "3000:3000"
  frontend:
    image: celkereszt-frontend:v1.2.3
    ports:
      - "443:443"
```

*(A `./secrets/` mappa ne kerüljön gitbe.)*

---

## 6. Release checklist

- CI-ben **`npm run build`** backend + frontend
- Verziózott tag image-ek (`v1.x.x`)
- **`GET /health`**, login, kritikus realtime flow füst teszt

---

## 7. Biztonság

- Éles **`JWT_SECRET`**, **Firebase kulcs**, adatbázis jelszó: secret manager vagy biztonságos CI változó — ne a követett forráskód része.
- Belső hálón DB és Redis — élesben ne legyen felesleges publikus host port.

---

## 8. Kapcsolódó

| Dokumentum |
|---|
| [INSTALLATION.md](INSTALLATION.md) |
| [API_SPEC.md](API_SPEC.md) |
| [FIREBASE_SETUP.md](FIREBASE_SETUP.md) |
