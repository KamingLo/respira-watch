import type { Request, Response } from 'express';
import { getNearestGridAqiByCoords } from '../services/aqiService.js';
import { handleControllerError, sendSuccess } from '../utils/response.js';

/**
 * Controller untuk menangani endpoint `GET /api/aqi`.
 *
 * Menerima parameter query `lat` (latitude) dan `lng` (longitude), mencari sel grid (`GridCell`)
 * terdekat menggunakan operator geospasial `$near` Mongoose, lalu mengambil metrik kualitas udara
 * (PM2.5, PM10, AQI) beserta status kesehatan area untuk ditampilkan pada **Kartu Hasil**.
 *
 * ### Urutan Prioritas Baca & Penanganan Potensi Cache Miss:
 * 1. **Prioritas Utama (Redis Cache Hit)**:
 *    Membaca key `aqi:grid:{grid_id}` di Redis yang diisi melalui mekanisme *Dual-Write* (`SETEX` TTL 2 jam).
 * 2. **Potensi Cache Miss & Fallback MongoDB**:
 *    *Cache Miss* dapat terjadi jika:
 *    - TTL key di Redis (2 jam / 7200 detik) telah habis masa berlakunya,
 *    - Layanan Redis baru di-restart atau sedang terputus, atau
 *    - Sel grid baru diinisialisasi dan belum terkena jadwal eksekusi `aqiCron` per jam.
 *    Saat *Cache Miss* terjadi, sistem otomatis mengeksekusi fallback ke MongoDB (`AqiReading` terbaru
 *    berdasarkan `gridCellId`), memulihkan cache Redis (`SETEX` 2 jam), atau melakukan *live fetch*
 *    ke Open-Meteo API apabila database belum memiliki riwayat untuk sel grid tersebut.
 *
 * @param req - Objek Express Request dengan query parameter `lat` (number) dan `lng` (number)
 * @param res - Objek Express Response yang mengembalikan payload `AqiResultCardResponse`
 * @returns Promise<void>
 */
export const getAqiByCoordinates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng } = req.query;
    const resultCardData = await getNearestGridAqiByCoords(lat, lng);

    sendSuccess(
      res,
      resultCardData,
      'Data kualitas udara dan status area berhasil dimuat.',
      200
    );
  } catch (error) {
    handleControllerError(
      res,
      error,
      'AqiController.getAqiByCoordinates',
      'Gagal memuat data kualitas udara (AQI) untuk lokasi tersebut.'
    );
  }
};
