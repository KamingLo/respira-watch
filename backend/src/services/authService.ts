import { Officer, type IOfficer } from '../models/Officer.js';
import { redisClient } from '../config/redis.js';
import { AppError } from '../utils/AppError.js';
import { verifyPassword } from '../utils/password.js';
import { signOfficerToken, type JwtOfficerPayload } from '../utils/jwt.js';

export interface LoginOfficerResult {
  token: string;
  officer: {
    id: string;
    name: string;
    nip: string;
    email: string;
    role: IOfficer['role'];
    assignedKelurahan?: IOfficer['assignedKelurahan'];
  };
}

export const authenticateOfficerLogin = async (
  email?: string,
  password?: string
): Promise<LoginOfficerResult> => {
  if (!email || !password) {
    throw new AppError('Email dan password wajib diisi.', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const officer = await Officer.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!officer || !officer.isActive) {
    throw new AppError('Kredensial tidak valid atau akun petugas tidak aktif.', 401);
  }

  const isPasswordMatch = await verifyPassword(password, officer.passwordHash);
  if (!isPasswordMatch) {
    throw new AppError('Kredensial tidak valid.', 401);
  }

  const officerId = officer._id.toString();
  const payload: JwtOfficerPayload = {
    officerId,
    email: officer.email,
    role: officer.role,
    nip: officer.nip,
  };

  const token = await signOfficerToken(payload);

  officer.lastLoginAt = new Date();
  await officer.save();

  if (redisClient.status === 'ready') {
    await redisClient.set(
      `session:officer:${officerId}`,
      JSON.stringify({
        officerId,
        role: officer.role,
        loginAt: officer.lastLoginAt.toISOString(),
      }),
      'EX',
      28800
    );
  }

  return {
    token,
    officer: {
      id: officerId,
      name: officer.name,
      nip: officer.nip,
      email: officer.email,
      role: officer.role,
      assignedKelurahan: officer.assignedKelurahan,
    },
  };
};

export const getAuthenticatedOfficerProfile = async (officerId: string): Promise<IOfficer> => {
  const officer = await Officer.findById(officerId).populate(
    'assignedKelurahan',
    'code name kecamatan'
  );

  if (!officer) {
    throw new AppError('Data petugas tidak ditemukan.', 404);
  }

  return officer;
};
