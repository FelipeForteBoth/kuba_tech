// ─────────────────────────────────────────────────────────────
// Serviço centralizado de e-mails da Kuba Tech.
//
// Usa APIs HTTP gratuitas (nenhuma dependência extra no package):
//   1) Brevo  — BREVO_API_KEY   (plano gratuito: 300 e-mails/dia)
//   2) Resend — RESEND_API_KEY  (plano gratuito: 3.000 e-mails/mês)
//
// Não há registro em banco: o resultado aparece apenas no console
// do servidor. Se nenhuma chave estiver configurada, o envio é
// ignorado e a operação de negócio segue normalmente.
// ─────────────────────────────────────────────────────────────
const templates = require('./emailTemplates');

const FROM_EMAIL = process.env.MAIL_FROM || 'nao-responda@kubatech.com.br';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'Kuba Tech';

async function sendWithBrevo(to, subject, html) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo respondeu ${res.status}: ${await res.text()}`);
}

async function sendWithResend(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend respondeu ${res.status}: ${await res.text()}`);
}

/**
 * Envia um e-mail a partir de um template registrado.
 * @param {string} template  nome do template (chave de emailTemplates)
 * @param {string} to        destinatário
 * @param {object} data      dados usados pelo template
 * @param {string} tenantId  empresa relacionada (opcional)
 */
async function sendTemplate(template, to, data = {}, tenantId = null) {
  const builder = templates[template];
  if (typeof builder !== 'function') throw new Error(`Template de e-mail desconhecido: ${template}`);
  if (!to) return { sent: false, reason: 'sem_destinatario' };

  const { subject, html } = builder(data);

  try {
    if (process.env.BREVO_API_KEY) {
      await sendWithBrevo(to, subject, html);
    } else if (process.env.RESEND_API_KEY) {
      await sendWithResend(to, subject, html);
    } else {
      console.warn(`E-mail "${template}" para ${to} ignorado: nenhuma API de e-mail configurada.`);
      return { sent: false, reason: 'sem_provedor' };
    }
    console.log(`E-mail "${template}" enviado para ${to}.`);
    return { sent: true };
  } catch (error) {
    console.error('Falha no envio de e-mail:', error.message);
    return { sent: false, reason: 'falha_no_envio', error: error.message };
  }
}

module.exports = { sendTemplate };
