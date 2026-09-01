-- =====================================================================
-- Kuba Tech — Schema PostgreSQL (Supabase) — ARQUIVO ÚNICO E DEFINITIVO
--
-- Este arquivo substitui todas as migrações anteriores (002 a 008).
-- Ele é IDEMPOTENTE: pode ser executado quantas vezes for necessário,
-- tanto em um banco novo quanto em um banco que já está em produção,
-- sem apagar nenhum dado existente.
--
-- Como aplicar:
--   • Supabase > SQL Editor > cole este arquivo inteiro > RUN
--   (aplicação é sempre manual; a API nunca altera o banco sozinha)
-- Depois, em bancos novos, rode database/seed.sql.
--
-- Conceitos aplicados (documentação técnica / TCC):
--   * Multi-tenancy lógico: toda tabela de negócio possui tenant_id.
--   * RBAC: platform_admin, company_admin, attendant, technician, manager.
--   * Integridade: PK/FK, UNIQUE por empresa e CHECKs de domínio.
--   * A plataforma NÃO processa pagamentos: o plano é apenas informativo.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('platform_admin', 'company_admin', 'attendant', 'technician', 'manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- Planos e módulos comercializáveis
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          VARCHAR(30)   NOT NULL UNIQUE,
    name          VARCHAR(60)   NOT NULL,
    description   TEXT,
    monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
    max_users     INTEGER       NOT NULL DEFAULT 5 CHECK (max_users > 0),
    active        BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30) NOT NULL UNIQUE,
    name        VARCHAR(60) NOT NULL,
    description TEXT,
    core        BOOLEAN     NOT NULL DEFAULT FALSE,
    slug        VARCHAR(100),
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS slug   VARCHAR(100);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE modules SET slug = code WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS modules_slug_unique ON modules(slug);

CREATE TABLE IF NOT EXISTS plan_modules (
    plan_id   UUID NOT NULL REFERENCES plans(id)   ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    PRIMARY KEY (plan_id, module_id)
);

-- ---------------------------------------------------------------------
-- Empresas contratantes (tenants)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(120)  NOT NULL,
    document     VARCHAR(18)   NOT NULL UNIQUE,       -- CNPJ 00.000.000/0000-00
    email        VARCHAR(120)  NOT NULL,
    phone        VARCHAR(15),
    plan_id      UUID          REFERENCES plans(id) ON DELETE SET NULL,
    status       tenant_status NOT NULL DEFAULT 'active',
    suspended_at TIMESTAMPTZ,
    sla_hours    INTEGER       NOT NULL DEFAULT 48,
    zip_code     VARCHAR(10),
    address      TEXT,
    neighborhood VARCHAR(100),
    city         VARCHAR(100),
    state        VARCHAR(50),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sla_hours    INTEGER NOT NULL DEFAULT 48;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS zip_code     VARCHAR(10);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address      TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city         VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state        VARCHAR(50);

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_sla_hours_check;
ALTER TABLE tenants ADD  CONSTRAINT tenants_sla_hours_check CHECK (sla_hours BETWEEN 1 AND 8760);

-- Colunas do antigo módulo de cobrança (removido nesta versão).
ALTER TABLE tenants DROP COLUMN IF EXISTS next_due_date;
ALTER TABLE tenants DROP COLUMN IF EXISTS last_payment_at;
ALTER TABLE tenants DROP COLUMN IF EXISTS billing_email;

UPDATE tenants SET suspended_at = NOW() WHERE status = 'suspended' AND suspended_at IS NULL;

-- Assinatura suspensa há mais de 2 meses é cancelada automaticamente.
CREATE OR REPLACE FUNCTION expire_suspended_tenants()
RETURNS INTEGER AS $$
DECLARE afetadas INTEGER;
BEGIN
    UPDATE tenants SET status = 'canceled'
     WHERE status = 'suspended'
       AND suspended_at IS NOT NULL
       AND suspended_at <= NOW() - INTERVAL '2 months';
    GET DIAGNOSTICS afetadas = ROW_COUNT;
    RETURN afetadas;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION track_tenant_suspension()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'suspended' AND (OLD.status IS DISTINCT FROM 'suspended') THEN
        NEW.suspended_at = NOW();
    ELSIF NEW.status <> 'suspended' THEN
        NEW.suspended_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_suspension ON tenants;
CREATE TRIGGER trg_tenant_suspension
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION track_tenant_suspension();

-- Módulos habilitados por empresa
CREATE TABLE IF NOT EXISTS tenant_modules (
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id  UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, module_id)
);

