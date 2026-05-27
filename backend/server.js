const express = require('express');
const cors    = require('cors');
const path    = require('path');

const customerRoutes     = require('./routes/customerRoutes');
const deviceRoutes       = require('./routes/deviceRoutes');
const serviceOrderRoutes = require('./routes/serviceOrderRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Serve toda a pasta public/ como raiz — css/style.css, js/*.js funcionam direto
app.use(express.static(path.join(__dirname, '../public')));

// Rotas da API
app.use('/api/customers',      customerRoutes);
app.use('/api/devices',        deviceRoutes);
app.use('/api/service-orders', serviceOrderRoutes);

// Fallback para SPA
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
