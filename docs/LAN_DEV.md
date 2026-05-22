# Helyi hálózat (LAN) — telefon teszt

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Cél:** Fizikai Android telefon és opcionálisan a web admin elérése **a PC helyi IP-címén** ugyanazon a Wi‑Fi-n. Előfeltétel: fut a stack — [INSTALLATION.md](INSTALLATION.md) (Út A: npm, vagy Út B: Docker stack).

---

### Tartalom

1. [PC IP és elérhetőség](#1-pc-ip-és-elérhetőség)
2. [Röviden: melyik címet használd](#2-röviden-melyik-címet-használd)
3. [Backend `.env`](#3-backend-env)
4. [Frontend `.env` és böngésző GPS](#4-frontend-env-és-böngésző-gps)
5. [Android app](#5-android-app)
6. [Gyakori hibák](#6-gyakori-hibák)
7. [Kapcsolódó dokumentumok](#7-kapcsolódó-dokumentumok)

---

## 1. PC IP és elérhetőség

A dokumentumban a **`192.168.x.x`** helyére mindig a **saját** IPv4 címedet írd.

**Windows (PowerShell):**

```powershell
ipconfig
```

Keress **IPv4 Address** sort (Wi‑Fi vagy Ethernet). A telefon és a PC **ugyanazon a hálózaton** legyen (ne vendég Wi‑Fi).

**Gyors teszt** (telefon böngészőjében):

`http://192.168.x.x:3000/health` → JSON válasz = backend elérhető a LAN-on.

Ha nem válaszol: fut-e a backend, ugyanaz a Wi‑Fi, **Windows tűzfal** (bejövő **TCP 3000**, Private profil).

---

## 2. Röviden: melyik címet használd

| Hol | Cím (Út A, npm) |
|-----|-----------------|
| Telefon app / QR | `http://192.168.x.x:3000/` — **ne** `localhost` |
| Admin a PC-n | `http://localhost:3001` (legegyszerűbb) |
| Admin IP-ről | `http://192.168.x.x:3001` + [§3–4](#3-backend-env) |

| Hol | Cím (Út B, Docker stack) |
|-----|---------------------------|
| Web admin | `http://localhost:8080` vagy `http://192.168.x.x:8080` |
| API / health | port **3000** (ugyanaz az IP teszt) |

**Emulátor** (backend a PC-n): az appban / configban tipikusan **`10.0.2.2`** — már engedélyezve a `network_security_config.xml`-ben; részletek: [ANDROID_RELEASE_BUILD.md §7](ANDROID_RELEASE_BUILD.md#7-http-teszt-lan--emulátor).

---

## 3. Backend `.env`

Fájl: **`backend/.env`** (sablon: **`backend/.env.example`** — másold `.env` névre, ha még nincs).

```env
PUBLIC_API_BASE_URL=http://192.168.x.x:3000/
```

Így az admin **Eszközök → Android kapcsolat** QR-je és API URL-je nem `localhost`-ot mutat telefonra.

Ha a web admint **IP-ről** nyitod, Út A (port **3001**):

```env
CORS_ORIGIN=http://192.168.x.x:3001
```

Út B (Docker stack, admin port **8080**):

```env
CORS_ORIGIN=http://192.168.x.x:8080
```

A **`CORS_ORIGIN`** pontosan egyezzen a böngésző címsor **origin** részével (scheme + host + port). Backend **újraindítás** `.env` módosítás után.

---

## 4. Frontend `.env` és böngésző GPS

Csak ha a web admint **LAN IP-ről** nyitod (`http://192.168.x.x:3001`, Út A).

Fájl: **`frontend/.env`** (sablon: **`frontend/.env.example`**).

```env
VITE_API_URL=http://192.168.x.x:3000
```

**Frontend dev szerver újraindítás** (`.env` csak induláskor töltődik):

```bash
cd frontend
npm run dev
```

Belépés „Network Error” → ellenőrizd a [§3](#3-backend-env) `CORS_ORIGIN` és `VITE_API_URL` párost, majd a frontend restartot.

### Böngésző GPS (üldöző pozíció)

`http://192.168.x.x:3001` + **HTTP** mellett a Chrome/Edge gyakran **nem kér helyet**, konzol: `geolocation` engedély megtagadva.

| Cél | Megoldás |
|-----|----------|
| Üldöző GPS a PC-n | `http://localhost:3001` + hely engedély |
| Üldöző GPS IP-ről (fejlesztés) | Chrome: `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → engedélyezd → `http://192.168.x.x:3001` → böngésző újraindítás |
| Csak párok / térkép | IP-ről is megy **GPS nélkül** |

Az Android app **nem** a böngésző GPS-ét használja — [§5](#5-android-app).

---

## 5. Android app

### 5.1 HTTP engedély (fizikai telefon)

Fájl: **`android-app/app/src/main/res/xml/network_security_config.xml`**

Add hozzá a PC IPv4 címét (a fájlban vedd ki a kommentet, ha példa blokk van):

```xml
<domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">192.168.x.x</domain>
</domain-config>
```

**Újra build + telepítés** kötelező — a már telepített APK nem veszi fel a változást. Release: [ANDROID_RELEASE_BUILD.md §4–7](ANDROID_RELEASE_BUILD.md#4-ajánlott-android-studio). Debug: [android-app/README.md](../android-app/README.md) → **Run**.

### 5.2 Párosítás

1. Web admin: bejelentkezés → **Eszközök** → **Android kapcsolat** (API URL + titok / QR).
2. App: **Szerver kapcsolat** → `http://192.168.x.x:3000/` + titok (vagy QR) → **Csatlakozás és mentés**.
3. **Eszköz bejelentkezés** (pár kód az admintól).
4. Android **Hely: Mindig** (Beállítások → Alkalmazások → Célkereszt).

API: [API_SPEC.md](API_SPEC.md) (`/api/mobile/verify`, `/api/devices/login`).

---

## 6. Gyakori hibák

| Tünet | Teendő |
|-------|--------|
| `health` nem megy telefonról | Backend, Wi‑Fi, tűzfal 3000 — [§1](#1-pc-ip-és-elérhetőség) |
| App nem kapcsolódik | IP a `network_security_config.xml`-ben + **új APK** — [§5.1](#51-http-engedély-fizikai-telefon) |
| QR / URL `localhost` | `PUBLIC_API_BASE_URL` — [§3](#3-backend-env) |
| Web login Network Error | `VITE_API_URL` + `CORS_ORIGIN` egyezik a címsorral; frontend restart — [§3–4](#3-backend-env) |
| `geolocation` megtagadva | [§4](#4-frontend-env-és-böngésző-gps) — localhost admin vagy Chrome flag |
| Emulátor nem éri a PC-t | `10.0.2.2`, nem `localhost` — [§2](#2-röviden-melyik-címet-használd) |

---

## 7. Kapcsolódó dokumentumok

| Dokumentum | Témakör |
|------------|---------|
| [INSTALLATION.md](INSTALLATION.md) | Első indulás, env fájlok |
| [ANDROID_RELEASE_BUILD.md](ANDROID_RELEASE_BUILD.md) | Release APK, HTTP / LAN §7 |
| [../android-app/README.md](../android-app/README.md) | App modulok, debug |
| [API_SPEC.md](API_SPEC.md) | Device / enrollment API |
| [FIREBASE_SETUP.md](FIREBASE_SETUP.md) | Push (FCM) |

---

[README a repó gyökerében](../README.md) · [Dokumentációs index](README.md)
