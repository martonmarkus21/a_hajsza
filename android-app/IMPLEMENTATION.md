# Android architektúra (implementációs jegyzetek)

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Szerepe:** Magas szintű technikai konszenzus a `com.celkereszt.app` csomaghoz — nem váltja ki a pontos package / osztálynevek olvasását a forrásban.

---

### Tartalom

1. [Célrendszer tulajdonságai](#1-célrendszer-tulajdonságai)
2. [Rétegek](#2-rétegek)
3. [Minőségbiztosítás](#3-minőségbiztosítás-fejlesztőnek)
4. [Kapcsolódó dokumentumok](#4-kapcsolódó-dokumentumok)

---

## 1. Célrendszer tulajdonságai

| Követelmény | Megközelítés |
|---|---|
| Mobil hálózati ingadozás | HTTP: **`ApiService`**/`EnrollmentProbe` (30s connect/read/write timeout). Pozíciók: sikertelen küldés → Room **`PositionRepository`** helyi sor + későbbi **`syncOfflinePositions`**. UI: tipikusan **loading / error** állapotok a képernyőkön |
| API alap URL + enrollment titok | **`ServerConnectionStore`**: **`EncryptedSharedPreferences`** + **`MasterKey`** (Android Keystore alapú kulcsgenerálás) — nincs éles URL vagy titok a forrásban rögzítve |
| Háttér helyzet | Foreground service + jogosultság UX a platform szabályai szerint (**`LocationService`**) |

---

## 2. Rétegek

### UI / Compose

Deklaratív állapot: többnyire **`StateFlow`** a ViewModelekben + **`collectAsStateWithLifecycle`** (**`AppActivity`**) és helyi **`remember`** a képernyőkön.

### Adat és API

- Mentett base URL (**`/`** végessel normalizálva) + Retrofit relatív útvonalak (**`api/...`** mint a **`ApiService`** interfészben — nincs vezető perjel a töredék path elején, a **`baseUrl`** peres lezárása mellett áll össze helyes URL).
- Enrollment fejléc: az app konstansa **`ApiService.ENROLLMENT_SECRET_HEADER`** (`X-Ck-Enrollment-Secret`) egyezik a backend **`MOBILE_ENROLLMENT_HEADER`** konstansával (`x-ck-enrollment-secret` — HTTP fejlécnél a kis-nagybetű nem számít).
- Első kapcsolat: **`EnrollmentProbe`** hívja **`GET /api/mobile/verify`**; csak **`ok`** esetén mentődnek URL + titok, majd folytatódik a navigáció. Sikertelen ellenőrzés (**401** vagy hálózat) a párosító képernyőn marad **hibaüzenettel**, mentés nélkül.
- Bejelentkezett JWT esetén **401** válasz a guarded hívásokon: token törlése + **`FORCE_LOGOUT`** broadcast (kiszolgáló általi érvénytelenített session), nem ugyanaz a folyamat, mint az első **`verify`**.

### Integrációk

| Integráció | Megjegyzés |
|---|---|
| **FCM** | Token → **`POST /api/devices/fcm-token`**; újraindítás / kijelentkezés után is újraregisztrálható. Adat payload: pl. **`force_logout`**, **`pair_deleted`**, **`location_update_request`** — **`FcmService`** kezeli; releváns esetekben Room esemény (**`EventRepository`**) is íródik |
| **WebSocket** | A **`/ws/game`** Socket.IO namespace a web admin felé; az Android kliens jelen architektúrában REST + push, nincs beépített Socket.IO kliens |
| **Room** | Helyi esemény‑/értesítés‑napló a listanézethez (**`AppDatabase`**, **`EventDao`**) |

---

## 3. Minőségbiztosítás (fejlesztőnek)

| Teszt | Cél |
|---|---|
| `assembleDebug` | Fordíthatóság |
| Enrollment + login | Session és tárolt kapcsolat |
| GPS mock | Pozíció pipeline a backendnek |
| Lassú hálózat | Timeout és hiba‑UX |
| Push | Foreground + background csatorna / értesítés megjelenés |

---

## 4. Kapcsolódó dokumentumok

| Dokumentum | Témakör |
|---|---|
| [README.md](README.md) | Build és onboarding szint |
| [../docs/API_SPEC.md](../docs/API_SPEC.md) | Device szerződés |
| [../docs/WEBSOCKET_EVENTS.md](../docs/WEBSOCKET_EVENTS.md) | Realtime (web admin); referencia ha később app oldali websocket kell |
| [../docs/FIREBASE_SETUP.md](../docs/FIREBASE_SETUP.md) | FCM backend oldal |
