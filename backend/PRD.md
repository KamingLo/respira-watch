# Product Requirements Document (PRD) — RespiraWatch Backend API

---

## 1. Gambaran Umum Produk (Product Overview)
 
### 1.1. Apa Itu RespiraWatch?
**RespiraWatch** adalah platform **WebGIS Pemantauan Kualitas Udara & Peringatan Dini Penyakit Lingkungan (ISPA & Diare)** berbasis spasial (*Geospatial Intelligence*) dan partisipasi warga (*Crowdsourcing*).

Sistem ini menggabungkan dua sumber data utama secara *real-time*:
1. **Data Partisipatif Warga (Bottom-Up):** Laporan keluhan kesehatan warga (ISPA dan Diare) beserta gejala, jumlah penderita, tingkat keparahan, dan titik koordinat lokasi.
2. **Data Kualitas Udara, Cuaca, & Polutan (Top-Down):** Metrik polutan udara ($PM_{2.5}, PM_{10}$, AQI) dan cuaca yang ditarik secara berkala dari **Open-Meteo API** serta titik api (Karhutla) dari **NASA FIRMS API**, dipetakan ke dalam satuan sel grid geospasial (`GridCell`).

### 1.2. Tujuan Utama Sistem
- **Deteksi Dini Klaster Penyakit:** Mengidentifikasi lonjakan kasus ISPA/Diare secara otomatis menggunakan algoritma DBSCAN (*Spatial-Temporal*) sebelum berkembang menjadi wabah.
- **Transparansi Peta Publik dengan Privasi Terjaga (*Privacy-by-Design*):** Menampilkan sebaran laporan warga (*heatmap*) tanpa membocorkan titik rumah presisi (menggunakan algoritma *Coordinate Jittering* 100–200 meter di level memori).
- **Edukasi & Kartu Hasil:** Memberikan informasi kualitas udara dan rekomendasi aktivitas instan kepada warga.
- **Kesiapsiagaan Petugas:** Menyediakan dasbor *real-time* berbasis peran (RBAC) dan wawasan berbantuan *Generative AI* untuk intervensi lapangan yang tepat sasaran.

### 1.3. Target Pengguna (User Personas)
| Persona | Role Sistem | Hak Akses & Aktivitas Utama |
| :--- | :--- | :--- |
| **Warga Umum** | Publik (Tanpa Login) | Lapor keluhan (`POST /api/reports`), lihat peta publik (`GET /api/map`), cek Kartu Hasil AQI (`GET /api/aqi`), dan input keluhan berbasis teks bebas (`POST /api/ai/classify`). |
| **Petugas Lapangan** | `field_officer` | Melihat data klaster *real-time*, melihat titik koordinat presisi (tanpa *jittering*), mengubah status penanganan laporan & klaster. |
| **Analis Kesehatan** | `health_analyst` | Memantau tren korelasi polusi udara vs penyakit, membaca ringkasan AI (`GET /api/clusters/:id/summary`), mengekspor data CSV/PDF. |
| **Admin Sistem** | `admin` | Kelola master data `Kelurahan`, akun `Officer`, dan penugasan wilayah. |

---

## 2. Tech Stack & Arsitektur Infrastruktur

| Lapisan | Teknologi | Kegunaan dalam RespiraWatch |
| :--- | :--- | :--- |
| **Runtime & Bahasa** | Node.js + TypeScript (ESM) | Eksekusi server modern berbasis ES Modules dengan *strict typing*. |
| **Web Framework** | Express.js | Routing REST API, middleware pipeline, dan sekuriti (`helmet`). |
| **Database & GIS** | MongoDB + Mongoose | Penyimpanan dokumen dan komputasi geospasial (`2dsphere`, `$near`). |
| **In-Memory Cache** | Redis (`ioredis`) | *Caching* peta publik, AQI per grid, ringkasan AI, dan state *rate limiter*. |
| **Spasial Komputasi**| Turf.js (`@turf/turf`) | Mesin algoritma spasial di Node.js (`clusters-dbscan`, `convex`). |
| **Real-time Engine** | Socket.io | *Broadcast* WebSocket saat laporan/klaster baru muncul (Dasbor Petugas). |
| **Rate Limiting** | `express-rate-limit` | Membatasi laporan warga (1 laporan/jam) berbasis `device_hash` di Redis. |
| **Background Cron** | `node-cron` | Sinkronisasi Open-Meteo (1 jam), deteksi klaster DBSCAN (10 menit). |
| **Generative AI** | Google Gemini API | Memetakan teks bebas ke gejala JSON baku & merangkum laporan klaster. |

---

## 3. Struktur Direktori Backend

```text
backend/
├── src/
    ├── index.ts                 # Entrypoint server, bootstrap DB, Redis, WebSockets, Cron Jobs
    ├── config/                  # database.ts (Mongo), redis.ts (ioredis), socket.ts (Socket.io)
    ├── models/                  # Skema Mongoose berindeks 2dsphere (GeoJSON)
    │   ├── Officer.ts, Kelurahan.ts, GridCell.ts, Report.ts, AqiReading.ts, Cluster.ts
    ├── middlewares/             # authMiddleware.ts (JWT), rateLimitMiddleware.ts (Redis limiter)
    ├── utils/                   # AppError.ts, response.ts, cache.ts, jwt.ts, password.ts
    ├── services/                
    │   ├── authService.ts, officerService.ts, kelurahanService.ts, reportService.ts
    │   ├── aqiService.ts        # Open-Meteo dual-write service
    │   ├── clusterService.ts    # Algoritma Turf.js DBSCAN & clustering logic
    │   ├── aiService.ts         # Integrasi Google Gemini API
    │   └── analyticsService.ts  # Hitung skor risiko & tarik data NASA FIRMS
    ├── controllers/             # Handler HTTP untuk tiap entitas (report, cluster, ai, export, dll)
    ├── routes/                  # Definisi routing Express
    ├── jobs/                    
    │   ├── aqiCron.ts           # Cron 1 jam: Tarik cuaca/AQI
    │   └── clusterCron.ts       # Cron 10 menit: Eksekusi DBSCAN
    └── templates/               # (Prepared) Template ekspor CSV/PDF