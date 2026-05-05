# Android kliens

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Szerepe:** Mobil (pár) kliens fejlesztői és forgalmazás előtti ellenőrzési pontok. Build és API részletek a forráskód és **`../docs`** mappa mellett.

---

### Tartalom

1. [Feladatkör](#1-feladatkör)
2. [Technológia](#2-technológia)
3. [Projekt struktúra](#3-projekt-struktúra)
4. [Build és futtatás](#4-build-és-futtatás)
5. [Első párosítás](#5-első-párosítás)
6. [Modulok](#6-modulok)
7. [Hibakeresés](#7-hibakeresés)
8. [Release előtti checklist](#8-release-előtti-checklist)
9. [Kapcsolódó dokumentumok](#9-kapcsolódó-dokumentumok)

---

## 1. Feladatkör

Pair eszköz: backendhez kapcsolódás (**enrollment** + **`POST /api/devices/login`** után Bearer token), lokáció küldése, **`help-request`** / **`vehicle-session-expired`** hívások, FCM fogadása.

Package jelen állapotban: **`com.celkereszt.app`** (`app/build.gradle.kts`).

---

## 2. Technológia

| Réteg | Eszköz |
|---|---|
| UI | Kotlin, Jetpack Compose |
| REST | Retrofit (+ Gson / projekt szerinti HTTP réteg) |
| Push | Firebase Cloud Messaging |
| Lokáció | Android Location / háttér service (részletek a kódmodulokban) |

---

## 3. Projekt struktúra (vázlat)

```text
android-app/
├── app/src/main/java/com/celkereszt/app/
│   ├── api/
│   ├── ui/
│   ├── services/
│   └── util/
└── app/src/main/res/
```

---

## 4. Build és futtatás

### Előfeltételek

- Android Studio stabil csatorna
- JDK verzió: a projekt Gradle/AGP `jvmToolchain` követelményének megfelelően (**`gradle.properties`**, wrapper)
- **`google-services.json`** → **`android-app/app/`**

### Lépések

1. Nyisd meg az **`android-app`** mappa gyökerét Android Studio-ban.
2. Gradle sync.
3. Fizikai eszköz vagy emulátor.
4. **`Run`** → **`debug`** build.

---

## 5. Első párosítás

Felhasználói onboarding adat:

| Adat | Forrás |
|---|---|
| API gyökér | Kézi bevitel vagy QR (admin **`/api/devices/admin/mobile-connection`** DTO szerint, lásd dokumentáció) |
| Enrollment titok | **`x-ck-enrollment-secret`** HTTP header minden guarded enroll/device hívás előtt |

Részletes flow: **`../docs/API_SPEC.md`**, **`../docs/INSTALLATION.md`**.

---

## 6. Modulok

| Terület | Funkció |
|---|---|
| Auth / párosítás | Enrollment ping, **`/api/devices/login`**, lokálisan tárolt device JWT |
| Helyzet | Periodikus lokáció **→** **`POST /api/position`** (DTO a backendhez igazítva) |
| Push | **`POST /api/devices/fcm-token`** regisztráció és notification channel kezelés |
| UX | Compose képernyők, hibadiálogok, QR capture Activity |

Technikai mélyebb írás: [IMPLEMENTATION.md](IMPLEMENTATION.md).

---

## 7. Hibakeresés

| Hibaüzenet / tünet | Ellenőrzés |
|---|---|
| Érvénytelen mobil kapcsolódási titok | `game_settings` aktív **`mobileEnrollmentSecret`**, pontos **`x-ck-enrollment-secret`** fejléc |
| Gradle „duplicate resources” | `res/mipmap*` – ne legyen párhuzamosan `ic_launcher.png` **és** `.webp` ugyanarra a névre |
| FCM néma | **`google-services.json`**, backend **`FIREBASE_*`** – [../docs/FIREBASE_SETUP.md](../docs/FIREBASE_SETUP.md) |

---

## 8. Release előtti checklist

- [ ] `assembleRelease` éles kulcsállománnyal (projekt szerinti signing)
- [ ] Enrollment + login + lokáció + push útvonal teszt fizikai kütyün
- [ ] Crashlytics / log opcionális követés bekötve organisation policy szerint

---

## 9. Kapcsolódó dokumentumok

| Dokumentum | Témakör |
|---|---|
| [../README.md](../README.md) | Monorepo áttekintés |
| [../docs/INSTALLATION.md](../docs/INSTALLATION.md) | Teljes stack helyben |
| [../docs/API_SPEC.md](../docs/API_SPEC.md) | Device végpontok |
| [../docs/FIREBASE_SETUP.md](../docs/FIREBASE_SETUP.md) | FCM |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Architektúra mélyebb |
