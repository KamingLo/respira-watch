import { Types } from 'mongoose';
import { Officer, type IOfficer, type OfficerRole } from '../models/Officer.js';
import { Kelurahan } from '../models/Kelurahan.js';
import type { IGeoPoint } from '../models/GeoJSON.js';
import { redisClient } from '../config/redis.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword } from '../utils/password.js';
import { validateGeoPoint } from './kelurahanService.js';

const VALID_ROLES: OfficerRole[] = ['admin', 'field_officer', 'health_analyst'];
const KELURAHAN_POPULATE_FIELDS = 'code name kecamatan kota provinsi centroid baselineRiskLevel';

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

export interface UpdateOfficerInput {
  name?: string;
  nip?: string;
  email?: string;
  password?: string;
  phone?: string | null;
  role?: OfficerRole;
  assignedKelurahan?: string | null;
  baseLocation?: IGeoPoint | null;
  isActive?: boolean;
}

export interface AssignOfficerKelurahanInput {
  assignedKelurahan?: string | null;
  syncBaseLocation?: boolean;
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
  let resolvedBaseLocation: IGeoPoint | undefined = baseLocation
    ? validateGeoPoint(baseLocation, 'baseLocation')
    : undefined;

  if (assignedKelurahan) {
    if (!Types.ObjectId.isValid(assignedKelurahan)) {
      throw new AppError('ID Kelurahan tidak valid.', 400);
    }
    const kelurahan = await Kelurahan.findById(assignedKelurahan);
    if (!kelurahan) {
      throw new AppError('Data Kelurahan yang ditugaskan tidak ditemukan.', 404);
    }
    kelurahanObjectId = kelurahan._id;

    if (!resolvedBaseLocation && kelurahan.centroid) {
      resolvedBaseLocation = kelurahan.centroid;
    }
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
    ...(resolvedBaseLocation ? { baseLocation: resolvedBaseLocation } : {}),
    isActive,
  });

  const populatedOfficer = await Officer.findById(createdOfficer._id).populate(
    'assignedKelurahan',
    KELURAHAN_POPULATE_FIELDS
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
    .populate('assignedKelurahan', KELURAHAN_POPULATE_FIELDS)
    .sort({ createdAt: -1 });
};

export const getOfficerDetailById = async (officerId: string): Promise<IOfficer> => {
  if (!Types.ObjectId.isValid(officerId)) {
    throw new AppError('Format ID petugas tidak valid.', 400);
  }

  const officer = await Officer.findById(officerId).populate(
    'assignedKelurahan',
    KELURAHAN_POPULATE_FIELDS
  );

  if (!officer) {
    throw new AppError('Data petugas tidak ditemukan.', 404);
  }

  return officer;
};

