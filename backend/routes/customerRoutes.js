const express = require('express');
const router = express.Router();
const customerController = require('../controller/customerController');
const verifyToken = require("../utils/verifyToken")

router.get('/', verifyToken.authenticateToken ,customerController.getAllCustomer);
router.delete('/cus',customerController.deleteAllCustomers);
router.delete('/con',customerController.deleteAllConversations);

// 🚫 Routes for blocking customers on Facebook pages
router.post('/block', verifyToken.authenticateToken, customerController.blockCustomerOnPage);
router.post('/unblock', verifyToken.authenticateToken, customerController.unblockCustomerOnPage);
router.get('/blocked/:pageId', verifyToken.authenticateToken, customerController.getBlockedCustomersOnPage);
router.get('/block-status', verifyToken.authenticateToken, customerController.checkCustomerBlockStatus);

// جلب طلبات العميل
router.get('/:customerId/orders', verifyToken.authenticateToken, customerController.getCustomerOrders);

module.exports = router;