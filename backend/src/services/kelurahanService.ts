import { Types } from 'mongoose';
import { Kelurahan, type IKelurahan } from '../models/Kelurahan.js';
import { Officer, type IOfficer } from '../models/Officer.js';
import type { IGeoPoint, IGeoPolygon } from '../models/GeoJSON.js';
import { AppError } from '../utils/AppError.js';

export type BaselineRiskLevel = IKelurahan['baselineRiskLevel'];

const VALID_RISK_LEVELS: BaselineRiskLevel[] = ['low', 'moderate', 'high', 'critical'];

export interface CreateKelurahanInput {
  code?: string;
  name?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  population?: number;
  areaSqKm?: number;
  boundary?: IGeoPolygon;
  centroid?: IGeoPoint;
  baselineRiskLevel?: BaselineRiskLevel;
}

export interface UpdateKelurahanInput {
  code?: string;
  name?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  population?: number;
  areaSqKm?: number | null;
  boundary?: IGeoPolygon;
  centroid?: IGeoPoint;
  baselineRiskLevel?: BaselineRiskLevel;
}

export interface ListKelurahansFilter {
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  baselineRiskLevel?: string;
  search?: string;
}

export interface KelurahanDetailWithOfficers extends Record<string, unknown> {
  assignedOfficers: IOfficer[];
}

const isValidCoordinatePair = (coord: unknown): coord is [number, number] => {
  return (
    Array.isArray(coord) &&
    coord.length === 2 &&
    typeof coord[0] === 'number' &&
    typeof coord[1] === 'number' &&
    Number.isFinite(coord[0]) &&
    Number.isFinite(coord[1]) &&
    coord[0] >= -180 &&
    coord[0] <= 180 &&
    coord[1] >= -90 &&
    coord[1] <= 90
  );
};

export const validateGeoPoint = (point: unknown, fieldName = 'centroid'): IGeoPoint => {
  if (!point || typeof point !== 'object') {
    throw new AppError(`Field ${fieldName} wajib berupa objek GeoJSON Point.`, 400);
  }

  const candidate = point as Partial<IGeoPoint>;
  const type = candidate.type ?? 'Point';

  if (type !== 'Point') {
    throw new AppError(`Tipe GeoJSON pada ${fieldName} harus bernilai 'Point'.`, 400);
  }

  if (!isValidCoordinatePair(candidate.coordinates)) {
    throw new AppError(
      `Koordinat ${fieldName} harus berupa [longitude, latitude] yang valid.`,
      400
    );
  }

  return {
    type: 'Point',
    coordinates: [candidate.coordinates[0], candidate.coordinates[1]],
  };
};

export const validateGeoPolygon = (polygon: unknown, fieldName = 'boundary'): IGeoPolygon => {
  if (!polygon || typeof polygon !== 'object') {
    throw new AppError(`Field ${fieldName} wajib berupa objek GeoJSON Polygon.`, 400);
  }

  const candidate = polygon as Partial<IGeoPolygon>;
  const type = candidate.type ?? 'Polygon';

  if (type !== 'Polygon') {
    throw new AppError(`Tipe GeoJSON pada ${fieldName} harus bernilai 'Polygon'.`, 400);
  }

  if (!Array.isArray(candidate.coordinates) || candidate.coordinates.length === 0) {
    throw new AppError(
      `Koordinat ${fieldName} harus berupa array linear ring GeoJSON Polygon yang tidak kosong.`,
      400
    );
  }

  for (const ring of candidate.coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) {
      throw new AppError(
        `Setiap linear ring pada ${fieldName} harus memiliki minimal 4 titik koordinat.`,
        400
      );
    }

    for (const point of ring) {
      if (!isValidCoordinatePair(point)) {
        throw new AppError(
          `Terdapat titik koordinat tidak valid pada ${fieldName}. Gunakan format [longitude, latitude].`,
          400
        );
      }
    }

    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
      throw new AppError(
        `Linear ring pada ${fieldName} harus tertutup (koordinat titik pertama dan terakhir harus sama).`,
        400
      );
    }
  }

  return {
    type: 'Polygon',
    coordinates: candidate.coordinates,
  };
};

