import { Schema } from 'mongoose';

export interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface IGeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface IGeoMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export const GeoPointSchema = new Schema<IGeoPoint>(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (coords: number[]) =>
          Array.isArray(coords) &&
          coords.length === 2 &&
          coords[0] !== undefined &&
          coords[1] !== undefined &&
          coords[0] >= -180 &&
          coords[0] <= 180 &&
          coords[1] >= -90 &&
          coords[1] <= 90,
        message: 'Koordinat GeoJSON Point harus berupa [longitude, latitude] yang valid.',
      },
    },
  },
  { _id: false }
);

export const GeoPolygonSchema = new Schema<IGeoPolygon>(
  {
    type: {
      type: String,
      enum: ['Polygon'],
      required: true,
      default: 'Polygon',
    },
    coordinates: {
      type: [[[Number]]],
      required: true,
    },
  },
  { _id: false }
);