CREATE OR REPLACE VIEW company_modules AS
  SELECT tm.tenant_id AS company_id, tm.module_id, TRUE AS active, tm.enabled_at AS created_at
    FROM tenant_modules tm;

-- ---------------------------------------------------------------------
-- Usuários (RBAC). tenant_id NULL => Administrador da Plataforma
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name                 VARCHAR(120) NOT NULL,
    email                VARCHAR(120) NOT NULL,
    password_hash        TEXT         NOT NULL,
    role                 user_role    NOT NULL,
    active               BOOLEAN      NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at        TIMESTAMPTZ,
    deleted_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_tenant_role_check CHECK (
        (role = 'platform_admin' AND tenant_id IS NULL) OR
        (role <> 'platform_admin' AND tenant_id IS NOT NULL)
    )
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- ---------------------------------------------------------------------
-- Recuperação de senha com aprovação hierárquica
--   • Funcionário  -> aprovado pelo Administrador da Empresa
--   • Adm. Empresa -> aprovado pelo Administrador da Plataforma
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    tenant_id         UUID          REFERENCES tenants(id) ON DELETE CASCADE,
    approver_scope    VARCHAR(20)  NOT NULL CHECK (approver_scope IN ('platform_admin', 'company_admin')),
    status            VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected', 'used', 'expired')),
    reason            TEXT,
    token_hash        TEXT,
    token_expires_at  TIMESTAMPTZ,
    decided_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    decided_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pwd_requests_scope  ON password_reset_requests(approver_scope, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pwd_requests_tenant ON password_reset_requests(tenant_id, status);

-- ---------------------------------------------------------------------
-- Solicitações de alteração de plano (sem pagamento pela plataforma)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plan_change_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    requested_by    UUID          REFERENCES users(id)   ON DELETE SET NULL,
    requester_name  VARCHAR(160),
    requester_email VARCHAR(160),
    current_plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    desired_plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    message         TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_service', 'done', 'rejected')),
    answer          TEXT,
    decided_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    decided_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plan_requests_tenant ON plan_change_requests(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_requests_status ON plan_change_requests(status);

-- ---------------------------------------------------------------------
-- Clientes (Pessoa Física — CPF — e Pessoa Jurídica — CNPJ)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cpf             VARCHAR(14),
    document_type   VARCHAR(10),
    document_number VARCHAR(20),
    name            VARCHAR(120) NOT NULL,
    company_name    VARCHAR(255),
    trade_name      VARCHAR(150),
    cnae            VARCHAR(160),
    opening_date    DATE,
    phone           VARCHAR(15)  NOT NULL,
    email           VARCHAR(120) NOT NULL,
    zip_code        VARCHAR(10),
    address         TEXT,
    neighborhood    VARCHAR(100),
    city            VARCHAR(100),
    state           VARCHAR(50),
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS document_type   VARCHAR(10);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS document_number VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name    VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS trade_name      VARCHAR(150);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cnae            VARCHAR(160);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opening_date    DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip_code        VARCHAR(10);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address         TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS neighborhood    VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city            VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state           VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;

-- Campos descontinuados nesta versão (situação cadastral e nascimento).
ALTER TABLE customers DROP COLUMN IF EXISTS registration_status;
ALTER TABLE customers DROP COLUMN IF EXISTS birth_date;

UPDATE customers SET document_type   = 'CPF' WHERE document_type   IS NULL;
UPDATE customers SET document_number = cpf   WHERE document_number IS NULL;

ALTER TABLE customers ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_tenant_cpf_unique;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_document_type_chk;
ALTER TABLE customers ADD  CONSTRAINT customers_document_type_chk
  CHECK (document_type IN ('CPF', 'CNPJ'));

CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_document_unique
  ON customers(tenant_id, document_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_tenant        ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_active ON customers(tenant_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- Equipamentos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID         NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
    customer_id   UUID         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) NOT NULL,
    type          VARCHAR(60)  NOT NULL,
    brand         VARCHAR(60),
    model         VARCHAR(60),
    deleted_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT devices_tenant_serial_unique UNIQUE (tenant_id, serial_number)
);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_devices_tenant        ON devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_customer      ON devices(customer_id);
CREATE INDEX IF NOT EXISTS idx_devices_tenant_active ON devices(tenant_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- Ordens de Serviço
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_orders (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
    number               INTEGER     NOT NULL,
    customer_id          UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    device_id            UUID        NOT NULL REFERENCES devices(id)   ON DELETE CASCADE,
    technician_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
    opening_date         DATE        NOT NULL,
    problem_description  TEXT        NOT NULL,
    solution             TEXT,
    status               TEXT        NOT NULL DEFAULT 'Aberto',
    service_type         VARCHAR(20) DEFAULT 'interno',
    diagnosis            VARCHAR(40),
    scheduling_sla_hours INTEGER     NOT NULL DEFAULT 24,
    sla_hours            INTEGER     NOT NULL DEFAULT 48,
    scheduled_at         TIMESTAMPTZ,
    started_at           TIMESTAMPTZ,
    zip_code             VARCHAR(10),
    address              TEXT,
    address_number       VARCHAR(20),
    neighborhood         VARCHAR(100),
    city                 VARCHAR(100),
    state                VARCHAR(50),
    latitude             DECIMAL(10,8),
    longitude            DECIMAL(11,8),
    departure_date       TIMESTAMPTZ,
    arrival_date         TIMESTAMPTZ,
    execution_start_date TIMESTAMPTZ,
    delivered_at         TIMESTAMPTZ,
    created_by           UUID        REFERENCES users(id) ON DELETE SET NULL,
    closed_at            TIMESTAMPTZ,
    deleted_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT service_orders_tenant_number_unique UNIQUE (tenant_id, number)
);

ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS service_type         VARCHAR(20) DEFAULT 'interno';
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS diagnosis            VARCHAR(40);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS scheduling_sla_hours INTEGER NOT NULL DEFAULT 24;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS sla_hours            INTEGER NOT NULL DEFAULT 48;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS scheduled_at         TIMESTAMPTZ;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS started_at           TIMESTAMPTZ;
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

-- Converte bancos antigos para a esteira atual de status.
ALTER TABLE service_orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE service_orders ALTER COLUMN status TYPE TEXT USING status::TEXT;
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_status_chk;

UPDATE service_orders SET status = CASE status
    WHEN 'A Realizar'             THEN 'Aberto'
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

UPDATE service_orders SET service_type = 'interno' WHERE service_type IS NULL;

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_service_type_chk;
ALTER TABLE service_orders ADD  CONSTRAINT service_orders_service_type_chk
  CHECK (service_type IN ('interno','externo'));

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_diagnosis_chk;
ALTER TABLE service_orders ADD  CONSTRAINT service_orders_diagnosis_chk
  CHECK (diagnosis IS NULL OR diagnosis IN ('Serviço Completo','Encerramento Interno'));

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_sla_hours_check;
ALTER TABLE service_orders ADD  CONSTRAINT service_orders_sla_hours_check
  CHECK (sla_hours BETWEEN 1 AND 8760);

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_sched_sla_chk;
ALTER TABLE service_orders ADD  CONSTRAINT service_orders_sched_sla_chk
  CHECK (scheduling_sla_hours BETWEEN 1 AND 8760);

CREATE INDEX IF NOT EXISTS idx_os_tenant        ON service_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_os_status        ON service_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_os_technician    ON service_orders(technician_id);
CREATE INDEX IF NOT EXISTS idx_os_scheduled     ON service_orders(tenant_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_os_tenant_active ON service_orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_os_service_type  ON service_orders(tenant_id, service_type);
CREATE INDEX IF NOT EXISTS idx_os_created_at    ON service_orders(tenant_id, created_at DESC);

DROP TYPE IF EXISTS os_status;

-- Numeração sequencial por empresa
CREATE OR REPLACE FUNCTION set_service_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = 0 THEN
        SELECT COALESCE(MAX(number), 0) + 1 INTO NEW.number
          FROM service_orders WHERE tenant_id = NEW.tenant_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_order_number ON service_orders;
CREATE TRIGGER trg_service_order_number
BEFORE INSERT ON service_orders
FOR EACH ROW EXECUTE FUNCTION set_service_order_number();

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

DROP TRIGGER IF EXISTS trg_service_orders_updated ON service_orders;
CREATE TRIGGER trg_service_orders_updated
BEFORE UPDATE ON service_orders
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------
-- Evidências fotográficas, assinatura digital e auditoria da O.S.
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
-- Registro dos e-mails automáticos (recuperação de senha, avisos)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Remoção definitiva do antigo módulo de pagamentos
-- (a plataforma não processa cobranças; a negociação é externa)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS payment_requests CASCADE;
DROP TABLE IF EXISTS payments         CASCADE;

-- ---------------------------------------------------------------------
-- Segurança no banco
-- O acesso ocorre exclusivamente pela API REST (Render). A Data API
-- pública do Supabase não é utilizada: o RLS abaixo bloqueia qualquer
-- acesso por chave anônima e o isolamento por tenant fica sob controle
-- da API (middleware tenantScope).
-- ---------------------------------------------------------------------
ALTER TABLE tenants                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_modules             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_images     ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_change_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs               ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
