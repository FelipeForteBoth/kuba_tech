-- =====================================================================
-- Kuba Tech — Seed PostgreSQL (Supabase)
-- Dados iniciais de demonstração para a plataforma SaaS multi-tenant.
--
-- Como usar: rode primeiro database/shchema.sql (cria as tabelas do
-- zero) e, em seguida, este arquivo no SQL Editor do Supabase.
--
-- Senha de TODOS os usuários de exemplo abaixo: Senha@123
-- (hash bcrypt, 10 salt rounds — mesmo esquema usado por
--  backend/modules/auth/auth.controller.js)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Planos
-- ---------------------------------------------------------------------
INSERT INTO plans (id, code, name, description, monthly_price, max_users, active) VALUES
('10000000-0000-0000-0000-000000000001', 'basico',       'Básico',       'Ideal para assistências técnicas pequenas: cadastro de clientes, equipamentos e ordens de serviço.', 99.90,  3,  TRUE),
('10000000-0000-0000-0000-000000000002', 'profissional', 'Profissional', 'Para equipes em crescimento: inclui relatórios avançados e gestão de equipe.',                          199.90, 8,  TRUE),
('10000000-0000-0000-0000-000000000003', 'empresarial',  'Empresarial',  'Plano completo, com notificações automáticas e limite ampliado de usuários.',                           349.90, 20, TRUE);

-- ---------------------------------------------------------------------
-- Módulos comercializáveis
-- ---------------------------------------------------------------------
INSERT INTO modules (id, code, name, description, core) VALUES
('20000000-0000-0000-0000-000000000001', 'clientes',       'Clientes',              'Cadastro e busca de clientes.',                     TRUE),
('20000000-0000-0000-0000-000000000002', 'dispositivos',   'Equipamentos',          'Cadastro de equipamentos vinculados aos clientes.', TRUE),
('20000000-0000-0000-0000-000000000003', 'ordens_servico', 'Ordens de Serviço',     'Abertura e acompanhamento de OS.',                  TRUE),
('20000000-0000-0000-0000-000000000004', 'relatorios',     'Relatórios Avançados',  'Indicadores e exportação de relatórios gerenciais.', FALSE),
('20000000-0000-0000-0000-000000000005', 'equipe',         'Gestão de Equipe',      'Cadastro de atendentes, técnicos e gestores.',      FALSE),
('20000000-0000-0000-0000-000000000006', 'notificacoes',   'Notificações',          'Avisos automáticos por e-mail/WhatsApp ao cliente.', FALSE);

-- Módulos incluídos em cada plano
INSERT INTO plan_modules (plan_id, module_id) VALUES
-- Básico: só o essencial
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003'),
-- Profissional: essencial + relatórios + equipe
('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003'),
('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004'),
('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005'),
-- Empresarial: todos os módulos
('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003'),
('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004'),
('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005'),
('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000006');

-- ---------------------------------------------------------------------
-- Empresas contratantes (tenants)
-- ---------------------------------------------------------------------
INSERT INTO tenants (id, company_name, document, email, phone, plan_id, status) VALUES
('30000000-0000-0000-0000-000000000001', 'Kuba Assistência Técnica LTDA',       '12.345.678/0001-90', 'contato@kubaassistencia.com.br', '(46) 99911-2233', '10000000-0000-0000-0000-000000000002', 'active'),
('30000000-0000-0000-0000-000000000002', 'TechFix Informática ME',              '98.765.432/0001-10', 'contato@techfix.com.br',         '(46) 99822-3344', '10000000-0000-0000-0000-000000000001', 'active'),
('30000000-0000-0000-0000-000000000003', 'InfoService Manutenção EIRELI',       '11.222.333/0001-44', 'contato@infoservice.com.br',     '(46) 99733-4455', '10000000-0000-0000-0000-000000000003', 'suspended');

-- Módulos habilitados por empresa (espelha o plano contratado)
INSERT INTO tenant_modules (tenant_id, module_id)
SELECT t.id, pm.module_id
  FROM tenants t
  JOIN plan_modules pm ON pm.plan_id = t.plan_id;

-- ---------------------------------------------------------------------
-- Usuários
-- Senha para todos: Senha@123
-- ---------------------------------------------------------------------
INSERT INTO users (id, tenant_id, name, email, password_hash, role, active) VALUES
-- Administrador da Plataforma (Kuba Tech)
('40000000-0000-0000-0000-000000000001', NULL, 'Admin Kuba Tech', 'admin@kubatech.com.br',
 '$2b$10$jL8vhUB4Jfu9MlTyqqof7up0ltm.4fPSyYAQOtiwC70ao2oda.5g6', 'platform_admin', TRUE),

-- Equipe da Kuba Assistência Técnica (plano Profissional)
('40000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000001', 'Felipe Souza',      'felipe@kubaassistencia.com.br',   '$2b$10$jL8vhUB4Jfu9MlTyqqof7up0ltm.4fPSyYAQOtiwC70ao2oda.5g6', 'company_admin', TRUE),
('40000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000001', 'Marina Alves',      'marina@kubaassistencia.com.br',   '$2b$10$jL8vhUB4Jfu9MlTyqqof7up0ltm.4fPSyYAQOtiwC70ao2oda.5g6', 'attendant',     TRUE),
('40000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000001', 'Diego Ferreira',    'diego@kubaassistencia.com.br',    '$2b$10$jL8vhUB4Jfu9MlTyqqof7up0ltm.4fPSyYAQOtiwC70ao2oda.5g6', 'technician',    TRUE),
('40000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000001', 'Aline Ribeiro',     'aline@kubaassistencia.com.br',    '$2b$10$jL8vhUB4Jfu9MlTyqqof7up0ltm.4fPSyYAQOtiwC70ao2oda.5g6', 'manager',       TRUE),

