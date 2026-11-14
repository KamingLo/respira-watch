import { Transform, type TransformCallback } from 'node:stream';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Cluster } from '../models/Cluster.js';
import { Report } from '../models/Report.js';
import { AppError } from '../utils/AppError.js';
import { handleControllerError } from '../utils/response.js';

export const escapeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value)
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n]/g, ' ')
    .trim();

  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  if (str.includes(',') || str.includes('"') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};

export const formatCsvRow = (columns: unknown[]): string =>
  `${columns.map((col) => escapeCsvCell(col)).join(',')}\n`;

export const CSV_EXPORT_HEADERS: readonly string[] = [
  'cluster_code',
  'cluster_category',
  'cluster_risk_status',
  'cluster_status',
  'cluster_average_aqi',
  'report_id',
  'reported_at_iso',
  'reporter_name',
  'disease_category',
  'symptoms',
  'sick_count',
  'patient_age',
  'severity',
  'report_status',
  'longitude',
  'latitude',
  'kelurahan_code',
  'kelurahan_name',
  'kecamatan',
  'address',
  'description',
] as const;

export interface ClusterExportMeta {
  clusterCode: string;
  category: string;
  riskStatus: string;
  status: string;
  averageAqi: number;
}

export const createClusterReportCsvTransformStream = (
  clusterMeta: ClusterExportMeta
): Transform => {
  let headerWritten = false;

  return new Transform({
    writableObjectMode: true,
    readableObjectMode: false,
    transform(chunk: Record<string, unknown>, _encoding: BufferEncoding, callback: TransformCallback) {
      try {
        if (!headerWritten) {
          headerWritten = true;
          this.push(`\uFEFF${formatCsvRow([...CSV_EXPORT_HEADERS])}`);
        }

        const rawGeom = (chunk.geom ?? chunk.location) as
          | { coordinates?: [number, number] }
          | undefined;
        const coords = Array.isArray(rawGeom?.coordinates) ? rawGeom.coordinates : [0, 0];
        const lng = Number(coords[0] ?? 0);
        const lat = Number(coords[1] ?? 0);

        const populatedKel = chunk.kelurahanId as
          | { code?: string; name?: string; kecamatan?: string }
          | undefined
          | null;

        const symptomsList = Array.isArray(chunk.symptoms)
          ? (chunk.symptoms as unknown[]).map((s) => String(s)).join('; ')
          : '';

        const reportedAtIso =
          chunk.reportedAt instanceof Date
            ? chunk.reportedAt.toISOString()
            : chunk.reportedAt
              ? new Date(String(chunk.reportedAt)).toISOString()
              : '';

        const row = formatCsvRow([
          clusterMeta.clusterCode,
          clusterMeta.category,
          clusterMeta.riskStatus,
          clusterMeta.status,
          clusterMeta.averageAqi,
          chunk._id ? String(chunk._id) : '',
          reportedAtIso,
          chunk.reporterName ?? 'Warga Anonim',
          chunk.category ?? clusterMeta.category,
          symptomsList,
          chunk.sickCount ?? 1,
          chunk.age ?? 0,
          chunk.severity ?? 'sedang',
          chunk.status ?? 'pending',
          lng,
          lat,
          populatedKel && typeof populatedKel === 'object' ? populatedKel.code ?? '' : '',
          populatedKel && typeof populatedKel === 'object' ? populatedKel.name ?? '' : '',
          populatedKel && typeof populatedKel === 'object' ? populatedKel.kecamatan ?? '' : '',
          chunk.address ?? '',
          chunk.description ?? '',
        ]);

        callback(null, row);
      } catch (err) {
        callback(err instanceof Error ? err : new Error('Gagal memformat baris CSV'));
      }
    },
    flush(callback: TransformCallback) {
      if (!headerWritten) {
        headerWritten = true;
        this.push(`\uFEFF${formatCsvRow([...CSV_EXPORT_HEADERS])}`);
      }
      callback();
    },
  });
};

export const exportClusterCsv = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawClusterId = String(req.params.clusterId ?? '').trim();
    if (!rawClusterId) {
      throw new AppError('Parameter clusterId wajib disertakan.', 400);
    }

    const lookupQuery = Types.ObjectId.isValid(rawClusterId)
      ? { _id: new Types.ObjectId(rawClusterId) }
      : { clusterCode: rawClusterId.toUpperCase() };

    const clusterDoc = await Cluster.findOne(lookupQuery)
      .select(
        '_id clusterCode category riskStatus status averageAqi reportIds'
      )
      .lean();

    if (!clusterDoc) {
      throw new AppError('Data klaster untuk ekspor CSV tidak ditemukan.', 404);
    }

    const safeFileCode = clusterDoc.clusterCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `respirawatch-${safeFileCode}-${dateStamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Cluster-Code', clusterDoc.clusterCode);

    const reportQuery =
      Array.isArray(clusterDoc.reportIds) && clusterDoc.reportIds.length > 0
        ? {
            $or: [
              { _id: { $in: clusterDoc.reportIds } },
              { clusterId: clusterDoc._id },
            ],
          }
        : { clusterId: clusterDoc._id };

    const reportCursor = Report.find(reportQuery)
      .populate('kelurahanId', 'code name kecamatan')
      .sort({ reportedAt: -1 })
      .lean()
      .cursor();

    const csvTransform = createClusterReportCsvTransformStream({
      clusterCode: clusterDoc.clusterCode,
      category: clusterDoc.category,
      riskStatus: clusterDoc.riskStatus,
      status: clusterDoc.status,
      averageAqi: Math.round(clusterDoc.averageAqi ?? 50),
    });

    req.on('close', () => {
      void reportCursor.close();
    });

    reportCursor.on('error', (streamErr) => {
      console.error('[ExportController] Cursor stream error:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Terjadi kesalahan saat mengalirkan data CSV klaster.',
        });
      } else {
        res.end();
      }
    });

    csvTransform.on('error', (transformErr) => {
      console.error('[ExportController] CSV transform error:', transformErr);
      res.end();
    });

    reportCursor.pipe(csvTransform).pipe(res);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'ExportController.exportClusterCsv',
      'Gagal mengekspor data laporan klaster ke format CSV.'
    );
  }
};
