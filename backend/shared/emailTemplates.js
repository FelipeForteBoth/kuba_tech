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
function cobranca({ companyName, planName, amount, dueDate, paymentUrl }) {
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
      cta: paymentUrl ? { url: paymentUrl, label: 'Pagar mensalidade' } : null,
      note: 'Após a confirmação do pagamento o acesso é liberado automaticamente.',
    }),
  };
}

/** Pagamento aprovado — disparado pelo webhook do Mercado Pago. */
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
function empresaSuspensa({ companyName, planName, amount, dueDate, paymentUrl }) {
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
      cta: paymentUrl ? { url: paymentUrl, label: 'Regularizar agora' } : null,
      note: 'Para regularizar, acesse a área <strong>Plano e Assinatura</strong> no sistema e conclua o pagamento. Assinaturas suspensas por mais de 2 meses são canceladas automaticamente.',
    }),
  };
}

module.exports = { cobranca, pagamentoAprovado, empresaSuspensa, layout, money, date };
