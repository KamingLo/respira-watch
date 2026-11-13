import { Types } from 'mongoose';
import {
  Report,
  type IReport,
  type CitizenReportCategory,
  type ReportSeverity,
  type ReportStatus,
} from '../models/Report.js';
import { Kelurahan } from '../models/Kelurahan.js';
import type { IGeoPoint } from '../models/GeoJSON.js';
import { AppError } from '../utils/AppError.js';
import {
  buildFilterCacheKey,
  getCache,
  setCache,
  delCache,
  DEFAULT_CACHE_TTL,
} from '../utils/cache.js';
import { emitNewReport, SOCKET_EVENTS } from '../config/socket.js';

export const PUBLIC_MAP_CACHE_PREFIX = 'map_cache';
export const PUBLIC_MAP_CACHE_PATTERN = `${PUBLIC_MAP_CACHE_PREFIX}:*`;
export const LEGACY_PUBLIC_MAP_CACHE_PATTERN = 'map:public:*';

const VALID_CITIZEN_CATEGORIES: CitizenReportCategory[] = ['ispa', 'diare'];

const VALID_SEVERITIES: ReportSeverity[] = [
  'ringan',
  'sedang',
  'berat',
  'kritis',
  'mild',
  'moderate',
  'severe',
  'critical',
];

const VALID_STATUSES: ReportStatus[] = [
  'pending',
  'verified',
  'in_progress',
  'resolved',
  'rejected',
];

const SEVERITY_WEIGHT_MAP: Record<ReportSeverity, number> = {
  ringan: 1,
  mild: 1,
  sedang: 2,
  moderate: 2,
  berat: 3,
  severe: 3,
  kritis: 4,
  critical: 4,
};

export interface CitizenReportInput {

  kategori?: string;
  category?: string;
  gejala?: string[] | string;
  symptoms?: string[] | string;
  jumlah_sakit?: number | string;
  jumlahSakit?: number | string;
  sickCount?: number | string;
  usia?: number | string;
  age?: number | string;
  tingkat_keparahan?: string;
  tingkatKeparahan?: string;
  severity?: string;
  device_hash?: string;
  deviceHash?: string;
  geom?: unknown;
  location?: unknown;
  reporterName?: string;
  nama_pelapor?: string;
  reporterContact?: string;
  description?: string;
  deskripsi?: string;
  address?: string;
  alamat?: string;
  kelurahanId?: string;
}

export interface UpsertCitizenReportResult {
  report: IReport;
  isUpdated: boolean;
}

export interface PublicMapQueryFilter {
  category?: string;
  kategori?: string;
  severity?: string;
  tingkat_keparahan?: string;
  status?: string;
  kelurahanId?: string;
  startDate?: string;
  endDate?: string;
  bbox?: string;
}

export interface PublicMapPointItem {
  id: string;
  category: string;
  symptoms: string[];
  sickCount: number;
  age: number;
  severity: ReportSeverity;
  status: ReportStatus;
  geom: IGeoPoint;
  kelurahan?: {
    id: string;
    code?: string;
    name?: string;
    kecamatan?: string;
  } | null;
  reportedAt: string;
}

export interface PublicHeatmapItem {
  coordinates: [number, number];
  lat: number;
  lng: number;
  weight: number;
  intensity: number;
  category: string;
  severity: ReportSeverity;
  sickCount: number;
}

export interface PublicMapResponseData {
  points: PublicMapPointItem[];
  geoJson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: IGeoPoint;
      properties: Omit<PublicMapPointItem, 'geom'>;
    }>;
  };
  heatmap: PublicHeatmapItem[];
  summary: {
    totalReports: number;
    totalSickCount: number;
    byCategory: {
      ispa: number;
      diare: number;
      other: number;
    };
    bySeverity: Record<string, number>;
    privacyJitterMeters: {
      min: number;
      max: number;
    };
    cacheKey: string;
    generatedAt: string;
  };
}

