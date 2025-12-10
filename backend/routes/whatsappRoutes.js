/**
 * 📱 WhatsApp Routes
 * مسارات API لنظام WhatsApp
 */

const express = require('express');
const router = express.Router();
const whatsappController = require('../controller/whatsappController');
const verifyToken = require('../utils/verifyToken');
const multer = require('multer');
const path = require('path');

// إعداد multer لرفع الملفات
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/uploads/whatsapp/temp'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max
    },
    fileFilter: (req, file, cb) => {
        // السماح بجميع أنواع الملفات المدعومة
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/3gpp', 'video/quicktime',
            'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/amr',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('نوع الملف غير مدعوم'), false);
        }
    }
});

// Logging middleware
router.use((req, res, next) => {
    console.log(`📱 WhatsApp Router: ${req.method} ${req.path}`);
    next();
});

// Test route
router.get('/test', (req, res) => res.json({ message: 'WhatsApp router is working' }));

// ═══════════════════════════════════════════════════════════════════════════════
// 📱 إدارة الجلسات
// ═══════════════════════════════════════════════════════════════════════════════

// إنشاء جلسة جديدة
router.get('/sessions/debug', whatsappController.getDebugSessions);
router.post('/sessions', verifyToken.authenticateToken, whatsappController.createSession);

// جلب كل الجلسات
router.get('/sessions', verifyToken.authenticateToken, whatsappController.getSessions);

// جلب جلسة محددة
router.get('/sessions/:id', verifyToken.authenticateToken, whatsappController.getSession);

// تحديث جلسة
router.put('/sessions/:id', verifyToken.authenticateToken, whatsappController.updateSession);

// حذف جلسة
router.delete('/sessions/:id', verifyToken.authenticateToken, whatsappController.deleteSession);

// بدء الاتصال بجلسة
router.post('/sessions/:id/connect', verifyToken.authenticateToken, whatsappController.connectSession);

// قطع الاتصال بجلسة
router.post('/sessions/:id/disconnect', verifyToken.authenticateToken, whatsappController.disconnectSession);

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 المحادثات والرسائل
// ═══════════════════════════════════════════════════════════════════════════════

// جلب المحادثات
router.get('/conversations', verifyToken.authenticateToken, whatsappController.getConversations);

// جلب رسائل محادثة
router.get('/conversations/:jid/messages', verifyToken.authenticateToken, whatsappController.getMessages);

// إرسال رسالة نصية
router.post('/messages/send', verifyToken.authenticateToken, whatsappController.sendMessage);

// إرسال وسائط
router.post('/messages/send-media', verifyToken.authenticateToken, whatsappController.sendMedia);

// رفع وإرسال ملف
router.post('/messages/upload-send', verifyToken.authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'لم يتم رفع ملف' });
        }

        const { sessionId, to, caption } = req.body;
        const { WhatsAppMediaHandler, WhatsAppMessageHandler } = require('../services/whatsapp');

        // رفع الملف
        const media = await WhatsAppMediaHandler.uploadMedia(
            req.file.path,
            req.file.mimetype,
            req.file.originalname
        );

        // تحديد نوع الوسائط
        let message;
        switch (media.type) {
            case 'image':
                message = await WhatsAppMessageHandler.sendImage(sessionId, to, media, caption);
                break;
            case 'video':
                message = await WhatsAppMessageHandler.sendVideo(sessionId, to, media, caption);
                break;
            case 'audio':
                message = await WhatsAppMessageHandler.sendAudio(sessionId, to, media);
                break;
            default:
                message = await WhatsAppMessageHandler.sendDocument(sessionId, to, {
                    ...media,
                    fileName: req.file.originalname
                }, { caption });
        }

        res.json({ success: true, message });
    } catch (error) {
        console.error('❌ Error uploading and sending:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء رفع وإرسال الملف' });
    }
});

// تحديد الرسائل كمقروءة
router.post('/messages/read', verifyToken.authenticateToken, whatsappController.markAsRead);

// إرسال رسالة بأزرار تفاعلية
router.post('/messages/send-buttons', verifyToken.authenticateToken, whatsappController.sendButtons);

// إرسال رسالة بقائمة
router.post('/messages/send-list', verifyToken.authenticateToken, whatsappController.sendList);

