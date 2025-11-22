const express = require('express');
const router = express.Router();
const storePagesController = require('../controller/storePagesController');
const verifyToken = require('../utils/verifyToken');

/**
 * 📄 Store Pages Routes
 * Routes for managing customizable store pages
 */

// ==================== PUBLIC ROUTES (MUST BE FIRST) ====================

// Get a page by slug (public access)
router.get(
  '/:companyId/slug/:slug',
  storePagesController.getPageBySlug
);

// Get all active pages for footer (public access)
router.get(
  '/:companyId/public',
  storePagesController.getAllPages
);

// ==================== AUTHENTICATED ROUTES ====================

// Get all pages for a company
router.get(
  '/:companyId',
  verifyToken.authenticateToken,
  verifyToken.requireCompanyAccess,
  storePagesController.getAllPages
);

// Get a single page by ID
router.get(
  '/:companyId/page/:pageId',
  verifyToken.authenticateToken,
  verifyToken.requireCompanyAccess,
  storePagesController.getPageById
);

// Create a new page
router.post(
  '/:companyId',
  verifyToken.authenticateToken,
  verifyToken.requireCompanyAccess,
  verifyToken.requireRole(['COMPANY_ADMIN']),
  storePagesController.createPage
);

// Update a page
router.put(
  '/:companyId/page/:pageId',
  verifyToken.authenticateToken,
  verifyToken.requireCompanyAccess,
  verifyToken.requireRole(['COMPANY_ADMIN']),
  storePagesController.updatePage
);

// Delete a page
router.delete(
  '/:companyId/page/:pageId',
  verifyToken.authenticateToken,
  verifyToken.requireCompanyAccess,
  verifyToken.requireRole(['COMPANY_ADMIN']),
  storePagesController.deletePage
);

// Toggle page status
router.patch(
  '/:companyId/page/:pageId/toggle',
  verifyToken.authenticateToken,
  verifyToken.requireCompanyAccess,
  verifyToken.requireRole(['COMPANY_ADMIN']),
  storePagesController.togglePageStatus
);

// Initialize default pages
router.post(
  '/:companyId/initialize',
  verifyToken.authenticateToken,
  verifyToken.requireCompanyAccess,
  verifyToken.requireRole(['COMPANY_ADMIN']),
  storePagesController.initializeDefaultPages
);

module.exports = router;
