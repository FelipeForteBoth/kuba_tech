-- =====================================================================
-- Kuba Tech — Schema PostgreSQL (Supabase)
-- Plataforma SaaS multi-tenant de gestão de Ordens de Serviço
--
-- Como usar: Supabase > SQL Editor > cole este arquivo > RUN.
-- Em seguida rode database/seed.sql para os dados iniciais.
--
-- Conceitos aplicados (conforme documentação técnica / TCC):
--  * Multi-tenancy lógico: toda tabela de negócio possui tenant_id
--    e todas as consultas da API filtram por ele.
--  * RBAC: perfis platform_admin, company_admin, attendant,
--    technician e manager.
--  * Integridade: chaves primárias, estrangeiras, UNIQUE por tenant
--    (CPF do cliente e número de série do equipamento) e CHECKs.
-- =====================================================================

-- Reinício limpo (o projeto está sendo recriado do zero)
DROP TABLE IF EXISTS service_orders CASCADE;
DROP TABLE IF EXISTS devices        CASCADE;
DROP TABLE IF EXISTS customers      CASCADE;
DROP TABLE IF EXISTS users          CASCADE;
DROP TABLE IF EXISTS tenant_modules CASCADE;
DROP TABLE IF EXISTS plan_modules   CASCADE;
DROP TABLE IF EXISTS tenants        CASCADE;
DROP TABLE IF EXISTS modules        CASCADE;
DROP TABLE IF EXISTS plans          CASCADE;

DROP TYPE IF EXISTS user_role      CASCADE;
DROP TYPE IF EXISTS tenant_status  CASCADE;
DROP TYPE IF EXISTS os_status      CASCADE;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
CREATE TYPE user_role     AS ENUM ('platform_admin', 'company_admin', 'attendant', 'technician', 'manager');
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'canceled');
CREATE TYPE os_status     AS ENUM ('A Realizar', 'Em Andamento', 'Finalizada', 'Cancelada');

-- ---------------------------------------------------------------------
-- Módulo: Plataforma (planos e módulos comercializáveis)
-- ---------------------------------------------------------------------
CREATE TABLE plans (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          VARCHAR(30)  NOT NULL UNIQUE,
    name          VARCHAR(60)  NOT NULL,
    description   TEXT,
    monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
    max_users     INTEGER      NOT NULL DEFAULT 5  CHECK (max_users > 0),
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE modules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30) NOT NULL UNIQUE,
    name        VARCHAR(60) NOT NULL,
    description TEXT,
    core        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE plan_modules (
    plan_id   UUID NOT NULL REFERENCES plans(id)   ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    PRIMARY KEY (plan_id, module_id)
);

-- ---------------------------------------------------------------------
-- Empresas contratantes (tenants)
-- ---------------------------------------------------------------------
CREATE TABLE tenants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(120) NOT NULL,
    document     VARCHAR(18)  NOT NULL UNIQUE,   -- CNPJ (00.000.000/0000-00)
    email        VARCHAR(120) NOT NULL,
    phone        VARCHAR(15),
    plan_id      UUID         REFERENCES plans(id) ON DELETE SET NULL,
    status       tenant_status NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Módulos efetivamente habilitados para cada empresa
CREATE TABLE tenant_modules (
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id  UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, module_id)
);

-- ---------------------------------------------------------------------
-- Usuários (RBAC). tenant_id NULL => Administrador da Plataforma
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(120) NOT NULL,
    password_hash TEXT         NOT NULL,
    role          user_role    NOT NULL,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_tenant_role_check CHECK (
        (role = 'platform_admin' AND tenant_id IS NULL) OR
        (role <> 'platform_admin' AND tenant_id IS NOT NULL)
    )
);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- ---------------------------------------------------------------------
-- Módulo: Clientes
-- ---------------------------------------------------------------------
CREATE TABLE customers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cpf        VARCHAR(14)  NOT NULL,
    name       VARCHAR(120) NOT NULL,
    phone      VARCHAR(15)  NOT NULL,
    email      VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT customers_tenant_cpf_unique UNIQUE (tenant_id, cpf)
);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);

-- ---------------------------------------------------------------------
-- Módulo: Equipamentos
-- ---------------------------------------------------------------------
CREATE TABLE devices (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID         NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
    customer_id   UUID         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) NOT NULL,
    type          VARCHAR(60)  NOT NULL,
    brand         VARCHAR(60),
    model         VARCHAR(60),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT devices_tenant_serial_unique UNIQUE (tenant_id, serial_number)
);
CREATE INDEX idx_devices_tenant   ON devices(tenant_id);
CREATE INDEX idx_devices_customer ON devices(customer_id);

-- ---------------------------------------------------------------------
-- Módulo: Ordens de Serviço
-- ---------------------------------------------------------------------
CREATE TABLE service_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
    number              INTEGER     NOT NULL,           -- numeração sequencial por empresa
    customer_id         UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    device_id           UUID        NOT NULL REFERENCES devices(id)   ON DELETE CASCADE,
    technician_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
    opening_date        DATE        NOT NULL,
    problem_description TEXT        NOT NULL,
    solution            TEXT,
    status              os_status   NOT NULL DEFAULT 'A Realizar',
    created_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    closed_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT service_orders_tenant_number_unique UNIQUE (tenant_id, number)
);
CREATE INDEX idx_os_tenant     ON service_orders(tenant_id);
CREATE INDEX idx_os_status     ON service_orders(tenant_id, status);
CREATE INDEX idx_os_technician ON service_orders(technician_id);

-- Numeração sequencial por empresa + updated_at automático
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

CREATE TRIGGER trg_service_order_number
BEFORE INSERT ON service_orders
FOR EACH ROW EXECUTE FUNCTION set_service_order_number();

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.status = 'Finalizada' AND OLD.status <> 'Finalizada' THEN
        NEW.closed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_orders_updated
BEFORE UPDATE ON service_orders
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------
-- Segurança no banco
-- O acesso aos dados ocorre exclusivamente pela API REST (Render), que se
-- conecta com a connection string do Postgres. A Data API pública do
-- Supabase não é utilizada; o RLS abaixo bloqueia qualquer acesso via
-- chave anônima, mantendo o isolamento por tenant sob controle da API.
-- ---------------------------------------------------------------------
ALTER TABLE tenants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_modules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
