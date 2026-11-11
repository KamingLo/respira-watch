import type { Request, Response } from 'express';
import {
  authenticateOfficerLogin,
  getAuthenticatedOfficerProfile,
} from '../services/authService.js';
import { handleControllerError, sendSuccess } from '../utils/response.js';

export const loginOfficer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    const result = await authenticateOfficerLogin(email, password);

    sendSuccess(res, result, 'Login berhasil.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'AuthController.loginOfficer',
      'Terjadi kesalahan pada server saat memproses login.'
    );
  }
};

export const getOfficerProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.officer) {
      res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });
      return;
    }

    const officer = await getAuthenticatedOfficerProfile(req.officer.officerId);
    sendSuccess(res, officer, undefined, 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'AuthController.getOfficerProfile',
      'Gagal mengambil profil petugas.'
    );
  }
};
