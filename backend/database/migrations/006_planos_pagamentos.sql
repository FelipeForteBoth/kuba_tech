-- =====================================================================
-- Kuba Tech — Migração 006: planos, assinaturas, pagamentos e e-mails
--
-- 1) Novos planos comerciais (Start / Professional / Business)
-- 2) Dados de assinatura na empresa contratante (vencimento, cobrança)
-- 3) Histórico de pagamentos (Mercado Pago)
-- 4) Registro de e-mails enviados pela plataforma
-- 5) Campos públicos extras do cliente (Receita Federal)
--
-- Aplique no Supabase > SQL Editor > RUN (depois de 005_evolucao_v2).
-- =====================================================================

-- ── 1) Planos comercializados ────────────────────────────────────────
UPDATE plans SET code = 'start',        name = 'Start',        monthly_price =  59.90,
                 description = 'Para assistências que estão começando.'
 WHERE code IN ('essencial', 'start');

UPDATE plans SET code = 'professional', name = 'Professional', monthly_price = 119.90,
                 description = 'Relatórios gerenciais e gestão de prazos (SLA).'
 WHERE code IN ('profissional', 'professional');

UPDATE plans SET code = 'business',     name = 'Business',     monthly_price = 249.90,
                 description = 'Todos os módulos, para operações de grande porte.'
 WHERE code IN ('empresarial', 'business');

INSERT INTO plans (code, name, description, monthly_price, max_users) VALUES
  ('start',        'Start',        'Para assistências que estão começando.',            59.90,  3),
  ('professional', 'Professional', 'Relatórios gerenciais e gestão de prazos (SLA).',  119.90, 15),
  ('business',     'Business',     'Todos os módulos, para operações de grande porte.', 249.90, 50)
ON CONFLICT (code) DO UPDATE
   SET name = EXCLUDED.name,
       description = EXCLUDED.description,
       monthly_price = EXCLUDED.monthly_price;

-- Composição dos planos (mesma regra de módulos já existente)
DELETE FROM plan_modules;

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'start'
   AND m.code IN ('customers','devices','orders','users');

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'professional'
   AND m.code IN ('customers','devices','orders','users','reports','sla');

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'business'
   AND m.code IN ('customers','devices','orders','users','reports','sla','schedule','portal');

-- Sincroniza os módulos habilitados por empresa com o plano vigente
DELETE FROM tenant_modules;
INSERT INTO tenant_modules (tenant_id, module_id)
SELECT t.id, pm.module_id FROM tenants t JOIN plan_modules pm ON pm.plan_id = t.plan_id;

-- ── 2) Assinatura da empresa contratante ─────────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS next_due_date   DATE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_email   VARCHAR(150);

UPDATE tenants
   SET next_due_date = COALESCE(next_due_date, (CURRENT_DATE + INTERVAL '30 days')::date),
       billing_email = COALESCE(billing_email, email);

-- ── 3) Pagamentos / cobranças da mensalidade ─────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id        UUID REFERENCES plans(id),
  plan_name      VARCHAR(80),
  amount         NUMERIC(10,2) NOT NULL,
  status         VARCHAR(20)   NOT NULL DEFAULT 'pending',
  provider       VARCHAR(30)   NOT NULL DEFAULT 'mercadopago',
  external_id    VARCHAR(120),
  preference_id  VARCHAR(120),
  checkout_url   TEXT,
  due_date       DATE,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant   ON payments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_external ON payments(external_id);

-- ── 4) Log de e-mails enviados ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id) ON DELETE SET NULL,
  template   VARCHAR(60)  NOT NULL,
  recipient  VARCHAR(150) NOT NULL,
  subject    VARCHAR(200) NOT NULL,
  status     VARCHAR(20)  NOT NULL DEFAULT 'sent',
  error      TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_tenant ON email_logs(tenant_id, created_at DESC);

-- ── 5) Dados públicos adicionais do cliente ──────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS trade_name          VARCHAR(150);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birth_date          DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS registration_status VARCHAR(60);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cnae                VARCHAR(160);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opening_date        DATE;
