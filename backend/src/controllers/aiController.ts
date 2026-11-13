import type { Request, Response } from 'express';
import {
  classifyCitizenComplaint,
  getClusterAiSummary,
  type ClassifyComplaintInput,
} from '../services/aiService.js';
import { AppError } from '../utils/AppError.js';
import { handleControllerError, sendSuccess } from '../utils/response.js';

export const classifyComplaint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const body = (req.body ?? {}) as ClassifyComplaintInput;
    const strictAiOnly =
      req.query.strict === 'true' || Boolean(body.strictAiOnly);

    const result = await classifyCitizenComplaint({
      ...body,
      strictAiOnly,
    });

    const message = result.meta.usedFallback
      ? 'Keluhan warga berhasil diklasifikasikan menggunakan mode fallback aman.'
      : 'Keluhan warga berhasil diklasifikasikan oleh AI ke format JSON baku.';

    sendSuccess(res, result, message, 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'AiController.classifyComplaint',
      'Gagal mengklasifikasikan teks keluhan warga.'
    );
  }
};

export const getClusterSummary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const idOrCode = String(req.params.id ?? '').trim();
    if (!idOrCode) {
      throw new AppError('Parameter ID atau kode klaster wajib disertakan.', 400);
    }

    const forceRefresh =
      req.query.refresh === 'true' || req.query.refresh === '1';
    const strictAiOnly =
      req.query.strict === 'true' || req.query.strict === '1';

    const summary = await getClusterAiSummary(idOrCode, {
      forceRefresh,
      strictAiOnly,
    });

    const message = summary.cache.cached
      ? 'Ringkasan AI klaster berhasil dimuat dari cache Redis.'
      : 'Ringkasan AI klaster berhasil disusun berdasarkan statistik faktual database.';

    sendSuccess(res, summary, message, 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'AiController.getClusterSummary',
      'Gagal menyusun ringkasan AI untuk klaster penyakit.'
    );
  }
};
