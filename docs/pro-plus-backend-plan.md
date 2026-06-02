# Pruva Pro+ Backend (MVP + Phase 2)

## 1) Mimari karar ozeti

- **API style:** REST + JSON, `v1` prefix (`/api/v1/pro-plus/*`).
- **Execution model:** request-time lightweight scoring (MVP), background recompute jobs (Phase 2).
- **Data model:** PostgreSQL normalized core tables + JSONB side payloads for model outputs.
- **Explainability first:** risk score mutlaka breakdown ile doner (UI aciklamasi icin).
- **Offline-first sync:** device cursor tabanli delta stream.
- **Security baseline:** JWT access + refresh rotation, audit log, abuse throttling.

### MVP vs Phase 2

- **MVP (2 hafta):**
  - Route risk analysis endpoint
  - Route recommendation endpoint (safest/shortest/fuel_efficient)
  - Fuel profile + cost estimate
  - Alert rules/events temel modeli
  - Private logbook
  - Delta sync cursor
  - Anchorage intelligence snapshot read endpoint
- **Phase 2:**
  - ML crowd forecast pipeline
  - Similar anchorage embedding service
  - Real-time captain mode streaming
  - Advanced route graph optimization
  - Push orchestration and smart batching

### iOS contract

- Tum endpointler bearer token ister.
- iOS tarafi `x-idempotency-key` headerini create-type endpointlerde gondermeli.
- Zaman alanlari ISO-8601 UTC string.

## 2) API tasarimi

### Versioning stratejisi

- URL versioning: `/api/v1/pro-plus`.
- Breaking degisiklikte `v2`.
- Non-breaking alan eklemeleri `v1` icinde serbest.

### Rate limiting

- Auth endpointleri: `10 req/min/user`.
- Analiz endpointleri (`/routes/analyze`, `/routes/recommend`): `30 req/min/user`.
- Sync endpointleri: `120 req/min/device`.

### Idempotency

- `POST /cost-estimates`, `POST /logbook/private`, `POST /alerts/rules` icin `x-idempotency-key` desteklenmeli.
- Backend, key + user bazli 24 saat cache ile duplicate create'i engeller.

### REST endpoint listesi (MVP)

- `POST /api/v1/pro-plus/routes/analyze`
- `POST /api/v1/pro-plus/routes/recommend`
- `GET /api/v1/pro-plus/anchorages/:anchorageId/intelligence`
- `GET /api/v1/pro-plus/fuel-profile`
- `PUT /api/v1/pro-plus/fuel-profile`
- `POST /api/v1/pro-plus/cost-estimates`
- `GET /api/v1/pro-plus/alerts/rules`
- `POST /api/v1/pro-plus/alerts/rules`
- `GET /api/v1/pro-plus/alerts/events`
- `GET /api/v1/pro-plus/logbook/private`
- `POST /api/v1/pro-plus/logbook/private`
- `GET /api/v1/pro-plus/sync/delta`
- `POST /api/v1/pro-plus/sync/ack`

Detayli schema: `docs/openapi/pro-plus-v1.yaml`.

## 3) Veri modeli

Migration draft: `scripts/migrations/20260429_pro_plus_mvp.sql`.

Kritik entityler:
- `users`
- `captain_verifications`
- `pro_routes`
- `route_segment_risks`
- `weather_snapshots`
- `anchorage_intelligence`
- `crowd_forecasts`
- `fuel_profiles`
- `cost_estimates`
- `alert_rules`
- `alert_events`
- `private_logbook_entries`
- `sync_changes`
- `device_sync_cursors`
- `audit_logs`

### iOS contract

- Entity id alanlari UUID string.
- `breakdown`, `threshold`, `scope`, `weather` gibi alanlar dictionary decode edilmeli.

## 4) Risk motoru

Segment score (0-100):

- `wind`: 23%
- `gust`: 17%
- `wave`: 25%
- `current`: 12%
- `visibility`: 15%
- `rain`: 8%
- `night penalty`: +20 flat

Formul:

`score = clamp(sum(weighted factors) + nightPenalty, 0, 100)`

Threshold:
- `0-44`: low
- `45-69`: medium
- `70-100`: high

