# RespiraWatch

**Warga lapor gejala. Peta langsung menunjukkan di mana klaster mulai terbentuk.**

Tahun ini lebih dari 14 juta orang di Indonesia kena ISPA. Masalahnya, data kasus biasanya baru terkumpul seminggu sekali dari Puskesmas dan rumah sakit. Waktu lonjakannya ketahuan, satu kelurahan sudah keburu ramai yang sakit.

RespiraWatch memotong jeda itu. Warga mengirim laporan gejala ISPA atau diare dari HP, tanpa daftar akun. Laporan itu digabung dengan data kualitas udara dari Open-Meteo. Setiap 10 menit, sistem mengecek apakah ada laporan yang mengumpul di satu area. Kalau ada, area itu ditandai di peta lengkap dengan level risikonya, jadi petugas tahu harus turun ke mana dulu.

- Demo live: ``
- API: ``
- Video demo: ``

<!-- tambah dokumentasi!!!  -->

---

## Daftar Isi

1. [Tim](#tim)
2. [Tentang Aplikasi](#tentang-aplikasi)

---

## Tim

**Nama tim:** Kalau menang kita joget brazil di panggung

| Nama | Peran |
| --- | --- |
| Carmen Jessalyn Tjong Malik | Team Lead & Technical Documentation |
| Leticia Michelle Purba | UI/UX Designer |
| Jessica Winola | Front-End Developer |
| Kaming | Back-End Developer |

---

## Tentang Aplikasi

Kategori: Web

Nama Aplikasi: RespiraWatch

Tema: NextGen Digital Innovation: Crafting Creative Solutions for a Better Society

Track: Inclusive Health and Well-being


### Masalah yang di angkat

Data Kementerian Kesehatan per pertengahan Oktober 2026 mengungkap salah satu data penting yaitu sebanyak **14.088.948 jiwa terpapar ISPA***. Krisis ini kian bereskalasi akibat kabut asap karhutla yang menyumbang **401.586 kasus tambahan di 63 kabupaten/kota** hanya dalam waktu kurang dari tiga minggu (per 2 November).

Sayangnya, statistik resmi tersebut memiliki keterbatasan akibat fenomena _undercounting_ (kasus yang tidak tercatat). Realitas di lapangan menunjukkan tingginya jumlah kasus ISPA yang luput dari pemantauan fasilitas kesehatan formal. Masyarakat yang merawat anggota keluarganya di rumah karena menganggapnya "sekadar flu biasa", atau warga di area dengan akses kesehatan terbatas, pada akhirnya tidak terinklusi dalam data nasional. Akibatnya, terdapat _blind spot_ (titik buta) yang signifikan dalam pemetaan krisis ini.

Lebih jauh, mitigasi kesehatan kita saat ini terhambat oleh **fragmentasi data (data silos)**. Data klinis pasien dan metrik kualitas udara berada di ekosistem yang terisolasi. Untuk melacak apakah lonjakan kasus pernapasan di suatu RW berkorelasi dengan perburukan kualitas udara, petugas kesehatan harus memvalidasinya secara manual. Proses ini lambat, tidak efisien, dan menunda respons mitigasi yang seharusnya bisa dilakukan lebih awal.


### Solusi kami
Untuk memutus rantai keterlambatan deteksi tersebut, kami menghadirkan RespiraWatch dengan pendekatan teknologi berikut:
1. Pelaporan Instan & Privacy-First: Sistem memungkinkan siapa pun melapor tanpa perlu login dengan sekadar memasukkan gejala, jumlah penderita, dan lokasi. Laporan langsung masuk ke peta publik dengan pengacakan koordinat otomatis (fuzzing) 100-200 meter untuk menjamin anonimitas privasi pelapor.
2. Integrasi Parameter Udara Otonom: Secara real-time di belakang layar, server menarik metrik udara esensial (PM2.5, PM10, dan AQI) dari Open-Meteo setiap jam tanpa memerlukan intervensi manual.
3. Pemetaan Klaster Berbasis Algoritma: Setiap 10 menit, algoritma DBSCAN bekerja memindai anomali dari laporan dalam 72 jam terakhir. Area dengan minimal 5 laporan dalam radius 500 meter akan otomatis divisualisasikan sebagai klaster.
4. Penilaian Risiko Multivariabel: Tingkat bahaya dari sebuah klaster dikalkulasi secara dinamis berdasarkan akumulasi jumlah laporan, rasio jumlah penderita, dan silang-data dengan kualitas udara lokal di sekitarnya.
5. Radar Peringatan Dini (Early Warning System): RespiraWatch bukanlah alat diagnosis klinis, melainkan penyedia sinyal awal spasial. Keputusan medis tetap di tangan tenaga kesehatan, namun kini mereka dipersenjatai dengan data yang jauh lebih cepat, komprehensif, dan tepat sasaran.

### Siapa yang memakai

| Pengguna | Akses | Yang bisa dilakukan |
| --- | --- | --- |
| Warga | Tanpa login | Melapor, melihat peta publik, mengecek AQI di sekitar rumah |
| Petugas lapangan (`field_officer`) | Login | Melihat data petugas dan kelurahan |
| Analis kesehatan (`health_analyst`) | Login | Melihat data petugas dan kelurahan |
| Admin (`admin`) | Login | Mengatur data kelurahan, akun petugas, dan wilayah tugas |

---

