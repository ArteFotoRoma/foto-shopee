/**
 * servidor principal — foto-shopee
 * inicializa o express, middlewares globais e rotas
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const rateLimit = require('express-rate-limit');

const uploadRoutes = require('./routes/upload');
const adminRoutes  = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── garante que a pasta de uploads existe ──────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── middlewares globais ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve o frontend estático a partir da pasta /frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// rate limit global — 100 requisições por 15 min por IP
const globalLimiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 100,
  message  : { error: 'Muitas requisições. Tente novamente em 15 minutos.' }
});
app.use(globalLimiter);

// ── rotas ──────────────────────────────────────────────────────────────────
app.use('/api/upload', uploadRoutes);
app.use('/api/admin',  adminRoutes);

// rota de health-check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── fallback: serve o index.html para qualquer rota desconhecida ───────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ── inicia o servidor ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Servidor rodando em http://localhost:${PORT}`);
  console.log(`📁  Uploads salvos em: ${uploadsDir}\n`);
});

module.exports = app;
