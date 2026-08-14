-- =====================================================================
-- Kuba Tech — Migração 003: módulos funcionais
--
-- Reduz o catálogo para 8 módulos, todos IMPLEMENTADOS no sistema:
--   Essencial    (4): Clientes, Equipamentos, Ordens de Serviço, Equipe
--   Profissional (6): + Relatórios, Gestão de SLA
--   Empresarial  (8): + Agenda Técnica, Portal do Cliente
--
-- Aplique no Supabase > SQL Editor > RUN (depois de migration_002).
-- =====================================================================

-- 1) Agendamento das O.S. (módulo Agenda Técnica)
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_os_scheduled ON service_orders(tenant_id, scheduled_at);

-- 2) Catálogo definitivo de módulos
INSERT INTO modules (code, name, description, core) VALUES
  ('customers', 'Clientes',          'Cadastro de clientes da assistência técnica.',                  TRUE),
  ('devices',   'Equipamentos',      'Cadastro de equipamentos vinculados aos clientes.',             TRUE),
  ('orders',    'Ordens de Serviço', 'Abertura e acompanhamento das ordens de serviço.',              TRUE),
  ('users',     'Gestão de Equipe',  'Cadastro de usuários e perfis de acesso.',                      TRUE),
  ('reports',   'Relatórios',        'Indicadores gerenciais de atendimento e produtividade.',        FALSE),
  ('sla',       'Gestão de SLA',     'Prazo padrão da empresa, prazo por O.S. e alerta de atraso.',   FALSE),
  ('schedule',  'Agenda Técnica',    'Programação de atendimentos por técnico e por data.',           FALSE),
  ('portal',    'Portal do Cliente', 'Consulta pública do andamento da ordem de serviço.',            FALSE)
ON CONFLICT (code) DO UPDATE
   SET name = EXCLUDED.name, description = EXCLUDED.description, core = EXCLUDED.core;

-- Remove módulos que não possuem funcionalidade implementada
DELETE FROM modules
 WHERE code NOT IN ('customers','devices','orders','users','reports','sla','schedule','portal');

-- 3) Composição dos planos
DELETE FROM plan_modules;

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'essencial'
   AND m.code IN ('customers','devices','orders','users');

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'profissional'
   AND m.code IN ('customers','devices','orders','users','reports','sla');

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'empresarial'
   AND m.code IN ('customers','devices','orders','users','reports','sla','schedule','portal');

-- 4) Sincroniza os módulos já habilitados nas empresas com o plano vigente
DELETE FROM tenant_modules;

INSERT INTO tenant_modules (tenant_id, module_id)
SELECT t.id, pm.module_id
  FROM tenants t
  JOIN plan_modules pm ON pm.plan_id = t.plan_id
ON CONFLICT DO NOTHING;
