const express = require('express');
const router = express.Router();
const storefrontSettingsController = require('../controller/storefrontSettingsController');
const { requireAuth } = require('../middleware/auth');

/**
 * 🛍️ Routes لإدارة إعدادات واجهة المتجر (Storefront Features)
 */

// Protected routes (تحتاج مصادقة)
router.get('/', requireAuth, storefrontSettingsController.getStorefrontSettings);
router.put('/', requireAuth, storefrontSettingsController.updateStorefrontSettings);
router.post('/reset', requireAuth, storefrontSettingsController.resetStorefrontSettings);

// Facebook Pixel & Conversions API routes
router.post('/test-facebook-pixel', requireAuth, storefrontSettingsController.testFacebookPixel);
router.post('/test-facebook-capi', requireAuth, storefrontSettingsController.testFacebookCapi);
router.post('/validate-pixel-id', requireAuth, storefrontSettingsController.validatePixelId);

// Public route (لا تحتاج مصادقة - للواجهة العامة)
router.get('/:companyId', storefrontSettingsController.getPublicStorefrontSettings);

module.exports = router;

