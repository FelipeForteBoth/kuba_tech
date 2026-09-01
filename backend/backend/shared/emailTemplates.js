// ─────────────────────────────────────────────────────────────
// Templates HTML dos e-mails automáticos da Kuba Tech.
// Layout responsivo (tabela única, largura máxima de 600px) e
// compatível com os principais clientes de e-mail.
//
// A plataforma NÃO processa pagamentos: não há e-mails de cobrança,
// boleto ou Pix. Os avisos tratam de acesso, senha e plano.
// ─────────────────────────────────────────────────────────────
const BRAND = '#4f46e5';

const money = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const date = (value) => {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};

const escape = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Moldura comum a todos os e-mails (cabeçalho, corpo e rodapé). */
function layout({ title, intro, rows = [], cta, note }) {
  const list = rows
    .filter(Boolean)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:14px;">${escape(label)}</td>
          <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${escape(value)}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td style="background:${BRAND};padding:22px 26px;color:#ffffff;font-size:20px;font-weight:700;">Kuba Tech</td></tr>
    <tr><td style="padding:26px;">
      <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${escape(title)}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">${intro}</p>
      ${list ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin-bottom:20px;">${list}</table>` : ''}
      ${cta ? `<p style="margin:0 0 18px;"><a href="${escape(cta.url)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:10px;font-size:15px;font-weight:700;">${escape(cta.label)}</a></p>` : ''}
      ${note ? `<p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">${note}</p>` : ''}
    </td></tr>
    <tr><td style="background:#f8fafc;padding:18px 26px;font-size:12px;color:#94a3b8;">
      Kuba Tech — plataforma de gestão para assistências técnicas.<br>
      Este é um e-mail automático, não é necessário respondê-lo.
    </td></tr>
  </table>
</body></html>`;
}

/** Primeiro acesso: usuário criado com senha temporária. */
function primeiroAcesso({ name, email, tempPassword, companyName, loginUrl }) {
  return {
    subject: 'Seu acesso à Kuba Tech foi criado',
    html: layout({
      title: 'Bem-vindo(a) à Kuba Tech',
      intro: `Olá, <strong>${escape(name)}</strong>. Seu acesso${companyName ? ` à empresa <strong>${escape(companyName)}</strong>` : ''} foi criado. Use a senha temporária abaixo no primeiro acesso — o sistema pedirá que você cadastre uma nova senha.`,
      rows: [
        ['E-mail de acesso', email],
        ['Senha temporária', tempPassword],
      ],
      cta: loginUrl ? { url: loginUrl, label: 'Acessar a plataforma' } : null,
      note: 'Por segurança, a senha temporária só pode ser usada uma vez: a troca é obrigatória.',
    }),
  };
}

/** Pedido de recuperação de senha aguardando aprovação do responsável. */
function recuperacaoSolicitada({ approverName, userName, userEmail, companyName, panelUrl }) {
  return {
    subject: 'Nova solicitação de recuperação de senha',
    html: layout({
      title: 'Solicitação de recuperação de senha',
      intro: `Olá${approverName ? `, <strong>${escape(approverName)}</strong>` : ''}. Um usuário solicitou a recuperação da senha e aguarda a sua aprovação.`,
      rows: [
        ['Usuário', userName],
        ['E-mail', userEmail],
        companyName ? ['Empresa', companyName] : null,
      ],
      cta: panelUrl ? { url: panelUrl, label: 'Analisar solicitação' } : null,
      note: 'Aprove somente se você reconhecer o pedido. Após a aprovação, o usuário recebe um link seguro e válido por 1 hora.',
    }),
  };
}

/** Aprovação: envia o link de redefinição ao usuário. */
function recuperacaoAprovada({ name, resetUrl, expiresInHours = 1 }) {
  return {
    subject: 'Recuperação de senha aprovada — Kuba Tech',
    html: layout({
      title: 'Sua recuperação de senha foi aprovada',
      intro: `Olá, <strong>${escape(name)}</strong>. O responsável aprovou a sua solicitação. Clique no botão abaixo para cadastrar uma nova senha.`,
      cta: { url: resetUrl, label: 'Cadastrar nova senha' },
      note: `O link é de uso único e expira em ${expiresInHours} hora(s). Se você não solicitou, ignore este e-mail.`,
    }),
  };
}

/** Recusa da solicitação de recuperação. */
function recuperacaoRecusada({ name, reason }) {
  return {
    subject: 'Recuperação de senha recusada — Kuba Tech',
    html: layout({
      title: 'Solicitação recusada',
      intro: `Olá, <strong>${escape(name)}</strong>. A sua solicitação de recuperação de senha não foi aprovada pelo responsável.`,
      rows: reason ? [['Motivo informado', reason]] : [],
      note: 'Procure o administrador responsável para regularizar o seu acesso.',
    }),
  };
}

/** Pedido de alteração de plano enviado à equipe Kuba Tech. */
function solicitacaoPlano({ companyName, currentPlan, desiredPlan, requesterName, requesterEmail, message }) {
  return {
    subject: `Solicitação de alteração de plano — ${companyName}`,
    html: layout({
      title: 'Nova solicitação de alteração de plano',
      intro: `A empresa <strong>${escape(companyName)}</strong> solicitou uma alteração no plano contratado.`,
      rows: [
        ['Plano atual', currentPlan || '—'],
        ['Plano desejado', desiredPlan || 'A definir'],
        ['Solicitante', requesterName || '—'],
        ['Contato', requesterEmail || '—'],
      ],
      note: message ? `Observações: ${escape(message)}` : 'Entre em contato com a empresa para dar andamento.',
    }),
  };
}

/** Retorno da equipe Kuba Tech sobre a solicitação de plano. */
function solicitacaoPlanoAtualizada({ companyName, statusLabel, answer, planName }) {
  return {
    subject: `Sua solicitação de plano foi atualizada — ${companyName}`,
    html: layout({
      title: 'Atualização da solicitação de plano',
      intro: `Olá, <strong>${escape(companyName)}</strong>. Sua solicitação de alteração de plano foi atualizada pela equipe Kuba Tech.`,
      rows: [
        ['Situação', statusLabel],
        planName ? ['Plano', planName] : null,
      ],
      note: answer ? `Retorno da equipe: ${escape(answer)}` : 'Em breve entraremos em contato com mais detalhes.',
    }),
  };
}

/** Aviso de suspensão da assinatura (decisão administrativa da plataforma). */
function empresaSuspensa({ companyName, planName }) {
  return {
    subject: `Assinatura suspensa — ${companyName}`,
    html: layout({
      title: 'Sua assinatura foi suspensa',
      intro: `A assinatura da empresa <strong>${escape(companyName)}</strong> foi suspensa pela equipe Kuba Tech. Enquanto estiver suspensa, o acesso dos usuários fica bloqueado.`,
      rows: [planName ? ['Plano contratado', planName] : null],
      note: 'Fale com a equipe Kuba Tech para regularizar. Assinaturas suspensas por mais de 2 meses são canceladas automaticamente.',
    }),
  };
}

module.exports = {
  primeiroAcesso,
  recuperacaoSolicitada,
  recuperacaoAprovada,
  recuperacaoRecusada,
  solicitacaoPlano,
  solicitacaoPlanoAtualizada,
  empresaSuspensa,
  layout,
  money,
  date,
};