export const validateReportGeom = (rawGeom: unknown): IGeoPoint => {
  if (!rawGeom) {
    throw new AppError(
      'Koordinat lokasi (geom) wajib diisi dalam format GeoJSON Point { type: "Point", coordinates: [lng, lat] }.',
      400
    );
  }

  let coords: unknown;

  if (Array.isArray(rawGeom)) {
    coords = rawGeom;
  } else if (typeof rawGeom === 'object') {
    const obj = rawGeom as Record<string, unknown>;
    if (obj.type !== undefined && obj.type !== 'Point') {
      throw new AppError("Tipe GeoJSON pada geom harus bernilai 'Point'.", 400);
    }

    if (Array.isArray(obj.coordinates)) {
      coords = obj.coordinates;
    } else if (obj.lng !== undefined && obj.lat !== undefined) {
      coords = [Number(obj.lng), Number(obj.lat)];
    } else if (obj.longitude !== undefined && obj.latitude !== undefined) {
      coords = [Number(obj.longitude), Number(obj.latitude)];
    }
  }

  if (!Array.isArray(coords) || coords.length !== 2) {
    throw new AppError(
      'Koordinat geom harus berupa pasangan [longitude, latitude] yang valid.',
      400
    );
  }

  const lng = Number(coords[0]);
  const lat = Number(coords[1]);

  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    throw new AppError(
      'Nilai koordinat geom tidak valid. Longitude harus berada di [-180, 180] dan Latitude di [-90, 90].',
      400
    );
  }

  return {
    type: 'Point',
    coordinates: [lng, lat],
  };
};

export const applyCoordinateJitter = (
  coordinates: [number, number],
  minMeters = 100,
  maxMeters = 200
): [number, number] => {
  const [lng, lat] = coordinates;

  const distanceMeters = minMeters + Math.random() * (maxMeters - minMeters);

  const angleRad = Math.random() * 2 * Math.PI;

  const metersPerDegreeLat = 111_320;
  const deltaLat = (distanceMeters * Math.cos(angleRad)) / metersPerDegreeLat;

  const cosLat = Math.cos((lat * Math.PI) / 180);
  const safeCosLat = Math.abs(cosLat) < 1e-6 ? 1e-6 : cosLat;
  const deltaLng = (distanceMeters * Math.sin(angleRad)) / (metersPerDegreeLat * safeCosLat);

  const jitteredLng = Math.max(-180, Math.min(180, Number((lng + deltaLng).toFixed(6))));
  const jitteredLat = Math.max(-90, Math.min(90, Number((lat + deltaLat).toFixed(6))));

  return [jitteredLng, jitteredLat];
};

export const invalidatePublicMapCache = async (): Promise<void> => {
  await Promise.all([
    delCache(PUBLIC_MAP_CACHE_PATTERN),
    delCache(LEGACY_PUBLIC_MAP_CACHE_PATTERN),
  ]);
};

