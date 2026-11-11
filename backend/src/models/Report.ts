import { Schema, model, type Document, type Types } from 'mongoose';
import { GeoPointSchema, type IGeoPoint } from './GeoJSON.js';

export type ReportCategory = 'respiratory_symptom' | 'air_pollution_source' | 'both';
export type ReportStatus = 'pending' | 'verified' | 'in_progress' | 'resolved' | 'rejected';

export interface IReport extends Document {
  reporterName: string;
  reporterContact?: string;
  category: ReportCategory;
  symptoms: string[];
  pollutionType?: 'open_burning' | 'industrial_smoke' | 'vehicle_emission' | 'dust' | 'odor' | 'other';
  severity: 'mild' | 'moderate' | 'severe' | 'critical';
  description: string;
  photoUrls: string[];
  location: IGeoPoint;
  address?: string;
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
    reporterName: { type: String, required: true, trim: true },
    reporterContact: { type: String, trim: true },
    category: {
      type: String,
      enum: ['respiratory_symptom', 'air_pollution_source', 'both'],
      required: true,
    },
    symptoms: { type: [String], default: [] },
    pollutionType: {
      type: String,
      enum: ['open_burning', 'industrial_smoke', 'vehicle_emission', 'dust', 'odor', 'other'],
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe', 'critical'],
      default: 'moderate',
    },
    description: { type: String, required: true, trim: true },
    photoUrls: { type: [String], default: [] },
    location: {
      type: GeoPointSchema,
      required: true,
    },
    address: { type: String, trim: true },
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

ReportSchema.index({ location: '2dsphere' });

export const Report = model<IReport>('Report', ReportSchema);
