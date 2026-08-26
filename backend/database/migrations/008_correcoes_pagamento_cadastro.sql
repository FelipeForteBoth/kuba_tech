-- =====================================================================
-- Kuba Tech — Migração 008: correções de assinatura e cadastros
--
-- Esta migração é totalmente idempotente e "conserta" bancos que ficaram
-- com migrações antigas parcialmente aplicadas (causa dos erros de
-- assinatura/cobrança e de "erro interno" ao cadastrar clientes).
-- =====================================================================

-- ── 1) Empresas contratantes (tenants) ───────────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at    TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sla_hours       INTEGER NOT NULL DEFAULT 48;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS next_due_date   DATE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_email   VARCHAR(150);

-- Endereço público da empresa (preenchido pela consulta de CNPJ).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS zip_code     VARCHAR(10);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address      TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city         VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state        VARCHAR(50);

UPDATE tenants
   SET next_due_date = COALESCE(next_due_date, (CURRENT_DATE + INTERVAL '30 days')::date),
       billing_email = COALESCE(billing_email, email);

-- ── 2) Clientes (Pessoa Física e Jurídica) ───────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS document_type       VARCHAR(10);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS document_number     VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name        VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip_code            VARCHAR(10);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address             TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS neighborhood        VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city                VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state               VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS trade_name          VARCHAR(150);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birth_date          DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS registration_status VARCHAR(60);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cnae                VARCHAR(160);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opening_date        DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ;

UPDATE customers SET document_type   = 'CPF' WHERE document_type IS NULL;
UPDATE customers SET document_number = cpf   WHERE document_number IS NULL;

ALTER TABLE customers ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_tenant_cpf_unique;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_document_type_chk;
ALTER TABLE customers ADD  CONSTRAINT customers_document_type_chk
  CHECK (document_type IN ('CPF', 'CNPJ'));

CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_document_unique
  ON customers(tenant_id, document_number) WHERE deleted_at IS NULL;

-- ── 3) Pagamentos manuais ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id     UUID REFERENCES plans(id),
  plan_name   VARCHAR(80),
  amount      NUMERIC(10,2) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  provider    VARCHAR(30) NOT NULL DEFAULT 'manual',
  external_id VARCHAR(120),
  method      VARCHAR(10),
  due_date    DATE,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS method      VARCHAR(10);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS external_id VARCHAR(120);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE payments ALTER COLUMN provider SET DEFAULT 'manual';
UPDATE payments SET provider = 'manual' WHERE provider <> 'manual';

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, created_at DESC);

-- ── 4) Solicitações de renovação ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id      UUID REFERENCES payments(id) ON DELETE SET NULL,
  requested_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  requester_name  VARCHAR(160),
  requester_email VARCHAR(160),
  method          VARCHAR(10) NOT NULL,
  status          VARCHAR(40) NOT NULL DEFAULT 'sent',
  plan_name       VARCHAR(120),
  amount          NUMERIC(10,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_tenant ON payment_requests (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests (status);

-- ── 5) Log de e-mails ────────────────────────────────────────────────
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
