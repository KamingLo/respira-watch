import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/respirawatch';

  try {
    mongoose.connection.on('connected', () => {
      console.log('[MongoDB] Terhubung ke database RespiraWatch');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Koneksi error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Koneksi terputus');
    });

    await mongoose.connect(mongoUri, {
      autoIndex: true,
    });
  } catch (error) {
    console.error('[MongoDB] Gagal menghubungkan ke database:', error);
    process.exit(1);
  }
};
