# Most Wanted - Android App

Android alkalmazás a menekülő párok számára (**Jetpack Compose**, egy fő `AppActivity`).

## Funkciók

- **Szerver beállítás** (első indítás): publikus API URL + beiratkozási titok (kézi vagy QR; admin felület „Android kapcsolat”). Opcionális ellenőrzés: `GET /api/mobile/verify` és `X-Mw-Enrollment-Secret` fejléc.
- **Bejelentkezés** pár felhasználónév / jelszóval és eszközazonosítóval (`POST /api/devices/login`, `MobileEnrollmentGuard`).
- **Főképernyő**: játékállapot sorok (`GET /api/game-settings/countdown`), élő állapot mapper, lokális **események** (Room / `EventRepository`).
- **LocationService**: előtér / háttér helykövetés és `POST /api/position` (jármű mód és `vehicleSessionRemaining` másodperc mezőkkel — a jármű 40 percének végekor `POST /api/devices/vehicle-session-expired`).
- **FCM** push fogadása, értesítési képernyő típus szerint összesítve.
- **„Segítség kérése”** → szerver globális toast a webhez (`POST /api/devices/help-request`).

## Technológia

- Kotlin, Jetpack Compose, Navigation
- MVVM (`MainViewModel`, `AuthViewModel`)
- Retrofit / OkHttp (**dinamikus base URL**, `ApiService.create(context)`)
- `EncryptedSharedPreferences` (`ServerConnectionStore`), Gson + szükség szerint `LenientBooleanDeserializer`
- Google Play Services Location, Firebase Messaging
- Room (offline cache, események)

## Beállítás

### Firebase

`google-services.json` → `android-app/app/`

### Backend elérése

Az API címet **nem** kötelező a forráskódba írni: az app a szerver párosító képernyőről tárolja. Fejlesztői esetekben tipikus érték: emulator `http://10.0.2.2:3000/`, fizikai készülék `http://<LAN-IP>:3000/`.

## Build

Android Studio → `android-app` modul futtatása. ProGuard konfig ha release: `app/proguard-rules.pro`.

## Projekt struktúra (válogatás)

```
app/src/main/java/com/mostwanted/app/
├── AppActivity.kt
├── api/                   # Retrofit + enrollment probe + Gson részletek
├── ui/                    # Compose képernyők (Login, Dashboard, Admin-szerű folyamat, Server setup, Notifications)
├── service/               # LocationService, FcmService
├── viewmodel/
├── repository/            # Offline / események
├── database/
├── splash/
├── model/
└── util/                  # ServerConnectionStore, QR parser, countdown / játék státusz formázók
```

## API végpontok (rövid)

| Funkció | Módszer / útvonal |
|--------|---------------------|
| Kapcsolat ellenőrzés | `GET /api/mobile/verify` |
| Bejelentkezés | `POST /api/devices/login` |
| Aktuális játékállapot összefoglaló | `GET /api/game-settings/countdown` |
| Pozíció | `POST /api/position` |
| FCM token | `POST /api/devices/fcm-token` |
| Segítség | `POST /api/devices/help-request` |
| Jármű 40 perc lejárta | `POST /api/devices/vehicle-session-expired` |
| Kilépés eszköz munkamenetből | `POST /api/devices/logout` |

Részletesen: táblázatokkal és auth magyarázattal lásd **`docs/API_SPEC.md`**.

## Engedélyek és háttér

Helyzet, előtér-szolgáltatás (location típus), értesítések (Android 13+). Az eszközazonosítót a klasszikus bejelentkezési útvonal továbbra is az Android **`ANDROID_ID`** (vagy stabilebb alternatívák) szerint küldi a szervernek; részletek a `devices` táblában (`imei_or_device_id`).

