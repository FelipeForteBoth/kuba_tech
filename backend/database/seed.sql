-- =====================================================================
-- Kuba Tech — Dados iniciais (Supabase > SQL Editor > RUN após schema.sql)
--
-- Cria os módulos comercializáveis, os planos da plataforma e o
-- usuário Administrador da Plataforma.
--
--   E-mail: admin@kubatech.com.br
--   Senha : Kuba@2026   (altere após o primeiro acesso)
-- =====================================================================

-- Módulos do produto
INSERT INTO modules (code, name, description, core) VALUES
  ('customers', 'Clientes',           'Cadastro de clientes da assistência técnica.', TRUE),
  ('devices',   'Equipamentos',       'Cadastro de equipamentos vinculados aos clientes.', TRUE),
  ('orders',    'Ordens de Serviço',  'Abertura e acompanhamento das ordens de serviço.', TRUE),
  ('users',     'Gestão de Equipe',   'Cadastro de usuários e perfis de acesso.', TRUE),
  ('reports',   'Relatórios',         'Indicadores gerenciais de atendimento.', FALSE)
ON CONFLICT (code) DO NOTHING;

-- Planos comercializados
INSERT INTO plans (code, name, description, monthly_price, max_users) VALUES
  ('essencial',  'Essencial',  'Para assistências que estão começando.',          0.00,   3),
  ('profissional','Profissional','Equipe completa e relatórios gerenciais.',      149.90, 15),
  ('avancado',   'Avançado',   'Operações com múltiplas equipes técnicas.',       299.90, 50)
ON CONFLICT (code) DO NOTHING;

-- Módulos incluídos em cada plano
INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code = 'essencial' AND m.code IN ('customers', 'devices', 'orders', 'users')
ON CONFLICT DO NOTHING;

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
 WHERE p.code IN ('profissional', 'avancado')
ON CONFLICT DO NOTHING;

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
