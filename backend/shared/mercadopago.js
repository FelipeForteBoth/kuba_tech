// ─────────────────────────────────────────────────────────────
// Integração com a API oficial do Mercado Pago (Checkout Pro).
//
// Configuração (Render > Environment):
//   MP_ACCESS_TOKEN  — token de acesso da aplicação
//   FRONTEND_URL     — usado nas URLs de retorno
//   PUBLIC_API_URL   — usado na URL do webhook
//
// Sem MP_ACCESS_TOKEN o sistema opera em "modo demonstração":
// a cobrança é criada no banco com status pendente e sem link,
// permitindo testar o fluxo sem credenciais.
// ─────────────────────────────────────────────────────────────
const API = 'https://api.mercadopago.com';

const isEnabled = () => Boolean(process.env.MP_ACCESS_TOKEN);

function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
}

function apiBase() {
  return (process.env.PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function mpFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Mercado Pago respondeu ${res.status}.`);
  return body;
}

/**
 * Cria a preferência de pagamento (cobrança) da mensalidade.
 * @returns {{ preferenceId: string|null, checkoutUrl: string|null, demo: boolean }}
 */
async function createPreference({ paymentId, planName, amount, payerEmail, companyName }) {
  if (!isEnabled()) return { preferenceId: null, checkoutUrl: null, demo: true };

  const front = frontendBase();
  const pref = await mpFetch('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [
        {
          id: paymentId,
          title: `Kuba Tech — Plano ${planName}`,
          description: `Mensalidade da empresa ${companyName}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number(amount),
        },
      ],
      payer: payerEmail ? { email: payerEmail } : undefined,
      external_reference: paymentId,
      notification_url: `${apiBase()}/api/billing/webhook`,
      back_urls: {
        success: `${front}/html/assinatura.html?pagamento=sucesso`,
        pending: `${front}/html/assinatura.html?pagamento=pendente`,
        failure: `${front}/html/assinatura.html?pagamento=falha`,
      },
      auto_return: 'approved',
    }),
  });

  return {
    preferenceId: pref.id || null,
    checkoutUrl: pref.init_point || pref.sandbox_init_point || null,
    demo: false,
  };
}

/** Consulta um pagamento pelo identificador informado no webhook. */
async function getPayment(paymentId) {
  if (!isEnabled()) return null;
  return mpFetch(`/v1/payments/${paymentId}`);
}

module.exports = { isEnabled, createPreference, getPayment };
