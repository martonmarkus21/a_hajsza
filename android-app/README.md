# Android kliens

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Szerepe:** Mobil (pár) kliens áttekintése: build, első párosítás és modulfelosztás. Részletes architektúra: [IMPLEMENTATION.md](IMPLEMENTATION.md); HTTP szerződés: **`../docs`**.

---

### Tartalom

1. [Feladatkör](#1-feladatkör)
2. [Technológia](#2-technológia)
3. [Projekt struktúra](#3-projekt-struktúra)
4. [Build és futtatás](#4-build-és-futtatás)
5. [Első párosítás](#5-első-párosítás)
6. [Modulok](#6-modulok)
7. [Hibakeresés](#7-hibakeresés)
8. [Kapcsolódó dokumentumok](#8-kapcsolódó-dokumentumok)

---

## 1. Feladatkör

Pair eszköz: backendhez kapcsolódás (**enrollment ellenőrzés** + **`POST /api/devices/login`** után Bearer token), lokáció küldése, **`help-request`** / **`vehicle-session-expired`** hívások, FCM fogadása.

Package jelen állapotban: **`com.celkereszt.app`** (`app/build.gradle.kts`).

---

## 2. Technológia

| Réteg | Eszköz |
|---|---|
| UI | Kotlin, Jetpack Compose |
| REST | Retrofit + Gson (**`CkApiGson`**) |
| Push | Firebase Cloud Messaging |
| Lokáció | Android Location + háttér service (`LocationService`) |

---

## 3. Projekt struktúra (vázlat)

```text
android-app/
├── app/src/main/java/com/celkereszt/app/
│   ├── api/
│   ├── database/          # Room
│   ├── model/
│   ├── repository/
│   ├── service/           # LocationService, FcmService
│   ├── ui/
│   ├── util/
│   ├── viewmodel/
│   ├── AppActivity.kt
│   └── splash/
└── app/src/main/res/
```

---

## 4. Build és futtatás

### Előfeltételek

- Android Studio stabil csatorna
- JDK: **Gradle futtatáshoz lehetőleg 17** (*Settings → Gradle → Gradle JDK*: ne legyen ennél újabb, elkerülhető véletlen **jlink**/JdkImageTransform hiba); az app bytecode célja: **Java 11** (`compileOptions`, `kotlinOptions.jvmTarget`)
- **`google-services.json`** → **`android-app/app/`** (Firebase Console szerint illeszd az **`applicationId`**-hez)

### Lépések

1. **android-app** mappa megnyitása Android Studio-ban (projekt gyökér erre a könyvtárra mutasson).
2. Gradle sync.
3. Fizikai eszköz vagy emulátor összepárosítva / elindítva.
4. **Run** → **debug** build.

---

## 5. Első párosítás

Felhasználói onboarding adat:

| Adat | Forrás |
|---|---|
| API gyökér | Kézi bevitel vagy QR (admin **`/api/devices/admin/mobile-connection`** DTO, lásd **`../docs`** ) |
| Enrollment titok | **`X-Ck-Enrollment-Secret`** (megegyező szándékú név mint backend **`MOBILE_ENROLLMENT_HEADER`**) |

Részletes flow: **`../docs/API_SPEC.md`**, **`../docs/INSTALLATION.md`**.

---

## 6. Modulok

| Terület | Funkció |
|---|---|
| Auth / párosítás | **`EnrollmentProbe`** → **`GET /api/mobile/verify`**, majd **`/api/devices/login`**, lokálisan tárolt device JWT (**`PreferencesHelper`**) |
| Helyzet | Periodikus lokáció → **`POST /api/position`** (**`LocationService`**, manifest: **foreground + `location` típus**) |
| Push | **`POST /api/devices/fcm-token`**, **`FcmService`** csatornák |
| Helyi események | Room: **`EventRepository`** ( **`FcmService`** és társított UX menti / listázza) |
| UX | Compose (**`AppNavGraph`**), QR (**`CkQrCaptureActivity`**) |

Részletesen: [IMPLEMENTATION.md](IMPLEMENTATION.md).

---

## 7. Hibakeresés

| Hibaüzenet / tünet | Ellenőrzés |
|---|---|
| Érvénytelen mobil kapcsolódási titok | `game_settings.mobile_enrollment_secret` / env felülírás; fejléc egyezése a **`ApiService.ENROLLMENT_SECRET_HEADER`** / backend konstanssal |
| Gradle „duplicate resources” | `res/mipmap*` — ne legyen párhuzamosan **`ic_launcher.png`** és **`.webp`** ugyanarra a névzónára |
| FCM néma | **`google-services.json`**, backend **`FIREBASE_*`** → [../docs/FIREBASE_SETUP.md](../docs/FIREBASE_SETUP.md) |

---

## 8. Kapcsolódó dokumentumok

| Dokumentum | Témakör |
|---|---|
| [../README.md](../README.md) | Monorepo áttekintés |
| [../docs/INSTALLATION.md](../docs/INSTALLATION.md) | Teljes stack helyben |
| [../docs/API_SPEC.md](../docs/API_SPEC.md) | Device végpontok |
| [../docs/FIREBASE_SETUP.md](../docs/FIREBASE_SETUP.md) | FCM |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Architektúra mélyebb |
