# Android App Implementáció Összefoglaló

## Teljesített funkciók

### ✅ 1. Device Bejelentkezés
- **LoginActivity**: Teljes bejelentkezési képernyő
- **API integráció**: `POST /api/devices/login` endpoint
- **Token tárolás**: SharedPreferences-ben
- **FCM token**: Automatikus küldés bejelentkezéskor

### ✅ 2. API Service
- **Retrofit integráció**: Teljes API kommunikáció
- **Auth interceptor**: Automatikus token hozzáadás
- **Error handling**: Offline mód támogatás
- **Device login**: Teljes implementáció

### ✅ 3. Location Service
- **Foreground service**: Háttérben futó szolgáltatás
- **GPS tracking**: Google Play Services Location API
- **Folyamatos / gyakori pozícióküldés** a szervernek (`PositionRepository`), a játékmotor mintaciklusa a backendhez igazodik
- **Játékállapot poll**: `GET /api/game-settings/countdown` (értesítés + broadcast a főképernyőnek)
- **Vehicle mode**: Járműhasználat követés

### ✅ 4. FCM Service
- **Push notifications**: Teljes FCM integráció
- **Token kezelés**: Automatikus token frissítés
- **Message handling**: Üzenetek megjelenítése
- **Broadcast**: MainActivity frissítés

### ✅ 5. Repository Pattern
- **PositionRepository**: Adat réteg
- **Offline cache**: Room database
- **Sync mechanism**: Automatikus szinkronizálás

### ✅ 6. MainActivity
- **UI**: Minimal fekete UI
- **Message display**: Üzenetek megjelenítése
- **Vehicle control**: Járműhasználat kezelés
- **Help button**: Segítség kérés

### ✅ 7. PreferencesHelper
- **Token storage**: Biztonságos token tárolás
- **Device info**: Pár információk
- **Vehicle state**: Járműhasználat állapot

### ✅ 8. Build Configuration
- **Kapt plugin**: Room compiler
- **Dependencies**: Minden szükséges library
- **Firebase**: Google Services integráció

### ✅ 9. UI/UX
- **Themes**: Fekete-narancs színséma
- **Layouts**: Login és Main activity
- **Strings**: Magyar nyelvű szövegek

## Projekt struktúra

```
android-app/
├── app/
│   ├── src/main/
│   │   ├── java/com/mostwanted/app/
│   │   │   ├── api/
│   │   │   │   └── ApiService.kt          # API interfészek
│   │   │   ├── database/
│   │   │   │   ├── AppDatabase.kt        # Room database
│   │   │   │   ├── PositionDao.kt        # DAO interfész
│   │   │   │   └── PositionEntity.kt     # Entity osztály
│   │   │   ├── repository/
│   │   │   │   └── PositionRepository.kt # Adat réteg
│   │   │   ├── service/
│   │   │   │   ├── LocationService.kt     # GPS service
│   │   │   │   └── FcmService.kt         # FCM service
│   │   │   ├── util/
│   │   │   │   ├── PreferencesHelper.kt  # SharedPreferences helper
│   │   │   │   └── GameRuntimeFormatter.kt
│   │   │   ├── viewmodel/
│   │   │   │   └── MainViewModel.kt       # ViewModel
│   │   │   ├── LoginActivity.kt          # Bejelentkezés
│   │   │   └── MainActivity.kt           # Főképernyő
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   ├── activity_login.xml
│   │   │   │   └── activity_main.xml
│   │   │   ├── values/
│   │   │   │   ├── strings.xml
│   │   │   │   └── themes.xml
│   │   │   └── ...
│   │   └── AndroidManifest.xml
│   ├── build.gradle.kts
│   └── google-services.json (létrehozandó)
├── build.gradle.kts
├── settings.gradle.kts
└── README.md
```

## Főbb komponensek

### LoginActivity
- Bejelentkezési képernyő
- Pár szám és jelszó megadása
- **Eszközazonosító** (`deviceId` a login body-ban): `Settings.Secure.ANDROID_ID`
- FCM token automatikus küldés (ha elérhető)
- Engedélyek: hely, értesítés (Android 13+), foreground service (részletek a manifestben)

### MainActivity
- Főképernyő minimal UI-val
- Üzenetek megjelenítése
- Járműhasználat kezelés
- FCM üzenetek fogadása

### LocationService
- Foreground service
- GPS pozíció követés, pozícióküldés a `PositionRepository`-n keresztül
- Játékállapot / countdown poll (értesítés szöveg + broadcast)

### ApiService
- Retrofit API interfész
- Auth interceptor
- Device login endpoint
- Position send endpoint

## Beállítási lépések

1. **Firebase beállítás**
   - Hozz létre Firebase projektet
   - Add hozzá az Android app-ot
   - Töltsd le a `google-services.json` fájlt
   - Helyezd el az `app/` mappába

2. **Backend URL**
   - Módosítsd az `ApiService.kt`-ban a `BASE_URL`-t
   - Emulator: `http://10.0.2.2:3000/`
   - Valós eszköz: `http://<saját-ip>:3000/`

3. **Build**
   - Nyisd meg Android Studio-ban
   - Gradle sync
   - Build és futtatás

## API Endpoints

### Device Login
```
POST /api/devices/login
Body: {
  "username": "1",
  "password": "1",
  "deviceId": "device_id",
  "fcmToken": "fcm_token"
}
```

### Position Send
```
POST /api/position
Header: Authorization: Bearer <token>
Body: {
  "deviceId": "string",
  "pairId": 1,
  "lat": 47.4979,
  "lon": 19.0402,
  "accuracy": 10.0,
  "speed": 0.0,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "vehicleMode": false,
  "vehicleSessionRemaining": null
}
```

## Engedélyek

- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` — GPS / hálózati hely
- `ACCESS_BACKGROUND_LOCATION` — háttérben is fusson a helykövetés (manifest szerint)
- `POST_NOTIFICATIONS` — push értesítések (Android 13+)
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` — hely típusú előtérbeli szolgáltatás
- `WAKE_LOCK` — háttérben futás

## Offline működés

- Pozíciók lokálisan tárolódnak Room database-ben
- Automatikus szinkronizálás amikor internet elérhető
- Sikertelen küldés esetén a pozíciók a Room-ban maradnak; a következő sikeres `sendPosition` szinkronizál

## Járműhasználat

- 40 perc limit
- Automatikus leállítás limit után
- Pozíció küldés vehicle mode-dal
- Remaining time számítás

## További fejlesztési lehetőségek

- [ ] Járműhasználat visszaszámláló UI
- [ ] Pozíció előzmények megjelenítése
- [ ] Offline mód indikátor
- [ ] Beállítások képernyő
- [ ] Logout funkció
- [ ] Hibakezelés UI
- [ ] Unit tesztek
- [ ] UI tesztek

