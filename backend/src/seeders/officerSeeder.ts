import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { Officer, type OfficerRole } from '../models/Officer.js';
import type { IGeoPoint } from '../models/GeoJSON.js';
import { hashPassword } from '../utils/password.js';

interface SeedOfficerData {
  name: string;
  nip: string;
  email: string;
  password: string;
  phone: string;
  role: OfficerRole;
  baseLocation: IGeoPoint;
  isActive: boolean;
}

const initialOfficers: SeedOfficerData[] = [
  {
    name: 'Admin Utama RespiraWatch',
    nip: '199001012020011001',
    email: 'admin@respirawatch.id',
    password: 'Password123!',
    phone: '081210000001',
    role: 'admin',
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
    baseLocation: {
      type: 'Point',
      coordinates: [106.822745, -6.229728],
    },
    isActive: true,
  },
];

const seedOfficers = async (): Promise<void> => {
  const isFresh = process.argv.includes('--fresh');

  try {
    await connectDatabase();

    if (isFresh) {
      await Officer.deleteMany({});
      console.log('[Seeder] Koleksi Officer berhasil dikosongkan (--fresh).');
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of initialOfficers) {
      const passwordHash = await hashPassword(item.password);
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
        existing.baseLocation = item.baseLocation;
        existing.isActive = item.isActive;
        await existing.save();
        updatedCount++;
        console.log(`[Seeder] Diperbarui: ${item.name} (${item.email}) - Role: ${item.role}`);
      } else {
        await Officer.create({
          name: item.name,
          nip: item.nip,
          email: item.email,
          passwordHash,
          phone: item.phone,
          role: item.role,
          baseLocation: item.baseLocation,
          isActive: item.isActive,
        });
        createdCount++;
        console.log(`[Seeder] Ditambahkan: ${item.name} (${item.email}) - Role: ${item.role}`);
      }
    }

    console.log(
      `\n[Seeder] Selesai! ${createdCount} petugas baru ditambahkan, ${updatedCount} petugas diperbarui.`
    );
  } catch (error) {
    console.error('[Seeder] Gagal menjalankan seeder Officer:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedOfficers();
