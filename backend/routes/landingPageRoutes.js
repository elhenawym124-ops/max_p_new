const express = require('express');
const router = express.Router();
const landingPageController = require('../controller/landingPageController');
const { authenticateToken } = require('../middleware/auth');

// Protected routes (تحتاج authentication)
router.post('/', authenticateToken, landingPageController.createLandingPage);
router.get('/', authenticateToken, landingPageController.getAllLandingPages);
router.get('/stats', authenticateToken, landingPageController.getLandingPageStats);
router.get('/:id', authenticateToken, landingPageController.getLandingPage);
router.put('/:id', authenticateToken, landingPageController.updateLandingPage);
router.delete('/:id', authenticateToken, landingPageController.deleteLandingPage);
router.post('/:id/toggle-publish', authenticateToken, landingPageController.togglePublish);
router.post('/:id/duplicate', authenticateToken, landingPageController.duplicateLandingPage);

// Public routes (لا تحتاج authentication)
router.get('/public/:slug', landingPageController.getPublicLandingPage);
router.post('/public/:slug/conversion', landingPageController.recordConversion);

module.exports = router;
