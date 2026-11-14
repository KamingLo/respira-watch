import { Schema, model, type Document, type Types } from 'mongoose';
import { GeoPointSchema, type IGeoPoint } from './GeoJSON.js';

export type CitizenReportCategory = 'ispa' | 'diare';
export type LegacyReportCategory = 'respiratory_symptom' | 'air_pollution_source' | 'both';
export type ReportCategory = CitizenReportCategory | LegacyReportCategory;

export type ReportSeverity =
  | 'ringan'
  | 'sedang'
  | 'berat'
  | 'kritis'
  | 'mild'
  | 'moderate'
  | 'severe'
  | 'critical';
export type ReportAgeGroup = 'balita' | 'anak' | 'remaja' | 'dewasa' | 'lansia';
export type ReportStatus = 'pending' | 'verified' | 'in_progress' | 'resolved' | 'rejected';

export interface IReportLocationSuggestion {
  name: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
}

const ReportLocationSuggestionSchema = new Schema<IReportLocationSuggestion>(
  {
    name: { type: String, required: true, trim: true },
    kecamatan: { type: String, trim: true },
    kota: { type: String, trim: true },
    provinsi: { type: String, trim: true },
  },
  { _id: false }
);

export interface IReport extends Document {
  reporterName: string;
  reporterContact?: string;
  category: ReportCategory;
  symptoms: string[];
  sickCount: number;
  age: number;
  ageGroups: ReportAgeGroup[];
  pollutionType?: 'open_burning' | 'industrial_smoke' | 'vehicle_emission' | 'dust' | 'odor' | 'other';
  severity: ReportSeverity;
  deviceHash: string;
  description: string;
  photoUrls: string[];
  geom: IGeoPoint;
  location: IGeoPoint;
  address?: string;
  locationSuggestion?: IReportLocationSuggestion;
  kelurahanId?: Types.ObjectId;
  gridCellId?: Types.ObjectId;
  clusterId?: Types.ObjectId;
  status: ReportStatus;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  reportedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterName: { type: String, required: true, default: 'Warga Anonim', trim: true },
    reporterContact: { type: String, trim: true },
    category: {
      type: String,
      enum: ['ispa', 'diare', 'respiratory_symptom', 'air_pollution_source', 'both'],
      required: true,
      index: true,
    },
    symptoms: { type: [String], required: true, default: [] },
    sickCount: { type: Number, required: true, default: 1, min: 1 },
    age: { type: Number, required: true, default: 0, min: 0, max: 120 },
    ageGroups: {
      type: [
        {
          type: String,
          enum: ['balita', 'anak', 'remaja', 'dewasa', 'lansia'],
        },
      ],
      default: [],
    },
    pollutionType: {
      type: String,
      enum: ['open_burning', 'industrial_smoke', 'vehicle_emission', 'dust', 'odor', 'other'],
    },
    severity: {
      type: String,
      enum: ['ringan', 'sedang', 'berat', 'kritis', 'mild', 'moderate', 'severe', 'critical'],
      required: true,
      default: 'sedang',
      index: true,
    },
    deviceHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: { type: String, default: '', trim: true },
    photoUrls: { type: [String], default: [] },
    geom: {
      type: GeoPointSchema,
      required: true,
    },
    location: {
      type: GeoPointSchema,
      required: true,
    },
    address: { type: String, trim: true },
    locationSuggestion: { type: ReportLocationSuggestionSchema },
    kelurahanId: { type: Schema.Types.ObjectId, ref: 'Kelurahan', index: true },
    gridCellId: { type: Schema.Types.ObjectId, ref: 'GridCell', index: true },
    clusterId: { type: Schema.Types.ObjectId, ref: 'Cluster', index: true },
    status: {
      type: String,
      enum: ['pending', 'verified', 'in_progress', 'resolved', 'rejected'],
      default: 'pending',
      index: true,
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'Officer' },
    verifiedAt: { type: Date },
    reportedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

ReportSchema.index({ geom: '2dsphere' });
ReportSchema.index({ location: '2dsphere' });

export const Report = model<IReport>('Report', ReportSchema);
