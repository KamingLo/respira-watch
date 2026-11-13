import type { Request, Response } from 'express';
import {
  createOrUpdateCitizenReport,
  getPublicMapData,
  type CitizenReportInput,
  type PublicMapQueryFilter,
} from '../services/reportService.js';
import { handleControllerError, sendSuccess } from '../utils/response.js';

export const createReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CitizenReportInput;
    const { report, isUpdated } = await createOrUpdateCitizenReport(body);

    const statusCode = isUpdated ? 200 : 201;
    const message = isUpdated
      ? 'Laporan warga untuk perangkat ini berhasil diperbarui dan cache peta publik telah disegarkan.'
      : 'Laporan warga berhasil disimpan dan cache peta publik telah disegarkan.';

    sendSuccess(res, report, message, statusCode);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'ReportController.createReport',
      'Gagal memproses laporan warga.'
    );
  }
};

export const getPublicMap = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category,
      kategori,
      severity,
      tingkat_keparahan,
      status,
      kelurahanId,
      startDate,
      endDate,
      bbox,
    } = req.query as PublicMapQueryFilter;

    const mapData = await getPublicMapData({
      category,
      kategori,
      severity,
      tingkat_keparahan,
      status,
      kelurahanId,
      startDate,
      endDate,
      bbox,
    });

    sendSuccess(res, mapData, undefined, 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'ReportController.getPublicMap',
      'Gagal memuat data peta publik dan heatmap.'
    );
  }
};
