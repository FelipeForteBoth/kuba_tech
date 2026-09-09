// Módulo Portal do Cliente — consulta pública (sem login) do andamento da O.S.
// Regra: o CPF é o único dado obrigatório. O número da O.S. é opcional e,
// quando informado, restringe o resultado àquela ordem — desde que ela
// realmente pertença ao CPF informado.
const model = require('./portal.model');
const { AppError } = require('../../shared/http');
const { onlyDigits, isValidCPF } = require('../../shared/validators');

const STATUS_STEPS = ['Aberto', 'Agendado', 'Em deslocamento', 'No local', 'Em execução', 'Finalizado', 'Entregue'];
const INTERNAL_STEPS = ['Aberto', 'Agendado', 'Em execução', 'Finalizado', 'Entregue'];

function serialize(order) {
  const passos = order.service_type === 'externo' ? STATUS_STEPS : INTERNAL_STEPS;
  const etapa = passos.indexOf(order.status);
  return {
    numero: order.number,
    status: order.status,
    tipo: order.service_type === 'externo' ? 'externo' : 'interno',
    etapa: etapa < 0 ? 0 : etapa + 1,
    totalEtapas: passos.length,
    abertura: order.opening_date,
    previsao: order.sla_due_at,
    agendamento: order.scheduled_at,
    encerramento: order.closed_at,
    atualizadoEm: order.updated_at,
    atrasada:
      !order.closed_at &&
      !['Finalizado', 'Entregue', 'Cancelado'].includes(order.status) &&
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
  };
}

// POST /api/portal/consulta { cpf, numero? }
async function lookup(req, res) {
  const cpf = onlyDigits(String(req.body.cpf || ''));
  const numeroBruto = String(req.body.numero || '').replace(/\D/g, '');

  if (cpf.length !== 11 || !isValidCPF(cpf)) {
    throw new AppError('Informe um CPF válido (11 números).');
  }

  let ordens;
  if (numeroBruto) {
    const numero = Number(numeroBruto);
    if (!Number.isInteger(numero) || numero <= 0) throw new AppError('Número da ordem de serviço inválido.');
    ordens = await model.findByCpfAndNumber(cpf, numero);
  } else {
    ordens = await model.listByCpf(cpf);
  }

  // Mensagem única: não revela se a O.S. existe para outro CPF (LGPD).
  if (!ordens.length) {
    throw new AppError('Nenhuma ordem de serviço encontrada para os dados informados.', 404);
  }

  res.json({ total: ordens.length, ordens: ordens.map(serialize) });
}

module.exports = { lookup };
