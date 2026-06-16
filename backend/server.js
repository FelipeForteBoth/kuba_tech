const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const authRoutes         = require('./routes/authRoutes');
const customerRoutes     = require('./routes/customerRoutes');
const deviceRoutes       = require('./routes/deviceRoutes');
const serviceOrderRoutes = require('./routes/serviceOrderRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Servir a pasta frontend/ como estática.
// Montamos em DOIS caminhos para funcionar tanto com paths "/css/..." como
// com paths antigos "/frontend/css/..." que já estavam nos HTMLs.
const FRONT_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONT_DIR));
app.use('/frontend', express.static(FRONT_DIR));

// Rotas da API
app.use('/api/auth',           authRoutes);
app.use('/api/customers',      customerRoutes);
app.use('/api/devices',        deviceRoutes);
app.use('/api/service-orders', serviceOrderRoutes);

// Raiz -> tela de login
app.get('/', (req, res) => {
    res.sendFile(path.join(FRONT_DIR, 'html', 'login.html'));
});

// Fallback: manda para login se nada bateu
app.use((req, res) => {
    res.sendFile(path.join(FRONT_DIR, 'html', 'login.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
