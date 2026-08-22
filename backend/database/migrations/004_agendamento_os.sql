-- =====================================================================
-- Kuba Tech — Migração 004: fluxo de agendamento das Ordens de Serviço
--
--   1) Nova esteira de status:
--        Aguardando Agendamento -> Agendada -> Em Andamento -> Finalizada
--        (Cancelada em qualquer ponto)
--   2) SLA de Agendamento (24h por padrão) contado a partir da abertura.
--   3) Depois de agendada a O.S. fica SEM SLA até a hora marcada.
--   4) Ao chegar a hora marcada ela vira "Em Andamento" e inicia o
--      SLA de serviço (48h por padrão), contado de started_at.
--
-- Aplique no Supabase > SQL Editor > RUN (depois de migration_003).
-- =====================================================================

-- 1) status passa de ENUM para TEXT + CHECK (permite novos valores)
ALTER TABLE service_orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE service_orders ALTER COLUMN status TYPE TEXT USING status::TEXT;

-- 2) Novas colunas de controle
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS scheduling_sla_hours INTEGER NOT NULL DEFAULT 24;

-- 3) Converte os registros existentes para a nova esteira
UPDATE service_orders
   SET status = CASE
                  WHEN status = 'A Realizar' AND scheduled_at IS NULL THEN 'Aguardando Agendamento'
                  WHEN status = 'A Realizar' AND scheduled_at > NOW()  THEN 'Agendada'
                  WHEN status = 'A Realizar'                           THEN 'Em Andamento'
                  ELSE status
                END
 WHERE status = 'A Realizar';

UPDATE service_orders
   SET started_at = COALESCE(started_at, scheduled_at, created_at)
 WHERE status IN ('Em Andamento', 'Finalizada');

-- 4) Regras de valores válidos e novo padrão
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_status_chk;
ALTER TABLE service_orders ADD CONSTRAINT service_orders_status_chk
  CHECK (status IN ('Aguardando Agendamento', 'Agendada', 'Em Andamento', 'Finalizada', 'Cancelada'));

ALTER TABLE service_orders ALTER COLUMN status SET DEFAULT 'Aguardando Agendamento';

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_sched_sla_chk;
ALTER TABLE service_orders ADD CONSTRAINT service_orders_sched_sla_chk
  CHECK (scheduling_sla_hours BETWEEN 1 AND 8760);

DROP TYPE IF EXISTS os_status;
