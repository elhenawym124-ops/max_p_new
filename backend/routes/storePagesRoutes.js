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

// Get all pages for a company (using POST to send companyId in body)
router.post(
  '/list',
  verifyToken.authenticateToken,
  storePagesController.getAllPages
);

// Get a single page by ID (using POST to send companyId in body)
router.post(
  '/page/:pageId',
  verifyToken.authenticateToken,
  storePagesController.getPageById
);

// Create a new page
router.post(
  '/',
  verifyToken.authenticateToken,
  verifyToken.requireRole(['COMPANY_ADMIN']),
  storePagesController.createPage
);

// Update a page
router.put(
  '/page/:pageId',
  verifyToken.authenticateToken,
  verifyToken.requireRole(['COMPANY_ADMIN']),
  storePagesController.updatePage
);

// Delete a page
router.delete(
  '/page/:pageId',
  verifyToken.authenticateToken,
  verifyToken.requireRole(['COMPANY_ADMIN']),
  storePagesController.deletePage
);

// Toggle page status
router.patch(
  '/page/:pageId/toggle',
  verifyToken.authenticateToken,
  verifyToken.requireRole(['COMPANY_ADMIN']),
  storePagesController.togglePageStatus
);

// Initialize default pages
router.post(
  '/initialize',
  verifyToken.authenticateToken,
  verifyToken.requireRole(['COMPANY_ADMIN']),
  storePagesController.initializeDefaultPages
);

module.exports = router;