-- Equipe da TechFix Informática (plano Básico)
('40000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000002', 'Bruno Martins',     'bruno@techfix.com.br',            '$2b$10$jL8vhUB4Jfu9MlTyqqof7up0ltm.4fPSyYAQOtiwC70ao2oda.5g6', 'company_admin', TRUE),
('40000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000002', 'Camila Rocha',      'camila@techfix.com.br',           '$2b$10$jL8vhUB4Jfu9MlTyqqof7up0ltm.4fPSyYAQOtiwC70ao2oda.5g6', 'technician',    TRUE),

-- Equipe da InfoService Manutenção (empresa suspensa)
('40000000-0000-0000-0000-000000000031', '30000000-0000-0000-0000-000000000003', 'Rodrigo Nunes',     'rodrigo@infoservice.com.br',      '$2b$10$jL8vhUB4Jfu9MlTyqqof7up0ltm.4fPSyYAQOtiwC70ao2oda.5g6', 'company_admin', TRUE);

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
INSERT INTO customers (id, tenant_id, cpf, name, phone, email) VALUES
-- Kuba Assistência Técnica
('50000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000001', '111.111.111-11', 'João Pedro Lima',      '(46) 99111-1111', 'joao.lima@email.com'),
('50000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000001', '222.222.222-22', 'Maria Fernanda Costa', '(46) 99222-2222', 'maria.costa@email.com'),
('50000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000001', '333.333.333-33', 'Carlos Eduardo Souza', '(46) 99333-3333', 'carlos.souza@email.com'),
-- TechFix Informática
('50000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000002', '444.444.444-44', 'Fernanda Oliveira',    '(46) 99444-4444', 'fernanda.oliveira@email.com'),
('50000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000002', '555.555.555-55', 'Ricardo Almeida',      '(46) 99555-5555', 'ricardo.almeida@email.com');

-- ---------------------------------------------------------------------
-- Equipamentos
-- ---------------------------------------------------------------------
INSERT INTO devices (id, tenant_id, customer_id, serial_number, type, brand, model) VALUES
-- Kuba Assistência Técnica
('60000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000011', 'SN-NB-0001', 'Notebook',    'Dell',    'Inspiron 15'),
('60000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000012', 'SN-DT-0002', 'Desktop',     'Lenovo',  'ThinkCentre M70'),
('60000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000013', 'SN-CL-0003', 'Celular',     'Samsung', 'Galaxy A54'),
-- TechFix Informática
('60000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000021', 'SN-NB-0004', 'Notebook',    'Acer',    'Aspire 5'),
('60000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000022', 'SN-IMP-0005', 'Impressora', 'HP',      'LaserJet M110');

-- ---------------------------------------------------------------------
-- Ordens de Serviço
-- (o número sequencial por empresa é preenchido automaticamente pelo
--  trigger trg_service_order_number)
-- ---------------------------------------------------------------------
INSERT INTO service_orders
  (id, tenant_id, customer_id, device_id, technician_id, opening_date, problem_description, solution, status, created_by, closed_at)
VALUES
-- Kuba Assistência Técnica
('70000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000001',
 '50000000-0000-0000-0000-000000000011', '60000000-0000-0000-0000-000000000011',
 '40000000-0000-0000-0000-000000000013', '2026-07-20',
 'Notebook não liga, suspeita de defeito na fonte.', 'Fonte substituída e testada.',
 'Finalizada', '40000000-0000-0000-0000-000000000012', '2026-07-22 14:30:00-03'),

('70000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000001',
 '50000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000012',
 '40000000-0000-0000-0000-000000000013', '2026-07-28',
 'Computador muito lento, cliente relata travamentos frequentes.', NULL,
 'Em Andamento', '40000000-0000-0000-0000-000000000012', NULL),

('70000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000001',
 '50000000-0000-0000-0000-000000000013', '60000000-0000-0000-0000-000000000013',
 NULL, '2026-08-01',
 'Tela trincada após queda, necessário orçamento de troca.', NULL,
 'A Realizar', '40000000-0000-0000-0000-000000000012', NULL),

-- TechFix Informática
('70000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000002',
 '50000000-0000-0000-0000-000000000021', '60000000-0000-0000-0000-000000000021',
 '40000000-0000-0000-0000-000000000022', '2026-07-15',
 'Notebook superaquecendo e desligando sozinho.', 'Limpeza interna e troca de pasta térmica.',
 'Finalizada', '40000000-0000-0000-0000-000000000021', '2026-07-16 11:00:00-03'),

('70000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000002',
 '50000000-0000-0000-0000-000000000022', '60000000-0000-0000-0000-000000000022',
 '40000000-0000-0000-0000-000000000022', '2026-07-30',
 'Impressora não puxa o papel corretamente.', NULL,
 'Cancelada', '40000000-0000-0000-0000-000000000021', NULL);

COMMIT;

-- =====================================================================
-- Credenciais de acesso para teste (todas com senha: Senha@123)
--
--  Administrador da Plataforma:
--    admin@kubatech.com.br
--
--  Kuba Assistência Técnica (plano Profissional):
--    felipe@kubaassistencia.com.br  (company_admin)
--    marina@kubaassistencia.com.br  (attendant)
--    diego@kubaassistencia.com.br   (technician)
--    aline@kubaassistencia.com.br   (manager)
--
--  TechFix Informática (plano Básico):
--    bruno@techfix.com.br   (company_admin)
--    camila@techfix.com.br  (technician)
--
--  InfoService Manutenção (empresa com assinatura suspensa):
--    rodrigo@infoservice.com.br (company_admin) — login bloqueado
--    até a assinatura ser reativada pelo Administrador da Plataforma.
-- =====================================================================
