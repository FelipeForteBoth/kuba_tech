// URL pública do front-end (Vercel), usada nos links enviados por e-mail.
// FRONTEND_URL pode conter uma lista separada por vírgula (CORS).
function frontendUrl() {
  const raw = String(process.env.FRONTEND_URL || '').split(',')[0].trim();
  return raw && raw !== '*' ? raw.replace(/\/$/, '') : '';
}

const loginUrl = () => (frontendUrl() ? `${frontendUrl()}/html/login.html` : '');

const resetUrl = (token) =>
  (frontendUrl() ? `${frontendUrl()}/html/redefinir-senha.html?token=${encodeURIComponent(token)}` : '');

const panelUrl = (page) => (frontendUrl() ? `${frontendUrl()}/html/${page}` : '');

module.exports = { frontendUrl, loginUrl, resetUrl, panelUrl };
