-- =====================================================================
-- Kuba Tech — Migração 005: Evolução da Plataforma (v2)
--
--  1) Catálogo de módulos com slug + 3 novos módulos comercializáveis
--     (Evidências fotográficas, Assinatura digital, Geolocalização).
--  2) Clientes Pessoa Física (CPF) e Pessoa Jurídica (CNPJ).
--  3) Nova esteira de status da O.S. (atendimento interno e externo).
--  4) Geolocalização do atendimento (ViaCEP + Mapbox) e marcos de campo.
--  5) Evidências fotográficas (Cloudinary) e assinatura digital.
--  6) Auditoria completa da O.S. (service_order_history).
--  7) Soft delete (deleted_at) e índices de performance.
--
-- Idempotente: pode ser reexecutada com segurança.
-- Aplicação: `npm run migrate` (backend) ou Supabase > SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Módulos
-- ---------------------------------------------------------------------
ALTER TABLE modules ADD COLUMN IF NOT EXISTS slug   VARCHAR(100);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO modules (code, name, description, core) VALUES
  ('service-order-photos', 'Evidências Fotográficas', 'Registro fotográfico do serviço executado (Cloudinary).',       FALSE),
  ('digital-signature',    'Assinatura Digital',      'Captura da assinatura do cliente no atendimento externo.',      FALSE),
  ('geolocation',          'Geolocalização',          'Endereço do atendimento, rota e coordenadas (ViaCEP/Mapbox).',  FALSE)
ON CONFLICT (code) DO UPDATE
   SET name = EXCLUDED.name, description = EXCLUDED.description;

-- slug padronizado (compatível com a nomenclatura da nova versão)
UPDATE modules SET slug = CASE code
    WHEN 'orders'   THEN 'service-orders'
    WHEN 'customers' THEN 'customers'
    WHEN 'devices'  THEN 'devices'
    WHEN 'users'    THEN 'users'
    WHEN 'reports'  THEN 'reports'
    WHEN 'sla'      THEN 'sla'
    WHEN 'schedule' THEN 'schedule'
    WHEN 'portal'   THEN 'portal'
    ELSE code
  END
 WHERE slug IS DISTINCT FROM code;

CREATE UNIQUE INDEX IF NOT EXISTS modules_slug_unique ON modules(slug);

-- Composição dos planos:
--   Essencial (4) < Profissional (7) < Empresarial (11)
DELETE FROM plan_modules;

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'essencial'
   AND m.code IN ('customers','devices','orders','users');

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'profissional'
   AND m.code IN ('customers','devices','orders','users','reports','sla','schedule');

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'empresarial'
   AND m.code IN ('customers','devices','orders','users','reports','sla','schedule',
                  'portal','service-order-photos','digital-signature','geolocation');

-- Reaplica os módulos do plano em cada empresa contratante
DELETE FROM tenant_modules;
INSERT INTO tenant_modules (tenant_id, module_id)
SELECT t.id, pm.module_id
  FROM tenants t
  JOIN plan_modules pm ON pm.plan_id = t.plan_id
ON CONFLICT DO NOTHING;

-- Visão compatível com a nomenclatura "company_modules"
CREATE OR REPLACE VIEW company_modules AS
  SELECT tm.tenant_id AS company_id, tm.module_id, TRUE AS active, tm.enabled_at AS created_at
    FROM tenant_modules tm;

-- ---------------------------------------------------------------------
-- 2) Clientes: Pessoa Física (CPF) e Pessoa Jurídica (CNPJ)
-- ---------------------------------------------------------------------
ALTER TABLE customers ADD COLUMN IF NOT EXISTS document_type   VARCHAR(10);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS document_number VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name    VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip_code        VARCHAR(10);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address         TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS neighborhood    VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city            VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state           VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;

UPDATE customers SET document_type = 'CPF' WHERE document_type IS NULL;
UPDATE customers SET document_number = cpf WHERE document_number IS NULL;

