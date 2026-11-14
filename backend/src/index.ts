import 'dotenv/config';
import { createServer } from 'node:http';
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { connectDatabase } from './config/database.js';
import { connectRedis, redisClient } from './config/redis.js';
import { initSocketServer } from './config/socket.js';
import { startAqiCronJob } from './jobs/aqiCron.js';
import { startClusterCronJob } from './jobs/clusterCron.js';
import apiRoutes from './routes.js';

const app: Express = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: 'RespiraWatch WebGIS API',
    redisStatus: redisClient.status,
    websocket: 'enabled',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiRoutes);
app.use('/', apiRoutes);

const bootstrap = async (): Promise<void> => {
  await connectDatabase();
  await connectRedis();
  initSocketServer(httpServer);
  startAqiCronJob();
  startClusterCronJob();

  httpServer.listen(port, () => {
    console.log(
      `[Server] RespiraWatch Backend (HTTP + Socket.io) berjalan di http://localhost:${port}`
    );
  });
};

bootstrap().catch((err) => {
  console.error('[Server] Gagal menjalankan server:', err);
  process.exit(1);
});

export { httpServer };
export default app;
