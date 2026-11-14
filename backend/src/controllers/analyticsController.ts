import type { Request, Response } from 'express';
import {
  computeAllGridRiskScoresBatch,
  getAreaRiskScoreMap,
  getNasaFirmsHotspots,
  getSingleGridRiskScoreO1,
  fetchGridWeatherMetrics,
} from '../services/analyticsService.js';
import { AppError } from '../utils/AppError.js';
import { handleControllerError, sendSuccess } from '../utils/response.js';

export const getRiskScores = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const gridIdOrCode = String(req.query.gridId ?? req.query.cellCode ?? '').trim();
    const forceRefresh =
      req.query.refresh === 'true' || req.query.refresh === '1';

    if (gridIdOrCode) {
      const singleScore = await getSingleGridRiskScoreO1(gridIdOrCode);
      if (!singleScore) {
        throw new AppError(
          `Sel grid dengan ID/kode "${gridIdOrCode}" tidak ditemukan.`,
          404
        );
      }
      sendSuccess(
        res,
        singleScore,
        'Skor risiko sel grid berhasil dimuat dari Redis Hash O(1).',
        200
      );
      return;
    }

    const riskMap = await getAreaRiskScoreMap({ forceRefresh });
    sendSuccess(
      res,
      riskMap,
      'Peta skor risiko area (0.5*Laporan + 0.3*AQI + 0.2*Cuaca) berhasil dimuat.',
      200
    );
  } catch (error) {
    handleControllerError(
      res,
      error,
      'AnalyticsController.getRiskScores',
      'Gagal memuat peta skor risiko area.'
    );
  }
};

export const getCurrentWeather = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (
      req.query.lat === undefined ||
      req.query.lng === undefined ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      throw new AppError('Koordinat lat dan lng tidak valid.', 400);
    }

    const weather = await fetchGridWeatherMetrics(lat, lng);
    sendSuccess(res, weather, 'Data cuaca area berhasil dimuat.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'AnalyticsController.getCurrentWeather',
      'Gagal memuat data cuaca area.'
    );
  }
};

export const triggerRiskScoreComputation = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const riskMap = await computeAllGridRiskScoresBatch();
    sendSuccess(
      res,
      riskMap,
      'Komputasi batch skor risiko area selesai dan telah disimpan ke Redis (Hash & JSON) untuk pembacaan O(1).',
      200
    );
  } catch (error) {
    handleControllerError(
      res,
      error,
      'AnalyticsController.triggerRiskScoreComputation',
      'Gagal menjalankan komputasi batch skor risiko area.'
    );
  }
};

export const getFirmsHotspots = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const bbox = typeof req.query.bbox === 'string' ? req.query.bbox : undefined;
    const source =
      typeof req.query.source === 'string' ? req.query.source : undefined;
    const dayRange =
      req.query.days !== undefined ? Number(req.query.days) : undefined;
    const forceRefresh =
      req.query.refresh === 'true' || req.query.refresh === '1';

    const hotspotsData = await getNasaFirmsHotspots({
      ...(bbox ? { bbox } : {}),
      ...(source ? { source } : {}),
      ...(dayRange !== undefined && Number.isFinite(dayRange)
        ? { dayRange }
        : {}),
      forceRefresh,
    });

    const message = hotspotsData.cache.cached
      ? 'Data hotspot karhutla harian NASA FIRMS berhasil dimuat dari cache Redis (TTL 12 jam).'
      : 'Data hotspot karhutla harian NASA FIRMS berhasil dimuat.';

    sendSuccess(res, hotspotsData, message, 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'AnalyticsController.getFirmsHotspots',
      'Gagal memuat data hotspot karhutla NASA FIRMS.'
    );
  }
};
