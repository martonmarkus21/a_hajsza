# Firebase Cloud Messaging (FCM) Beállítás

Az üzenetküldés funkció működéséhez Firebase beállítás szükséges. Ez a dokumentum általános útmutatót nyújt a Firebase Cloud Messaging (FCM) konfigurálásához a projektben, anélkül hogy konkrét adatokat tartalmazna.

## Projekt információk

**Firebase Projekt:**
- **Project ID**: `<YOUR_PROJECT_ID>`
- **Project Number**: `<YOUR_PROJECT_NUMBER>`
- **Auth Domain**: `<YOUR_PROJECT_ID>.firebaseapp.com`
- **Storage Bucket**: `<YOUR_PROJECT_ID>.firebasestorage.app`

Ezeket az információkat a Firebase Console-ban találod meg a projekt beállításai alatt.

## Backend beállítás (Service Account)

A backend Firebase Admin SDK-t használ, ami service account credentials-et igényel.

### 1. Service Account Key létrehozása

1. Menj a [Firebase Console](https://console.firebase.google.com/)-ba
2. Válaszd ki a megfelelő projektet
3. Kattints a **Project Settings** (fogaskerék ikon) menüpontra
4. Menj a **Service Accounts** fülre
5. Kattints a **Generate new private key** gombra
6. A letöltött JSON fájl tartalmazza a szükséges adatokat

**Biztonsági figyelmeztetés:** A letöltött JSON fájlt soha ne add hozzá a verziókezelő rendszerhez (pl. Git). Használj környezeti változókat vagy biztonságos tárolást.

### 2. Backend .env fájl beállítása

Hozz létre egy `.env` fájlt a `backend/` mappában (vagy használd a meglévőt) és add hozzá a következő változókat:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=<YOUR_PROJECT_ID>
FIREBASE_PRIVATE_KEY="<YOUR_PRIVATE_KEY>"
FIREBASE_CLIENT_EMAIL=<YOUR_CLIENT_EMAIL>
```

**Fontos:**
- A `FIREBASE_PRIVATE_KEY` értékét a letöltött JSON fájlból másold ki (a `private_key` mező). Ügyelj arra, hogy a `\n` karaktereket megtartsd a private key-ben.
- A `FIREBASE_CLIENT_EMAIL` értéke a letöltött JSON fájlban a `client_email` mező.
- Soha ne commitold a `.env` fájlt a verziókezelőbe. Használd a `.gitignore` fájlt ennek biztosítására.

**Példa a letöltött JSON fájl struktúrájára:**
```json
{
  "type": "service_account",
  "project_id": "<YOUR_PROJECT_ID>",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "<YOUR_CLIENT_EMAIL>",
  ...
}
```

### 3. Cloud Messaging API engedélyezése

1. Menj a [Google Cloud Console](https://console.cloud.google.com/)-ba
2. Válaszd ki a megfelelő projektet
3. Menj az **APIs & Services** > **Library** menüpontra
4. Keress rá a "Firebase Cloud Messaging API"-ra
5. Kattints rá és engedélyezd, ha még nincs engedélyezve

## Android App beállítás

1. **Firebase Console** > **Project Settings** > **Cloud Messaging**
2. Ha még nincs Android app hozzáadva:
   - Kattints az **Add app** gombra
   - Válaszd az **Android** ikont
   - Add meg a package name-t (pl. `com.yourcompany.yourapp`)
   - Töltsd le a `google-services.json` fájlt
   - Helyezd el az `android-app/app/` mappába

**Megjegyzés:** A `google-services.json` fájl tartalmazza az alkalmazás-specifikus konfigurációt. Ne add hozzá a verziókezelőhöz.

## Web Config (Frontend - opcionális)

Ha a frontend-ben is használni szeretnéd a Firebase-t, használd a következő konfigurációs objektumot (a Firebase Console-ból másold ki a pontos értékeket):

```javascript
const firebaseConfig = {
  apiKey: "<YOUR_API_KEY>",
  authDomain: "<YOUR_PROJECT_ID>.firebaseapp.com",
  projectId: "<YOUR_PROJECT_ID>",
  storageBucket: "<YOUR_PROJECT_ID>.firebasestorage.app",
  messagingSenderId: "<YOUR_PROJECT_NUMBER>",
  appId: "<YOUR_APP_ID>"
};
```

Ezeket az értékeket a Firebase Console **Project Settings** > **General** > **Your apps** > **Web app** alatt találod.

## Tesztelés

1. Indítsd el a backend-et
2. Ellenőrizd a konzol kimenetét - látnod kellene: `Firebase initialized`
3. Ha hiba van, ellenőrizd:
   - A `.env` fájlban lévő értékeket (helyesek-e és kitöltöttek-e)
   - A Cloud Messaging API engedélyezve van-e
   - A service account key helyes-e és nem járt-e le

## Jelenlegi állapot

Az FCM service működik, de csak akkor küld üzeneteket, ha a Firebase credentials be vannak állítva a `.env` fájlban.

Ha nincs beállítva, a rendszer figyelmeztetést ír ki: `Firebase credentials not provided, FCM disabled`, de nem hibázik. Ez lehetővé teszi a fejlesztést anélkül, hogy minden környezetben Firebase lenne konfigurálva.

## További ajánlások

- **Környezetek kezelése:** Használj különböző Firebase projekteket fejlesztési, staging és production környezetekhez.
- **Biztonság:** Rendszeresen forgasd a service account kulcsokat és monitorozd a használatukat.
- **Dokumentáció:** További információkért lásd a [Firebase dokumentációt](https://firebase.google.com/docs).