// إرسال منتج
router.post('/messages/send-product', verifyToken.authenticateToken, whatsappController.sendProduct);

// إرسال تفاعل (Reaction)
router.post('/messages/send-reaction', verifyToken.authenticateToken, whatsappController.sendReaction);

// ═══════════════════════════════════════════════════════════════════════════════
// 📸 الحالات (Status Updates)
// ═══════════════════════════════════════════════════════════════════════════════

// جلب الحالات
router.get('/:sessionId/statuses', verifyToken.authenticateToken, whatsappController.getStatuses);

// نشر حالة جديدة
router.post('/:sessionId/status', verifyToken.authenticateToken, upload.single('media'), whatsappController.postStatus);

// تحديد الحالة كمشاهدة
router.put('/:sessionId/status/:statusId/view', verifyToken.authenticateToken, whatsappController.markStatusViewed);

// ═══════════════════════════════════════════════════════════════════════════════
// 👤 جهات الاتصال
// ═══════════════════════════════════════════════════════════════════════════════

// تحديث جهة اتصال
router.put('/contacts/:id', verifyToken.authenticateToken, whatsappController.updateContact);

// ربط جهة اتصال بعميل
router.post('/contacts/:id/link-customer', verifyToken.authenticateToken, whatsappController.linkCustomer);

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 الردود السريعة
// ═══════════════════════════════════════════════════════════════════════════════

// جلب الردود السريعة
router.get('/quick-replies', verifyToken.authenticateToken, whatsappController.getQuickReplies);

// إنشاء رد سريع
router.post('/quick-replies', verifyToken.authenticateToken, whatsappController.createQuickReply);

// تحديث رد سريع
router.put('/quick-replies/:id', verifyToken.authenticateToken, whatsappController.updateQuickReply);

// حذف رد سريع
router.delete('/quick-replies/:id', verifyToken.authenticateToken, whatsappController.deleteQuickReply);

// إرسال رد سريع
router.post('/quick-replies/:id/send', verifyToken.authenticateToken, whatsappController.sendQuickReply);

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ الإعدادات
// ═══════════════════════════════════════════════════════════════════════════════

// جلب الإعدادات
router.get('/settings', verifyToken.authenticateToken, whatsappController.getSettings);

// تحديث الإعدادات
router.put('/settings', verifyToken.authenticateToken, whatsappController.updateSettings);

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 الإحصائيات
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 👥 المجموعات
// ═══════════════════════════════════════════════════════════════════════════════

// إنشاء مجموعة
router.post('/groups', verifyToken.authenticateToken, whatsappController.createGroup);

// جلب بيانات مجموعة
router.get('/groups/:jid', verifyToken.authenticateToken, whatsappController.getGroupMetadata);

// تحديث اسم المجموعة
router.put('/groups/:jid/subject', verifyToken.authenticateToken, whatsappController.updateGroupSubject);

// تحديث وصف المجموعة
router.put('/groups/:jid/description', verifyToken.authenticateToken, whatsappController.updateGroupDescription);

// تحديث إعدادات المجموعة
router.put('/groups/:jid/settings', verifyToken.authenticateToken, whatsappController.updateGroupSettings);

// إضافة/إزالة مشاركين
router.put('/groups/:jid/participants', verifyToken.authenticateToken, whatsappController.updateGroupParticipants);

// الخروج من المجموعة
router.post('/groups/:jid/leave', verifyToken.authenticateToken, whatsappController.leaveGroup);

// جلب رابط الدعوة
router.get('/groups/:jid/invite-code', verifyToken.authenticateToken, whatsappController.getGroupInviteCode);

// إلغاء رابط الدعوة
router.post('/groups/:jid/revoke-invite', verifyToken.authenticateToken, whatsappController.revokeGroupInviteCode);

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 الإحصائيات
// ═══════════════════════════════════════════════════════════════════════════════

// جلب الإحصائيات
router.get('/stats', verifyToken.authenticateToken, whatsappController.getStats);

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 إدارة الرسائل
// ═══════════════════════════════════════════════════════════════════════════════

// تعديل رسالة
router.post('/messages/edit', verifyToken.authenticateToken, whatsappController.editMessage);

// حذف رسالة
router.post('/messages/delete', verifyToken.authenticateToken, whatsappController.deleteMessage);

