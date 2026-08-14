// ─────────────────────────────────────────────────────────────
// Kuba Tech — API REST (Node.js + Express + PostgreSQL/Supabase)
// Arquitetura modular por domínio, multi-tenant e com RBAC.
// Hospedagem: Render (API) + Vercel (front-end estático).
// ─────────────────────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { errorHandler } = require('./shared/http');
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const customerRoutes = require('./modules/customers/customer.routes');
const deviceRoutes = require('./modules/devices/device.routes');
const serviceOrderRoutes = require('./modules/serviceOrders/serviceOrder.routes');
const platformRoutes = require('./modules/platform/platform.routes');
const companyRoutes = require('./modules/company/company.routes');
const reportRoutes = require('./modules/reports/report.routes');
const scheduleRoutes = require('./modules/schedule/schedule.routes');
const portalRoutes = require('./modules/portal/portal.routes');
const lookupRoutes = require('./modules/lookup/lookup.routes');

const app = express();

// Em produção defina FRONTEND_URL (ex.: https://kuba-tech.vercel.app).
const allowedOrigins = (process.env.FRONTEND_URL || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins.includes('*') ? '*' : allowedOrigins }));
app.use(express.json({ limit: '12mb' })); // fotos e assinaturas em base64

// Verificação de saúde usada pelo Render.
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'kuba-tech-api' }));

// Rotas da API por domínio
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/service-orders', serviceOrderRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/lookup', lookupRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Recurso não encontrado.' }));

// Front-end estático (útil em execução local; na Vercel ele é servido separadamente).
const FRONT_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONT_DIR));
app.use('/frontend', express.static(FRONT_DIR));
app.get('/', (_req, res) => res.sendFile(path.join(FRONT_DIR, 'html', 'login.html')));
app.use((_req, res) => res.sendFile(path.join(FRONT_DIR, 'html', 'login.html')));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API Kuba Tech em http://localhost:${PORT}`));

module.exports = app;
