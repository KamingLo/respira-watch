# RespiraWatch — Backend WebGIS API

Official backend service for **RespiraWatch**, a **WebGIS Air Quality Monitoring & Environmental Disease Early Warning Platform (ISPA / Acute Respiratory Infection & Diarrhea)** powered by geospatial intelligence and citizen crowdsourcing.

---

## Table of Contents

- [1. Purpose & Overview](#1-purpose--overview)
- [2. Technical Specifications (Specs)](#2-technical-specifications-specs)
  - [Tech Stack](#tech-stack)
  - [Architecture & Data Flow](#architecture--data-flow)
  - [Data Models (MongoDB + 2dsphere)](#data-models-mongodb--2dsphere)
  - [Core Algorithms & Feature Specs](#core-algorithms--feature-specs)
  - [Background Cron Jobs](#background-cron-jobs)
  - [Real-Time Engine (Socket.io)](#real-time-engine-socketio)
  - [Security, Privacy & Caching Strategy](#security-privacy--caching-strategy)
  - [Directory Structure](#directory-structure)
- [3. How to Use](#3-how-to-use)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration (`.env`)](#environment-configuration-env)
  - [Database Seeding & System Diagnostics](#database-seeding--system-diagnostics)
  - [Running the Server](#running-the-server)
  - [REST API Endpoint Reference](#rest-api-endpoint-reference)
  - [Quick Usage Examples](#quick-usage-examples)
  - [Additional API Documentation](#additional-api-documentation)

---

## 1. Purpose & Overview

RespiraWatch combines two real-time data streams into a single spatial intelligence backend:
1. **Bottom-Up Citizen Reporting:** Health symptom reports (`ispa` and `diare`) containing symptoms, sick count, patient age, severity level, and GeoJSON coordinates.
2. **Top-Down Environmental & Pollution Data:** Air quality metrics (PM2.5, PM10, CO, NO2, SO2, O3, US AQI) and weather telemetry fetched from the **Open-Meteo API**, plus wildfire/hotspot detections from the **NASA FIRMS API**, mapped onto geospatial grid cells (`GridCell`).

### Core Objectives
- **Early Disease Cluster Detection:** Automatically identify spatial-temporal spikes in ISPA and diarrhea cases before they escalate into outbreaks using **DBSCAN** clustering and **Convex Hull** boundary generation.
- **Privacy-Preserving Public Transparency (Privacy-by-Design):** Publish public disease maps and heatmaps using in-memory **Coordinate Jittering (100–200 meters)** so exact residential coordinates remain protected in the database.
- **Air Quality & Composite Area Risk Scoring:** Deliver nearest-grid AQI Result Cards and compute a weighted area risk score (`0.5 * Report + 0.3 * AQI + 0.2 * Weather`) stored in Redis for `O(1)` lookup.
- **Generative AI Triage & Cluster Summaries:** Convert free-text citizen complaints into standardized JSON payloads and generate factual, anti-hallucination executive cluster summaries using the **Google Gemini API** (backed by prompt-injection defense and deterministic fallbacks).
- **Officer Readiness & Real-Time Operations:** Power an authenticated **Socket.io** officer dashboard with role-based access control (RBAC), regional management, and memory-safe streaming CSV exports.

### User Roles (RBAC)
| Role | Access & Primary Capabilities |
| :--- | :--- |
| **Public (Unauthenticated)** | Submit/update citizen reports (`POST /api/reports`), view jittered public map (`GET /api/map`), check nearest AQI card (`GET /api/aqi`), classify free-text complaints (`POST /api/ai/classify`), inspect active clusters, AI summaries, risk scores, and hotspots. |
| **`field_officer`** | Connect to Socket.io with exact report coordinates, monitor clusters in real time, and update cluster handling status (`PATCH /api/clusters/:id`). |
| **`health_analyst`** | Analyze environmental risk trends and NASA FIRMS hotspots, review AI cluster summaries, update cluster status, and download streaming CSV cluster exports. |
| **`admin`** | All operational officer capabilities plus full CRUD management of `Kelurahan` regions, `Officer` accounts, and regional assignments (`assign-kelurahan`). |

---

## 2. Technical Specifications (Specs)

### Tech Stack

Based on [package.json](./package.json) and [tsconfig.json](./tsconfig.json):

| Layer | Technology & Version | Purpose |
| :--- | :--- | :--- |
| **Runtime & Language** | Node.js + TypeScript (`^7.0.2`), ESM (`ES2022`, `NodeNext`, `strict: true`) | Modern ES Module backend execution with strict static typing. |
| **Web Framework** | Express (`^5.3.0`), `cors` (`^2.8.6`), `node:http` | REST API routing, CORS handling, and shared HTTP server for Socket.io. |
| **Database & GIS** | MongoDB + Mongoose (`^9.12.1`) | Document persistence and geospatial queries (`2dsphere`, `$near`, `$geoIntersects`, `$geoWithin`). |
| **Cache & Rate-Limit Store** | Redis (`ioredis` `^6.0.0`) | Caching for maps, grid AQI, clusters, AI summaries, NASA FIRMS, `O(1)` risk scores, and rate-limiter state. |
| **Spatial Computation** | Turf.js (`@turf/clusters-dbscan`, `@turf/convex`, `@turf/helpers` `^7.2.0`) | DBSCAN spatial clustering and cluster boundary polygon generation. |
| **Real-Time Engine** | Socket.io (`^4.8.4`) | Real-time broadcast of incoming reports and cluster updates to officer dashboards. |
| **Auth & Security** | `jose` (`^6.2.17`), `bcryptjs` (`^3.0.3`), `express-rate-limit` (`^8.7.4`), `rate-limit-redis` (`^6.0.2`) | `HS256` JWT tokens, bcrypt password hashing (10 salt rounds), and per-device cooldown rate limiting. |
| **Scheduler** | `node-cron` (`^4.6.0`) | Automated AQI/weather sync and DBSCAN clustering in `Asia/Jakarta` timezone. |
| **External APIs** | Open-Meteo API, NASA FIRMS API, Google Gemini API | Pollutant & weather metrics, VIIRS fire hotspots, and Generative AI triage/summaries. |

### Architecture & Data Flow

```text
Citizen / Officer Dashboard
   |
   +-- HTTP REST (/api/* or /*) --> Express 5 + Middlewares (JWT RBAC / Redis Rate Limiter)
   |                                      |
   |                                      v
   |                                 Controllers --> Services
   |                                                   |-- MongoDB (2dsphere Geospatial)
   |                                                   |-- Redis (Cache, O(1) Hash, Rate Limit)
   |                                                   |-- Turf.js (DBSCAN + Convex Hull)
   |                                                   +-- External APIs (Open-Meteo, FIRMS, Gemini)
   |
   +-- WebSocket (Socket.io) <----- JWT Handshake Guard (io.use) + Rooms (officers, role:*, kelurahan:*)
```

### Data Models (MongoDB + 2dsphere)

All geospatial schemas use GeoJSON `[longitude, latitude]` coordinates with `2dsphere` indexes in [src/models/](./src/models):

| Model | File | Description & Spatial Indexes |
| :--- | :--- | :--- |
| **`Kelurahan`** | [Kelurahan.ts](./src/models/Kelurahan.ts) | Administrative ward master data (code, kecamatan, kota, provinsi, population, `baselineRiskLevel`: `low` / `moderate` / `high` / `critical`). `2dsphere` index on `boundary` (`Polygon`) and `centroid` (`Point`). |
| **`Officer`** | [Officer.ts](./src/models/Officer.ts) | Officer accounts (`admin`, `field_officer`, `health_analyst`), unique NIP, unique email, `passwordHash` (`select: false`), `assignedKelurahan`, and `baseLocation` (`2dsphere`). |
| **`GridCell`** | [GridCell.ts](./src/models/GridCell.ts) | Spatial monitoring cells (`currentAqi`, `dominantPollutant`, `activeReportCount`, `vulnerabilityIndex`, `riskLevel`). `2dsphere` index on `geometry` & `centroid`. |
| **`AqiReading`** | [AqiReading.ts](./src/models/AqiReading.ts) | Time-series AQI & weather snapshots (`pm25`, `pm10`, `co`, `no2`, `so2`, `o3`, temperature, humidity, wind speed & direction). `2dsphere` index on `location`. |
| **`Report`** | [Report.ts](./src/models/Report.ts) | Citizen reports (`ispa` / `diare`), symptoms, `sickCount`, `age`, `severity` (`ringan`/`sedang`/`berat`/`kritis` and English equivalents), `deviceHash`, workflow status, and exact `geom` & `location` (`2dsphere`). |
| **`Cluster`** | [Cluster.ts](./src/models/Cluster.ts) | Detected DBSCAN clusters (`clusterCode`, `category`, `center` `2dsphere`, `boundary` `2dsphere`, `radiusMeters`, `reportCount`, `totalSickCount`, `averageAqi`, `dominantSymptoms`, `riskStatus`, `status`). |

### Core Algorithms & Feature Specs

1. **Citizen Reporting, Upsert & Privacy Jittering (`reportService.ts`):**
   - Supports bilingual input keys (e.g., `kategori`/`category`, `gejala`/`symptoms`, `jumlah_sakit`/`sickCount`, `usia`/`age`, `tingkat_keparahan`/`severity`, `device_hash`/`deviceHash`).
   - **Rate Limiter:** Allows `1` request per `device_hash` (or IP fallback) every `1` hour (default `3600000` ms) backed by Redis (`rl:reports:device:<key>`). Failed validations (`4xx`) do not consume quota (`skipFailedRequests: true`), and the limiter fails open if Redis is unavailable (`passOnStoreError: true`).
   - **Device-Based Upsert:** When the same `deviceHash` submits again after the cooldown window, the existing report is updated (`200 OK`) instead of creating duplicates (`201 Created`).
   - **Auto-Kelurahan Matching:** Automatically resolves `kelurahanId` from `geom` using MongoDB `$geoIntersects`.
   - **Public Jittering:** `GET /api/map` applies a random **100–200 meter** coordinate offset in memory before returning `points`, `geoJson` (`FeatureCollection`), and `heatmap`.

2. **Spatial-Temporal DBSCAN Clustering (`clusterService.ts`):**
   - Queries non-rejected reports (`status != 'rejected'`) from the **last 72 hours**, processed separately by category (`ispa` and `diare`).
   - Runs `@turf/clusters-dbscan` with max distance **0.5 km (500 m)** and **`minPoints: 5`**.
   - Builds cluster boundary polygons using `@turf/convex` (falling back to an 8-vertex circle polygon if points are collinear).
   - Generates deterministic `clusterCode` values (`CLU-<CATEGORY>-<LAT>-<LNG>`) and merges with nearby active clusters within 500 m.
   - **Cluster Risk Classification:**
     - **`Prioritas` (Red / `#EF4444`):** `reportCount >= 15`, or `(reportCount >= 10 && AQI > 150)`, or `(ISPA && reportCount >= 8 && AQI > 200)`, or `totalSickCount >= 25`.
     - **`Siaga` (Orange / `#F97316`):** `reportCount >= 8`, or `(reportCount >= 5 && AQI > 100)`, or `totalSickCount >= 12`.
     - **`Waspada` (Yellow / `#EAB308`):** Any remaining valid cluster (`>= 5` reports).
   - Previously `active` clusters that no longer meet thresholds in the latest run are automatically marked `resolved`.

3. **Air Quality (Open-Meteo) & `O(1)` Area Risk Scoring (`aqiService.ts`, `analyticsService.ts`):**
   - Fetches `pm2_5`, `pm10`, `us_aqi`, `european_aqi`, `carbon_monoxide`, `nitrogen_dioxide`, `sulphur_dioxide`, and `ozone` from Open-Meteo per `GridCell`, then dual-writes to MongoDB (`AqiReading` + `GridCell`) and Redis (`aqi:grid:<gridId>`, **2-hour TTL** / `7200s`). Falls back to US EPA PM2.5 breakpoints if `us_aqi` is unavailable.
   - `GET /api/aqi?lat=...&lng=...` locates the nearest `GridCell` via `$near`, checks Redis first, and falls back to MongoDB or live Open-Meteo fetch.
   - **Composite Area Risk Score (0–100):** Computed per `GridCell` using non-rejected reports within `1500 m` (last 72 hours), grid AQI, and live Open-Meteo weather (`temperature_2m`, `relative_humidity_2m`, `wind_speed_10m`):
     ```text
     Composite Risk Score = (0.5 * Report Score) + (0.3 * AQI Score) + (0.2 * Weather Score)
     ```
   - Batch results are persisted in Redis Hash `analytics:risk_map:hash` (indexed by both `gridId` and `cellCode`) and JSON key `analytics:risk_map:all` (2-hour TTL) for **`O(1)` `HGET` lookups** on `GET /api/analytics/risk-scores?cellCode=...`.
   - **NASA FIRMS Hotspots:** Fetches VIIRS CSV data (`VIIRS_SNPP_NRT`, default Indonesia bbox `95,-11,141,6`, 8s timeout) and caches results in Redis for **12 hours** (`43200s`), with graceful fallback if `NASA_FIRMS_MAP_KEY` is unset or upstream times out.

4. **Generative AI & Guardrails (`aiService.ts`):**
   - Calls the **Google Gemini** REST API (default model `gemini-flash-latest`, 15s timeout) using `responseMimeType: 'application/json'` and strict `responseSchema` enforcement.
   - **Complaint Triage (`POST /api/ai/classify`):** Validates length (5–1000 chars), blocks English/Indonesian prompt-injection patterns, wraps user input in `<citizen_complaint_text>` tags, and provides a keyword-based heuristic fallback when the API key is missing, rate-limited, or timed out (unless `?strict=true`).
   - **Cluster Summary (`GET /api/clusters/:id/summary`):** Injects exact MongoDB statistics inside `<FAKTA_DATABASE_KLASTER>` to prevent numerical hallucination, caches output in Redis for **12–24 hours** (default `43200s`), and includes a deterministic narrative fallback.

5. **Streaming CSV Export (`exportController.ts`):**
   - `GET /api/export/:clusterId` streams report documents from a MongoDB cursor (`Report.find(...).cursor()`) through a Node.js `Transform` stream directly to the HTTP response.
   - Prepends a UTF-8 BOM (`\uFEFF`) for Excel compatibility and neutralizes CSV formula injection for cells starting with `=`, `+`, `-`, or `@`.

### Background Cron Jobs

Initialized on server startup in [src/index.ts](./src/index.ts) using the `Asia/Jakarta` (WIB) timezone with concurrency locks to prevent overlapping runs:

| Job | File | Schedule | Behavior |
| :--- | :--- | :--- | :--- |
| **AQI & Risk Score Sync** | [aqiCron.ts](./src/jobs/aqiCron.ts) | `0 * * * *` (Hourly) + on boot | Syncs Open-Meteo air quality for every `GridCell`, dual-writes to MongoDB & Redis, and recomputes batch area risk scores. |
| **DBSCAN Cluster Detection** | [clusterCron.ts](./src/jobs/clusterCron.ts) | `*/10 * * * *` (Every 10 min) + on boot | Runs 72-hour DBSCAN clustering, upserts clusters, invalidates Redis caches, and broadcasts Socket.io events. |

### Real-Time Engine (Socket.io)

Socket.io shares the Express HTTP server ([src/config/socket.ts](./src/config/socket.ts)):
- **Mandatory JWT Handshake Auth:** `io.use(...)` validates the `HS256` JWT from `socket.handshake.auth.token`, `Authorization: Bearer <token>` header, or `query.token`, and checks that the `Officer` record has `isActive: true`.
- **Auto-Joined Rooms:** Authenticated officers automatically join `officers`, `role:<role>`, and `kelurahan:<assignedKelurahan>` (if assigned).
- **Server -> Client Events:**
  - `connection:authenticated` — Emitted on connect with officer profile metadata and joined rooms.
  - `report:new` — Broadcast when a citizen report is created or updated via `POST /api/reports` (includes exact `geom` coordinates for officers).
  - `cluster:detected` — Broadcast when a DBSCAN cycle detects or updates active clusters.
  - `cluster:updated` — Broadcast when cluster status is modified via `PATCH /api/clusters/:id`.
- **Client -> Server Events:**
  - `ping:dashboard` — Returns acknowledgment `{ pong: true, timestamp }`.

### Security, Privacy & Caching Strategy

- **Passwords & JWT:** Passwords are hashed with `bcryptjs` (10 rounds); JWTs are signed with `HS256` via `jose` (default expiration `8h`).
- **Fail-Open Redis:** The server remains operational even if Redis is offline (`connectRedis()` logs a warning without crashing, cache reads return `null`, and the rate limiter passes requests through).
- **Automatic Cache Invalidation:** Report writes invalidate `map_cache:*`; cluster detections or updates invalidate `clusters:list:*`, `clusters:detail:*`, `clusters:summary:*`, and `map_cache:*`; officer/kelurahan mutations invalidate related profile and list keys.

### Directory Structure

```text
backend/
|-- .env.example                 # Environment variable template
|-- package.json                 # Dependencies and npm/pnpm scripts
|-- tsconfig.json                # TypeScript ESM config (NodeNext)
`-- src/
    |-- index.ts                 # HTTP + Socket.io entrypoint, DB/Redis/Cron bootstrap
    |-- routes.ts                # Central API router aggregation
    |-- config/
    |   |-- database.ts          # MongoDB connection (Mongoose autoIndex)
    |   |-- redis.ts             # ioredis connection with lazyConnect & retry strategy
    |   `-- socket.ts            # Socket.io server, JWT handshake guard & emitters
    |-- models/                  # Mongoose schemas with GeoJSON 2dsphere indexes
    |-- middlewares/             # authMiddleware.ts (JWT + RBAC), rateLimitMiddleware.ts
    |-- routes/                  # Domain route definitions (auth, officers, kelurahans, etc.)
    |-- controllers/             # HTTP request/response handlers & CSV streaming
    |-- services/                # Business logic, DBSCAN, Open-Meteo, NASA FIRMS, Gemini AI
    |-- jobs/                    # Background cron jobs (aqiCron.ts, clusterCron.ts)
    |-- sockets/                 # Socket module re-export
    |-- seeders/                 # masterSeeder.ts (full seed + diagnostics), officerSeeder.ts
    |-- templates/               # Reserved directory for export templates
    `-- utils/                   # AppError, cache helpers, jwt, password, response formatter
```

---

## 3. How to Use

### Prerequisites

Ensure the following tools and services are available:
- **Node.js** `>= 20 LTS` (tested on `v24.21.0`)
- **pnpm** `>= 10` (tested on `12.18.0`)
- **MongoDB** (local at `127.0.0.1:27017` or MongoDB Atlas)
- **Redis** (local at `127.0.0.1:6379` or Redis Cloud — recommended for caching, `O(1)` risk scores, and rate limiting)

### Installation

```bash
cd backend
pnpm install
```

### Environment Configuration (`.env`)

Copy [.env.example](./.env.example) to `.env` and configure your values:

```bash
cp .env.example .env
```

All environment variables read by the backend source code:

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `4000` | HTTP and Socket.io listening port. |
| `NODE_ENV` | No | `development` | Application environment mode. |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin for Socket.io. |
| `MONGODB_URI` | Yes* | `mongodb://127.0.0.1:27017/respirawatch` | MongoDB connection URI. |
| `REDIS_URL` | No | `redis://127.0.0.1:6379` | Redis connection URI. |
| `JWT_SECRET` | Yes (Prod) | `respirawatch_super_secret_jwt_key_change_in_prod` | Secret key for signing `HS256` JWT tokens. |
| `JWT_EXPIRES_IN` | No | `8h` | Officer JWT expiration duration. |
| `GEMINI_API_KEY` | Optional | *(empty)* | Google Gemini API key. If empty, AI endpoints fall back to heuristic/deterministic mode. |
| `GEMINI_MODEL` | No | `gemini-flash-latest` | Gemini model identifier used for generation. |
| `AI_SUMMARY_CACHE_TTL_SECONDS` | No | `43200` | Redis cache TTL for cluster AI summaries (clamped between `43200`s / 12h and `86400`s / 24h). |
| `NASA_FIRMS_MAP_KEY` | Optional | *(empty)* | NASA FIRMS `MAP_KEY` for live satellite hotspots (also accepts `FIRMS_API_KEY` alias). |
| `REPORT_RATE_LIMIT_WINDOW_MS` | No | `3600000` | Citizen report cooldown window in milliseconds (default 1 hour). |
| `REPORT_RATE_LIMIT_MAX` | No | `1` | Maximum reports per `device_hash` within one cooldown window. |

> **Note:** Never commit `.env*` files containing live credentials to version control (already ignored via [`.gitignore`](./.gitignore)).

### Database Seeding & System Diagnostics

Available seeding commands in [package.json](./package.json):

```bash
# 1. Master Seeder + Full System Diagnostics (Flows 1-6; resets DB & Redis by default)
pnpm seed
# or explicitly:
pnpm seed:fresh

# 2. Master Seeder in append mode (keeps existing records)
pnpm seed:append

# 3. Minimal Seeder for 3 initial Kelurahans & 3 Officers only (supports --fresh)
pnpm seed:officers
```

**Data populated by `pnpm seed` (Master Seeder):**
- **8 Kelurahans** across Jakarta (Gambir, Manggarai, Senayan, Kebon Melati, Cawang, Pluit, Kelapa Gading Barat, Kalideres)
- **8 Officer Accounts** across all roles (`admin`, `field_officer`, `health_analyst`)
- **8 GridCells** & **24 AqiReadings** synced to Redis
- **105 Citizen Reports** (7 dense zones designed to trigger ISPA & diarrhea clusters + sporadic noise reports)
- Runs automated verification checks for Flows 1–6: DBSCAN clustering, Socket.io JWT handshake, prompt-injection defense, AI classification & summary, `O(1)` risk scores, NASA FIRMS, and CSV streaming.

**Default Seeded Login Accounts:**
| Role | Email | Password |
| :--- | :--- | :--- |
| `admin` | `admin@respirawatch.id` | `Password123!` |
| `field_officer` | `field@respirawatch.id` | `Password123!` |
| `health_analyst` | `analyst@respirawatch.id` | `Password123!` |

### Running the Server

**Development Mode (Hot Reload via `tsx watch`):**
```bash
pnpm dev
```

**Production Mode (Compile TypeScript to `dist/` and run with Node.js):**
```bash
pnpm build
pnpm start
```

Verify the server is running:
```bash
curl http://localhost:4000/api/health
```

### REST API Endpoint Reference

All API routes are mounted under **`/api`** (and aliased directly at root **`/`**). Standard JSON responses follow this envelope:
```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

#### 1. Health & Authentication
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Returns service health, Redis status, and WebSocket availability. |
| `POST` | `/api/auth/login` | Public | Authenticates an officer (`email`, `password`) and returns a JWT Bearer token. |
| `GET` | `/api/auth/me` | JWT (Any Role) | Returns the authenticated officer profile (cached in Redis). |

#### 2. Citizen Reports & Public Map
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/reports` | Public (Rate-Limited) | Creates or upserts a citizen report (`ispa`/`diare`). 1-hour cooldown per `device_hash`. Broadcasts `report:new`. |
| `GET` | `/api/map` | Public (Cached) | Returns public map points & heatmap with **100–200m Coordinate Jittering**. Optional filters: `category`/`kategori`, `severity`/`tingkat_keparahan`, `status`, `kelurahanId`, `startDate`, `endDate`, `bbox`. |

#### 3. Air Quality (AQI) & Risk Analytics
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/aqi?lat=<lat>&lng=<lng>` | Public | Returns the nearest grid's AQI Result Card, pollutant breakdown, and health advice. |
| `GET` | `/api/analytics/risk-scores` | Public | Returns all grid risk scores, or a single cell in `O(1)` via `?gridId=...` / `?cellCode=GRID-JKT-02` (supports `?refresh=true`). |
| `POST` | `/api/analytics/risk-scores/compute` | Public | Triggers batch area risk score recomputation and updates Redis Hash & JSON caches. |
| `GET` | `/api/analytics/hotspots` *(alias: `/api/analytics/firms`)* | Public | Returns NASA FIRMS fire hotspots (12h Redis cache). Optional query params: `bbox`, `source`, `days` (1–10), `refresh=true`. |

#### 4. Disease Clusters & CSV Export
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/clusters` | Public (5m Cache) | Lists clusters. Optional filters: `category`/`kategori`, `level`/`riskLevel`/`riskStatus` (`Waspada`/`Siaga`/`Prioritas`), `status` (`active`/`monitoring`/`resolved`/`all`), `kelurahanId`. |
| `GET` | `/api/clusters/:id` | Public (5m Cache) | Retrieves cluster detail by MongoDB ObjectId or `clusterCode`. |
| `POST` | `/api/clusters/detect` | Public | Manually triggers DBSCAN clustering outside the 10-minute cron schedule. |
| `PATCH` | `/api/clusters/:id` | JWT (`admin`, `field_officer`, `health_analyst`) | Updates cluster `status` (`active`/`monitoring`/`resolved`) and/or `assignedOfficerId`, invalidates caches, and broadcasts `cluster:updated`. |
| `GET` | `/api/export/:clusterId` | Public | Streams all member reports of a cluster as a downloadable CSV file (accepts ObjectId or `clusterCode`). |

#### 5. Generative AI (Triage & Cluster Summaries)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/classify` | Public | Extracts free-text complaints (`text`/`keluhan`) into structured JSON (`category`, `symptoms`, `severity`, `sickCount`, `recommendedAction`). Add `?strict=true` to disable heuristic fallback. |
| `GET` | `/api/clusters/:id/summary` | Public (12–24h Cache) | Returns a factual MongoDB statistics + Gemini AI executive summary. Supports `?refresh=true` and `?strict=true`. |

#### 6. Master Data: Kelurahans & Officers
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/kelurahans` *(alias: `/api/kelurahan`)* | JWT (Any Role) | Lists wards. Optional filters: `kecamatan`, `kota`, `provinsi`, `baselineRiskLevel`, `search`. |
| `GET` | `/api/kelurahans/:id` | JWT (Any Role) | Gets ward details along with assigned officers. |
| `POST` | `/api/kelurahans` | JWT (`admin`) | Creates a ward with GeoJSON `boundary` & `centroid`. |
| `PUT` / `PATCH` | `/api/kelurahans/:id` | JWT (`admin`) | Updates ward data. |
| `DELETE` | `/api/kelurahans/:id` | JWT (`admin`) | Deletes a ward (blocked with `409` if officers are still assigned). |
| `GET` | `/api/officers` | JWT (Any Role) | Lists officers. Optional filters: `role`, `isActive`, `assignedKelurahan`, `search`. |
| `GET` | `/api/officers/:id` | JWT (Any Role) | Retrieves officer profile details. |
| `POST` | `/api/officers` | JWT (`admin`) | Creates a new officer account. |
| `PUT` / `PATCH` | `/api/officers/:id` | JWT (`admin`) | Updates officer details or active status. |
| `PATCH` | `/api/officers/:id/assign-kelurahan` | JWT (`admin`) | Assigns or unassigns an officer's ward. |
| `DELETE` | `/api/officers/:id` | JWT (`admin`) | Deletes an officer account (self-deletion is blocked). |

### Quick Usage Examples

**1. Officer Login to Obtain a JWT Token:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@respirawatch.id",
    "password": "Password123!"
  }'
```

**2. Submit a Citizen Report (`POST /api/reports`):**
```bash
curl -X POST http://localhost:4000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "kategori": "ispa",
    "gejala": ["batuk kering", "sesak napas"],
    "jumlah_sakit": 2,
    "usia": 30,
    "tingkat_keparahan": "sedang",
    "device_hash": "device-demo-jakarta-001",
    "geom": {
      "type": "Point",
      "coordinates": [106.845599, -6.208763]
    }
  }'
```

**3. Query Nearest AQI & `O(1)` Risk Score:**
```bash
curl "http://localhost:4000/api/aqi?lat=-6.208763&lng=106.845599"
curl "http://localhost:4000/api/analytics/risk-scores?cellCode=GRID-JKT-02"
```

**4. Classify Free-Text Complaint with AI:**
```bash
curl -X POST http://localhost:4000/api/ai/classify \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Sejak pagi anak saya batuk berdahak dan sesak karena asap pembakaran sampah.",
    "usia": 8,
    "jumlah_sakit": 1
  }'
```

**5. Connect via Socket.io (JS/TS Client):**
```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: { token: '<OFFICER_JWT_TOKEN>' },
});

socket.on('connection:authenticated', (info) => console.log('Connected rooms:', info.rooms));
socket.on('report:new', (payload) => console.log('New report:', payload));
socket.on('cluster:detected', (payload) => console.log('Clusters detected:', payload));
socket.on('cluster:updated', (payload) => console.log('Cluster updated:', payload));
```

### Additional API Documentation

For full payload contracts, test scenarios, and the Bruno API collection, see [../respirawatch-api-documentation/](../respirawatch-api-documentation/):
- [Flow 1: Reporting & Public Map](../respirawatch-api-documentation/ALUR_1_PELAPORAN_DAN_PETA_PUBLIK.md)
- [Flow 2: Open-Meteo AQI](../respirawatch-api-documentation/ALUR_2_OPEN_METEO_AQI.md)
- [Flow 3: Spatial-Temporal Cluster Detection](../respirawatch-api-documentation/ALUR_3_DETEKSI_KLASTER_SPASIAL_TEMPORAL.md)
- [Flow 4: Real-Time Socket & Officer Dashboard](../respirawatch-api-documentation/ALUR_4_REALTIME_SOCKET_DAN_DASBOR_PETUGAS.md)
- [Flow 5: Generative AI Classification & Summary](../respirawatch-api-documentation/ALUR_5_AI_GENERATIVE_KLASIFIKASI_DAN_RINGKASAN.md)
- [Flow 6: NASA FIRMS Analytics & CSV Export](../respirawatch-api-documentation/ALUR_6_ANALITIK_NASA_FIRMS_DAN_EXPORT_CSV.md)
