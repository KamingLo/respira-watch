import 'dotenv/config';
import express, { type Request, type Response } from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  // Menggunakan variabel dari .env
  const message = process.env.GREETING_MESSAGE || 'Halo, Express dengan TypeScript berjalan!';
  res.send(message);
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});