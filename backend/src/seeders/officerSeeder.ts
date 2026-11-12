import 'dotenv/config';
import mongoose, { type Types } from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { Officer, type OfficerRole } from '../models/Officer.js';
import { Kelurahan, type IKelurahan } from '../models/Kelurahan.js';
import type { IGeoPoint, IGeoPolygon } from '../models/GeoJSON.js';
import { hashPassword } from '../utils/password.js';

interface SeedKelurahanData {
  code: string;
  name: string;
  kecamatan: string;
  kota: string;
  provinsi: string;
  population: number;
  areaSqKm: number;
  boundary: IGeoPolygon;
  centroid: IGeoPoint;
  baselineRiskLevel: IKelurahan['baselineRiskLevel'];
}

interface SeedOfficerData {
  name: string;
  nip: string;
  email: string;
  password: string;
  phone: string;
  role: OfficerRole;
  kelurahanCode: string;
  baseLocation: IGeoPoint;
  isActive: boolean;
}

const initialKelurahans: SeedKelurahanData[] = [
  {
    code: '31.71.01.1001',
    name: 'Gambir',
    kecamatan: 'Gambir',
    kota: 'Jakarta Pusat',
    provinsi: 'DKI Jakarta',
    population: 3420,
    areaSqKm: 2.58,
    centroid: {
      type: 'Point',
      coordinates: [106.827153, -6.175392],
    },
    boundary: {
      type: 'Polygon',
      coordinates: [
        [
          [106.82, -6.17],
          [106.835, -6.17],
          [106.835, -6.182],
          [106.82, -6.182],
          [106.82, -6.17],
        ],
      ],
    },
    baselineRiskLevel: 'moderate',
  },
  {
    code: '31.74.01.1001',
    name: 'Manggarai',
    kecamatan: 'Tebet',
    kota: 'Jakarta Selatan',
    provinsi: 'DKI Jakarta',
    population: 33510,
    areaSqKm: 0.95,
    centroid: {
      type: 'Point',
      coordinates: [106.845599, -6.208763],
    },
    boundary: {
      type: 'Polygon',
      coordinates: [
        [
          [106.84, -6.203],
          [106.852, -6.203],
          [106.852, -6.215],
          [106.84, -6.215],
          [106.84, -6.203],
        ],
      ],
    },
    baselineRiskLevel: 'high',
  },
  {
    code: '31.74.07.1005',
    name: 'Senayan',
    kecamatan: 'Kebayoran Baru',
    kota: 'Jakarta Selatan',
    provinsi: 'DKI Jakarta',
    population: 4820,
    areaSqKm: 1.53,
    centroid: {
      type: 'Point',
      coordinates: [106.822745, -6.229728],
    },
    boundary: {
      type: 'Polygon',
      coordinates: [
        [
          [106.815, -6.222],
          [106.83, -6.222],
          [106.83, -6.236],
          [106.815, -6.236],
          [106.815, -6.222],
        ],
      ],
    },
    baselineRiskLevel: 'low',
  },
];

const initialOfficers: SeedOfficerData[] = [
  {
    name: 'Admin Utama RespiraWatch',
    nip: '199001012020011001',
    email: 'admin@respirawatch.id',
    password: 'Password123!',
    phone: '081210000001',
    role: 'admin',
    kelurahanCode: '31.71.01.1001',
    baseLocation: {
      type: 'Point',
      coordinates: [106.827153, -6.175392],
    },
    isActive: true,
  },
  {
    name: 'Budi Santoso (Petugas Lapangan)',
    nip: '199203152021011002',
    email: 'field@respirawatch.id',
    password: 'Password123!',
    phone: '081210000002',
    role: 'field_officer',
    kelurahanCode: '31.74.01.1001',
    baseLocation: {
      type: 'Point',
      coordinates: [106.845599, -6.208763],
    },
    isActive: true,
  },
  {
    name: 'dr. Siti Rahmawati (Analis Kesehatan)',
    nip: '199407202022012003',
    email: 'analyst@respirawatch.id',
    password: 'Password123!',
    phone: '081210000003',
    role: 'health_analyst',
    kelurahanCode: '31.74.07.1005',
    baseLocation: {
      type: 'Point',
      coordinates: [106.822745, -6.229728],
    },
    isActive: true,
  },
];

