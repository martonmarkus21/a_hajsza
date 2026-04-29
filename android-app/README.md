# Most Wanted - Android App

Android alkalmazás a menekülő párok számára.

## Funkciók

- ✅ Device bejelentkezés (pár száma alapján)
- ✅ Minimal UI (fekete háttér, rövid üzenetek)
- ✅ **LocationService** (előtér-szolgáltatás): folyamatos GPS + pozícióküldés a szervernek (távolságszámításhoz is)
- ✅ FCM push értesítések fogadása
- ✅ Járműhasználat követése (40 perc limit)
- ✅ Offline cache és sync (`PositionRepository`)
- ✅ Játékállapot / countdown lekérés (`GET /api/game-settings/countdown`) — értesítés és főképernyő frissítés

## Technológia

- Kotlin
- MVVM architektúra
- Google Play Services Location API
- Firebase Cloud Messaging
- Room Database (offline cache)
- Retrofit (API kommunikáció)

## Beállítás

### 1. Firebase beállítás

1. Hozz létre egy Firebase projektet a [Firebase Console](https://console.firebase.google.com/)-ban
2. Add hozzá az Android alkalmazást a projekthez
3. Töltsd le a `google-services.json` fájlt
4. Helyezd el a fájlt az `app/` mappába

### 2. Backend URL beállítása

Módosítsd az `ApiService.kt` fájlban a `BASE_URL` értékét:

```kotlin
// Android emulator esetén:
private const val BASE_URL = "http://10.0.2.2:3000/"

// Valós eszköz esetén (cseréld le a saját IP-dre):
private const val BASE_URL = "http://192.168.x.x:3000/"
```

### 3. Build és futtatás

1. Nyisd meg Android Studio-ban
2. Importáld a projektet
3. Várj, amíg a Gradle szinkronizál
4. Futtasd az alkalmazást

## Használat

### Bejelentkezés

1. Indítsd el az alkalmazást
2. Add meg a pár számát (username)
3. Add meg a jelszót (ugyanaz, mint a pár száma)
4. Kattints a "Bejelentkezés" gombra

### Fő funkciók

- **Üzenetek**: A főképernyőn jelennek meg az üzenetek
- **Segítség kérése**: Kattints a "Segítség kérése" gombra
- **Járműhasználat**: Indítsd/állítsd le a járműhasználatot (40 perc limit)

### Háttér működés

- A **LocationService** küldi a pozíciót (folyamatos / gyakori mintavétel a kliensen; a játékmotor ciklusa a szerveren dől el)
- Offline módban a pozíciók lokálisan tárolódnak és később szinkronizálódnak
- FCM push értesítések automatikusan megjelennek

## Engedélyek

Az alkalmazás a következő engedélyeket kéri (a `AndroidManifest.xml` szerint):

- **Helymeghatározás** (fine / coarse, szükség szerint háttér hely): pozíció küldéshez
- **Értesítések** (Android 13+): FCM push értesítésekhez
- **Foreground service** (location típusú): háttérben futó helyszolgáltatás

A bejelentkezéskor küldött `deviceId` előállítása: `LoginActivity` (`Settings.Secure.ANDROID_ID`).

## Hibaelhárítás

### Nem lehet bejelentkezni

- Ellenőrizd, hogy a backend fut-e
- Ellenőrizd a `BASE_URL` beállítását
- Ellenőrizd, hogy a pár létezik-e az adatbázisban

### Pozíció nem küldődik

- Ellenőrizd a helymeghatározás engedélyt
- Ellenőrizd az internetkapcsolatot
- Nézd meg a logokat (Logcat)

### FCM nem működik

- Ellenőrizd, hogy a `google-services.json` fájl helyesen van-e beállítva
- Ellenőrizd a Firebase projekt beállításait

## Fejlesztés

### Projekt struktúra

```
app/src/main/java/com/mostwanted/app/
├── api/              # API interfészek
├── database/         # Room database
├── repository/       # Adat réteg
├── service/          # Háttér szolgáltatások
├── util/             # Segéd osztályok
├── viewmodel/        # ViewModel osztályok
├── LoginActivity.kt  # Bejelentkezési képernyő
└── MainActivity.kt  # Főképernyő
```

### API Endpoints

- `POST /api/devices/login` - Device bejelentkezés
- `GET /api/game-settings/countdown` - Játékállapot / számláló (JWT)
- `POST /api/position` - Pozíció küldés

### Adatbázis

A Room adatbázis offline pozíciók tárolására szolgál. A pozíciók automatikusan szinkronizálódnak, amikor az internetkapcsolat elérhető.
