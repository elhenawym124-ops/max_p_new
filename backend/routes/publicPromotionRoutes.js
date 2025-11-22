const express = require('express');
const router = express.Router();
const promotionSettingsController = require('../controller/promotionSettingsController');
const storefrontSettingsController = require('../controller/storefrontSettingsController');
const deliveryOptionController = require('../controller/deliveryOptionController');

/**
 * 🌐 Public Routes للترويج وخيارات التوصيل (بدون مصادقة)
 * يتم استخدامها من الواجهة العامة للمتجر
 */

// Promotion Settings (Free Shipping)
router.get('/promotion-settings/:companyId', promotionSettingsController.getPublicPromotionSettings);

// Storefront Settings (Storefront Features)
router.get('/storefront-settings/:companyId', storefrontSettingsController.getPublicStorefrontSettings);

// Delivery Options
router.get('/delivery-options/:companyId', deliveryOptionController.getPublicDeliveryOptions);

module.exports = router;
