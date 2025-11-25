const express = require('express');
const router = express.Router();
const adminModelsController = require('../controller/adminModelsController');
const verifyToken = require("../utils/verifyToken");

// Models Management (Super Admin only)
router.get('/', verifyToken.authenticateToken, verifyToken.requireSuperAdmin, adminModelsController.getAllModels);
router.get('/model/:modelName', verifyToken.authenticateToken, verifyToken.requireSuperAdmin, adminModelsController.getModelsByModelName);
router.put('/:id/toggle', verifyToken.authenticateToken, verifyToken.requireSuperAdmin, adminModelsController.toggleModelEnabled);
router.put('/:id/priority', verifyToken.authenticateToken, verifyToken.requireSuperAdmin, adminModelsController.updateModelPriority);
router.put('/:id/limit', verifyToken.authenticateToken, verifyToken.requireSuperAdmin, adminModelsController.updateModelLimit);

module.exports = router;

