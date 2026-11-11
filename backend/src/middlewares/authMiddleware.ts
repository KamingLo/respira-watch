import type { Request, Response, NextFunction } from 'express';
import type { OfficerRole } from '../models/Officer.js';
import {
  getJwtSecretKey,
  verifyOfficerToken,
  type JwtOfficerPayload,
} from '../utils/jwt.js';

export { getJwtSecretKey, type JwtOfficerPayload };

declare global {
  namespace Express {
    interface Request {
      officer?: JwtOfficerPayload;
    }
  }
}

export const authenticateOfficer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Akses ditolak. Token autentikasi tidak ditemukan.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Format token tidak valid.',
    });
    return;
  }

  try {
    req.officer = await verifyOfficerToken(token);
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token tidak valid atau telah kedaluwarsa.',
    });
  }
};

export const authorizeRoles = (...allowedRoles: OfficerRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.officer || !allowedRoles.includes(req.officer.role)) {
      res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki izin untuk mengakses sumber daya ini.',
      });
      return;
    }
    next();
  };
};
