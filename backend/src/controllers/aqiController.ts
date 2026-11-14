import type { Request, Response } from 'express';
import { getNearestGridAqiByCoords } from '../services/aqiService.js';
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
