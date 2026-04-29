# Adatbázis séma

## Táblák

### `pairs`
Párok táblája.

```sql
CREATE TABLE pairs (
  id SERIAL PRIMARY KEY,
  assigned_number INTEGER UNIQUE NOT NULL,
  name VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `devices`
Eszközök (telefonok) táblája.

```sql
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  pair_id INTEGER REFERENCES pairs(id) ON DELETE CASCADE,
  imei_or_device_id VARCHAR(255) UNIQUE NOT NULL,
  fcm_token TEXT,
  last_seen_at TIMESTAMP,
  logged_out_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> Az `imei_or_device_id` egyedi eszközazonosító a bejelentkezéshez és a naplózáshoz (oszlopnév történelmi okból „IMEI”; az Android kliens jellemzően `ANDROID_ID` szerinti azonosítót küld).  
> A `logged_out_at` a kijelentkezéskor áll be; sikeres bejelentkezéskor törlődik. Az utolsó valós szerverkapcsolat ideje a `last_seen_at` mezőben marad megjelenítéshez.

### `positions`
Pozíciók táblája (történeti / időzítő szerinti **minták**; minden egyes app-os GPS-küldés nem feltétlenül kerül ide — lásd API specifikáció, Redis élő réteg).

```sql
CREATE TABLE positions (
  id SERIAL PRIMARY KEY,
  pair_id INTEGER REFERENCES pairs(id) ON DELETE CASCADE,
  lat DECIMAL(10, 8) NOT NULL,
  lon DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  speed DECIMAL(10, 2),
  vehicle_mode BOOLEAN DEFAULT false,
  vehicle_session_remaining INTEGER,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  game_area_snapshot_json JSONB,
  had_rule_violation_at_save BOOLEAN DEFAULT false
);

CREATE INDEX idx_positions_pair_id ON positions(pair_id);
CREATE INDEX idx_positions_timestamp ON positions(timestamp);
CREATE INDEX idx_positions_pair_timestamp ON positions(pair_id, timestamp DESC);
```

> **`game_area_snapshot_json`**: mentéskor aktív `game_area` geofence-ek pillanatképe (név, középpont, sugár, `metadata_json` polygon stb.) — admin térképes nézet / nyomvonal modál.  
> **`had_rule_violation_at_save`**: a minta rögzítésekor volt-e a párnak meg nem oldott szabályszegése (pillanatkép, később nem változik).

### `captures`
Elfogások táblája.

```sql
CREATE TABLE captures (
  id SERIAL PRIMARY KEY,
  pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  captured_by_user_id INTEGER NOT NULL REFERENCES users(id),
  location_id INTEGER REFERENCES positions(id),
  request_id VARCHAR(100) UNIQUE,
  client_timestamp TIMESTAMPTZ,
  timestamp TIMESTAMPTZ NOT NULL,
  captured_lat DOUBLE PRECISION,
  captured_lon DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT UQ_captures_pair_id_unique UNIQUE (pair_id)
);

CREATE INDEX idx_captures_pair_id ON captures(pair_id);
```

> **`pair_id`**: egy párhoz egyszerre legfeljebb egy elfogás (egyedi). **`request_id`**: opcionális kliens-kérés azonosító idempotens ismétléshez (egyedi, ha meg van adva). **`captured_lat` / `captured_lon`**: a rögzítés pillanatában mentett hely (nem feltétlenül egyezik a `location_id` sor koordinátájával). **`location_id`**: ha a hely a legutóbbi PG `positions` sorból lett kötve.

### `mw_flags`
Most Wanted jelzések táblája.

```sql
CREATE TABLE mw_flags (
  id SERIAL PRIMARY KEY,
  pair_id INTEGER REFERENCES pairs(id) ON DELETE CASCADE,
  flagged_by_user_id INTEGER REFERENCES users(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mw_flags_pair_id ON mw_flags(pair_id);
CREATE INDEX idx_mw_flags_active ON mw_flags(active);
```

### `users`
Felhasználók (adminok, celebrendőrök) táblája.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'admin', 'officer'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `game_days`
Játék napok táblája.

```sql
CREATE TABLE game_days (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  special_rules_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_game_days_date ON game_days(date);
```

### `geofences`
Geofence-ek (játéktér, scenariók) táblája.

```sql
CREATE TABLE geofences (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lon DECIMAL(11, 8) NOT NULL,
  radius_m INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  active_from TIMESTAMP,
  active_until TIMESTAMP,
  geofence_type VARCHAR(50) NOT NULL, -- 'game_area', 'scenario', 'crossing_point'
  metadata_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_geofences_active ON geofences(active);
CREATE INDEX idx_geofences_type ON geofences(geofence_type);
```

### `geofence_completions`
Geofence teljesítések táblája.

```sql
CREATE TABLE geofence_completions (
  id SERIAL PRIMARY KEY,
  geofence_id INTEGER REFERENCES geofences(id) ON DELETE CASCADE,
  pair_id INTEGER REFERENCES pairs(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  position_id INTEGER REFERENCES positions(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(geofence_id, pair_id)
);

CREATE INDEX idx_geofence_completions_geofence ON geofence_completions(geofence_id);
CREATE INDEX idx_geofence_completions_pair ON geofence_completions(pair_id);
```

### `audit_logs`
Audit naplók táblája.

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action_type VARCHAR(100) NOT NULL, -- 'capture', 'mw_flag', 'geofence_create', etc.
  entity_type VARCHAR(50), -- 'pair', 'geofence', etc.
  entity_id INTEGER,
  data_json JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
```

### `rule_violations`
Szabályszegések táblája.

```sql
CREATE TABLE rule_violations (
  id SERIAL PRIMARY KEY,
  pair_id INTEGER REFERENCES pairs(id) ON DELETE CASCADE,
  violation_type VARCHAR(100) NOT NULL, -- 'game_area_exit', 'vehicle_time_exceeded', 'crossing_point_violation'
  description TEXT,
  position_id INTEGER REFERENCES positions(id),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rule_violations_pair_id ON rule_violations(pair_id);
CREATE INDEX idx_rule_violations_resolved ON rule_violations(resolved);
```

### `game_runtime_state`
Játékmotor futásidejű állapota (egysoros konfigurációs/állapot tábla).

```sql
CREATE TABLE game_runtime_state (
  id SERIAL PRIMARY KEY,
  campaign_status VARCHAR(50) NOT NULL DEFAULT 'IDLE',
  active_game_day_id INTEGER REFERENCES game_days(id),
  current_cycle_start_at TIMESTAMP,
  current_cycle_end_at TIMESTAMP,
  allow_position_updates_for_map BOOLEAN DEFAULT false,
  last_cycle_turn_at TIMESTAMP,
  last_map_position_at TIMESTAMP,
  pairs_sent_position_this_cycle JSONB DEFAULT '[]',
  last_applied_area_schedule_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Kapcsolatok

- `devices.pair_id` → `pairs.id`
- `positions.pair_id` → `pairs.id`
- `captures.pair_id` → `pairs.id`
- `captures.captured_by_user_id` → `users.id`
- `mw_flags.pair_id` → `pairs.id`
- `mw_flags.flagged_by_user_id` → `users.id`
- `geofence_completions.geofence_id` → `geofences.id`
- `geofence_completions.pair_id` → `pairs.id`
- `audit_logs.user_id` → `users.id`
- `rule_violations.pair_id` → `pairs.id`