-- cpf deixa de ser obrigatório (clientes PJ usam CNPJ)
ALTER TABLE customers ALTER COLUMN cpf DROP NOT NULL;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_tenant_cpf_unique;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_document_type_chk;
ALTER TABLE customers ADD  CONSTRAINT customers_document_type_chk
  CHECK (document_type IN ('CPF', 'CNPJ'));

CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_document_unique
  ON customers(tenant_id, document_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_tenant_active
  ON customers(tenant_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 3/4) Ordens de Serviço: atendimento interno/externo e geolocalização
-- ---------------------------------------------------------------------
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS service_type         VARCHAR(20) DEFAULT 'interno';
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS diagnosis            VARCHAR(40);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS zip_code             VARCHAR(10);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS address              TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS address_number       VARCHAR(20);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS neighborhood         VARCHAR(100);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS city                 VARCHAR(100);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS state                VARCHAR(50);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS latitude             DECIMAL(10,8);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS longitude            DECIMAL(11,8);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS departure_date       TIMESTAMPTZ;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS arrival_date         TIMESTAMPTZ;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS execution_start_date TIMESTAMPTZ;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS delivered_at         TIMESTAMPTZ;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS deleted_at           TIMESTAMPTZ;

UPDATE service_orders SET service_type = 'interno' WHERE service_type IS NULL;

-- Nova esteira de status
ALTER TABLE service_orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_status_chk;

UPDATE service_orders SET status = CASE status
    WHEN 'Aguardando Agendamento' THEN 'Aberto'
    WHEN 'Agendada'               THEN 'Agendado'
    WHEN 'Em Andamento'           THEN 'Em execução'
    WHEN 'Finalizada'             THEN 'Finalizado'
    WHEN 'Cancelada'              THEN 'Cancelado'
    ELSE status
  END;

ALTER TABLE service_orders ADD CONSTRAINT service_orders_status_chk
  CHECK (status IN ('Aberto','Agendado','Em deslocamento','No local','Em execução',
                    'Aguardando cliente','Finalizado','Entregue','Cancelado'));
ALTER TABLE service_orders ALTER COLUMN status SET DEFAULT 'Aberto';

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_service_type_chk;
ALTER TABLE service_orders ADD  CONSTRAINT service_orders_service_type_chk
  CHECK (service_type IN ('interno','externo'));

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_diagnosis_chk;
ALTER TABLE service_orders ADD  CONSTRAINT service_orders_diagnosis_chk
  CHECK (diagnosis IS NULL OR diagnosis IN ('Serviço Completo','Encerramento Interno'));

-- Trigger de updated_at/closed_at ajustado à nova nomenclatura
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.status = 'Finalizado' AND OLD.status <> 'Finalizado' THEN
        NEW.closed_at = COALESCE(NEW.closed_at, NOW());
    END IF;
    IF NEW.status = 'Entregue' AND OLD.status <> 'Entregue' THEN
        NEW.delivered_at = COALESCE(NEW.delivered_at, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_os_tenant_active   ON service_orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_os_service_type    ON service_orders(tenant_id, service_type);
CREATE INDEX IF NOT EXISTS idx_os_created_at      ON service_orders(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 5) Evidências fotográficas e assinatura digital
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_order_images (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    image_url        TEXT NOT NULL,
    public_id        TEXT,
    uploaded_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_os_images_order ON service_order_images(service_order_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS service_order_signatures (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    signature_url    TEXT NOT NULL,
    public_id        TEXT,
    signer_name      VARCHAR(120),
    signed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_os_signatures_order ON service_order_signatures(service_order_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 6) Auditoria da Ordem de Serviço
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_order_history (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    action           VARCHAR(100) NOT NULL,
    description      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_os_history_order ON service_order_history(service_order_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 7) Soft delete nas demais entidades
-- ---------------------------------------------------------------------
ALTER TABLE devices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_devices_tenant_active ON devices(tenant_id) WHERE deleted_at IS NULL;

ALTER TABLE service_order_images     ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_history    ENABLE ROW LEVEL SECURITY;
