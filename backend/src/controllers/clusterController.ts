import type { Request, Response } from 'express';
import {
  detectClusters,
  listClusters,
  getClusterByIdOrCode,
  getClusterReportTrend,
  updateClusterStatus as updateClusterStatusService,
  type ClusterQueryFilter,
  type UpdateClusterStatusInput,
} from '../services/clusterService.js';
import { AppError } from '../utils/AppError.js';
import { handleControllerError, sendSuccess } from '../utils/response.js';

export const getClusters = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category,
      kategori,
      level,
      riskLevel,
      riskStatus,
      status,
      kelurahanId,
      startDate,
      endDate,
    } = req.query as ClusterQueryFilter;

    const clusters = await listClusters({
      category,
      kategori,
      level,
      riskLevel,
      riskStatus,
      status,
      kelurahanId,
      startDate,
      endDate,
    });

    sendSuccess(
      res,
      clusters,
      'Daftar klaster spasial-temporal berhasil dimuat.',
      200
    );
  } catch (error) {
    handleControllerError(
      res,
      error,
      'ClusterController.getClusters',
      'Gagal memuat daftar klaster penyakit.'
    );
  }
};

export const getClusterDetail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const idOrCode = String(req.params.id ?? '').trim();
    if (!idOrCode) {
      throw new AppError('Parameter ID atau kode klaster wajib disertakan.', 400);
    }

    const cluster = await getClusterByIdOrCode(idOrCode);
    if (!cluster) {
      throw new AppError('Data klaster tidak ditemukan.', 404);
    }

    sendSuccess(res, cluster, 'Detail klaster berhasil dimuat.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'ClusterController.getClusterDetail',
      'Gagal memuat detail klaster penyakit.'
    );
  }
};

export const getClusterTrend = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const idOrCode = String(req.params.id ?? '').trim();
    if (!idOrCode) {
      throw new AppError('Parameter ID atau kode klaster wajib disertakan.', 400);
    }

    const trend = await getClusterReportTrend(idOrCode);
    sendSuccess(res, trend, 'Tren laporan klaster berhasil dimuat.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'ClusterController.getClusterTrend',
      'Gagal memuat tren laporan klaster.'
    );
  }
};

export const updateClusterStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const idOrCode = String(req.params.id ?? '').trim();
    if (!idOrCode) {
      throw new AppError('Parameter ID atau kode klaster wajib disertakan.', 400);
    }

    const body = (req.body ?? {}) as UpdateClusterStatusInput;
    const updatedCluster = await updateClusterStatusService(
      idOrCode,
      body,
      req.officer
    );

    sendSuccess(
      res,
      updatedCluster,
      'Status penanganan klaster berhasil diperbarui dan cache Redis telah disegarkan.',
      200
    );
  } catch (error) {
    handleControllerError(
      res,
      error,
      'ClusterController.updateClusterStatus',
      'Gagal memperbarui status penanganan klaster.'
    );
  }
};

export const triggerClusterDetection = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await detectClusters();
    sendSuccess(
      res,
      result,
      'Deteksi klaster spasial-temporal (DBSCAN 0.5 km, minPoints: 5) berhasil dijalankan dan cache peta telah disegarkan.',
      200
    );
  } catch (error) {
    handleControllerError(
      res,
      error,
      'ClusterController.triggerClusterDetection',
      'Gagal menjalankan deteksi klaster spasial-temporal.'
    );
  }
};
