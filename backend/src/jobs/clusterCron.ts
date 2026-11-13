import cron, { type ScheduledTask } from 'node-cron';
import { detectClusters, type DetectClustersResult } from '../services/clusterService.js';

export const CLUSTER_CRON_SCHEDULE = '*/10 * * * *';

let isClusterCronRunning = false;
let clusterScheduledTaskInstance: ScheduledTask | null = null;

export const getIsClusterCronRunning = (): boolean => isClusterCronRunning;

export const runClusterDetectionJob = async (): Promise<{
  skipped: boolean;
  result: DetectClustersResult | null;
}> => {
  if (isClusterCronRunning) {
    console.warn(
      '[ClusterCron] Eksekusi dilewati (SKIP): siklus deteksi klaster DBSCAN sebelumnya masih berjalan.'
    );
    return {
      skipped: true,
      result: null,
    };
  }

  isClusterCronRunning = true;
  const startedAt = Date.now();

  try {
    console.log(
      `[ClusterCron] Memulai deteksi klaster spasial-temporal (72 jam terakhir) pada ${new Date().toISOString()}...`
    );

    const result = await detectClusters();
    const durationMs = Date.now() - startedAt;

    console.log(
      `[ClusterCron] Siklus selesai dalam ${durationMs}ms | Laporan (72j): ${result.totalReportsFetched} (ISPA: ${result.reportsByCategory.ispa}, Diare: ${result.reportsByCategory.diare}) | Klaster Aktif: ${result.clustersDetected} (ISPA: ${result.clustersByCategory.ispa}, Diare: ${result.clustersByCategory.diare}) | Cache Invalidated: ${result.cacheInvalidated}`
    );

    return {
      skipped: false,
      result,
    };
  } catch (error) {
    console.error(
      '[ClusterCron] Terjadi kesalahan saat menjalankan deteksi klaster spasial-temporal:',
      error
    );
    return {
      skipped: false,
      result: null,
    };
  } finally {
    isClusterCronRunning = false;
  }
};

export const startClusterCronJob = (runImmediatelyOnBoot = true): ScheduledTask => {
  if (clusterScheduledTaskInstance) {
    return clusterScheduledTaskInstance;
  }

  clusterScheduledTaskInstance = cron.schedule(
    CLUSTER_CRON_SCHEDULE,
    async () => {
      await runClusterDetectionJob();
    },
    {
      timezone: 'Asia/Jakarta',
    }
  );

  console.log(
    `[ClusterCron] Terjadwal aktif menggunakan node-cron pada ekspresi "${CLUSTER_CRON_SCHEDULE}" (setiap 10 menit, WIB).`
  );

  if (runImmediatelyOnBoot) {
    void runClusterDetectionJob();
  }

  return clusterScheduledTaskInstance;
};
