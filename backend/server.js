const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()

app.use(cors())
app.use(express.json())

const authRoutes = require('./routes/authRoutes')

app.use('/api/auth', authRoutes)

app.listen(process.env.PORT, () => {
    console.log('Servidor rodando')
})