import cron, { type ScheduledTask } from 'node-cron';
import { ensureDefaultGridCells, syncSingleGridCellAqi } from '../services/aqiService.js';
import { computeAllGridRiskScoresBatch } from '../services/analyticsService.js';

export const AQI_CRON_SCHEDULE = '0 * * * *';

let isAqiCronRunning = false;
let scheduledTaskInstance: ScheduledTask | null = null;

export const getIsAqiCronRunning = (): boolean => isAqiCronRunning;

export const runAqiSyncJob = async (): Promise<{
  skipped: boolean;
  totalGrids: number;
  successCount: number;
  failureCount: number;
  riskScoresComputed: boolean;
}> => {
  if (isAqiCronRunning) {
    console.warn(
      '[AqiCron] Eksekusi dilewati (SKIP): siklus penarikan data Open-Meteo sebelumnya masih berjalan.'
    );
    return {
      skipped: true,
      totalGrids: 0,
      successCount: 0,
      failureCount: 0,
      riskScoresComputed: false,
    };
  }

  isAqiCronRunning = true;
  const startedAt = Date.now();
  let totalGrids = 0;
  let successCount = 0;
  let failureCount = 0;
  let riskScoresComputed = false;

  try {
    console.log(
      `[AqiCron] Memulai sinkronisasi data Open-Meteo (PM2.5, PM10, AQI) & Komputasi Batch Skor Risiko Area pada ${new Date().toISOString()}...`
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

    try {
      const riskMap = await computeAllGridRiskScoresBatch();
      riskScoresComputed = true;
      console.log(
        `[AqiCron] Komputasi batch skor risiko selesai -> ${riskMap.totalGrids} sel grid | Avg Score: ${riskMap.summary.averageScore}/100 | Max Score: ${riskMap.summary.maxScore}/100`
      );
    } catch (riskErr) {
      console.error(
        '[AqiCron] Gagal menjalankan komputasi batch skor risiko area:',
        riskErr
      );
    }

    const durationMs = Date.now() - startedAt;
    console.log(
      `[AqiCron] Siklus selesai dalam ${durationMs}ms | Total Grid: ${totalGrids}, Sukses: ${successCount}, Gagal: ${failureCount}, RiskMap O(1): ${riskScoresComputed}`
    );
  } catch (error) {
    console.error('[AqiCron] Terjadi kesalahan tak terduga saat menjalankan AQI Cron Job:', error);
  } finally {
    isAqiCronRunning = false;
  }

  return {
    skipped: false,
    totalGrids,
    successCount,
    failureCount,
    riskScoresComputed,
  };
};

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
    void runAqiSyncJob();
  }

  return scheduledTaskInstance;
};
