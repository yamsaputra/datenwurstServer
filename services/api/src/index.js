import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import ingestRouter    from './routes/ingest.js';
import authRouter      from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import mlRouter        from './routes/ml.js';
import publicRouter    from './routes/public.js';
import errorHandler    from './middleware/errorHandler.js';
import { defaultLimiter } from './middleware/rateLimiter.js';
import { nowIso } from './lib/logger.js';

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

// Dispatch per path — stacking both would let the app CORS headers
// overwrite the public wildcard ones.
const publicCors = cors({ origin: '*', methods: ['GET', 'OPTIONS'] });
const appCors = cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});
app.use((req, res, next) =>
  (req.path.startsWith('/api/v1/public') ? publicCors : appCors)(req, res, next));

app.use(defaultLimiter);

app.use('/api/v1/ingest',    ingestRouter);
app.use('/api/v1/auth',      authRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/ml',        mlRouter);
app.use('/api/v1/public',    publicRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[api][${nowIso()}] API listening on :${PORT}`));