export const createNewKelurahan = async (input: CreateKelurahanInput): Promise<IKelurahan> => {
  const {
    code,
    name,
    kecamatan,
    kota,
    provinsi,
    population = 0,
    areaSqKm,
    boundary,
    centroid,
    baselineRiskLevel = 'low',
  } = input;

  if (!code || !name || !kecamatan || !kota || !provinsi || !boundary || !centroid) {
    throw new AppError(
      'Kode, nama kelurahan, kecamatan, kota, provinsi, boundary, dan centroid wajib diisi.',
      400
    );
  }

  if (!VALID_RISK_LEVELS.includes(baselineRiskLevel)) {
    throw new AppError(
      `Level risiko dasar tidak valid. Pilihan yang tersedia: ${VALID_RISK_LEVELS.join(', ')}.`,
      400
    );
  }

  if (typeof population !== 'number' || Number.isNaN(population) || population < 0) {
    throw new AppError('Jumlah populasi harus berupa angka positif atau nol.', 400);
  }

  if (
    areaSqKm !== undefined &&
    (typeof areaSqKm !== 'number' || Number.isNaN(areaSqKm) || areaSqKm < 0)
  ) {
    throw new AppError('Luas wilayah (areaSqKm) harus berupa angka positif atau nol.', 400);
  }

  const validatedCentroid = validateGeoPoint(centroid, 'centroid');
  const validatedBoundary = validateGeoPolygon(boundary, 'boundary');

  const normalizedCode = code.trim();
  const existing = await Kelurahan.findOne({ code: normalizedCode });
  if (existing) {
    throw new AppError('Kode kelurahan sudah terdaftar.', 409);
  }

  const createdKelurahan = await Kelurahan.create({
    code: normalizedCode,
    name: name.trim(),
    kecamatan: kecamatan.trim(),
    kota: kota.trim(),
    provinsi: provinsi.trim(),
    population,
    ...(areaSqKm !== undefined ? { areaSqKm } : {}),
    boundary: validatedBoundary,
    centroid: validatedCentroid,
    baselineRiskLevel,
  });

  return createdKelurahan;
};

export const getKelurahans = async (filter: ListKelurahansFilter = {}): Promise<IKelurahan[]> => {
  const query: Record<string, unknown> = {};

  if (filter.kecamatan && filter.kecamatan.trim() !== '') {
    query.kecamatan = new RegExp(`^${filter.kecamatan.trim()}$`, 'i');
  }

  if (filter.kota && filter.kota.trim() !== '') {
    query.kota = new RegExp(`^${filter.kota.trim()}$`, 'i');
  }

  if (filter.provinsi && filter.provinsi.trim() !== '') {
    query.provinsi = new RegExp(`^${filter.provinsi.trim()}$`, 'i');
  }

  if (
    filter.baselineRiskLevel &&
    VALID_RISK_LEVELS.includes(filter.baselineRiskLevel as BaselineRiskLevel)
  ) {
    query.baselineRiskLevel = filter.baselineRiskLevel;
  }

  if (filter.search && filter.search.trim() !== '') {
    const regex = new RegExp(filter.search.trim(), 'i');
    query.$or = [{ code: regex }, { name: regex }, { kecamatan: regex }, { kota: regex }];
  }

  return Kelurahan.find(query).sort({ name: 1 });
};

export const getKelurahanDetailById = async (
  kelurahanId: string
): Promise<KelurahanDetailWithOfficers> => {
  if (!Types.ObjectId.isValid(kelurahanId)) {
    throw new AppError('Format ID kelurahan tidak valid.', 400);
  }

  const kelurahan = await Kelurahan.findById(kelurahanId);
  if (!kelurahan) {
    throw new AppError('Data kelurahan tidak ditemukan.', 404);
  }

  const assignedOfficers = await Officer.find({
    assignedKelurahan: kelurahan._id,
  })
    .select('name nip email phone role isActive baseLocation lastLoginAt')
    .sort({ name: 1 });

  return {
    ...kelurahan.toObject(),
    assignedOfficers,
  };
};

