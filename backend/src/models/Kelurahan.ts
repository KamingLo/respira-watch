import { Schema, model, type Document } from 'mongoose';
import { GeoPointSchema, GeoPolygonSchema, type IGeoPoint, type IGeoPolygon } from './GeoJSON.js';

export interface IKelurahan extends Document {
  code: string;
  name: string;
  kecamatan: string;
  kota: string;
  provinsi: string;
  population: number;
  areaSqKm?: number;
  boundary: IGeoPolygon;
  centroid: IGeoPoint;
  baselineRiskLevel: 'low' | 'moderate' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}

const KelurahanSchema = new Schema<IKelurahan>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    kecamatan: { type: String, required: true, trim: true },
    kota: { type: String, required: true, trim: true },
    provinsi: { type: String, required: true, trim: true },
    population: { type: Number, default: 0, min: 0 },
    areaSqKm: { type: Number, min: 0 },
    boundary: {
      type: GeoPolygonSchema,
      required: true,
    },
    centroid: {
      type: GeoPointSchema,
      required: true,
    },
    baselineRiskLevel: {
      type: String,
      enum: ['low', 'moderate', 'high', 'critical'],
      default: 'low',
    },
  },
  { timestamps: true }
);

KelurahanSchema.index({ boundary: '2dsphere' });
KelurahanSchema.index({ centroid: '2dsphere' });

export const Kelurahan = model<IKelurahan>('Kelurahan', KelurahanSchema);
