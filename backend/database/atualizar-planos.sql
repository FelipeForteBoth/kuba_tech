-- ─────────────────────────────────────────────────────────────
-- Kuba Tech — Atualização dos nomes e preços dos planos
-- Rode este arquivo no SQL Editor do Supabase.
-- Os identificadores internos (slug) NÃO mudam, então nenhuma
-- empresa perde o plano contratado nem os módulos liberados.
-- ─────────────────────────────────────────────────────────────

UPDATE plans SET
  name = 'Start',
  description = 'Para quem está começando a organizar os serviços.',
  monthly_price = 59.90,
  max_users = 3
WHERE slug = 'start';

UPDATE plans SET
  name = 'Premium',
  description = 'Relatórios gerenciais e gestão de prazos (SLA).',
  monthly_price = 99.90,
  max_users = 15
WHERE slug = 'professional';

UPDATE plans SET
  name = 'Elite',
  description = 'Todos os módulos, para operações de grande porte.',
  monthly_price = 179.90,
  max_users = 50
WHERE slug = 'business';

SELECT slug, name, monthly_price, max_users FROM plans ORDER BY monthly_price;
