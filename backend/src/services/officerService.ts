import { Types } from 'mongoose';
import { Officer, type IOfficer, type OfficerRole } from '../models/Officer.js';
import { Kelurahan } from '../models/Kelurahan.js';
import type { IGeoPoint } from '../models/GeoJSON.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword } from '../utils/password.js';

const VALID_ROLES: OfficerRole[] = ['admin', 'field_officer', 'health_analyst'];

export interface CreateOfficerInput {
  name?: string;
  nip?: string;
  email?: string;
  password?: string;
  phone?: string;
  role?: OfficerRole;
  assignedKelurahan?: string;
  baseLocation?: IGeoPoint;
  isActive?: boolean;
}

export interface ListOfficersFilter {
  role?: string;
  isActive?: string;
  assignedKelurahan?: string;
  search?: string;
}

export const createNewOfficer = async (input: CreateOfficerInput): Promise<IOfficer> => {
  const {
    name,
    nip,
    email,
    password,
    phone,
    role = 'field_officer',
    assignedKelurahan,
    baseLocation,
    isActive = true,
  } = input;

  if (!name || !nip || !email || !password) {
    throw new AppError('Nama, NIP, email, dan password wajib diisi.', 400);
  }

  if (password.length < 6) {
    throw new AppError('Password minimal harus terdiri dari 6 karakter.', 400);
  }

  if (!VALID_ROLES.includes(role)) {
    throw new AppError(
      `Role tidak valid. Pilihan role yang tersedia: ${VALID_ROLES.join(', ')}.`,
      400
    );
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedNip = nip.trim();

  const existingOfficer = await Officer.findOne({
    $or: [{ email: normalizedEmail }, { nip: normalizedNip }],
  });

  if (existingOfficer) {
    if (existingOfficer.email === normalizedEmail) {
      throw new AppError('Email petugas sudah terdaftar.', 409);
    }
    throw new AppError('NIP petugas sudah terdaftar.', 409);
  }

  let kelurahanObjectId: Types.ObjectId | undefined;
  if (assignedKelurahan) {
    if (!Types.ObjectId.isValid(assignedKelurahan)) {
      throw new AppError('ID Kelurahan tidak valid.', 400);
    }
    const kelurahanExists = await Kelurahan.exists({ _id: assignedKelurahan });
    if (!kelurahanExists) {
      throw new AppError('Data Kelurahan yang ditugaskan tidak ditemukan.', 404);
    }
    kelurahanObjectId = new Types.ObjectId(assignedKelurahan);
  }

  const passwordHash = await hashPassword(password);

  const createdOfficer = await Officer.create({
    name: name.trim(),
    nip: normalizedNip,
    email: normalizedEmail,
    passwordHash,
    ...(phone ? { phone: phone.trim() } : {}),
    role,
    ...(kelurahanObjectId ? { assignedKelurahan: kelurahanObjectId } : {}),
    ...(baseLocation ? { baseLocation } : {}),
    isActive,
  });

  const populatedOfficer = await Officer.findById(createdOfficer._id).populate(
    'assignedKelurahan',
    'code name kecamatan'
  );

  if (!populatedOfficer) {
    throw new AppError('Gagal mengambil data petugas yang baru dibuat.', 500);
  }

  return populatedOfficer;
};

export const getOfficers = async (filter: ListOfficersFilter = {}): Promise<IOfficer[]> => {
  const query: Record<string, unknown> = {};

  if (filter.role && VALID_ROLES.includes(filter.role as OfficerRole)) {
    query.role = filter.role;
  }

  if (filter.isActive !== undefined) {
    if (filter.isActive === 'true') query.isActive = true;
    if (filter.isActive === 'false') query.isActive = false;
  }

  if (filter.assignedKelurahan && Types.ObjectId.isValid(filter.assignedKelurahan)) {
    query.assignedKelurahan = new Types.ObjectId(filter.assignedKelurahan);
  }

  if (filter.search && filter.search.trim() !== '') {
    const regex = new RegExp(filter.search.trim(), 'i');
    query.$or = [{ name: regex }, { nip: regex }, { email: regex }];
  }

  return Officer.find(query)
    .populate('assignedKelurahan', 'code name kecamatan')
    .sort({ createdAt: -1 });
};

export const getOfficerDetailById = async (officerId: string): Promise<IOfficer> => {
  if (!Types.ObjectId.isValid(officerId)) {
    throw new AppError('Format ID petugas tidak valid.', 400);
  }

  const officer = await Officer.findById(officerId).populate(
    'assignedKelurahan',
    'code name kecamatan'
  );

  if (!officer) {
    throw new AppError('Data petugas tidak ditemukan.', 404);
  }

  return officer;
};
