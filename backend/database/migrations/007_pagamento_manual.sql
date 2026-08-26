-- =====================================================================
-- Kuba Tech — Migração 007: pagamento manual (Pix / Boleto)
--
-- 1) Remove os vestígios do gateway automático (Mercado Pago)
-- 2) Cria a tabela de solicitações de renovação de assinatura
--
-- Preserva todo o histórico já existente em "payments".
-- Aplique com:  cd backend && npm run migrate
-- =====================================================================

-- ── 1) Pagamentos passam a ser manuais ───────────────────────────────
ALTER TABLE payments DROP COLUMN IF EXISTS preference_id;
ALTER TABLE payments DROP COLUMN IF EXISTS checkout_url;
ALTER TABLE payments ALTER COLUMN provider SET DEFAULT 'manual';
UPDATE payments SET provider = 'manual' WHERE provider = 'mercadopago';

-- Forma de pagamento combinada com a equipe Kuba Tech.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS method VARCHAR(10);

-- ── 2) Solicitações de renovação (fluxo manual) ──────────────────────
CREATE TABLE IF NOT EXISTS payment_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id      UUID REFERENCES payments(id) ON DELETE SET NULL,
  requested_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  requester_name  VARCHAR(160),
  requester_email VARCHAR(160),
  method          VARCHAR(10)  NOT NULL CHECK (method IN ('pix', 'boleto')),
  status          VARCHAR(40)  NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent', 'in_service', 'info_sent', 'awaiting_confirmation', 'confirmed', 'canceled')),
  plan_name       VARCHAR(120),
  amount          NUMERIC(10,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_tenant ON payment_requests (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests (status);

-- A API acessa o banco com o papel dono do schema (pool do Render).
-- Os GRANTs abaixo mantêm compatibilidade com a Data API do Supabase.
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_requests TO authenticated;
GRANT ALL ON payment_requests TO service_role;

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- O isolamento por tenant é garantido pela API (middleware tenantScope).
-- Nenhuma policy permissiva é criada: a Data API pública não expõe a tabela.