export const createOrUpdateCitizenReport = async (
  input: CitizenReportInput
): Promise<UpsertCitizenReportResult> => {

  const rawCategory = (input.kategori ?? input.category ?? '').toString().trim().toLowerCase();
  if (!VALID_CITIZEN_CATEGORIES.includes(rawCategory as CitizenReportCategory)) {
    throw new AppError(
      "Kategori laporan tidak valid. Pilihan yang diperbolehkan: 'ispa' atau 'diare'.",
      400
    );
  }
  const category = rawCategory as CitizenReportCategory;

  const rawSymptoms = input.gejala ?? input.symptoms;
  let symptoms: string[] = [];
  if (Array.isArray(rawSymptoms)) {
    symptoms = rawSymptoms
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  } else if (typeof rawSymptoms === 'string' && rawSymptoms.trim() !== '') {
    symptoms = rawSymptoms
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (symptoms.length === 0) {
    throw new AppError('Gejala (gejala / symptoms) wajib diisi minimal 1 gejala.', 400);
  }

  const rawSickCount = input.jumlah_sakit ?? input.jumlahSakit ?? input.sickCount;
  const sickCount = Number(rawSickCount);
  if (
    rawSickCount === undefined ||
    rawSickCount === null ||
    rawSickCount === '' ||
    !Number.isInteger(sickCount) ||
    sickCount < 1
  ) {
    throw new AppError(
      'Jumlah sakit (jumlah_sakit / sickCount) wajib berupa bilangan bulat minimal 1.',
      400
    );
  }

  const rawAge = input.usia ?? input.age;
  const age = Number(rawAge);
  if (
    rawAge === undefined ||
    rawAge === null ||
    rawAge === '' ||
    !Number.isInteger(age) ||
    age < 0 ||
    age > 120
  ) {
    throw new AppError(
      'Usia penderita (usia / age) wajib berupa bilangan bulat yang valid (0 - 120).',
      400
    );
  }

  const rawSeverity = (
    input.tingkat_keparahan ??
    input.tingkatKeparahan ??
    input.severity ??
    ''
  )
    .toString()
    .trim()
    .toLowerCase();

  if (!VALID_SEVERITIES.includes(rawSeverity as ReportSeverity)) {
    throw new AppError(
      `Tingkat keparahan tidak valid. Pilihan yang tersedia: ${VALID_SEVERITIES.join(', ')}.`,
      400
    );
  }
  const severity = rawSeverity as ReportSeverity;

  const rawDeviceHash = (input.device_hash ?? input.deviceHash ?? '').toString().trim();
  if (!rawDeviceHash || rawDeviceHash.length < 4) {
    throw new AppError(
      'Identitas perangkat (device_hash) wajib diisi (minimal 4 karakter).',
      400
    );
  }
  const deviceHash = rawDeviceHash.toLowerCase();

  const validatedGeom = validateReportGeom(input.geom ?? input.location);

  let resolvedKelurahanId: Types.ObjectId | undefined;
  if (input.kelurahanId) {
    if (!Types.ObjectId.isValid(input.kelurahanId)) {
      throw new AppError('Format kelurahanId tidak valid.', 400);
    }
    const kelurahanExists = await Kelurahan.findById(input.kelurahanId).select('_id');
    if (!kelurahanExists) {
      throw new AppError('Data kelurahan yang dipilih tidak ditemukan.', 404);
    }
    resolvedKelurahanId = kelurahanExists._id;
  } else {
    const matchedKelurahan = await Kelurahan.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: validatedGeom,
        },
      },
    }).select('_id');

    if (matchedKelurahan) {
      resolvedKelurahanId = matchedKelurahan._id;
    }
  }

  const reporterName =
    (input.reporterName ?? input.nama_pelapor ?? 'Warga Anonim').toString().trim() ||
    'Warga Anonim';
  const description = (
    input.description ??
    input.deskripsi ??
    `Laporan warga kategori ${category.toUpperCase()} (${symptoms.join(', ')})`
  )
    .toString()
    .trim();
  const address = (input.address ?? input.alamat)?.toString().trim();
  const reporterContact = input.reporterContact?.toString().trim();

  const existingReport = await Report.findOne({ deviceHash }).sort({ updatedAt: -1 });

  let savedReport: IReport;
  let isUpdated = false;

  if (existingReport) {
    existingReport.reporterName = reporterName;
    if (reporterContact !== undefined) {
      existingReport.reporterContact = reporterContact;
    }
    existingReport.category = category;
    existingReport.symptoms = symptoms;
    existingReport.sickCount = sickCount;
    existingReport.age = age;
    existingReport.severity = severity;
    existingReport.description = description;
    existingReport.geom = validatedGeom;
    existingReport.location = validatedGeom;
    if (address !== undefined) {
      existingReport.address = address;
    }
    if (resolvedKelurahanId) {
      existingReport.kelurahanId = resolvedKelurahanId;
    }
    existingReport.reportedAt = new Date();

    savedReport = await existingReport.save();
    isUpdated = true;
  } else {
    savedReport = await Report.create({
      reporterName,
      ...(reporterContact ? { reporterContact } : {}),
      category,
      symptoms,
      sickCount,
      age,
      severity,
      deviceHash,
      description,
      geom: validatedGeom,
      location: validatedGeom,
      ...(address ? { address } : {}),
      ...(resolvedKelurahanId ? { kelurahanId: resolvedKelurahanId } : {}),
      status: 'pending',
      reportedAt: new Date(),
    });
    isUpdated = false;
  }

  await invalidatePublicMapCache();

  emitNewReport({
    event: SOCKET_EVENTS.REPORT_NEW,
    isUpdated,
    report: {
      id: savedReport._id.toString(),
      reporterName: savedReport.reporterName,
      category: savedReport.category,
      symptoms: savedReport.symptoms,
      sickCount: savedReport.sickCount,
      age: savedReport.age,
      severity: savedReport.severity,
      status: savedReport.status,
      geom: savedReport.geom,
      ...(savedReport.address ? { address: savedReport.address } : {}),
      ...(savedReport.kelurahanId
        ? { kelurahanId: savedReport.kelurahanId.toString() }
        : {}),
      reportedAt:
        savedReport.reportedAt instanceof Date
          ? savedReport.reportedAt.toISOString()
          : new Date(savedReport.reportedAt ?? Date.now()).toISOString(),
    },
    emittedAt: new Date().toISOString(),
  });

  return {
    report: savedReport,
    isUpdated,
  };
};

