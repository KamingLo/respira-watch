import { Schema, model, type Document, type Types } from 'mongoose';
import { GeoPointSchema, GeoPolygonSchema, type IGeoPoint, type IGeoPolygon } from './GeoJSON.js';

export type ClusterCategory = 'ispa' | 'diare';
export type ClusterRiskStatus = 'Waspada' | 'Siaga' | 'Prioritas';
export type ClusterRiskColor = 'Kuning' | 'Oranye' | 'Merah';
export type ClusterLegacyRiskLevel = 'low' | 'moderate' | 'high' | 'outbreak';
export type ClusterStatus = 'active' | 'monitoring' | 'verified' | 'resolved';

export interface ICluster extends Document {
  clusterCode: string;
  category: ClusterCategory;
  kelurahanId?: Types.ObjectId;
  center: IGeoPoint;
  boundary?: IGeoPolygon;
  radiusMeters: number;
  reportCount: number;
  totalSickCount: number;
  reportIds: Types.ObjectId[];
  averageAqi?: number;
  dominantSymptoms: string[];
  riskStatus: ClusterRiskStatus;
  riskColor: ClusterRiskColor;
  colorHex: string;
  riskLevel: ClusterLegacyRiskLevel;
  status: ClusterStatus;
  assignedOfficerId?: Types.ObjectId;
  firstDetectedAt: Date;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ClusterSchema = new Schema<ICluster>(
  {
    clusterCode: { type: String, required: true, unique: true, trim: true },
    category: {
      type: String,
      enum: ['ispa', 'diare'],
      required: true,
      default: 'ispa',
      index: true,
    },
    kelurahanId: { type: Schema.Types.ObjectId, ref: 'Kelurahan', index: true },
    center: {
      type: GeoPointSchema,
      required: true,
    },
    boundary: {
      type: GeoPolygonSchema,
      required: false,
    },
    radiusMeters: { type: Number, required: true, min: 0 },
    reportCount: { type: Number, required: true, default: 1, min: 0 },
    totalSickCount: { type: Number, required: true, default: 1, min: 0 },
    reportIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Report' }],
      default: [],
    },
    averageAqi: { type: Number, min: 0 },
    dominantSymptoms: { type: [String], default: [] },
    riskStatus: {
      type: String,
      enum: ['Waspada', 'Siaga', 'Prioritas'],
      required: true,
      default: 'Waspada',
      index: true,
    },
    riskColor: {
      type: String,
      enum: ['Kuning', 'Oranye', 'Merah'],
      required: true,
      default: 'Kuning',
    },
    colorHex: {
      type: String,
      required: true,
      default: '#EAB308',
      trim: true,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'moderate', 'high', 'outbreak'],
      default: 'moderate',
    },
    status: {
      type: String,
      enum: ['active', 'monitoring', 'verified', 'resolved'],
      default: 'active',
      index: true,
    },
    assignedOfficerId: { type: Schema.Types.ObjectId, ref: 'Officer' },
    firstDetectedAt: { type: Date, default: Date.now },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ClusterSchema.index({ center: '2dsphere' });
ClusterSchema.index({ boundary: '2dsphere' });
ClusterSchema.index({ category: 1, status: 1 });

export const Cluster = model<ICluster>('Cluster', ClusterSchema);
