const express = require('express');
const router = express.Router();
const verifyToken = require('../utils/verifyToken');

// Products Controller
const {
  fetchProductsFromWooCommerce,
  importSelectedProducts
} = require('../controller/wooCommerceController');

// Orders Controller
const {
  fetchOrdersFromWooCommerce,
  importOrdersFromWooCommerce,
  getLocalOrdersForExport,
  exportOrdersToWooCommerce,
  saveWooCommerceSettings,
  getWooCommerceSettings,
  getSyncLogs,
  triggerAutoSync
} = require('../controller/wooCommerceOrdersController');

// Webhook Controller
const {
  handleWooCommerceWebhook,
  setupWooCommerceWebhooks,
  testWebhook
} = require('../controller/wooCommerceWebhookController');

// ═══════════════════════════════════════════════════════════════
// 📦 Products Routes
// ═══════════════════════════════════════════════════════════════

/**
 * @route   POST /api/v1/woocommerce/fetch-products
 * @desc    جلب المنتجات من WooCommerce
 * @access  Private
 */
router.post('/fetch-products', verifyToken.authenticateToken, fetchProductsFromWooCommerce);

/**
 * @route   POST /api/v1/woocommerce/import-selected
 * @desc    استيراد المنتجات المحددة من WooCommerce
 * @access  Private
 */
router.post('/import-selected', verifyToken.authenticateToken, importSelectedProducts);

// ═══════════════════════════════════════════════════════════════
// 📋 Orders Routes
// ═══════════════════════════════════════════════════════════════

/**
 * @route   POST /api/v1/woocommerce/orders/fetch
 * @desc    جلب الطلبات من WooCommerce (معاينة)
 * @access  Private
 */
router.post('/orders/fetch', verifyToken.authenticateToken, fetchOrdersFromWooCommerce);

/**
 * @route   POST /api/v1/woocommerce/orders/import
 * @desc    استيراد الطلبات المحددة من WooCommerce
 * @access  Private
 */
router.post('/orders/import', verifyToken.authenticateToken, importOrdersFromWooCommerce);

/**
 * @route   GET /api/v1/woocommerce/orders/local
 * @desc    جلب الطلبات المحلية للتصدير
 * @access  Private
 */
router.get('/orders/local', verifyToken.authenticateToken, getLocalOrdersForExport);

/**
 * @route   POST /api/v1/woocommerce/orders/export
 * @desc    تصدير الطلبات إلى WooCommerce
 * @access  Private
 */
router.post('/orders/export', verifyToken.authenticateToken, exportOrdersToWooCommerce);

// ═══════════════════════════════════════════════════════════════
// ⚙️ Settings Routes
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/woocommerce/settings
 * @desc    جلب إعدادات WooCommerce
 * @access  Private
 */
router.get('/settings', verifyToken.authenticateToken, getWooCommerceSettings);

/**
 * @route   POST /api/v1/woocommerce/settings
 * @desc    حفظ إعدادات WooCommerce
 * @access  Private
 */
router.post('/settings', verifyToken.authenticateToken, saveWooCommerceSettings);

/**
 * @route   GET /api/v1/woocommerce/sync-logs
 * @desc    جلب سجل المزامنة
 * @access  Private
 */
router.get('/sync-logs', verifyToken.authenticateToken, getSyncLogs);

// ═══════════════════════════════════════════════════════════════
// 🔔 Webhook Routes
// ═══════════════════════════════════════════════════════════════

/**
 * @route   POST /api/v1/woocommerce/webhook/:companyId
 * @desc    استقبال Webhook من WooCommerce
 * @access  Public (verified by signature)
 */
router.post('/webhook/:companyId', handleWooCommerceWebhook);

/**
 * @route   POST /api/v1/woocommerce/webhooks/setup
 * @desc    إنشاء Webhooks في WooCommerce
 * @access  Private
 */
router.post('/webhooks/setup', verifyToken.authenticateToken, setupWooCommerceWebhooks);

/**
 * @route   POST /api/v1/woocommerce/webhooks/test
 * @desc    اختبار Webhook
 * @access  Private
 */
router.post('/webhooks/test', verifyToken.authenticateToken, testWebhook);

// ═══════════════════════════════════════════════════════════════
// 🔄 Auto Sync Routes
// ═══════════════════════════════════════════════════════════════

/**
 * @route   POST /api/v1/woocommerce/auto-sync
 * @desc    تشغيل المزامنة التلقائية يدوياً
 * @access  Private
 */
router.post('/auto-sync', verifyToken.authenticateToken, triggerAutoSync);

module.exports = router;