export const updateKelurahanById = async (
  kelurahanId: string,
  input: UpdateKelurahanInput
): Promise<IKelurahan> => {
  if (!Types.ObjectId.isValid(kelurahanId)) {
    throw new AppError('Format ID kelurahan tidak valid.', 400);
  }

  const kelurahan = await Kelurahan.findById(kelurahanId);
  if (!kelurahan) {
    throw new AppError('Data kelurahan tidak ditemukan.', 404);
  }

  if (input.code !== undefined) {
    const normalizedCode = input.code.trim();
    if (!normalizedCode) {
      throw new AppError('Kode kelurahan tidak boleh kosong.', 400);
    }

    const duplicate = await Kelurahan.findOne({
      code: normalizedCode,
      _id: { $ne: kelurahan._id },
    });

    if (duplicate) {
      throw new AppError('Kode kelurahan sudah digunakan oleh kelurahan lain.', 409);
    }

    kelurahan.code = normalizedCode;
  }

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new AppError('Nama kelurahan tidak boleh kosong.', 400);
    }
    kelurahan.name = trimmedName;
  }

  if (input.kecamatan !== undefined) {
    const trimmedKecamatan = input.kecamatan.trim();
    if (!trimmedKecamatan) {
      throw new AppError('Nama kecamatan tidak boleh kosong.', 400);
    }
    kelurahan.kecamatan = trimmedKecamatan;
  }

  if (input.kota !== undefined) {
    const trimmedKota = input.kota.trim();
    if (!trimmedKota) {
      throw new AppError('Nama kota tidak boleh kosong.', 400);
    }
    kelurahan.kota = trimmedKota;
  }

  if (input.provinsi !== undefined) {
    const trimmedProvinsi = input.provinsi.trim();
    if (!trimmedProvinsi) {
      throw new AppError('Nama provinsi tidak boleh kosong.', 400);
    }
    kelurahan.provinsi = trimmedProvinsi;
  }

  if (input.population !== undefined) {
    if (
      typeof input.population !== 'number' ||
      Number.isNaN(input.population) ||
      input.population < 0
    ) {
      throw new AppError('Jumlah populasi harus berupa angka positif atau nol.', 400);
    }
    kelurahan.population = input.population;
  }

  if (input.areaSqKm !== undefined) {
    if (input.areaSqKm === null) {
      kelurahan.set('areaSqKm', undefined);
    } else if (
      typeof input.areaSqKm !== 'number' ||
      Number.isNaN(input.areaSqKm) ||
      input.areaSqKm < 0
    ) {
      throw new AppError('Luas wilayah (areaSqKm) harus berupa angka positif atau nol.', 400);
    } else {
      kelurahan.areaSqKm = input.areaSqKm;
    }
  }

  if (input.baselineRiskLevel !== undefined) {
    if (!VALID_RISK_LEVELS.includes(input.baselineRiskLevel)) {
      throw new AppError(
        `Level risiko dasar tidak valid. Pilihan yang tersedia: ${VALID_RISK_LEVELS.join(', ')}.`,
        400
      );
    }
    kelurahan.baselineRiskLevel = input.baselineRiskLevel;
  }

  if (input.centroid !== undefined) {
    kelurahan.centroid = validateGeoPoint(input.centroid, 'centroid');
  }

  if (input.boundary !== undefined) {
    kelurahan.boundary = validateGeoPolygon(input.boundary, 'boundary');
  }

  await kelurahan.save();
  return kelurahan;
};

export const deleteKelurahanById = async (kelurahanId: string): Promise<{ id: string }> => {
  if (!Types.ObjectId.isValid(kelurahanId)) {
    throw new AppError('Format ID kelurahan tidak valid.', 400);
  }

  const kelurahan = await Kelurahan.findById(kelurahanId);
  if (!kelurahan) {
    throw new AppError('Data kelurahan tidak ditemukan.', 404);
  }

  const assignedOfficerCount = await Officer.countDocuments({
    assignedKelurahan: kelurahan._id,
  });

  if (assignedOfficerCount > 0) {
    throw new AppError(
      `Kelurahan tidak dapat dihapus karena masih terdapat ${assignedOfficerCount} petugas yang ditempatkan di wilayah ini.`,
      409
    );
  }

  await kelurahan.deleteOne();

  return { id: kelurahan._id.toString() };
};
