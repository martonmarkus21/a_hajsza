# Firebase / FCM beállítás

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Szerepe:** Android push (FCM) összekötése Firebase projekten és backend service account változókon keresztül.

---

### Tartalom

1. [Cél és komponensek](#1-cél-és-komponensek)
2. [Firebase projekt és Android alkalmazás](#2-firebase-projekt-és-android-app)
3. [Android alkalmazás fájlok](#3-android-alkalmazás-fájlok)
4. [Backend service account](#4-backend-service-account)
5. [Backend környezeti változók](#5-backend-környezeti-változók)
6. [Ellenőrzés](#6-ellenőrzés)
7. [Gyakori hibák](#7-gyakori-hibák)
8. [Biztonság](#8-biztonság)
9. [Kapcsolódó dokumentumok](#9-kapcsolódó-dokumentumok)

---

## 1. Cél és komponensek

| Komponens | Szerep |
|---|---|
| Firebase projekt | FCM végpont |
| `google-services.json` | Android app Firebase azon |
| Backend service account JWT | Küldő hitelesítés – **`FcmService`** (`firebase-admin`) |

Ha a három **`FIREBASE_*`** közül bármelyik hiányzik vagy sablon, a **`FcmService`** nem indul el: a webes admin életben maradhat, de **push és a teljes terepi élmény nélkül**.

---

## 2. Firebase projekt és Android app

1. [Firebase Console](https://console.firebase.google.com/).
2. Új vagy létező projekt.
3. **Add app** → Android → package név **`com.celkereszt.app`** (aktuális Gradle `applicationId` szerint ellenőrizd).

---

## 3. Android alkalmazás fájlok

1. Töltsd le **`google-services.json`**.
2. **`android-app/app/google-services.json`**
3. Android Studio Gradle sync ellenőrizze a **`com.google.gms.google-services`** plugint és a Firebase BOM deps-t.

---

## 4. Backend service account

1. Firebase Console → Project settings → Service accounts.
2. **Új kulcs generálása** JSON.
3. A JSON-ban szerepelnek a **`project_id`**, **`private_key`**, **`client_email`** értékek — ezekre képeződnek a backend env változók.

Credential fájlt **ne** commitálj gitbe.

---

## 5. Backend környezeti változók

Sablon egy helyen: **`backend/.env.example`**. A három kötelező kulcs **`FcmService.onModuleInit()`** feltételei:

| Változó | Tartalom |
|---|---|
| `FIREBASE_PROJECT_ID` | `project_id` a JSON-ból |
| `FIREBASE_PRIVATE_KEY` | `private_key` – `.env`-ben gyakran **`\n`** escape több sor helyett |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |

**Ha a backend Docker stackben fut:** **`docker/env/backend.stack.env`** — előállítás és helyük: **[INSTALLATION.md §4](INSTALLATION.md#4-út-b--minden-dockerben)**; változónevek **`backend/.env.example`** szerint.

---

## 6. Ellenőrzés

1. Backend indul **„Firebase initialized”** (verbose opció) vs **„Firebase credentials not provided”** sor a logban.
2. Android felhasználó belép → eszköz küld **`POST /api/devices/fcm-token`**.
3. Várd a pushot valós eseményre (pl. szabálysértés, admin trigger – ahol a kód FCM-et hív).

**Siker jele:** nincs auth hiba a logban, értesítés megjelenik foreground + background módban.

---

## 7. Gyakori hibák

| Jelenség | Ok / teendő |
|---|---|
| `messaging/invalid-registration-token` | Régi FCM token – friss regisztráció az appban |
| `auth/invalid-credential` | Rossz `FIREBASE_PRIVATE_KEY` formázás (sortörés escape) vagy lejárt kulcs |
| Push nincs, log tiszta | Android értesítési csatorna, akkumulátor optimalizálás, `POST /api/devices/fcm-token` lefutott-e |

---

## 8. Biztonság

- Dev / prod **külön** Firebase projekt javasolt.
- Production titkok **secret manager** vagy CI secret.
- Service account kulcs rotáció évente vagy incidens után.

---

## 9. Kapcsolódó dokumentumok

| Dokumentum | Témakör |
|---|---|
| [INSTALLATION.md](INSTALLATION.md) | Helyi stack |
| [../android-app/README.md](../android-app/README.md) | Android build |
