import type { Request, Response } from 'express';
import {
  createCitizenReport,
  getPublicMapData,
  listOfficerReports,
  updateOfficerReportStatus,
  type CitizenReportInput,
  type PublicMapQueryFilter,
  type OfficerReportFilter,
  type UpdateReportStatusInput,
} from '../services/reportService.js';
import { handleControllerError, sendSuccess } from '../utils/response.js';

export const createReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CitizenReportInput;
    const { report, isUpdated } = await createCitizenReport(body);

    const statusCode = isUpdated ? 200 : 201;
    const message = isUpdated
      ? 'Laporan warga untuk perangkat ini berhasil diperbarui dan cache peta publik telah disegarkan.'
      : 'Laporan warga berhasil disimpan dan cache peta publik telah disegarkan.';

    sendSuccess(
      res,
      { ...report.toObject(), isUpdated },
      message,
      statusCode
    );
  } catch (error) {
    handleControllerError(
      res,
      error,
      'ReportController.createReport',
      'Gagal memproses laporan warga.'
    );
  }
};

export const getOfficerReports = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const filter = req.query as OfficerReportFilter;
    const reports = await listOfficerReports(
      req.officer?.officerId ?? '',
      filter
    );
    sendSuccess(res, reports, 'Daftar laporan berhasil dimuat.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'ReportController.getOfficerReports',
      'Gagal memuat daftar laporan petugas.'
    );
  }
};

export const updateOfficerReportStatusController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const reportId = String(req.params.id ?? '').trim();
    const updatedReport = await updateOfficerReportStatus(
      reportId,
      (req.body ?? {}) as UpdateReportStatusInput,
      req.officer?.officerId ?? ''
    );
    sendSuccess(res, updatedReport, 'Status laporan berhasil diperbarui.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'ReportController.updateOfficerReportStatus',
      'Gagal memperbarui status laporan.'
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
