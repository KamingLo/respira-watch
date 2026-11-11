import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { connectDatabase } from './config/database.js';
import { connectRedis, redisClient } from './config/redis.js';
import apiRoutes from './routes.js';

const app: Express = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: 'RespiraWatch WebGIS API',
    redisStatus: redisClient.status,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiRoutes);

const bootstrap = async (): Promise<void> => {
  await connectDatabase();
  await connectRedis();

  app.listen(port, () => {
    console.log(`[Server] RespiraWatch Backend berjalan di http://localhost:${port}`);
  });
};

bootstrap().catch((err) => {
  console.error('[Server] Gagal menjalankan server:', err);
  process.exit(1);
});

export default app;
