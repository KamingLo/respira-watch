import { Schema, model, type Document, type Types } from 'mongoose';
import { GeoPointSchema, GeoPolygonSchema, type IGeoPoint, type IGeoPolygon } from './GeoJSON.js';

export interface ICluster extends Document {
  clusterCode: string;
  kelurahanId?: Types.ObjectId;
  center: IGeoPoint;
  boundary?: IGeoPolygon;
  radiusMeters: number;
  reportCount: number;
  averageAqi?: number;
  dominantSymptoms: string[];
  riskLevel: 'low' | 'moderate' | 'high' | 'outbreak';
  status: 'active' | 'monitoring' | 'resolved';
  assignedOfficerId?: Types.ObjectId;
  firstDetectedAt: Date;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ClusterSchema = new Schema<ICluster>(
  {
    clusterCode: { type: String, required: true, unique: true, trim: true },
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
    averageAqi: { type: Number, min: 0 },
    dominantSymptoms: { type: [String], default: [] },
    riskLevel: {
      type: String,
      enum: ['low', 'moderate', 'high', 'outbreak'],
      default: 'moderate',
    },
    status: {
      type: String,
      enum: ['active', 'monitoring', 'resolved'],
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

export const Cluster = model<ICluster>('Cluster', ClusterSchema);
