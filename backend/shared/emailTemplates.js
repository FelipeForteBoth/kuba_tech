// ─────────────────────────────────────────────────────────────
// Templates HTML dos e-mails automáticos da Kuba Tech.
// Layout responsivo (tabela única, largura máxima de 600px) e
// compatível com os principais clientes de e-mail.
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

/** Cobrança por atraso — enviada manualmente pelo Admin da Plataforma. */
function cobranca({ companyName, planName, amount, dueDate }) {
  return {
    subject: `Mensalidade em aberto — ${companyName}`,
    html: layout({
      title: 'Sua mensalidade está em aberto',
      intro: `Olá, <strong>${escape(companyName)}</strong>. Identificamos que a mensalidade do seu plano ainda não foi confirmada. Regularize o pagamento para manter o acesso à plataforma.`,
      rows: [
        ['Empresa', companyName],
        ['Plano contratado', planName],
        ['Valor da mensalidade', money(amount)],
        ['Vencimento', date(dueDate)],
      ],
      note: 'Para renovar, acesse <strong>Plano e Assinatura</strong> no sistema e clique em "Renovar assinatura". Nossa equipe enviará os dados de Pix ou boleto.',
      
    }),
  };
}

/** Pagamento confirmado — baixa manual feita pela equipe Kuba Tech. */
function pagamentoAprovado({ companyName, planName, amount, paidAt, nextDueDate }) {
  return {
    subject: 'Pagamento confirmado — Kuba Tech',
    html: layout({
      title: 'Pagamento confirmado',
      intro: `Recebemos o pagamento da mensalidade da empresa <strong>${escape(companyName)}</strong>. Sua assinatura está ativa.`,
      rows: [
        ['Plano contratado', planName],
        ['Valor pago', money(amount)],
        ['Data do pagamento', date(paidAt)],
        nextDueDate ? ['Próximo vencimento', date(nextDueDate)] : null,
      ],
      note: 'Obrigado por continuar com a Kuba Tech.',
    }),
  };
}

/** Empresa suspensa — disparado quando o status vira "suspended". */
function empresaSuspensa({ companyName, planName, amount, dueDate }) {
  return {
    subject: `Assinatura suspensa — ${companyName}`,
    html: layout({
      title: 'Sua assinatura foi suspensa',
      intro: `A assinatura da empresa <strong>${escape(companyName)}</strong> foi suspensa por falta de pagamento da mensalidade. Enquanto estiver suspensa, o acesso dos usuários fica bloqueado.`,
      rows: [
        ['Motivo', 'Falta de pagamento da mensalidade'],
        ['Plano contratado', planName],
        ['Valor em aberto', money(amount)],
        ['Vencimento', date(dueDate)],
      ],
      note: 'Para regularizar, acesse <strong>Plano e Assinatura</strong> no sistema e clique em "Renovar assinatura". Assinaturas suspensas por mais de 2 meses são canceladas automaticamente.',
    }),
  };
}

/**
 * Solicitação de renovação — enviada para a caixa administrativa da
 * Kuba Tech quando uma empresa pede os dados de Pix ou boleto.
 */
function solicitacaoRenovacao({
  requestId, companyName, document, contactEmail, requesterName,
  requesterEmail, method, planName, amount, dueDate, createdAt,
}) {
  return {
    subject: `Solicitação de renovação (${method}) — ${companyName}`,
    html: layout({
      title: 'Nova solicitação de renovação de assinatura',
      intro: `A empresa <strong>${escape(companyName)}</strong> solicitou as informações para pagamento da mensalidade. Responda com os dados de <strong>${escape(method)}</strong>.`,
      rows: [
        ['Solicitação', requestId],
        ['Empresa', companyName],
        ['CNPJ', document || '—'],
        ['Contato da empresa', contactEmail || '—'],
        ['Solicitante', `${requesterName || '—'} (${requesterEmail || '—'})`],
        ['Forma de pagamento', method],
        ['Plano', planName],
        ['Valor', money(amount)],
        ['Vencimento', date(dueDate)],
        ['Data da solicitação', date(createdAt)],
      ],
      note: 'Acompanhe e atualize esta solicitação no <strong>Painel da Plataforma</strong>.',
    }),
  };
}

/** Retorno da equipe: atualização do andamento da solicitação. */
function solicitacaoAtualizada({ companyName, method, statusLabel, notes }) {
  return {
    subject: `Atualização da sua solicitação de pagamento — ${statusLabel}`,
    html: layout({
      title: 'Sua solicitação foi atualizada',
      intro: `Olá, <strong>${escape(companyName)}</strong>. O andamento da sua solicitação de renovação (${escape(method)}) foi atualizado.`,
      rows: [
        ['Situação', statusLabel],
        ['Forma de pagamento', method],
      ],
      note: notes ? `<strong>Mensagem da equipe:</strong><br>${escape(notes).replace(/\n/g, '<br>')}` : null,
    }),
  };
}

module.exports = {
  cobranca,
  pagamentoAprovado,
  empresaSuspensa,
  solicitacaoRenovacao,
  solicitacaoAtualizada,
  layout,
  money,
  date,
};

