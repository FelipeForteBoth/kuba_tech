// ─────────────────────────────────────────────────────────────
// Cloudinary — armazenamento das evidências fotográficas e das
// assinaturas digitais. O banco guarda APENAS a URL da imagem.
//
// Variáveis de ambiente (Render):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
//
// Se as credenciais não estiverem configuradas, o sistema continua
// funcional em modo degradado (a imagem é mantida como data URL),
// mas o log avisa que o Cloudinary deve ser configurado.
// ─────────────────────────────────────────────────────────────
const crypto = require('crypto');

function config() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };
}

function isConfigured() {
  const { cloudName, apiKey, apiSecret } = config();
  return Boolean(cloudName && apiKey && apiSecret);
}

function sign(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

/**
 * Envia uma imagem (data URL base64) ao Cloudinary.
 * Retorna { url, publicId }.
 */
async function upload(dataUrl, folder) {
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(String(dataUrl || ''))) {
    throw new Error('Formato de imagem inválido. Envie PNG, JPG ou WEBP.');
  }

  if (!isConfigured()) {
    console.warn('[cloudinary] credenciais ausentes — imagem mantida localmente (configure CLOUDINARY_*).');
    return { url: dataUrl, publicId: null };
  }

  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp };
  const signature = sign(params, apiSecret);

  const body = new URLSearchParams({
    file: dataUrl,
    folder,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.secure_url) {
    throw new Error((json && json.error && json.error.message) || 'Falha ao enviar a imagem.');
  }
  return { url: json.secure_url, publicId: json.public_id };
}

/** Remove a imagem do Cloudinary (ignora falhas silenciosamente). */
async function destroy(publicId) {
  if (!publicId || !isConfigured()) return;
  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign({ public_id: publicId, timestamp }, apiSecret);
  try {
    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: apiKey, signature }),
    });
  } catch (error) {
    console.warn('[cloudinary] falha ao remover imagem:', error.message);
  }
}

module.exports = { upload, destroy, isConfigured };
