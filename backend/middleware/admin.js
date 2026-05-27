function admin(req, res, next){

    if(req.user.tipo !== 'admin'){
        return res.status(403).json({
            error: 'Acesso negado'
        })
    }

    next()
}

module.exports = admin