export const getPublicMapData = async (
  rawFilter: PublicMapQueryFilter = {}
): Promise<PublicMapResponseData> => {
  const categoryFilter = (rawFilter.category ?? rawFilter.kategori ?? '').trim().toLowerCase();
  const severityFilter = (rawFilter.severity ?? rawFilter.tingkat_keparahan ?? '')
    .trim()
    .toLowerCase();
  const statusFilter = (rawFilter.status ?? '').trim().toLowerCase();
  const kelurahanIdFilter = (rawFilter.kelurahanId ?? '').trim();
  const startDateFilter = (rawFilter.startDate ?? '').trim();
  const endDateFilter = (rawFilter.endDate ?? '').trim();
  const bboxFilter = (rawFilter.bbox ?? '').trim();

  const normalizedFilterRecord = {
    category: categoryFilter || undefined,
    severity: severityFilter || undefined,
    status: statusFilter || undefined,
    kelurahanId: kelurahanIdFilter || undefined,
    startDate: startDateFilter || undefined,
    endDate: endDateFilter || undefined,
    bbox: bboxFilter || undefined,
  };

  const cacheKey = buildFilterCacheKey(PUBLIC_MAP_CACHE_PREFIX, normalizedFilterRecord);

  const cachedMapData = await getCache<PublicMapResponseData>(cacheKey);
  if (cachedMapData) {
    return cachedMapData;
  }

  const mongoQuery: Record<string, unknown> = {
    status: { $ne: 'rejected' },
  };

  if (categoryFilter) {
    if (!VALID_CITIZEN_CATEGORIES.includes(categoryFilter as CitizenReportCategory)) {
      throw new AppError(
        "Filter kategori tidak valid. Gunakan 'ispa' atau 'diare'.",
        400
      );
    }
    mongoQuery.category = categoryFilter;
  }

  if (severityFilter) {
    if (!VALID_SEVERITIES.includes(severityFilter as ReportSeverity)) {
      throw new AppError(
        `Filter tingkat keparahan tidak valid. Pilihan: ${VALID_SEVERITIES.join(', ')}.`,
        400
      );
    }
    mongoQuery.severity = severityFilter;
  }

  if (statusFilter) {
    if (!VALID_STATUSES.includes(statusFilter as ReportStatus)) {
      throw new AppError(
        `Filter status tidak valid. Pilihan: ${VALID_STATUSES.join(', ')}.`,
        400
      );
    }
    mongoQuery.status = statusFilter;
  }

  if (kelurahanIdFilter) {
    if (!Types.ObjectId.isValid(kelurahanIdFilter)) {
      throw new AppError('Format parameter kelurahanId tidak valid.', 400);
    }
    mongoQuery.kelurahanId = new Types.ObjectId(kelurahanIdFilter);
  }

  if (startDateFilter || endDateFilter) {
    const reportedAtRange: Record<string, Date> = {};
    if (startDateFilter) {
      const parsedStart = new Date(startDateFilter);
      if (Number.isNaN(parsedStart.getTime())) {
        throw new AppError('Format parameter startDate tidak valid.', 400);
      }
      reportedAtRange.$gte = parsedStart;
    }
    if (endDateFilter) {
      const parsedEnd = new Date(endDateFilter);
      if (Number.isNaN(parsedEnd.getTime())) {
        throw new AppError('Format parameter endDate tidak valid.', 400);
      }
      reportedAtRange.$lte = parsedEnd;
    }
    mongoQuery.reportedAt = reportedAtRange;
  }

  if (bboxFilter) {
    const parts = bboxFilter.split(',').map((val) => Number(val.trim()));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      throw new AppError(
        'Format parameter bbox tidak valid. Gunakan format "minLng,minLat,maxLng,maxLat".',
        400
      );
    }
    const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
    mongoQuery.geom = {
      $geoWithin: {
        $box: [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
      },
    };
  }

  const reports = await Report.find(mongoQuery)
    .populate('kelurahanId', 'code name kecamatan')
    .sort({ reportedAt: -1 })
    .lean();

  const points: PublicMapPointItem[] = [];
  const heatmap: PublicHeatmapItem[] = [];
  const byCategory = { ispa: 0, diare: 0, other: 0 };
  const bySeverity: Record<string, number> = {};
  let totalSickCount = 0;

  for (const doc of reports) {
    const rawPoint = doc.geom?.coordinates?.length === 2 ? doc.geom : doc.location;
    if (!rawPoint || !Array.isArray(rawPoint.coordinates) || rawPoint.coordinates.length !== 2) {
      continue;
    }

    const jitteredCoords = applyCoordinateJitter(
      [rawPoint.coordinates[0], rawPoint.coordinates[1]],
      100,
      200
    );

    const jitteredGeom: IGeoPoint = {
      type: 'Point',
      coordinates: jitteredCoords,
    };

    const sickCount = typeof doc.sickCount === 'number' && doc.sickCount > 0 ? doc.sickCount : 1;
    const age = typeof doc.age === 'number' ? doc.age : 0;
    const severity = (doc.severity ?? 'sedang') as ReportSeverity;
    const category = String(doc.category ?? 'ispa');
    const status = (doc.status ?? 'pending') as ReportStatus;

    totalSickCount += sickCount;
    if (category === 'ispa') {
      byCategory.ispa += 1;
    } else if (category === 'diare') {
      byCategory.diare += 1;
    } else {
      byCategory.other += 1;
    }

    bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;

    const populatedKel = doc.kelurahanId as
      | { _id?: Types.ObjectId; code?: string; name?: string; kecamatan?: string }
      | undefined
      | null;

    const kelurahanInfo =
      populatedKel && typeof populatedKel === 'object' && populatedKel._id
        ? {
            id: populatedKel._id.toString(),
            code: populatedKel.code,
            name: populatedKel.name,
            kecamatan: populatedKel.kecamatan,
          }
        : null;

    const reportedAtIso =
      doc.reportedAt instanceof Date
        ? doc.reportedAt.toISOString()
        : new Date(doc.reportedAt ?? Date.now()).toISOString();

    points.push({
      id: doc._id.toString(),
      category,
      symptoms: Array.isArray(doc.symptoms) ? doc.symptoms : [],
      sickCount,
      age,
      severity,
      status,
      geom: jitteredGeom,
      kelurahan: kelurahanInfo,
      reportedAt: reportedAtIso,
    });

    const severityWeight = SEVERITY_WEIGHT_MAP[severity] ?? 2;
    const rawWeight = severityWeight * Math.min(sickCount, 10);
    const normalizedIntensity = Number(Math.min(1, Math.max(0.1, rawWeight / 12)).toFixed(2));

    heatmap.push({
      coordinates: jitteredCoords,
      lng: jitteredCoords[0],
      lat: jitteredCoords[1],
      weight: rawWeight,
      intensity: normalizedIntensity,
      category,
      severity,
      sickCount,
    });
  }

  const responseData: PublicMapResponseData = {
    points,
    geoJson: {
      type: 'FeatureCollection',
      features: points.map(({ geom, ...properties }) => ({
        type: 'Feature' as const,
        geometry: geom,
        properties,
      })),
    },
    heatmap,
    summary: {
      totalReports: points.length,
      totalSickCount,
      byCategory,
      bySeverity,
      privacyJitterMeters: {
        min: 100,
        max: 200,
      },
      cacheKey,
      generatedAt: new Date().toISOString(),
    },
  };

  await setCache(cacheKey, responseData, DEFAULT_CACHE_TTL);

  return responseData;
};
