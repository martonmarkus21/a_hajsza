# WebSocket események

## Kapcsolat

WebSocket namespace: `/ws/game`

Csatlakozás:
```javascript
const socket = io('wss://api.example.com/ws/game', {
  auth: {
    token: 'jwt_token_here'
  }
});
```

## Kliens → Szerver események

### `subscribe:positions`
Előfizetés pozíció frissítésekre.

```json
{
  "gameId": "optional_game_id"
}
```

### `unsubscribe:positions`
Leiratkozás pozíció frissítésekről.

## Szerver → Kliens események

### `positionUpdate`
Új pozíció érkezett.

```json
{
  "pairId": 1,
  "lat": 47.4979,
  "lon": 19.0402,
  "accuracy": 10.5,
  "speed": 0,
  "timestamp": "2024-01-15T10:30:00Z",
  "vehicleMode": false
}
```

### `capture`
Pár elfogva.

```json
{
  "pairId": 1,
  "capturedBy": {
    "id": 1,
    "username": "officer1"
  },
  "timestamp": "2024-01-15T10:35:00Z"
}
```

### `mwHighlight`
Most Wanted jelzés aktiválva/deaktiválva.

```json
{
  "pairId": 1,
  "active": true,
  "flaggedBy": {
    "id": 1,
    "username": "officer1"
  },
  "timestamp": "2024-01-15T10:40:00Z"
}
```

### `geofenceAlert`
Geofence esemény (belépés, kilépés, teljesítés).

```json
{
  "type": "completion", // 'entry', 'exit', 'completion'
  "geofenceId": 1,
  "geofenceName": "Balaton tű",
  "pairId": 1,
  "timestamp": "2024-01-15T10:45:00Z"
}
```

### `ruleViolation`
Szabályszegés észlelve vagy megszűnése.

```json
{
  "pairId": 1,
  "violationType": "game_area_exit",
  "description": "Pár kilépett a játéktérből",
  "continuousMode": true,
  "resolved": false,
  "timestamp": "2024-01-15T10:50:00Z",
  "createdAt": "2024-01-15T10:50:00Z"
}
```

> **Megjegyzés**: Ha `resolved: true`, a szabályszegés megszűnt (a pár visszatért a
> játékterületre). A `continuousMode` ilyenkor `false` értékű.

### `pairStatusUpdate`
Pár státusz változás (aktív, inaktív, stb.).

```json
{
  "pairId": 1,
  "status": "active",
  "changes": {
    "captured": false,
    "mostWanted": true
  },
  "timestamp": "2024-01-15T10:55:00Z"
}
```

### `gameAreaUpdate`
Játéktér frissítés (admin).

```json
{
  "activeCounties": ["Pest", "Fejér"],
  "activeRegions": ["dunatol_keleti"],
  "updatedBy": 1,
  "timestamp": "2024-01-15T11:00:00Z"
}
```

### `error`
Hiba esemény.

```json
{
  "code": "ERROR_CODE",
  "message": "Hibaüzenet",
  "timestamp": "2024-01-15T11:05:00Z"
}
```






