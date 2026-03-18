const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const fs        = require('fs');
const rateLimit = require('express-rate-limit');

const uploadRoutes = require('./routes/upload');
const adminRoutes  = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// necessário no Railway (proxy reverso)
app.set('trust proxy', 1);

// frontend fica em ../frontend relativo ao backend/
const frontendDir = path.join(__dirname, '..', 'frontend');

// garante pasta de uploads (fallback local)
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve frontend se a pasta existir
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
}

// rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' }
});
app.use(globalLimiter);

// rotas da API
app.use('/api/upload', uploadRoutes);
app.use('/api/admin',  adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// fallback para o frontend
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ status: 'API online', frontend: 'não encontrado' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Frontend em: ${frontendDir}`);
  console.log(`Frontend existe: ${fs.existsSync(frontendDir)}`);
});

module.exports = app;
