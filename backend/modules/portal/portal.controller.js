// Módulo Portal do Cliente — consulta pública do andamento da O.S.
const model = require('./portal.model');
const { AppError } = require('../../shared/http');
const { onlyDigits } = require('../../shared/validators');
const STATUS_STEPS = ['Aberto','Agendado','Em deslocamento','No local','Em execução','Aguardando cliente','Finalizado','Entregue'];

function mapOrder(order) {
  const etapa = STATUS_STEPS.indexOf(order.status);
  return {
    numero: order.number, status: order.status, etapa: etapa < 0 ? 0 : etapa + 1, totalEtapas: STATUS_STEPS.length,
    abertura: order.opening_date, previsao: order.sla_due_at, agendamento: order.scheduled_at,
    encerramento: order.closed_at, atualizadoEm: order.updated_at,
    atrasada: !order.closed_at && !['Finalizado','Entregue','Cancelado'].includes(order.status) && new Date(order.sla_due_at).getTime() < Date.now(),
    cliente: order.customer_name,
    equipamento: [order.device_type, order.device_brand, order.device_model].filter(Boolean).join(' '),
    defeito: order.problem_description, solucao: order.solution || null,
    empresa: { nome: order.company_name, telefone: order.company_phone, email: order.company_email },
  };
}

// POST /api/portal/consulta { cpf, numero? }
async function lookup(req, res) {
  const numeroRaw = String(req.body.numero || '').trim();
  const cpf = onlyDigits(String(req.body.cpf || ''));
  if (cpf.length !== 11) throw new AppError('Informe um CPF válido (11 números).');
  let numero = null;
  if (numeroRaw) {
    numero = Number(numeroRaw.replace(/\D/g, ''));
    if (!Number.isInteger(numero) || numero <= 0) throw new AppError('Número da O.S. inválido.');
  }

  const orders = await model.findPublicOrders(cpf, numero);
  if (!orders.length) throw new AppError('Nenhuma ordem de serviço encontrada para os dados informados.', 404);
  res.json({ ordens: orders.map(mapOrder), total: orders.length });
}
module.exports = { lookup };
