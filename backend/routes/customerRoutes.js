const express = require('express');
const router = express.Router();
const customerController = require('../controller/customerController');
const verifyToken = require("../utils/verifyToken")

router.get('/', verifyToken.authenticateToken, customerController.getAllCustomer);
router.delete('/cus', customerController.deleteAllCustomers);
router.delete('/con', customerController.deleteAllConversations);

// 🚫 Routes for blocking customers on Facebook pages
router.post('/block', verifyToken.authenticateToken, customerController.blockCustomerOnPage);
router.post('/unblock', verifyToken.authenticateToken, customerController.unblockCustomerOnPage);
router.get('/blocked/:pageId', verifyToken.authenticateToken, customerController.getBlockedCustomersOnPage);
router.get('/block-status', verifyToken.authenticateToken, customerController.checkCustomerBlockStatus);

// تفاصيل العميل
router.get('/:customerId', verifyToken.authenticateToken, customerController.getCustomerDetails);

// جلب طلبات العميل
router.get('/:customerId/orders', verifyToken.authenticateToken, customerController.getCustomerOrders);

// سجل نشاطات العميل
router.get('/:customerId/activity', verifyToken.authenticateToken, customerController.getCustomerActivity);

// 📝 ملاحظات العميل
router.get('/:customerId/notes', verifyToken.authenticateToken, customerController.getCustomerNotes);
router.post('/:customerId/notes', verifyToken.authenticateToken, customerController.addCustomerNote);
router.delete('/notes/:noteId', verifyToken.authenticateToken, customerController.deleteCustomerNote);

module.exports = router;