### Breakdown format

```json
{
  "score": 62,
  "level": "medium",
  "breakdown": {
    "wind": 58,
    "gust": 50,
    "wave": 70,
    "current": 20,
    "visibility": 30,
    "rain": 10,
    "night": 20
  }
}
```

### Kalibrasyon

- Ilk 2 hafta retrospective calibration: gercek olaylar vs score.
- Her hafta percentile tabanli threshold review.
- False positive > %20 ise medium/high siniri +5 artirilir.

### iOS contract

- UI segment card'larinda `breakdown` bar chart gosterebilir.
- `level` renk map: low=green, medium=orange, high=red.

## 5) Rota onerileri motoru

Multi-objective:
- **safest:** risk min, distance tolerant
- **shortest:** distance min, risk capped
- **fuel_efficient:** weather-adjusted fuel min

Input:
- start/end/waypoints
- boat profile (`cruise_speed_kn`, `burn_rate_lph`)
- weather window

Output:
- Alternative route list
- For each route: `distance_nm`, `eta_hours`, `risk_score`, `fuel_l`

### iOS contract

- Top tab: `Safest`, `Shortest`, `Fuel`.
- Compare sheet shows these 4 metrics side by side.

## 6) Anchorage intelligence

Best anchor time:
- Hourly score from historical weather, crowd data, and wave trends.
- Returns a 0-100 comfort score and the top 3 windows.

Crowd forecast:
- Historical check-ins plus weekday/hour seasonality.
- Output: `expected_boats`, `confidence`.

Similar anchorage recommendations:
- MVP: feature-based cosine (depth, shelter, swell exposure, crowd profile).
- Phase 2: embedding model + ANN index.

### iOS contract

- Intelligence API returns a single response with:
  - `best_anchor_windows`
  - `ai_summary`
  - `crowd_forecast[]`
  - `similar_anchorages[]`

## 7) Bildirim sistemi

Rule engine (IF-THIS-THEN-THAT):
- if `wind_kn > threshold` then `alert_event`.
- if `risk_score crosses high` then critical alert.
- if `crowd forecast exceeds threshold` then congestion alert.

Dedup/cooldown:
- `dedup_key = user + type + scope + 30min bucket`
- active cooldown boyunca tekrar push yok.

Quiet hours:
- rule-level `quiet_hours_start/end`.
- critical severity quiet hours bypass opsiyonlu.

### iOS contract

- iOS, notification settings ekraninda rule CRUD yapar.
- Badge count `/alerts/events` unread hesabina gore client-side hesaplanabilir (MVP).

## 8) Offline sync backend

Delta strategy:
- Server-side `sync_changes` append-only stream.
- Device `since_cursor` ile incremental fetch.

Conflict resolution:
- MVP: last-write-wins (server timestamp authoritative).
- Phase 2: field-level merge (logbook note/tag merge policy).

Device cursor:
- `(user_id, device_id)` unique row, `last_cursor` saklar.

### iOS contract

- App foreground refresh:
  1. `/sync/delta?device_id=...&since_cursor=...`
  2. local apply
  3. `/sync/ack` with new cursor

## 9) Guvenlik

- JWT access (15-30 dk) + refresh token rotation (30 gun).
- Token theft mitigation: refresh token family invalidation.
- Private logbook row access: `WHERE user_id = req.user.id`.
- Audit log:
  - profile updates
  - captain verification actions
  - alert rule changes
  - logbook create/update/delete
- Abuse controls:
  - per-user throttles
  - suspicious IP burst denylist
  - idempotency replay guard

## 10) 2 haftalik MVP backlog (oncelikli)

### Hafta 1

1. DB migration + indexes + smoke tests
2. Pro+ auth route/controller scaffold
3. Route analyze endpoint + breakdown payload
4. Fuel profile + cost estimate endpoint
5. OpenAPI + contract tests

### Hafta 2

1. Alerts rule/event CRUD + cooldown logic
2. Private logbook CRUD (MVP create/list)
3. Sync delta/ack endpoint + cursor persistence
4. Anchorage intelligence read model endpoint
5. iOS integration test checklist + staging hardening
