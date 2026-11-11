import { Schema, model, type Document, type Types } from 'mongoose';
import { GeoPointSchema, type IGeoPoint } from './GeoJSON.js';

export type AqiCategory =
  | 'baik'
  | 'sedang'
  | 'tidak_sehat_bagi_kelompok_sensitif'
  | 'tidak_sehat'
  | 'sangat_tidak_sehat'
  | 'berbahaya';

export interface IAqiReading extends Document {
  stationCode: string;
  stationName: string;
  source: 'iot_sensor' | 'government_station' | 'external_api' | 'manual_measurement';
  location: IGeoPoint;
  kelurahanId?: Types.ObjectId;
  gridCellId?: Types.ObjectId;
  aqi: number;
  category: AqiCategory;
  pollutants: {
    pm25?: number;
    pm10?: number;
    co?: number;
    no2?: number;
    so2?: number;
    o3?: number;
  };
  weather?: {
    temperatureC?: number;
    humidityPct?: number;
    windSpeedKmh?: number;
    windDirectionDeg?: number;
  };
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AqiReadingSchema = new Schema<IAqiReading>(
  {
    stationCode: { type: String, required: true, trim: true, index: true },
    stationName: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: ['iot_sensor', 'government_station', 'external_api', 'manual_measurement'],
      default: 'iot_sensor',
    },
    location: {
      type: GeoPointSchema,
      required: true,
    },
    kelurahanId: { type: Schema.Types.ObjectId, ref: 'Kelurahan', index: true },
    gridCellId: { type: Schema.Types.ObjectId, ref: 'GridCell', index: true },
    aqi: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: [
        'baik',
        'sedang',
        'tidak_sehat_bagi_kelompok_sensitif',
        'tidak_sehat',
        'sangat_tidak_sehat',
        'berbahaya',
      ],
      required: true,
    },
    pollutants: {
      pm25: { type: Number, min: 0 },
      pm10: { type: Number, min: 0 },
      co: { type: Number, min: 0 },
      no2: { type: Number, min: 0 },
      so2: { type: Number, min: 0 },
      o3: { type: Number, min: 0 },
    },
    weather: {
      temperatureC: { type: Number },
      humidityPct: { type: Number, min: 0, max: 100 },
      windSpeedKmh: { type: Number, min: 0 },
      windDirectionDeg: { type: Number, min: 0, max: 360 },
    },
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

AqiReadingSchema.index({ location: '2dsphere' });
AqiReadingSchema.index({ stationCode: 1, recordedAt: -1 });

export const AqiReading = model<IAqiReading>('AqiReading', AqiReadingSchema);
