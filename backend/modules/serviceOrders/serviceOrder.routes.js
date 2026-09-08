// Módulo Ordens de Serviço — rotas.
const express = require('express');
const controller = require('./serviceOrder.controller');
const model = require('./serviceOrder.model');
const { authenticate } = require('../../middleware/auth');
const { authorize, tenantScope } = require('../../middleware/rbac');
const { requireModule, tenantHasModule } = require('../../middleware/modules');
const { asyncHandler, AppError } = require('../../shared/http');
const { ROLES, OS_CLOSED_STATUS, MODULES } = require('../../config/roles');

const router = express.Router();
router.use(authenticate, tenantScope);
router.get('/', asyncHandler(controller.index));
router.get('/summary', asyncHandler(controller.summary));
router.get('/:id', asyncHandler(controller.show));
router.get('/:id/history', asyncHandler(controller.history));
const canManage = authorize(ROLES.COMPANY_ADMIN, ROLES.ATTENDANT);
const canOperate = authorize(ROLES.COMPANY_ADMIN, ROLES.ATTENDANT, ROLES.TECHNICIAN);

function requireTechnician(req, _res, next) {
  const technicianId = String(req.body.technicianId || '').trim();
  if (!technicianId) return next(new AppError('Um usuário "Técnico" deve ser cadastrado para prosseguir'));
  return next();
}

function requireCurrentOrHistoricalModule(code) {
  return async (req, res, next) => {
    try {
      if (!req.tenantId) return res.status(403).json({ error: 'Operação exclusiva de empresas contratantes.' });
      const order = await model.findById(req.tenantId, req.params.id);
      if (order && OS_CLOSED_STATUS.includes(order.status)) return next();
      if (!(await tenantHasModule(req.tenantId, code))) {
        return res.status(403).json({ error: 'Este módulo não faz parte do plano contratado pela sua empresa.' });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

router.post('/', canManage, requireTechnician, asyncHandler(controller.store));
router.put('/:id', canManage, requireTechnician, asyncHandler(controller.update));
router.patch('/:id/schedule', canOperate, asyncHandler(controller.schedule));
router.patch('/:id/status', canOperate, asyncHandler(controller.updateStatus));
// A criação/alteração continua limitada ao módulo contratado.
// A leitura de conteúdo histórico permanece disponível em O.S. finalizadas mesmo após downgrade.
router.get('/:id/photos', requireCurrentOrHistoricalModule(MODULES.PHOTOS), asyncHandler(controller.listPhotos));
router.post('/:id/photos', requireModule(MODULES.PHOTOS), canOperate, asyncHandler(controller.addPhotos));
router.delete('/:id/photos/:imageId', requireModule(MODULES.PHOTOS), canOperate, asyncHandler(controller.removePhoto));
router.get('/:id/signature', requireCurrentOrHistoricalModule(MODULES.SIGNATURE), asyncHandler(controller.getSignature));
router.post('/:id/signature', requireModule(MODULES.SIGNATURE), canOperate, asyncHandler(controller.saveSignature));
router.delete('/:id/signature', requireModule(MODULES.SIGNATURE), canOperate, asyncHandler(controller.deleteSignature));
router.patch('/:id/sla', requireModule(MODULES.SLA), authorize(ROLES.COMPANY_ADMIN), asyncHandler(controller.updateSla));
router.delete('/:id', authorize(ROLES.COMPANY_ADMIN), asyncHandler(controller.destroy));
module.exports = router;
