# Android architektúra (implementációs jegyzetek)

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Szerepe:** Magas szintű technikai konszenzus a `com.celkereszt.app` csomaghoz — nem váltja ki a pontos package / osztálynevek olvasását a forrásban.

---

### Tartalom

1. [Célrendszer tulajdonságai](#1-célrendszer-tulajdonságai)
2. [Rétegek](#2-rétegek)
3. [Kerülendő minták](#3-kerülendő-minták)
4. [Minőség](#4-minőségbiztosítás-fejlesztőnek)
5. [Kapcsolódó dokumentumok](#5-kapcsolódó-dokumentumok)

---

## 1. Célrendszer tulajdonságai

| Követelmény | Megközelítés |
|---|---|
| Mobil hálózati ingadozás | Központi HTTP kliens retry + felhasználói állapot (**loading / success / failure**) |
| Enrollment titkok | Nem hardcodeolt – háttér titok tárolása platform KeyStore-ban / Preferences biztonságos rétegben ahogy az app teszi |
| Háttér helyzet | Foreground service + jogosultság UX a platform szabályainak megfelelően |

---

## 2. Rétegek

### UI / Compose

Deklaratív állapot (**StateFlow** / **`remember` állapot gépek**) – Compose preview-k a statikus blokkoknak.

### Adat és API

- Base URL felhasználói tárolása – minden relatív **`/api`** path a backend előírására illeszkedjen.
- **Enrollment header:** **`x-ck-enrollment-secret`** mind azonos néven küldött, mint a **`MOBILE_ENROLLMENT_HEADER`** backend konstans.
- Sikertelen **401 enrollment** válasszal visszalépés onboardingra.

### Integrációk

| Integráció | Megjegyzés |
|---|---|
| **FCM** | Token → **`POST /api/devices/fcm-token`** logout / újraindítás esetén is frissíthető |
| **WebSocket** | Ha van kliens oldali figyelés: namespace **`/ws/game`** – általában a web admin használja élőben, az app REST + push domináns lehet |

---

## 3. Kerülendő minták

- **Ne** logolj teljes authorization headert vagy enrollment titkot.
- **Ne** commitolj **`.env`** jellegű runtime URL-t publikus repóba.

---

## 4. Minőségbiztosítás (fejlesztőnek)

| Teszt | Cél |
|---|---|
| `assembleDebug` | Fordíthatóság |
| Enrollment + login | Session kezelés |
| GPS mock | Backend pozíció pipeline |
| Lassú hálózat (emulátor?) | Timeout UX |
| Push | Foreground + background értesítés |

---

## 5. Kapcsolódó dokumentumok

| Dokumentum | Témakör |
|---|---|
| [README.md](README.md) | Felhasználói / build szint |
| [../docs/API_SPEC.md](../docs/API_SPEC.md) | Device contract |
| [../docs/WEBSOCKET_EVENTS.md](../docs/WEBSOCKET_EVENTS.md) | Realtime (ha használjátok app oldalon) |
| [../docs/FIREBASE_SETUP.md](../docs/FIREBASE_SETUP.md) | FCM backend oldal |