// إعادة توجيه رسالة
router.post('/messages/forward', verifyToken.authenticateToken, whatsappController.forwardMessage);

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 إدارة المحادثات
// ═══════════════════════════════════════════════════════════════════════════════

// أرشفة محادثة
router.post('/chats/archive', verifyToken.authenticateToken, whatsappController.archiveChat);

// تثبيت محادثة
router.post('/chats/pin', verifyToken.authenticateToken, whatsappController.pinChat);

// كتم محادثة
router.post('/chats/mute', verifyToken.authenticateToken, whatsappController.muteChat);

// تحديد كغير مقروء
router.post('/chats/unread', verifyToken.authenticateToken, whatsappController.markChatUnread);

// حذف محادثة
router.post('/chats/delete', verifyToken.authenticateToken, whatsappController.deleteChat);

// مسح محتوى المحادثة
router.post('/chats/clear', verifyToken.authenticateToken, whatsappController.clearChat);

// Migration endpoint
router.post('/migrate-auth', verifyToken.authenticateToken, whatsappController.migrateAuthToDatabase);

router.put('/groups/:jid/description', verifyToken.authenticateToken, whatsappController.updateGroupDescription);

// تحديث إعدادات المجموعة
router.put('/groups/:jid/settings', verifyToken.authenticateToken, whatsappController.updateGroupSettings);

// مغادرة المجموعة
router.post('/groups/:jid/leave', verifyToken.authenticateToken, whatsappController.leaveGroup);

// الحصول على رابط الدعوة
router.get('/groups/:jid/invite-code', verifyToken.authenticateToken, whatsappController.getGroupInviteCode);

// إلغاء رابط الدعوة
router.post('/groups/:jid/revoke-invite', verifyToken.authenticateToken, whatsappController.revokeGroupInviteCode);

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 الخصوصية والحظر
// ═══════════════════════════════════════════════════════════════════════════════

// حظر جهة اتصال
router.post('/contacts/block', verifyToken.authenticateToken, whatsappController.blockContact);

// إلغاء حظر جهة اتصال
router.post('/contacts/unblock', verifyToken.authenticateToken, whatsappController.unblockContact);

// التحقق من الرقم
router.post('/check-number', verifyToken.authenticateToken, whatsappController.checkNumber);

// ═══════════════════════════════════════════════════════════════════════════════
// 👤 الملف الشخصي
// ═══════════════════════════════════════════════════════════════════════════════

// مزامنة الملف الشخصي
router.post('/profile/sync', verifyToken.authenticateToken, whatsappController.syncProfile);

// جلب الملف الشخصي
router.get('/profile', verifyToken.authenticateToken, whatsappController.getProfile);

// تحديث الملف الشخصي
router.post('/profile/update', verifyToken.authenticateToken, upload.single('picture'), whatsappController.updateProfile);

// ═══════════════════════════════════════════════════════════════════════════════
// 🏢 Business Profile
// ═══════════════════════════════════════════════════════════════════════════════

// جلب ملف الأعمال
router.get('/business/profile', verifyToken.authenticateToken, whatsappController.getBusinessProfile);

// تعيين ملف الأعمال
router.post('/business/profile', verifyToken.authenticateToken, whatsappController.setBusinessProfile);

// تحديث ملف الأعمال
router.put('/business/profile', verifyToken.authenticateToken, whatsappController.updateBusinessProfile);

// جلب ساعات العمل
router.get('/business/hours', verifyToken.authenticateToken, whatsappController.getBusinessHours);

// تعيين ساعات العمل
router.post('/business/hours', verifyToken.authenticateToken, whatsappController.setBusinessHours);

// ═══════════════════════════════════════════════════════════════════════════════
// 📢 البث (Broadcast)
// ═══════════════════════════════════════════════════════════════════════════════

// إرسال بث جماعي
router.post('/broadcast/send', verifyToken.authenticateToken, whatsappController.sendBroadcast);

// إنشاء قائمة بث
router.post('/broadcast/lists', verifyToken.authenticateToken, whatsappController.createBroadcastList);

// جلب قوائم البث
router.get('/broadcast/lists', verifyToken.authenticateToken, whatsappController.getBroadcastLists);

// ═══════════════════════════════════════════════════════════════════════════════
// 🏷️ العلامات (Labels)
// ═══════════════════════════════════════════════════════════════════════════════

