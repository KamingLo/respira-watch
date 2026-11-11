import { Schema, model, type Document, type Types } from 'mongoose';
import { GeoPointSchema, GeoPolygonSchema, type IGeoPoint, type IGeoPolygon } from './GeoJSON.js';

export interface IGridCell extends Document {
  cellCode: string;
  kelurahanId?: Types.ObjectId;
  geometry: IGeoPolygon;
  centroid: IGeoPoint;
  currentAqi: number;
  dominantPollutant?: 'PM2.5' | 'PM10' | 'CO' | 'NO2' | 'SO2' | 'O3';
  activeReportCount: number;
  vulnerabilityIndex: number;
  riskLevel: 'safe' | 'moderate' | 'unhealthy' | 'very_unhealthy' | 'hazardous';
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GridCellSchema = new Schema<IGridCell>(
  {
    cellCode: { type: String, required: true, unique: true, trim: true },
    kelurahanId: { type: Schema.Types.ObjectId, ref: 'Kelurahan', index: true },
    geometry: {
      type: GeoPolygonSchema,
      required: true,
    },
    centroid: {
      type: GeoPointSchema,
      required: true,
    },
    currentAqi: { type: Number, default: 0, min: 0 },
    dominantPollutant: {
      type: String,
      enum: ['PM2.5', 'PM10', 'CO', 'NO2', 'SO2', 'O3'],
    },
    activeReportCount: { type: Number, default: 0, min: 0 },
    vulnerabilityIndex: { type: Number, default: 0, min: 0, max: 1 },
    riskLevel: {
      type: String,
      enum: ['safe', 'moderate', 'unhealthy', 'very_unhealthy', 'hazardous'],
      default: 'safe',
    },
    lastCalculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

GridCellSchema.index({ geometry: '2dsphere' });
GridCellSchema.index({ centroid: '2dsphere' });

export const GridCell = model<IGridCell>('GridCell', GridCellSchema);