const seedOfficersAndKelurahans = async (): Promise<void> => {
  const isFresh = process.argv.includes('--fresh');

  try {
    await connectDatabase();

    if (isFresh) {
      await Officer.deleteMany({});
      await Kelurahan.deleteMany({});
      console.log('[Seeder] Koleksi Officer dan Kelurahan berhasil dikosongkan (--fresh).');
    }

    const kelurahanMap = new Map<string, Types.ObjectId>();
    let kelurahanCreatedCount = 0;
    let kelurahanUpdatedCount = 0;

    for (const kel of initialKelurahans) {
      const existingKelurahan = await Kelurahan.findOne({ code: kel.code });

      if (existingKelurahan) {
        existingKelurahan.name = kel.name;
        existingKelurahan.kecamatan = kel.kecamatan;
        existingKelurahan.kota = kel.kota;
        existingKelurahan.provinsi = kel.provinsi;
        existingKelurahan.population = kel.population;
        existingKelurahan.areaSqKm = kel.areaSqKm;
        existingKelurahan.boundary = kel.boundary;
        existingKelurahan.centroid = kel.centroid;
        existingKelurahan.baselineRiskLevel = kel.baselineRiskLevel;
        await existingKelurahan.save();
        kelurahanMap.set(kel.code, existingKelurahan._id);
        kelurahanUpdatedCount++;
        console.log(`[Seeder] Kelurahan diperbarui: ${kel.name} (${kel.code})`);
      } else {
        const createdKelurahan = await Kelurahan.create(kel);
        kelurahanMap.set(kel.code, createdKelurahan._id);
        kelurahanCreatedCount++;
        console.log(`[Seeder] Kelurahan ditambahkan: ${kel.name} (${kel.code})`);
      }
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of initialOfficers) {
      const passwordHash = await hashPassword(item.password);
      const assignedKelurahanId = kelurahanMap.get(item.kelurahanCode);
      const existing = await Officer.findOne({
        $or: [{ email: item.email }, { nip: item.nip }],
      });

      if (existing) {
        existing.name = item.name;
        existing.nip = item.nip;
        existing.email = item.email;
        existing.passwordHash = passwordHash;
        existing.phone = item.phone;
        existing.role = item.role;
        if (assignedKelurahanId) {
          existing.assignedKelurahan = assignedKelurahanId;
        }
        existing.baseLocation = item.baseLocation;
        existing.isActive = item.isActive;
        await existing.save();
        updatedCount++;
        console.log(`[Seeder] Petugas diperbarui: ${item.name} (${item.email}) - Role: ${item.role}`);
      } else {
        await Officer.create({
          name: item.name,
          nip: item.nip,
          email: item.email,
          passwordHash,
          phone: item.phone,
          role: item.role,
          ...(assignedKelurahanId ? { assignedKelurahan: assignedKelurahanId } : {}),
          baseLocation: item.baseLocation,
          isActive: item.isActive,
        });
        createdCount++;
        console.log(`[Seeder] Petugas ditambahkan: ${item.name} (${item.email}) - Role: ${item.role}`);
      }
    }

    console.log(
      `\n[Seeder] Selesai! Kelurahan (${kelurahanCreatedCount} baru, ${kelurahanUpdatedCount} diperbarui) | Petugas (${createdCount} baru, ${updatedCount} diperbarui).`
    );
  } catch (error) {
    console.error('[Seeder] Gagal menjalankan seeder Officer & Kelurahan:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedOfficersAndKelurahans();
