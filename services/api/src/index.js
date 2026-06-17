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

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

const corsOrigin = process.env.CORS_ORIGIN;
app.use('/api/v1/public', cors({ origin: '*', methods: ['GET', 'OPTIONS'] }));
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(defaultLimiter);

app.use('/api/v1/ingest',    ingestRouter);
app.use('/api/v1/auth',      authRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/ml',        mlRouter);
app.use('/api/v1/public',    publicRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
