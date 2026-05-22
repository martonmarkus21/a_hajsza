# Android release APK — build és aláírás

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Szerepe:** Rövid útmutató: hogyan készül **telepíthető** release APK. **Ajánlott módszer: Android Studio** (build + aláírás egy helyen). Debug futtatás: [../android-app/README.md](../android-app/README.md).

---

### Tartalom

1. [Röviden: mi kell?](#1-röviden-mi-kell)
2. [Firebase fájl (kötelező)](#2-firebase-fájl-kötelező)
3. [Miért nincs „mindenkinek jó” APK a GitHubon?](#3-miért-nincs-mindenkinek-jó-apk-a-githubon)
4. [Ajánlott: Android Studio](#4-ajánlott-android-studio)
5. [Hol van az APK?](#5-hol-van-az-apk)
6. [Telefonra telepítés](#6-telefonra-telepítés)
7. [HTTP teszt (LAN / emulátor)](#7-http-teszt-lan--emulátor)
8. [GitHub Release](#8-github-release)
9. [Ha a build elhasal (JDK)](#9-ha-a-build-elhasal-jdk)
10. [Opcionális: parancssor](#10-opcionális-parancssor)
11. [Gyakori hibák](#11-gyakori-hibák)
12. [Kapcsolódó dokumentumok](#12-kapcsolódó-dokumentumok)

---

## 1. Röviden: mi kell?

| Amit akarsz | Mit jelent |
|-------------|------------|
| **Aláírt release APK** | Telefonra telepíthető csomag (pár eszköz app) |
| **`google-services.json`** | Firebase-hez kötött beállítás — **minden telepítéshez más lehet** |
| **Keystore** | „Kulcs” az APK aláírásához — **egyszer** létrehozod, később ugyanazt használod |

**Unsigned APK** (`app-release-unsigned.apk`) → a telefon általában **nem** telepíti. Aláírás kell (Studio-ban a legegyszerűbb).

---

## 2. Firebase fájl (kötelező)

Build **nélküle nem megy**.

1. [Firebase Console](https://console.firebase.google.com/) → a **saját** projekt.
2. Android app: csomagnév **`com.celkereszt.app`**.
3. Letöltöd a **`google-services.json`**-t.
4. Bemásolod ide: **`android-app/app/google-services.json`**
5. **Ne** rakd gitbe (a repóban csak **`google-services.json.example`** van mintának).

Backend push (FCM) ugyanahhoz a Firebase projekthez: [FIREBASE_SETUP.md](FIREBASE_SETUP.md).

---

## 3. Miért nincs „mindenkinek jó” APK a GitHubon?

Mert az APK **a ti Firebase projektetekhez** van kötve. Más szerver / más Firebase → **más** `google-services.json` → **másik** APK kell.

| GitHub Release-en | Érdemes? |
|-------------------|----------|
| Tag + changelog + **link erre a doksira** | Igen |
| Egy konkrét, aláírt APK (csak a ti körötöknek) | Opcionális |
| `google-services.json` vagy keystore | **Nem** |

---

## 4. Ajánlott: Android Studio

### 4.1 Projekt megnyitása

1. **File → Open** → válaszd az **`android-app`** mappát.
2. Várj **Gradle sync**-re (alsó sáv).
3. Ha kéri: **Gradle JDK = 17** (lásd §9, ha hibát kapsz).

### 4.2 Verzió (új build előtt)

`android-app/app/build.gradle.kts` → `versionCode` és `versionName` (pl. `1` / `1.0.0`).

### 4.3 Aláírt APK készítése (egy varázsló)

1. Menü: **Build → Generate Signed App Bundle or APK…**
2. Válaszd: **APK** → **Next**.
3. **Key store path:**
   - **Első alkalommal:** **Create new…** → válassz helyet (pl. saját Documents mappa), adj jelszót, alias nevet (pl. `celkereszt`). **Őrizd meg** a fájlt és a jelszót — későbbi frissítéshez ugyanaz kell.
   - **Már van kulcsod:** **Choose existing…** → válaszd a `.jks` / `.keystore` fájlt.
4. **Next** → pipáld be a **release** build type-ot → **Create** / **Finish**.
5. Ha kész, alul felugrik: **locate** — erre kattintva megnyílik a mappa az **aláírt** APK-val.

*(A keystore-t létrehozhatod parancssorból is — §10 — de Studio-ban a **Create new** ugyanazt csinálja, egyszerűbben.)*

### 4.4 Gradle sync után gyors build (ha már be van állítva az aláírás)

Ha a projektben később beállítod a signingot a Gradle-ben, elég lehet **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Kezdőknek a fenti **Generate Signed…** a biztos út.

---

## 5. Hol van az APK?

Studio **Generate Signed…** után tipikusan:

`android-app/app/release/`  
vagy  
`android-app/app/build/outputs/apk/release/`

A fájl neve lehet pl. **`app-release.apk`** — ez már **aláírt**, ezt oszd / töltsd fel.

---

## 6. Telefonra telepítés

1. APK átmásolása telefonra (USB, Drive, stb.).
2. Szükség esetén: **Ismeretlen forrásból** telepítés engedélyezése.
3. APK megnyitása → telepítés.
4. App indulás: **szerver URL** + **enrollment** (QR vagy kézi) — [API_SPEC.md](API_SPEC.md), [android-app/README.md](../android-app/README.md).

---

## 7. HTTP teszt (LAN / emulátor)

Ha a backend **http://** címen fut (nincs HTTPS), a telefon engedélyezze a domain-t:

Fájl: `android-app/app/src/main/res/xml/network_security_config.xml`

| Eszköz | Tipikus domain |
|--------|----------------|
| Emulátor, backend a PC-n | `10.0.2.2` (már benne van) |
| Valódi telefon, backend LAN-on | A **szerver gép IP-je** (pl. `192.168.x.x`) — saját blokkot add hozzá, majd újra build |

`.env`, párosítás, web CORS: [LAN_DEV.md](LAN_DEV.md).

Éles **HTTPS** mellett ezt általában nem kell piszkálni.

---

## 8. GitHub Release

Írd a Release szövegébe: Android APK **saját Firebase + build** alapján készül — lépések: ez a dokumentum.

Feltölthető melléklet: **aláírt APK** (ha csak egy zárt csapat használja).  
Ne tölts fel: `google-services.json`, keystore, jelszó, unsigned APK.

---

## 9. Ha a build elhasal (JDK)

Gyakori hiba parancssorból: *„compatible with **Java 8**”* — a gépen a **`JAVA_HOME`** régi Java 8-ra mutat, miközben az Android pluginnek **11+** kell.

**Android Studio-ban (elég sokszor):**

*Settings → Build, Execution, Deployment → Build Tools → Gradle → **Gradle JDK*** → válaszd: **jbr-17** vagy **Embedded JDK** (Android Studio JBR), **ne** Java 8.

**Windows környezeti változó (állandó javítás):**

`JAVA_HOME` = pl. `C:\Program Files\Android\Android Studio\jbr`  
(ne legyen `...\jre-8...`)

Utána: **File → Invalidate Caches** vagy legalább újra **Gradle sync**.

---

## 10. Opcionális: parancssor

Ha **Android Studio** megvan, maradj a **§4**-nél — ott build + aláírás egy varázslóban van.

A parancssor akkor hasznos, ha CI-ben buildelsz, vagy gyorsan csak **unsigned** APK kell, az aláírást pedig utána Studio-ban vagy `apksigner`-rel csinálod.

### 10.1 Előfeltétel (ugyanaz, mint Studio-nál)

- **`android-app/app/google-services.json`** — §2
- **`android-app`** mappa = parancsok gyökere
- **JDK 17+** a Gradle számára — §9

### 10.2 Gradle JDK (PowerShell, build előtt)

Ha `.\gradlew.bat` **Java 8** hibát ír, egy ablakban (csak erre a buildre):

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd "C:\...\a_hajsza\android-app"
.\gradlew.bat --stop
.\gradlew.bat -version
```

A `-version` sorban **ne** legyen `1.8`. Állandó javítás: Windows **`JAVA_HOME`** → ugyanez a Studio **jbr** mappa (§9).

### 10.3 Release APK fordítása

```powershell
cd android-app
.\gradlew.bat clean assembleRelease
```

| Kimenet | Hol |
|---------|-----|
| Gyakori név | `app\build\outputs\apk\release\app-release-unsigned.apk` |
| Jelentés | **Nincs aláírás** — telefonra általában **nem** megy |

**Debug APK** (gyors teszt, nem release):

```powershell
.\gradlew.bat assembleDebug
```

→ `app\build\outputs\apk\debug\app-debug.apk` (debug kulccsal aláírva, **nem** éles release).

### 10.4 Keystore létrehozása (`keytool`)

Ha már van Studio-ban létrehozott `.jks` / `.keystore`, ezt a lépést **kihagyhatod**.

```powershell
keytool -genkey -v `
  -keystore "$env:USERPROFILE\celkereszt-release.keystore" `
  -alias celkereszt `
  -keyalg RSA -keysize 2048 -validity 10000
```

| Mit jegyezz fel | Miért |
|-----------------|--------|
| A `.keystore` fájl helye | Későbbi buildekhez ugyanaz kell |
| Alias (`celkereszt`) | Aláíráskor kell |
| Store + key jelszó | Elveszítve → nehéz ugyanazzal a kulccsal frissíteni |

**Ne** commitold gitbe.

### 10.5 Unsigned APK aláírása (`apksigner`)

Az Android SDK **build-tools** mappában van az `apksigner.bat` (Studio telepítés után).

1. Melyik build-tools verzió van (a legújabb általában jó):

```powershell
Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\build-tools" | Sort-Object Name -Descending | Select-Object -First 1 Name
```

2. Aláírás (a `34.0.0` sort cseréld a saját mappád nevére, ha más):

```powershell
$bt = "$env:LOCALAPPDATA\Android\Sdk\build-tools\34.0.0"
$apksigner = Join-Path $bt "apksigner.bat"

$unsigned = "app\build\outputs\apk\release\app-release-unsigned.apk"
$signed   = "app\build\outputs\apk\release\celkereszt-1.0.0-signed.apk"
$ks       = "$env:USERPROFILE\celkereszt-release.keystore"

& $apksigner sign --ks $ks --ks-key-alias celkereszt --out $signed $unsigned
```

A parancs kéri a keystore jelszavát. A **`$signed`** fájl telepíthető.

3. Ellenőrzés:

```powershell
& $apksigner verify --verbose $signed
```

„Verified” → kész.

**Egyszerűbb alternatíva:** vidd be az unsigned APK-t Studio-ba: **Build → Generate Signed App Bundle or APK** → válaszd a meglévő keystore-t (§4.3).

### 10.6 Parancssor vs Studio — összehasonlítás

| Lépés | Studio (§4) | Parancssor (§10) |
|-------|-------------|------------------|
| Firebase JSON | Kézi másolás | Ugyanaz |
| Build release | Generate Signed… | `assembleRelease` |
| Aláírás | Varázsló | `apksigner` vagy Studio |
| Keystore | Create new | `keytool` vagy Studio |
| Kezdőknek | **Ajánlott** | Haladó / CI |

---

## 11. Gyakori hibák

| Tünet | Mit nézz |
|-------|----------|
| Build: Java 8 / AGP hiba | §9 — Gradle JDK |
| `google-services.json` hiányzik | §2 — fájl az `app/` alatt |
| Telefon nem telepíti az APK-t | Unsigned volt → §4 **Generate Signed** |
| Nincs push | [FIREBASE_SETUP.md](FIREBASE_SETUP.md) + helyes JSON |
| App nem éri el a szervert | §7 — IP / HTTP engedély |

---

## 12. Kapcsolódó dokumentumok

| Dokumentum | Témakör |
|------------|---------|
| [FIREBASE_SETUP.md](FIREBASE_SETUP.md) | Firebase + backend FCM |
| [INSTALLATION.md](INSTALLATION.md) | Backend helyben |
| [LAN_DEV.md](LAN_DEV.md) | Telefon, helyi IP |
| [API_SPEC.md](API_SPEC.md) | Párosítás, device API |
| [../android-app/README.md](../android-app/README.md) | App modulok, debug |
| [README.md](README.md) | Dokumentációs index |

---

[README a repó gyökerében](../README.md)
