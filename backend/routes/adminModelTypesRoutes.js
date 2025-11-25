const express = require('express');
const router = express.Router();
const adminModelTypesController = require('../controller/adminModelTypesController');
const verifyToken = require("../utils/verifyToken");

// Model Types Management (Super Admin only)
router.get('/', verifyToken.authenticateToken, verifyToken.requireSuperAdmin, adminModelTypesController.getAllModelTypes);
router.get('/:modelName', verifyToken.authenticateToken, verifyToken.requireSuperAdmin, adminModelTypesController.getModelTypeDetails);
router.put('/:modelName/toggle', verifyToken.authenticateToken, verifyToken.requireSuperAdmin, adminModelTypesController.toggleModelType);

module.exports = router;

