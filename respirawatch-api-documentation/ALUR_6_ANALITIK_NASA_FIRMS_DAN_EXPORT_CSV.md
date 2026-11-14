# Dokumentasi Teknis Alur 6: Fitur Analitik (`Skor Risiko O(1)` & `NASA FIRMS`) dan Ekspor CSV Streaming

Dokumen ini menjelaskan arsitektur komputasi **Skor Risiko Area per Sel Grid (`0–100`)** yang dijalankan secara *batch* setiap 1 jam dan disimpan ke Redis untuk pembacaan $O(1)$, integrasi **Hotspot Karhutla Harian NASA FIRMS** dengan *timeout guard* & cache Redis TTL 12 jam, serta **Eksportir CSV Streaming (`GET /api/export/:clusterId`)** hemat RAM.

---

## 1. Gambaran Arsitektur

```mermaid
sequenceDiagram
    autonumber
    participant Cron as aqiCron.ts (Setiap 1 Jam - "0 * * * *")
    participant Client as Petugas / Analis Kesehatan
    participant Controller as analyticsController / exportController
    participant Service as analyticsService.ts
    participant Redis as Redis (O(1) Hash/JSON & 12h FIRMS Cache)
    participant Mongo as MongoDB (GridCell, Report, Cluster)
    participant External as Open-Meteo Weather & NASA FIRMS API

    rect rgb(240, 249, 255)
        Note over Cron,Redis: 1. Komputasi Batch Skor Risiko Area (Setiap 1 Jam)
        Cron->>Service: computeAllGridRiskScoresBatch()
        Service->>Mongo: Ambil GridCell & Laporan Aktif (72 Jam Terakhir)
        Service->>External: Tarik Cuaca Terkini (Suhu, Kelembapan, Kecepatan Angin)
        loop Untuk setiap GridCell
            Service->>Service: Skor = round(0.5 * Laporan + 0.3 * AQI + 0.2 * Cuaca) [0-100]
        end
        Service->>Redis: HSET analytics:risk_map:hash <gridId> <json> (O(1) Lookup per Sel)
        Service->>Redis: SETEX analytics:risk_map:all (O(1) Lookup Seluruh Peta, TTL 2 Jam)
        Service->>Mongo: GridCell.bulkWrite (vulnerabilityIndex, activeReportCount, riskLevel)
    end

    rect rgb(254, 249, 195)
        Note over Client,External: 2. Integrasi NASA FIRMS Hotspot Harian (TTL 12 Jam + Timeout 8s)
        Client->>Controller: GET /api/analytics/hotspots
        Controller->>Service: getNasaFirmsHotspots(bbox, source, dayRange)
        Service->>Redis: GET analytics:firms:hotspots:<source>:<days>d:<bbox>
        alt Cache HIT (TTL 12 Jam / 43200s)
            Redis-->>Service: Cached Hotspot GeoJSON
        else Cache MISS
            Service->>External: fetch NASA FIRMS CSV (AbortController Timeout 8000ms)
            External-->>Service: CSV Hotspot -> Parse ke GeoJSON FeatureCollection
            Service->>Redis: SETEX analytics:firms:hotspots:... (TTL 43200s / 12 Jam)
        end
        Service-->>Controller: NasaFirmsHotspotResponse
        Controller-->>Client: 200 OK
    end

    rect rgb(220, 252, 231)
        Note over Client,Mongo: 3. Export CSV Streaming Hemat RAM (GET /api/export/:clusterId)
        Client->>Controller: GET /api/export/:clusterId
        Controller->>Mongo: Cluster.findOne(idOrCode).lean()
        Controller->>Mongo: Report.find(reportQuery).populate('kelurahanId').lean().cursor()
        Controller-->>Client: HTTP 200 (Content-Type: text/csv; Transfer-Encoding: chunked)
        loop Stream per Dokumen (Konsumsi RAM O(1))
            Mongo-->>Controller: 1 Dokumen Report dari Cursor
            Controller-->>Client: Transform & Pipe 1 Baris CSV ke Response Stream
        end
        Controller-->>Client: Tutup Stream CSV
    end
```

---

## 2. Komponen & Lokasi File

