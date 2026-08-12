// Módulo Portal do Cliente — consulta pública (sem login) do andamento da O.S.
const model = require('./portal.model');
const { AppError } = require('../../shared/http');
const { onlyDigits } = require('../../shared/validators');

const STATUS_STEPS = ['A Realizar', 'Em Andamento', 'Finalizada'];

// POST /api/portal/consulta { numero, cpf }
async function lookup(req, res) {
  const numero = Number(String(req.body.numero || '').replace(/\D/g, ''));
  const cpf = onlyDigits(String(req.body.cpf || ''));

  if (!Number.isInteger(numero) || numero <= 0) throw new AppError('Informe o número da ordem de serviço.');
  if (cpf.length !== 11) throw new AppError('Informe o CPF do cliente (11 números).');

  const order = await model.findPublicOrder(numero, cpf);
  // Mensagem única: não revela se a O.S. existe para outro CPF (LGPD).
  if (!order) throw new AppError('Nenhuma ordem de serviço encontrada para os dados informados.', 404);

  const etapa = STATUS_STEPS.indexOf(order.status);
  res.json({
    numero: order.number,
    status: order.status,
    etapa: etapa < 0 ? 0 : etapa + 1,
    totalEtapas: STATUS_STEPS.length,
    abertura: order.opening_date,
    previsao: order.sla_due_at,
    agendamento: order.scheduled_at,
    encerramento: order.closed_at,
    atualizadoEm: order.updated_at,
    atrasada:
      !order.closed_at &&
      !['Finalizada', 'Cancelada'].includes(order.status) &&
      new Date(order.sla_due_at).getTime() < Date.now(),
    cliente: order.customer_name,
    equipamento: [order.device_type, order.device_brand, order.device_model].filter(Boolean).join(' '),
    defeito: order.problem_description,
    solucao: order.solution || null,
    empresa: {
      nome: order.company_name,
      telefone: order.company_phone,
      email: order.company_email,
    },
  });
}

module.exports = { lookup };
