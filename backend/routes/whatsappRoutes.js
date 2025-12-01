/**
 * 📱 WhatsApp Routes
 * مسارات API لنظام WhatsApp
 */

const express = require('express');
const router = express.Router();
const whatsappController = require('../controller/whatsappController');
const { requireAuth: authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// إعداد multer لرفع الملفات
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/whatsapp/temp'));
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

// ═══════════════════════════════════════════════════════════════════════════════
// 📱 إدارة الجلسات
// ═══════════════════════════════════════════════════════════════════════════════

// إنشاء جلسة جديدة
router.post('/sessions', authenticateToken, whatsappController.createSession);

// جلب كل الجلسات
router.get('/sessions', authenticateToken, whatsappController.getSessions);

// جلب جلسة محددة
router.get('/sessions/:id', authenticateToken, whatsappController.getSession);

// تحديث جلسة
router.put('/sessions/:id', authenticateToken, whatsappController.updateSession);

// حذف جلسة
router.delete('/sessions/:id', authenticateToken, whatsappController.deleteSession);

// بدء الاتصال بجلسة
router.post('/sessions/:id/connect', authenticateToken, whatsappController.connectSession);

// قطع الاتصال بجلسة
router.post('/sessions/:id/disconnect', authenticateToken, whatsappController.disconnectSession);

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 المحادثات والرسائل
// ═══════════════════════════════════════════════════════════════════════════════

// جلب المحادثات
router.get('/conversations', authenticateToken, whatsappController.getConversations);

// جلب رسائل محادثة
router.get('/conversations/:jid/messages', authenticateToken, whatsappController.getMessages);

// إرسال رسالة نصية
router.post('/messages/send', authenticateToken, whatsappController.sendMessage);

// إرسال وسائط
router.post('/messages/send-media', authenticateToken, whatsappController.sendMedia);

// رفع وإرسال ملف
router.post('/messages/upload-send', authenticateToken, upload.single('file'), async (req, res) => {
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
router.post('/messages/read', authenticateToken, whatsappController.markAsRead);

// إرسال رسالة بأزرار تفاعلية
router.post('/messages/send-buttons', authenticateToken, whatsappController.sendButtons);

// إرسال رسالة بقائمة
router.post('/messages/send-list', authenticateToken, whatsappController.sendList);

// إرسال منتج
router.post('/messages/send-product', authenticateToken, whatsappController.sendProduct);

// إرسال تفاعل (Reaction)
router.post('/messages/send-reaction', authenticateToken, whatsappController.sendReaction);

// ═══════════════════════════════════════════════════════════════════════════════
// 👤 جهات الاتصال
// ═══════════════════════════════════════════════════════════════════════════════

// تحديث جهة اتصال
router.put('/contacts/:id', authenticateToken, whatsappController.updateContact);

// ربط جهة اتصال بعميل
router.post('/contacts/:id/link-customer', authenticateToken, whatsappController.linkCustomer);

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 الردود السريعة
// ═══════════════════════════════════════════════════════════════════════════════

// جلب الردود السريعة
router.get('/quick-replies', authenticateToken, whatsappController.getQuickReplies);

// إنشاء رد سريع
router.post('/quick-replies', authenticateToken, whatsappController.createQuickReply);

// تحديث رد سريع
router.put('/quick-replies/:id', authenticateToken, whatsappController.updateQuickReply);

// حذف رد سريع
router.delete('/quick-replies/:id', authenticateToken, whatsappController.deleteQuickReply);

// إرسال رد سريع
router.post('/quick-replies/:id/send', authenticateToken, whatsappController.sendQuickReply);

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ الإعدادات
// ═══════════════════════════════════════════════════════════════════════════════

// جلب الإعدادات
router.get('/settings', authenticateToken, whatsappController.getSettings);

// تحديث الإعدادات
router.put('/settings', authenticateToken, whatsappController.updateSettings);

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 الإحصائيات
// ═══════════════════════════════════════════════════════════════════════════════

// جلب الإحصائيات
router.get('/stats', authenticateToken, whatsappController.getStats);

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 إدارة الرسائل
// ═══════════════════════════════════════════════════════════════════════════════

// تعديل رسالة
router.post('/messages/edit', authenticateToken, whatsappController.editMessage);

// حذف رسالة
router.post('/messages/delete', authenticateToken, whatsappController.deleteMessage);

// إعادة توجيه رسالة
router.post('/messages/forward', authenticateToken, whatsappController.forwardMessage);

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 إدارة المحادثات
// ═══════════════════════════════════════════════════════════════════════════════

// أرشفة محادثة
router.post('/chats/archive', authenticateToken, whatsappController.archiveChat);

// تثبيت محادثة
router.post('/chats/pin', authenticateToken, whatsappController.pinChat);

// كتم محادثة
router.post('/chats/mute', authenticateToken, whatsappController.muteChat);

// تحديد كغير مقروء
router.post('/chats/unread', authenticateToken, whatsappController.markChatUnread);

// حذف محادثة
router.post('/chats/delete', authenticateToken, whatsappController.deleteChat);

// مسح محتوى المحادثة
router.post('/chats/clear', authenticateToken, whatsappController.clearChat);

// Migration endpoint
router.post('/migrate-auth', authenticateToken, whatsappController.migrateAuthToDatabase);

module.exports = router;
