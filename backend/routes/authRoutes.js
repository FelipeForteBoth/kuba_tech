const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../config/database')
require('dotenv').config()

// CADASTRO CLIENTE
router.post('/register-client', async (req, res) => {

    const { nome, cpf, login } = req.body

    const senhaBase = cpf.slice(0,5) + cpf.slice(-1)

    const senhaHash = await bcrypt.hash(senhaBase, 10)

    const sql = `
        INSERT INTO users(nome, cpf, login, senha, tipo)
        VALUES (?, ?, ?, ?, 'cliente')
    `

    db.query(sql, [nome, cpf, login, senhaHash], (err, result) => {

        if(err){
            return res.status(500).json(err)
        }

        res.json({
            message: 'Cliente cadastrado',
            senhaInicial: senhaBase
        })
    })
})

// CADASTRO ADMIN
router.post('/register-admin', async (req, res) => {

    const { nome, cpf, login, senha } = req.body

    const senhaHash = await bcrypt.hash(senha, 10)

    const sql = `
        INSERT INTO users(nome, cpf, login, senha, tipo)
        VALUES (?, ?, ?, ?, 'admin')
    `

    db.query(sql, [nome, cpf, login, senhaHash], (err, result) => {

        if(err){
            return res.status(500).json(err)
        }

        res.json({
            message: 'Administrador cadastrado'
        })
    })
})

// LOGIN
router.post('/login', (req, res) => {

    const { login, senha } = req.body

    const sql = `
        SELECT * FROM users
        WHERE login = ?
    `

    db.query(sql, [login], async (err, result) => {

        if(err){
            return res.status(500).json(err)
        }

        if(result.length === 0){
            return res.status(401).json({
                error: 'Usuário não encontrado'
            })
        }

        const user = result[0]

/*         const senhaValida = await bcrypt.compare(senha, user.senha)

        if(!senhaValida){
            return res.status(401).json({
                error: 'Senha inválida'
            })
        } */

        const token = jwt.sign({
            id: user.id,
            tipo: user.tipo,
            nome: user.nome
        }, process.env.JWT_SECRET, {
            expiresIn: '1d'
        })

        res.json({
            token,
            tipo: user.tipo,
            nome: user.nome
        })
    })
})

module.exports = router