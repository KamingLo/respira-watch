import cron, { type ScheduledTask } from 'node-cron';
import { ensureDefaultGridCells, syncSingleGridCellAqi } from '../services/aqiService.js';

/**
 * Ekspresi jadwal Cron: berjalan setiap 1 jam tepat pada menit ke-0 ('0 * * * *')
 */
export const AQI_CRON_SCHEDULE = '0 * * * *';

/**
 * Flag mutex in-memory untuk mencegah eksekusi cron bertumpuk (overlap)
 * apabila penarikan data ke Open-Meteo pada siklus sebelumnya belum selesai.
 */
let isAqiCronRunning = false;

/**
 * Referensi instance ScheduledTask node-cron yang aktif
 */
let scheduledTaskInstance: ScheduledTask | null = null;

/**
 * Mengecek apakah proses sinkronisasi AQI sedang berjalan.
 *
 * @returns `true` jika cron sedang mengeksekusi penarikan data, `false` jika idle
 */
export const getIsAqiCronRunning = (): boolean => isAqiCronRunning;

/**
 * Menjalankan satu siklus penuh penarikan data kualitas udara (PM2.5, PM10, AQI)
 * dari Open-Meteo API untuk seluruh `GridCell` aktif, lalu melakukan **Dual-Write**:
 * 1. Simpan riwayat cuaca ke MongoDB (`AqiReading` & update `GridCell`).
 * 2. Lakukan operasi `SETEX` (TTL 2 jam / 7200 detik) ke Redis untuk AQI terbaru per `grid_id`.
 *
 * Dilengkapi pengaman anti-overlap (`isAqiCronRunning`) dan blok `try-catch-finally` berlapis
 * sehingga kegagalan jaringan pada satu sel grid tidak mematikan keseluruhan proses cron.
 *
 * @returns Ringkasan jumlah sel grid yang berhasil dan gagal disinkronkan
 */
export const runAqiSyncJob = async (): Promise<{
  skipped: boolean;
  totalGrids: number;
  successCount: number;
  failureCount: number;
}> => {
  // Cegah eksekusi bertumpuk (anti-overlap guard)
  if (isAqiCronRunning) {
    console.warn(
      '[AqiCron] Eksekusi dilewati (SKIP): siklus penarikan data Open-Meteo sebelumnya masih berjalan.'
    );
    return {
      skipped: true,
      totalGrids: 0,
      successCount: 0,
      failureCount: 0,
    };
  }

  isAqiCronRunning = true;
  const startedAt = Date.now();
  let totalGrids = 0;
  let successCount = 0;
  let failureCount = 0;

  try {
    console.log(
      `[AqiCron] Memulai sinkronisasi data Open-Meteo (PM2.5, PM10, AQI) pada ${new Date().toISOString()}...`
    );

    const gridCells = await ensureDefaultGridCells();
    totalGrids = gridCells.length;

    for (const gridCell of gridCells) {
      try {
        const { cachedPayload } = await syncSingleGridCellAqi(gridCell);
        successCount += 1;
        console.log(
          `[AqiCron] Grid ${gridCell.cellCode} (${gridCell._id.toString()}) tersinkronisasi -> AQI: ${cachedPayload.aqi}, PM2.5: ${cachedPayload.pm25}, PM10: ${cachedPayload.pm10}`
        );
      } catch (cellError) {
        failureCount += 1;
        console.error(
          `[AqiCron] Gagal menyinkronkan GridCell ${gridCell.cellCode} (${gridCell._id.toString()}):`,
          cellError
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log(
      `[AqiCron] Siklus selesai dalam ${durationMs}ms | Total Grid: ${totalGrids}, Sukses: ${successCount}, Gagal: ${failureCount}`
    );
  } catch (error) {
    console.error('[AqiCron] Terjadi kesalahan tak terduga saat menjalankan AQI Cron Job:', error);
  } finally {
    // Pastikan lock selalu dilepas meskipun terjadi exception
    isAqiCronRunning = false;
  }

  return {
    skipped: false,
    totalGrids,
    successCount,
    failureCount,
  };
};

/**
 * Menginisialisasi dan menjalankan jadwal `node-cron` setiap 1 jam (`0 * * * *`)
 * untuk menarik data kualitas udara dari Open-Meteo API.
 *
 * @param runImmediatelyOnBoot - Jika `true`, langsung memicu pemanasan awal (initial sync) di background saat server menyala
 * @returns Instance `ScheduledTask` dari `node-cron`
 */
export const startAqiCronJob = (runImmediatelyOnBoot = true): ScheduledTask => {
  if (scheduledTaskInstance) {
    return scheduledTaskInstance;
  }

  scheduledTaskInstance = cron.schedule(
    AQI_CRON_SCHEDULE,
    async () => {
      await runAqiSyncJob();
    },
    {
      timezone: 'Asia/Jakarta',
    }
  );

  console.log(
    `[AqiCron] Terjadwal aktif menggunakan node-cron pada ekspresi "${AQI_CRON_SCHEDULE}" (setiap 1 jam, WIB).`
  );

  if (runImmediatelyOnBoot) {
    // Jalankan pemanasan cache & DB awal secara asinkron tanpa memblokir proses boot server
    void runAqiSyncJob();
  }

  return scheduledTaskInstance;
};
