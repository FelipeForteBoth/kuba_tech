-- =====================================================================
-- Kuba Tech — Migração 002
-- Rode no Supabase (SQL Editor) sobre um banco que já tem o schema.sql.
--
-- Novidades:
--  * SLA das ordens de serviço (padrão 48 horas, editável pelo
--    Administrador da Empresa).
--  * Cancelamento automático da assinatura suspensa há mais de 2 meses.
--  * Novos módulos comercializáveis e planos revisados
--    (Profissional < Empresarial em número de módulos).
-- =====================================================================

-- ── Empresas: data da suspensão e SLA padrão ──
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sla_hours INTEGER NOT NULL DEFAULT 48;

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_sla_hours_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_sla_hours_check
  CHECK (sla_hours BETWEEN 1 AND 8760);

UPDATE tenants SET suspended_at = NOW()
 WHERE status = 'suspended' AND suspended_at IS NULL;

-- ── Ordens de serviço: prazo (SLA) individual ──
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS sla_hours INTEGER NOT NULL DEFAULT 48;

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_sla_hours_check;
ALTER TABLE service_orders ADD CONSTRAINT service_orders_sla_hours_check
  CHECK (sla_hours BETWEEN 1 AND 8760);

-- ── Cancelamento automático após 2 meses suspensa ──
CREATE OR REPLACE FUNCTION expire_suspended_tenants()
RETURNS INTEGER AS $$
DECLARE
    afetadas INTEGER;
BEGIN
    UPDATE tenants
       SET status = 'canceled'
     WHERE status = 'suspended'
       AND suspended_at IS NOT NULL
       AND suspended_at <= NOW() - INTERVAL '2 months';
    GET DIAGNOSTICS afetadas = ROW_COUNT;
    RETURN afetadas;
END;
$$ LANGUAGE plpgsql;

-- Registra automaticamente a data em que a assinatura foi suspensa.
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

-- ── Plano "Avançado" passa a se chamar "Empresarial" ──
UPDATE plans
   SET code = 'empresarial', name = 'Empresarial',
       description = 'Todos os módulos, para operações de grande porte.'
 WHERE code = 'avancado';

-- ── Novos módulos e recomposição dos planos ──
-- (rode o seed.sql novamente, ou execute o bloco abaixo)
INSERT INTO modules (code, name, description, core) VALUES
  ('sla',           'Gestão de SLA',     'Prazos de atendimento e acompanhamento de atrasos.', FALSE),
  ('schedule',      'Agenda Técnica',    'Programação de atendimentos por técnico.', FALSE),
  ('notifications', 'Notificações',      'Avisos automáticos de andamento e vencimento de prazo.', FALSE),
  ('inventory',     'Estoque de Peças',  'Controle de peças utilizadas nos reparos.', FALSE),
  ('finance',       'Financeiro',        'Orçamentos, faturamento e recebimentos das O.S.', FALSE),
  ('portal',        'Portal do Cliente', 'Consulta pública do andamento da ordem de serviço.', FALSE),
  ('audit',         'Auditoria e Logs',  'Registro de ações dos usuários para conformidade (LGPD).', FALSE)
ON CONFLICT (code) DO NOTHING;

DELETE FROM plan_modules;

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'essencial'
   AND m.code IN ('customers', 'devices', 'orders', 'users');

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'profissional'
   AND m.code IN ('customers', 'devices', 'orders', 'users',
                  'reports', 'sla', 'schedule', 'notifications');

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'empresarial';

-- Sincroniza os módulos já habilitados em cada empresa
DELETE FROM tenant_modules;
INSERT INTO tenant_modules (tenant_id, module_id)
SELECT t.id, pm.module_id FROM tenants t
  JOIN plan_modules pm ON pm.plan_id = t.plan_id
ON CONFLICT DO NOTHING;