| Komponen | Path File | Tanggung Jawab |
| :--- | :--- | :--- |
| **Layanan Analitik & NASA FIRMS** | [src/services/analyticsService.ts](file:///Users/lo/Work/respira-watch/backend/src/services/analyticsService.ts) | Formula skor risiko `0.5*Laporan + 0.3*AQI + 0.2*Cuaca`, penyimpanan/pembacaan Redis $O(1)$ (`HSET`/`HGET` & JSON), serta penarikan dan parser CSV hotspot NASA FIRMS dengan timeout `8000ms` & cache TTL 12 jam. |
| **Integrasi Cron 1 Jam** | [src/jobs/aqiCron.ts](file:///Users/lo/Work/respira-watch/backend/src/jobs/aqiCron.ts) | Menjalankan `computeAllGridRiskScoresBatch()` setiap 1 jam (`0 * * * *`) setelah sinkronisasi Open-Meteo selesai. |
| **Controller Analitik** | [src/controllers/analyticsController.ts](file:///Users/lo/Work/respira-watch/backend/src/controllers/analyticsController.ts) & [src/routes/analyticsRoutes.ts](file:///Users/lo/Work/respira-watch/backend/src/routes/analyticsRoutes.ts) | Endpoint `GET /api/analytics/risk-scores`, `POST /api/analytics/risk-scores/compute`, dan `GET /api/analytics/hotspots`. |
| **Eksportir CSV Streaming** | [src/controllers/exportController.ts](file:///Users/lo/Work/respira-watch/backend/src/controllers/exportController.ts) & [src/routes/exportRoutes.ts](file:///Users/lo/Work/respira-watch/backend/src/routes/exportRoutes.ts) | Endpoint `GET /api/export/:clusterId` menggunakan Mongoose Cursor + Node.js `Transform` stream yang di-*pipe* langsung ke `res`. |

---

## 3. Penjelasan Detail Fitur Utama

### 3.1. Skor Risiko Area (`0–100`) & Pembacaan $O(1)$ di Redis
Skor risiko setiap sel grid (`GridCell`) dihitung pada rentang `0–100` dengan 3 sub-komponen terstandarisasi:
1. **Komponen Laporan ($S_{\text{report}} \in [0, 100]$, bobot $0.5$)**:
   - Dihitung dari jumlah laporan aktif dalam 72 jam terakhir pada sel grid, bobot keparahan (`ringan: 1.0`, `sedang: 1.5`, `berat: 2.5`, `kritis: 3.5`), dan jumlah total warga sakit.
2. **Komponen Kualitas Udara / AQI ($S_{\text{aqi}} \in [0, 100]$, bobot $0.3$)**:
   - Dinormalisasi secara proporsional dari rentang US AQI (`0–50` -> `0–20`, `51–100` -> `20–45`, `101–150` -> `45–70`, `151–200` -> `70–85`, `201–300+` -> `85–100`).
3. **Komponen Cuaca ($S_{\text{weather}} \in [0, 100]$, bobot $0.2$)**:
   - Dihitung dari kecepatan angin (`windSpeedKmh` — angin lemah $\le 5\text{ km/j}$ menahan dispersi polutan udara), kelembapan relatif (`humidityPct`), dan suhu udara (`temperatureC`).
4. **Formula Komposit**:
   $$\text{TotalScore} = \text{round}\Big(\text{clamp}_{0..100}\big(0.5 \times S_{\text{report}} + 0.3 \times S_{\text{aqi}} + 0.2 \times S_{\text{weather}}\big)\Big)$$

#### Penyimpanan & Pembacaan $O(1)$ di Redis
Setiap siklus batch 1 jam menyimpan hasil ke Redis menggunakan `redisClient.pipeline()`:
- **`analytics:risk_map:hash` (Redis Hash)**: Menyimpan setiap sel grid dengan field `<gridId>` dan `<cellCode>`. Saat klien meminta 1 sel (`GET /api/analytics/risk-scores?cellCode=GRID-JKT-01`), server mengeksekusi `HGET` dengan kompleksitas waktu **$O(1)$**.
- **`analytics:risk_map:all` (Redis JSON)**: Menyimpan objek peta utuh beserta GeoJSON `FeatureCollection`. Saat klien meminta seluruh peta (`GET /api/analytics/risk-scores`), server mengeksekusi 1 perintah `GET` dengan kompleksitas waktu **$O(1)$**.

---

### 3.2. Integrasi NASA FIRMS (Hotspot Karhutla Harian)
- **Endpoint**: `GET /api/analytics/hotspots` (alias: `GET /api/analytics/firms`)
- **Parameter Query Opsional**:
  - `bbox`: Bounding box koordinat `minLng,minLat,maxLng,maxLat` (default: `95,-11,141,6` wilayah Indonesia).
  - `source`: Sumber instrumen satelit (default: `VIIRS_SNPP_NRT`).
  - `days`: Rentang hari `1–10` (default: `1` hari).
  - `refresh`: `true` untuk memaksa penarikan ulang.
- **Timeout Guard (`8000ms`)**: Menggunakan `AbortController` (`NASA_FIRMS_FETCH_TIMEOUT_MS = 8000`) sehingga jika server NASA FIRMS lambat atau tidak merespons, koneksi langsung dibatalkan dengan aman dan tidak pernah membuat server *hang*.
- **Redis Cache TTL 12 Jam (`43200` detik)**: Disimpan pada kunci `analytics:firms:hotspots:<source>:<days>d:<bbox>`.

---

### 3.3. Export CSV Streaming (`GET /api/export/:clusterId`)
- **Arsitektur Hemat RAM ($O(1)$ Memory Footprint)**:
  - Menggunakan `Report.find(reportQuery).populate('kelurahanId').sort({ reportedAt: -1 }).lean().cursor()` yang membaca dokumen satu per satu dari MongoDB.
  - Setiap dokumen langsung dilewatkan ke `createClusterReportCsvTransformStream()` (`node:stream` `Transform`) dan di-*pipe* langsung ke objek HTTP Response Express (`reportCursor.pipe(csvTransform).pipe(res)`).
  - Jika klien membatalkan unduhan di tengah jalan (`req.on('close')`), cursor MongoDB otomatis ditutup (`reportCursor.close()`) untuk mencegah kebocoran koneksi/memori.
- **Keamanan CSV (Anti-Formula Injection)**:
  - Fungsi `escapeCsvCell()` otomatis menetralkan nilai sel yang diawali karakter formula spreadsheet (`=`, `+`, `-`, `@`) dengan menambahkan prefix tanda kutip tunggal (`'`), serta melakukan *double-quote escaping* (`""`) sesuai standar RFC 4180.
