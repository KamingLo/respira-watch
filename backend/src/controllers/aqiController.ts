import type { Request, Response } from 'express';
import {
  getAqiHistory,
  getAqiGridMap,
  getNearestGridAqiByCoords,
} from '../services/aqiService.js';
import { handleControllerError, sendSuccess } from '../utils/response.js';

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

export const getAqiMap = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await getAqiGridMap();
    sendSuccess(res, result, 'Lapisan AQI grid berhasil dimuat.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'AqiController.getAqiMap',
      'Gagal memuat lapisan AQI.'
    );
  }
};

export const getAqiTrend = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await getAqiHistory(req.query.days, req.query.kelurahanId);
    sendSuccess(res, result, 'Tren historis AQI berhasil dimuat.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'AqiController.getAqiTrend',
      'Gagal memuat tren historis AQI.'
    );
  }
};
