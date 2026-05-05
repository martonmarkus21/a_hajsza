# Adatbázis séma

<p align="center">
  <img src="../frontend/src/assets/images/celkereszt_logomark.png" alt="Célkereszt logomark" width="88" />
</p>

> **Szerepe:** PostgreSQL + TypeORM szerkezet magas szintű áttekintése; élő állapot mellé lásd Redis használat a backend dokumentációjában és a kódban.

---

### Tartalom

1. [Gyors tények](#1-gyors-tények)
2. [Táblacsoportok](#2-táblacsoportok)
3. [Kiemelt táblák](#3-kiemelt-táblák)
4. [Fogalmi kapcsolatok](#4-fogalmi-kapcsolatok)
5. [Index és integritás](#5-indexlési-ötletek)
6. [Üzemeltetési gyakorlat](#6-fejlesztői--üzemeltetési-irányelvek)
7. [Kapcsolódó dokumentumok](#7-kapcsolódó-dokumentumok)

---

## 1. Gyors tények

| Rendszer | Szerepe |
|---|---|
| **PostgreSQL** | Perzisztens adat, audit, előzmények |
| **TypeORM** | Entitások és migrációk (production: synchronize **nem** kapcsol) |
| **Redis** | Élő GPS cache, háttérqueue – nem része ennek az SQL sémakiírásnak |

---

## 2. Táblacsoportok

| Csoport | Táblák | Szerep |
|---|---|---|
| Identitás | `users`, `devices` | Szerepek, eszköz-kötés párhoz |
| Játék | `pairs`, `game_days`, `game_settings`, `game_runtime_state` | Pár, naptár, globál és motor állapot |
| Térképszabály | `geofences`, `geofence_completions` | Geofence játéklogika |
| Esemény | `positions`, `rule_violations`, `captures`, `ck_flags` | Pozíció, szabály, elfogás, CK jelölés |
| Napló | `audit_logs` | Admin-akció követése |

*Tábla nevek egyeznek az `@Entity()` dekorátor **`name`** attribútumaival (`backend/src/entities`).*

---

## 3. Kiemelt táblák

### `game_settings`

Globál rendszerbeállítások. **Logikai singleton**: egy élő sor várható. Mobil enrollment titok tárolása is ide tartozhat.

### `game_runtime_state`

Játékmotor pillanatnaptár: ciklus, időzítők, hogy mikor mehet élő pozíció a térképre (`game-runtime-state.entity.ts` → `game_runtime_state` tábla).

### `pairs`

Pár törzsadatai: hozzárendelt szám (`assignedNumber` / DB oszlop a TypeORM leképezés szerint), aktív jelölő, stb. Eszköz kötése a `devices` táblán keresztül (`pair_id`).

### `positions`

PostgreSQL-ba mentett GPS minták történeti visszanézéshez és admin exportokhoz.

### `rule_violations`

Aktív / feloldott szabálysérülések (típus mező például `game_area_exit`).

### `ck_flags`

Célkereszt állapot rekord páronként, aktív jelzővel és időbélyeggel.

### `audit_logs`

Struktúrált naplósorok admin mozdulatokról és egyes gépi eseményekről.

---

## 4. Fogalmi kapcsolatok

```
pairs ─┬──< positions
       ├──< rule_violations
       ├──< captures
       ├──< ck_flags
       └──< devices (gyakran 1:1 élő páronként users nélkül is)

users ────< audit_logs
```

*(A pontos FK–onDelete viselkedés az entitás `JoinColumn` / `Cascade` beállításaitól függ.)*

---

## 5. Indexlési ötletek

| Tábla | Javasolt kulcs(ok) megfontolása |
|---|---|
| `positions` | `pair_id` + **`timestamp`** lekérdezések |
| `rule_violations` | `pair_id` + **`created_at`** státusz szerint szűréskor |
| `audit_logs` | **`created_at`** idő szerinti lapozás |
| `devices` | **`last_seen_at`** aktivitás kérdéseknél |

---

## 6. Fejlesztői / üzemeltetési irányelvek

- Séma változtatása mindig párosuljon áttekinthető migrációval **production-ben**.
- `development` **`NODE_ENV`** alatt futó synchronize **ne** váljon éles automatizmus helyett.
- `game_settings`: szolgáltatás rétegben előzd meg több konkurens élő sor káoszát (`ensureGameSettings` típus minták).

---

## 7. Kapcsolódó dokumentumok

| Dokumentum | Témakör |
|---|---|
| [API_SPEC.md](API_SPEC.md) | REST rétegek mögött |
| [WEBSOCKET_EVENTS.md](WEBSOCKET_EVENTS.md) | Realtime, nem tárolt események |
| [INSTALLATION.md](INSTALLATION.md) | DB konténer helyben |
