-- =====================================================================
-- Kuba Tech — Dados iniciais (Supabase > SQL Editor > RUN após schema.sql)
--
-- Cria os módulos comercializáveis (todos implementados no sistema),
-- os planos da plataforma e o usuário Administrador da Plataforma.
--
--   E-mail: admin@kubatech.com.br
--   Senha : Kuba@2026   (altere após o primeiro acesso)
-- =====================================================================

-- Módulos do produto (8 módulos, todos funcionais)
INSERT INTO modules (code, name, description, core) VALUES
  ('customers', 'Clientes',          'Cadastro de clientes da assistência técnica.',                TRUE),
  ('devices',   'Equipamentos',      'Cadastro de equipamentos vinculados aos clientes.',           TRUE),
  ('orders',    'Ordens de Serviço', 'Abertura e acompanhamento das ordens de serviço.',            TRUE),
  ('users',     'Gestão de Equipe',  'Cadastro de usuários e perfis de acesso.',                    TRUE),
  ('reports',   'Relatórios',        'Indicadores gerenciais de atendimento e produtividade.',      FALSE),
  ('sla',       'Gestão de SLA',     'Prazo padrão da empresa, prazo por O.S. e alerta de atraso.', FALSE),
  ('schedule',  'Agenda Técnica',    'Programação de atendimentos por técnico e por data.',         FALSE),
  ('portal',    'Portal do Cliente', 'Consulta pública do andamento da ordem de serviço.',          FALSE)
ON CONFLICT (code) DO UPDATE
   SET name = EXCLUDED.name, description = EXCLUDED.description, core = EXCLUDED.core;

-- Planos comercializados
INSERT INTO plans (code, name, description, monthly_price, max_users) VALUES
  ('essencial',    'Essencial',    'Para assistências que estão começando.',            0.00,   3),
  ('profissional', 'Profissional', 'Relatórios gerenciais e gestão de prazos (SLA).', 149.90,  15),
  ('empresarial',  'Empresarial',  'Todos os módulos, para operações de grande porte.', 299.90, 50)
ON CONFLICT (code) DO NOTHING;

-- Módulos incluídos em cada plano
--   Essencial (4) < Profissional (6) < Empresarial (8)
DELETE FROM plan_modules;

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'essencial'
   AND m.code IN ('customers', 'devices', 'orders', 'users');

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'profissional'
   AND m.code IN ('customers', 'devices', 'orders', 'users', 'reports', 'sla');

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'empresarial'
   AND m.code IN ('customers', 'devices', 'orders', 'users', 'reports', 'sla', 'schedule', 'portal');

-- Administrador da Plataforma (sem tenant_id)
INSERT INTO users (tenant_id, name, email, password_hash, role)
VALUES (
  NULL,
  'Administrador da Plataforma',
  'admin@kubatech.com.br',
  '$2b$10$hhrHzCkpG7FWHreo/t8W8eSM.AvK3cyP/ZhsXwPbYzdEkH6eV6Fra',
  'platform_admin'
)
ON CONFLICT (email) DO NOTHING;