// إضافة علامة للمحادثة
router.post('/labels/chat', verifyToken.authenticateToken, whatsappController.labelChat);

// جلب العلامات
router.get('/labels', verifyToken.authenticateToken, whatsappController.getLabels);

// إنشاء علامة جديدة
router.post('/labels', verifyToken.authenticateToken, whatsappController.createLabel);

// حذف علامة
router.delete('/labels/:id', verifyToken.authenticateToken, whatsappController.deleteLabel);

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ الرسائل المميزة (Starred Messages)
// ═══════════════════════════════════════════════════════════════════════════════

// تمييز رسالة
router.post('/messages/star', verifyToken.authenticateToken, whatsappController.starMessage);

// إلغاء تمييز رسالة
router.post('/messages/unstar', verifyToken.authenticateToken, whatsappController.unstarMessage);

// جلب الرسائل المميزة
router.get('/messages/starred', verifyToken.authenticateToken, whatsappController.getStarredMessages);

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 الخصوصية المتقدمة
// ═══════════════════════════════════════════════════════════════════════════════

// جلب قائمة المحظورين
router.get('/privacy/blocklist', verifyToken.authenticateToken, whatsappController.fetchBlocklist);

// جلب إعدادات الخصوصية
router.get('/privacy/settings', verifyToken.authenticateToken, whatsappController.fetchPrivacySettings);

// تعيين إعدادات الخصوصية
router.post('/privacy/settings', verifyToken.authenticateToken, whatsappController.setPrivacy);

// ═══════════════════════════════════════════════════════════════════════════════
// 👥 ميزات المجموعات المتقدمة
// ═══════════════════════════════════════════════════════════════════════════════

// جلب جميع المجموعات
router.get('/groups/all', verifyToken.authenticateToken, whatsappController.groupFetchAllParticipating);

// تفعيل/تعطيل الرسائل المؤقتة
router.post('/groups/:jid/ephemeral', verifyToken.authenticateToken, whatsappController.groupToggleEphemeral);

// تحديث صورة المجموعة
router.post('/groups/:jid/picture', verifyToken.authenticateToken, whatsappController.groupUpdatePicture);

// قبول دعوة للمجموعة
router.post('/groups/invite/accept', verifyToken.authenticateToken, whatsappController.groupInviteAccept);

// رفض دعوة للمجموعة
router.post('/groups/invite/reject', verifyToken.authenticateToken, whatsappController.groupInviteReject);

// معلومات عن رابط الدعوة
router.get('/groups/invite/info', verifyToken.authenticateToken, whatsappController.groupInviteInfo);

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 الحالة (Status)
// ═══════════════════════════════════════════════════════════════════════════════

// جلب حالة مستخدم
router.get('/status', verifyToken.authenticateToken, whatsappController.getStatus);

// تعيين حالة المستخدم
router.post('/status', verifyToken.authenticateToken, whatsappController.setStatus);

// ═══════════════════════════════════════════════════════════════════════════════
// 🔗 معلومات الرابط
// ═══════════════════════════════════════════════════════════════════════════════

// الحصول على معلومات رابط
router.get('/url/info', verifyToken.authenticateToken, whatsappController.getUrlInfo);

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 الاستطلاعات والطلبات
// ═══════════════════════════════════════════════════════════════════════════════

// إرسال استطلاع
router.post('/messages/send-poll', verifyToken.authenticateToken, whatsappController.sendPoll);

// إرسال طلب
router.post('/messages/send-order', verifyToken.authenticateToken, whatsappController.sendOrder);

// إرسال كتالوج
router.post('/messages/send-catalog', verifyToken.authenticateToken, whatsappController.sendCatalog);

// جلب الكتالوج
router.get('/catalog', verifyToken.authenticateToken, whatsappController.getCatalog);

// جلب المنتجات
router.get('/products', verifyToken.authenticateToken, whatsappController.getProducts);

// جلب السلة
router.get('/cart', verifyToken.authenticateToken, whatsappController.getCart);

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 قوالب الرسائل
// ═══════════════════════════════════════════════════════════════════════════════

// إرسال رسالة قالب
router.post('/messages/send-template', verifyToken.authenticateToken, whatsappController.sendTemplateMessage);

// جلب قوالب الرسائل
router.get('/templates', verifyToken.authenticateToken, whatsappController.getMessageTemplate);

module.exports = router;