export const updateOfficerById = async (
  officerId: string,
  input: UpdateOfficerInput
): Promise<IOfficer> => {
  if (!Types.ObjectId.isValid(officerId)) {
    throw new AppError('Format ID petugas tidak valid.', 400);
  }

  const officer = await Officer.findById(officerId).select('+passwordHash');
  if (!officer) {
    throw new AppError('Data petugas tidak ditemukan.', 404);
  }

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new AppError('Nama petugas tidak boleh kosong.', 400);
    }
    officer.name = trimmedName;
  }

  if (input.nip !== undefined) {
    const normalizedNip = input.nip.trim();
    if (!normalizedNip) {
      throw new AppError('NIP petugas tidak boleh kosong.', 400);
    }

    const duplicateNip = await Officer.findOne({
      nip: normalizedNip,
      _id: { $ne: officer._id },
    });
    if (duplicateNip) {
      throw new AppError('NIP petugas sudah digunakan oleh petugas lain.', 409);
    }

    officer.nip = normalizedNip;
  }

  if (input.email !== undefined) {
    const normalizedEmail = input.email.toLowerCase().trim();
    if (!normalizedEmail) {
      throw new AppError('Email petugas tidak boleh kosong.', 400);
    }

    const duplicateEmail = await Officer.findOne({
      email: normalizedEmail,
      _id: { $ne: officer._id },
    });
    if (duplicateEmail) {
      throw new AppError('Email petugas sudah digunakan oleh petugas lain.', 409);
    }

    officer.email = normalizedEmail;
  }

  if (input.password !== undefined && input.password !== '') {
    if (input.password.length < 6) {
      throw new AppError('Password minimal harus terdiri dari 6 karakter.', 400);
    }
    officer.passwordHash = await hashPassword(input.password);
  }

  if (input.phone !== undefined) {
    if (input.phone === null || input.phone.trim() === '') {
      officer.set('phone', undefined);
    } else {
      officer.phone = input.phone.trim();
    }
  }

  if (input.role !== undefined) {
    if (!VALID_ROLES.includes(input.role)) {
      throw new AppError(
        `Role tidak valid. Pilihan role yang tersedia: ${VALID_ROLES.join(', ')}.`,
        400
      );
    }
    officer.role = input.role;
  }

  if (input.assignedKelurahan !== undefined) {
    if (input.assignedKelurahan === null || input.assignedKelurahan.trim() === '') {
      officer.set('assignedKelurahan', undefined);
    } else {
      if (!Types.ObjectId.isValid(input.assignedKelurahan)) {
        throw new AppError('ID Kelurahan tidak valid.', 400);
      }
      const kelurahan = await Kelurahan.findById(input.assignedKelurahan);
      if (!kelurahan) {
        throw new AppError('Data Kelurahan yang ditugaskan tidak ditemukan.', 404);
      }
      officer.assignedKelurahan = kelurahan._id;

      if (input.baseLocation === undefined && !officer.baseLocation && kelurahan.centroid) {
        officer.baseLocation = kelurahan.centroid;
      }
    }
  }

  if (input.baseLocation !== undefined) {
    if (input.baseLocation === null) {
      officer.set('baseLocation', undefined);
    } else {
      officer.baseLocation = validateGeoPoint(input.baseLocation, 'baseLocation');
    }
  }

  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') {
      throw new AppError('Status aktif (isActive) harus bernilai boolean.', 400);
    }
    officer.isActive = input.isActive;

    if (!input.isActive && redisClient.status === 'ready') {
      await redisClient.del(`session:officer:${officer._id.toString()}`);
    }
  }

  await officer.save();

  const updatedOfficer = await Officer.findById(officer._id).populate(
    'assignedKelurahan',
    KELURAHAN_POPULATE_FIELDS
  );

  if (!updatedOfficer) {
    throw new AppError('Gagal mengambil data petugas yang telah diperbarui.', 500);
  }

  return updatedOfficer;
};

export const assignOfficerKelurahan = async (
  officerId: string,
  input: AssignOfficerKelurahanInput
): Promise<IOfficer> => {
  if (!Types.ObjectId.isValid(officerId)) {
    throw new AppError('Format ID petugas tidak valid.', 400);
  }

  const officer = await Officer.findById(officerId);
  if (!officer) {
    throw new AppError('Data petugas tidak ditemukan.', 404);
  }

  const { assignedKelurahan, syncBaseLocation = true } = input;

  if (
    assignedKelurahan === undefined ||
    assignedKelurahan === null ||
    assignedKelurahan.trim() === ''
  ) {
    officer.set('assignedKelurahan', undefined);
  } else {
    if (!Types.ObjectId.isValid(assignedKelurahan)) {
      throw new AppError('ID Kelurahan tidak valid.', 400);
    }

    const kelurahan = await Kelurahan.findById(assignedKelurahan);
    if (!kelurahan) {
      throw new AppError('Data Kelurahan yang ditugaskan tidak ditemukan.', 404);
    }

    officer.assignedKelurahan = kelurahan._id;

    if ((syncBaseLocation || !officer.baseLocation) && kelurahan.centroid) {
      officer.baseLocation = kelurahan.centroid;
    }
  }

  await officer.save();

  const updatedOfficer = await Officer.findById(officer._id).populate(
    'assignedKelurahan',
    KELURAHAN_POPULATE_FIELDS
  );

  if (!updatedOfficer) {
    throw new AppError('Gagal mengambil data petugas setelah pembaruan kelurahan.', 500);
  }

  return updatedOfficer;
};

export const deleteOfficerById = async (
  officerId: string,
  requesterOfficerId?: string
): Promise<{ id: string }> => {
  if (!Types.ObjectId.isValid(officerId)) {
    throw new AppError('Format ID petugas tidak valid.', 400);
  }

  if (requesterOfficerId && officerId === requesterOfficerId) {
    throw new AppError('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.', 400);
  }

  const officer = await Officer.findById(officerId);
  if (!officer) {
    throw new AppError('Data petugas tidak ditemukan.', 404);
  }

  await officer.deleteOne();

  if (redisClient.status === 'ready') {
    await redisClient.del(`session:officer:${officerId}`);
  }

  return { id: officerId };
};
