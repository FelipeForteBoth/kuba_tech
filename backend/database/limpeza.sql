-- ─────────────────────────────────────────────────────────────
-- KUBA TECH — LIMPEZA DE DADOS (ATENÇÃO: DESTRUTIVO)
--
-- Apaga TODOS os dados de operação e todas as empresas contratantes,
-- preservando APENAS o Administrador da Plataforma kubatech720@gmail.com
-- e os cadastros de catálogo (planos, módulos e planos x módulos).
--
-- Como usar: abra o SQL Editor do Supabase, cole este arquivo e execute.
-- Rode primeiro o schema.sql, se ainda não tiver rodado.
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- Garantia: o administrador que deve permanecer precisa existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
     WHERE LOWER(email) = 'kubatech720@gmail.com'
       AND role = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'Administrador da plataforma kubatech720@gmail.com nao encontrado. Cadastre-o antes de executar a limpeza.';
  END IF;
END $$;

-- Dados operacionais (ordem respeita as chaves estrangeiras).
TRUNCATE TABLE
  service_order_history,
  service_order_images,
  service_order_signatures,
  service_orders,
  devices,
  customers,
  email_logs,
  password_reset_requests,
  plan_change_requests
RESTART IDENTITY CASCADE;

-- Vínculos de módulos das empresas contratantes.
DELETE FROM tenant_modules;

-- Todos os usuários, exceto o administrador da plataforma preservado.
DELETE FROM users
 WHERE LOWER(email) <> 'kubatech720@gmail.com';

-- Empresas contratantes.
DELETE FROM tenants;

COMMIT;

-- Conferência rápida.
SELECT (SELECT COUNT(*) FROM tenants)   AS empresas,
       (SELECT COUNT(*) FROM users)     AS usuarios,
       (SELECT COUNT(*) FROM customers) AS clientes,
       (SELECT COUNT(*) FROM devices)   AS equipamentos;
