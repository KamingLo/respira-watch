# Dokumentasi Backend Alur 1: Pelaporan Warga & Peta Publik (Express + TypeScript)

Dokumen ini menjelaskan spesifikasi teknis, arsitektur, validasi, rate-limiting, privasi spasial (*Jittering*), dan strategi *caching* Redis pada **Alur 1 RespiraWatch**.

---

## 1. Ringkasan Endpoint

| Method | Endpoint | Akses | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/reports` *(alias: `/reports`)* | Publik (Rate-Limited per `device_hash`) | Menerima laporan warga baru atau meng-update laporan yang sudah ada jika `device_hash` sama, lalu menghapus cache peta publik (`delCache('map:public:*')`). |
| `GET` | `/api/map` *(alias: `/map`)* | Publik (Cached di Redis) | Mengembalikan titik laporan (dengan koordinat *jittered* 100–200m di memori) dan layer *heatmap* beserta ringkasan statistik. |

---

## 2. Detail Endpoint `POST /api/reports`

### Aturan Validasi Input
Endpoint mendukung penamaan atribut dalam **Bahasa Indonesia** maupun **Bahasa Inggris**:

| Field Input | Tipe | Wajib | Aturan Validasi |
| :--- | :--- | :---: | :--- |
| `kategori` / `category` | `string` | Ya | Harus bernilai `'ispa'` atau `'diare'` (case-insensitive). |
| `gejala` / `symptoms` | `string[]` \| `string` | Ya | Array string minimal 1 gejala tidak kosong (atau string dipisahkan koma). |
| `jumlah_sakit` / `sickCount` | `number` | Ya | Bilangan bulat (`integer`) $\ge 1$. |
| `usia` / `age` | `number` | Ya | Bilangan bulat (`integer`) antara `0` hingga `120`. |
| `tingkat_keparahan` / `severity` | `string` | Ya | `'ringan'`, `'sedang'`, `'berat'`, `'kritis'` (atau `'mild'`, `'moderate'`, `'severe'`, `'critical'`). |
| `device_hash` / `deviceHash` | `string` | Ya | String identitas perangkat minimal 4 karakter. |
| `geom` / `location` | `GeoJSON Point` | Ya | `{ "type": "Point", "coordinates": [longitude, latitude] }` dengan `lng` $\in [-180, 180]$ dan `lat` $\in [-90, 90]$. |
| `reporterName` / `nama_pelapor` | `string` | Opsional | Default: `'Warga Anonim'`. |
| `description` / `deskripsi` | `string` | Opsional | Deskripsi tambahan kondisi/sumber keluhan. |

### Contoh Request Body (`POST /api/reports`)
```json
{
  "kategori": "ispa",
  "gejala": ["batuk kering", "sesak napas", "demam"],
  "jumlah_sakit": 2,
  "usia": 34,
  "tingkat_keparahan": "sedang",
  "device_hash": "dev-hash-warga-tebet-001",
  "geom": {
    "type": "Point",
    "coordinates": [106.845599, -6.208763]
  },
  "reporterName": "Warga Manggarai",
  "description": "Asap pembakaran sampah menyebabkan 2 anggota keluarga batuk dan sesak."
}
```

### Perilaku Cooldown Rate-Limit (1 Jam) & Upsert `device_hash`
1. **Rate Limit (`express-rate-limit` + `rate-limit-redis`)**:
   - Menggunakan kunci `rl:reports:device:<device_hash>`.
   - `windowMs`: `3600000` ms (**1 jam**) dengan `max: 1`.
   - `skipFailedRequests: true`: Jika payload gagal validasi (`400 Bad Request`), kuota cooldown perangkat tidak hangus.
   - `passOnStoreError: true`: Jika Redis sedang mati, middleware melakukan *fail-open* secara mulus tanpa menghentikan layanan.
   - Jika perangkat yang sama mengirim ulang dalam masa cooldown 1 jam, server mengembalikan **`429 Too Many Requests`**.
2. **Upsert Berdasarkan `device_hash`**:
   - Jika `device_hash` belum pernah terdaftar di koleksi `Report`, sistem membuat dokumen baru dan mengembalikan **`201 Created`**.
   - Jika `device_hash` sudah ada di database (dan masa cooldown 1 jam sudah lewat), sistem **cukup meng-update** dokumen laporan milik `device_hash` tersebut (tanpa membuat dokumen duplikat) dan mengembalikan **`200 OK`**.
3. **Auto-Spatial Kelurahan Matching**:
   - Sistem secara otomatis mencocokkan titik `geom` dengan poligon batas wilayah Kelurahan menggunakan query MongoDB `$geoIntersects`.

---

## 3. Detail Endpoint `GET /api/map`

### Parameter Query (Opsional & Dinamis)
| Query Param | Contoh | Deskripsi |
| :--- | :--- | :--- |
| `category` / `kategori` | `ispa` atau `diare` | Memfilter laporan berdasarkan kategori penyakit. |
| `severity` / `tingkat_keparahan` | `sedang`, `berat`, dll. | Memfilter berdasarkan tingkat keparahan. |
| `status` | `pending`, `verified`, dll. | Memfilter berdasarkan status verifikasi laporan. |
| `kelurahanId` | `6af5331bda87e443aea245da` | Memfilter laporan pada satu wilayah Kelurahan tertentu. |
| `startDate` & `endDate` | `2026-11-01` | Rentang tanggal waktu pelaporan (`reportedAt`). |
| `bbox` | `106.80,-6.25,106.90,-6.15` | Bounding box spasial `minLng,minLat,maxLng,maxLat` (`$geoWithin: $box`). |

### Logika Jittering 100–200 Meter di Level Memori
Demi melindungi privasi warga agar titik koordinat rumah presisi tidak terekspos ke publik:
- Koordinat asli disimpan secara utuh di MongoDB (`geom` & `location`).
- Saat `GET /api/map` membaca dokumen dari MongoDB, fungsi `applyCoordinateJitter([lng, lat], 100, 200)` menggeser koordinat di memori sejauh jarak acak $d \in [100, 200]$ meter dengan sudut arah acak $\theta \in [0, 2\pi)$:
  $$\Delta \text{lat} = \frac{d \cdot \cos(\theta)}{111320}, \quad \Delta \text{lng} = \frac{d \cdot \sin(\theta)}{111320 \cdot \cos(\text{lat})}$$
- Atribut sensitif seperti `deviceHash` dan `reporterContact` tidak disertakan pada output publik.

### Strategi Caching Aman & Cache Invalidation
1. **Dynamic Cache Key**:
   - Dibangun menggunakan `buildFilterCacheKey('map:public', filter)`:
     - Tanpa filter: `map:public:all`
     - Dengan filter: `map:public:category=ispa&severity=sedang`
2. **Cache Invalidation Instan (`delCache`)**:
   - Setiap kali `POST /api/reports` berhasil menyimpan atau memperbarui laporan, `invalidatePublicMapCache()` memanggil `delCache('map:public:*')` yang melakukan `SCAN` + `DEL` pada seluruh kunci `map:public:*`.
3. **Graceful Fallback ke MongoDB**:
   - Apabila Redis mengalami gangguan saat proses pembacaan (`getCache`), error ditangkap dengan aman dan sistem otomatis mengambil data langsung dari MongoDB tanpa mengembalikan error ke pengguna.
