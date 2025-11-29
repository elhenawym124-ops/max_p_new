const express = require('express');
const router = express.Router();
const adminGeminiKeysController = require('../controller/adminGeminiKeysController');
const verifyToken = require("../utils/verifyToken");

// ================================
// ADMIN GEMINI KEYS MANAGEMENT
// ================================
// All routes require Super Admin authentication

// Get all keys (central + company) with optional filtering
router.get('/', 
  verifyToken.authenticateToken, 
  verifyToken.requireSuperAdmin, 
  adminGeminiKeysController.getAllGeminiKeys
);

// Get central keys only
router.get('/central', 
  verifyToken.authenticateToken, 
  verifyToken.requireSuperAdmin, 
  adminGeminiKeysController.getCentralKeys
);

// Get company keys for a specific company
router.get('/company/:companyId', 
  verifyToken.authenticateToken, 
  verifyToken.requireSuperAdmin, 
  adminGeminiKeysController.getCompanyKeys
);

// Add new key (can be central or company)
router.post('/', 
  verifyToken.authenticateToken, 
  verifyToken.requireSuperAdmin, 
  adminGeminiKeysController.addGeminiKey
);

// Toggle key active status
router.put('/:id/toggle', 
  verifyToken.authenticateToken, 
  verifyToken.requireSuperAdmin, 
  adminGeminiKeysController.toggleGeminiKeyActiveStatus
);

// Update key model settings
router.put('/:id/model', 
  verifyToken.authenticateToken, 
  verifyToken.requireSuperAdmin, 
  adminGeminiKeysController.updateGeminiKeyModel
);

// Delete key
router.delete('/:id', 
  verifyToken.authenticateToken, 
  verifyToken.requireSuperAdmin, 
  adminGeminiKeysController.deleteGeminiKey
);

// Test key
router.post('/:id/test', 
  verifyToken.authenticateToken, 
  verifyToken.requireSuperAdmin, 
  adminGeminiKeysController.testGeminiKey2
);

// ✅ Clear all model caches (use after changing key settings)
router.post('/clear-cache', 
  verifyToken.authenticateToken, 
  verifyToken.requireSuperAdmin, 
  adminGeminiKeysController.clearModelCaches
);

module.exports = router;

