import { Schema, model, type Document, type Types } from 'mongoose';
import { GeoPointSchema, type IGeoPoint } from './GeoJSON.js';

export type OfficerRole = 'admin' | 'field_officer' | 'health_analyst';

export interface IOfficer extends Document {
  name: string;
  nip: string;
  email: string;
  passwordHash: string;
  phone?: string;
  role: OfficerRole;
  assignedKelurahan?: Types.ObjectId;
  baseLocation?: IGeoPoint;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OfficerSchema = new Schema<IOfficer>(
  {
    name: { type: String, required: true, trim: true },
    nip: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    role: {
      type: String,
      enum: ['admin', 'field_officer', 'health_analyst'],
      default: 'field_officer',
    },
    assignedKelurahan: { type: Schema.Types.ObjectId, ref: 'Kelurahan' },
    baseLocation: {
      type: GeoPointSchema,
      required: false,
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

OfficerSchema.index({ baseLocation: '2dsphere' });

export const Officer = model<IOfficer>('Officer', OfficerSchema);
