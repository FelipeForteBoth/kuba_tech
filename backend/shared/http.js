// Captura erros de handlers assíncronos e envia ao middleware de erro.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Erro de negócio com status HTTP.
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Middleware final de tratamento de erros.
function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Violação de UNIQUE / FK no Postgres
  if (err.code === '23505') return res.status(409).json({ error: 'Registro já cadastrado.' });
  if (err.code === '23503') return res.status(400).json({ error: 'Registro relacionado não encontrado.' });

  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno no servidor.' });
}

module.exports = { asyncHandler, AppError, errorHandler };
