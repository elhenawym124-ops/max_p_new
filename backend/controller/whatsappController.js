/**
 * 📱 WhatsApp Controller
 * API endpoints لإدارة WhatsApp
 */

const { getSharedPrismaClient } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();
const { Prisma } = require('@prisma/client');
const {
    WhatsAppManager,
    WhatsAppMessageHandler,
    WhatsAppMediaHandler,
    WhatsAppAIIntegration
} = require('../services/whatsapp');

// ═══════════════════════════════════════════════════════════════════════════════
// 📱 إدارة الجلسات
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * إنشاء جلسة جديدة
 * POST /api/whatsapp/sessions
 */
async function createSession(req, res) {
    try {
        const { companyId } = req.user;
        const { name, aiEnabled = true, autoReply = false, aiMode = 'suggest' } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'اسم الجلسة مطلوب' });
        }

        // التحقق من عدد الجلسات
        const settings = await prisma.whatsAppSettings.findUnique({
            where: { companyId }
        });

        const maxSessions = settings?.maxSessions || 3;
        const currentSessions = await prisma.whatsAppSession.count({
            where: { companyId }
        });

        if (currentSessions >= maxSessions) {
            return res.status(400).json({
                error: `لقد وصلت للحد الأقصى من الجلسات (${maxSessions})`
            });
        }

        // إنشاء الجلسة في قاعدة البيانات
        const session = await prisma.whatsAppSession.create({
            data: {
                companyId,
                name,
                aiEnabled,
                autoReply,
                aiMode,
                status: 'DISCONNECTED'
            }
        });

        // بدء الاتصال
        await WhatsAppManager.createSession(session.id, companyId);

        res.status(201).json({
            success: true,
            session
        });
    } catch (error) {
        console.error('❌ Error creating session:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الجلسة' });
    }
}

/**
 * جلب كل الجلسات
 * GET /api/whatsapp/sessions
 */
async function getSessions(req, res) {
    try {
        const { companyId } = req.user;

        const sessions = await prisma.whatsAppSession.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        messages: true,
                        contacts: true
                    }
                }
            }
        });

        // إضافة معلومات الجلسات النشطة
        const sessionsWithStatus = sessions.map(session => {
            const activeSession = WhatsAppManager.getSession(session.id);
            return {
                ...session,
                liveStatus: activeSession?.status || 'disconnected',
                qrCode: activeSession?.qrCode || null
            };
        });

        res.json({ sessions: sessionsWithStatus });
    } catch (error) {
        console.error('❌ Error getting sessions:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الجلسات' });
    }
}

/**
 * جلب جلسة محددة
 * GET /api/whatsapp/sessions/:id
 */
async function getSession(req, res) {
    try {
        const { companyId } = req.user;
        const { id } = req.params;

        const session = await prisma.whatsAppSession.findFirst({
            where: { id, companyId },
            include: {
                _count: {
                    select: {
                        messages: true,
                        contacts: true
                    }
                }
            }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        const activeSession = WhatsAppManager.getSession(id);

        res.json({
            session: {
                ...session,
                liveStatus: activeSession?.status || 'disconnected',
                qrCode: activeSession?.qrCode || null
            }
        });
    } catch (error) {
        console.error('❌ Error getting session:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الجلسة' });
    }
}

/**
 * تحديث جلسة
 * PUT /api/whatsapp/sessions/:id
 */
async function updateSession(req, res) {
    try {
        const { companyId } = req.user;
        const { id } = req.params;
        const {
            name,
            aiEnabled,
            autoReply,
            aiMode,
            welcomeMessage,
            awayMessage,
            workingHoursEnabled,
            workingHours,
            isDefault
        } = req.body;

        // التحقق من الملكية
        const existingSession = await prisma.whatsAppSession.findFirst({
            where: { id, companyId }
        });

        if (!existingSession) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        // إذا تم تعيينها كافتراضية، إلغاء الافتراضية من الجلسات الأخرى
        if (isDefault) {
            await prisma.whatsAppSession.updateMany({
                where: { companyId, isDefault: true },
                data: { isDefault: false }
            });
        }

        const session = await prisma.whatsAppSession.update({
            where: { id },
            data: {
                name,
                aiEnabled,
                autoReply,
                aiMode,
                welcomeMessage,
                awayMessage,
                workingHoursEnabled,
                workingHours: workingHours ? JSON.stringify(workingHours) : undefined,
                isDefault
            }
        });

        res.json({ success: true, session });
    } catch (error) {
        console.error('❌ Error updating session:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث الجلسة' });
    }
}

/**
 * حذف جلسة
 * DELETE /api/whatsapp/sessions/:id
 */
async function deleteSession(req, res) {
    try {
        const { companyId } = req.user;
        const { id } = req.params;

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        // حذف الجلسة
        await WhatsAppManager.deleteSession(id);

        res.json({ success: true, message: 'تم حذف الجلسة بنجاح' });
    } catch (error) {
        console.error('❌ Error deleting session:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف الجلسة' });
    }
}

/**
 * بدء الاتصال بجلسة
 * POST /api/whatsapp/sessions/:id/connect
 */
async function connectSession(req, res) {
    try {
        const { companyId } = req.user;
        const { id } = req.params;

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        // بدء الاتصال
        await WhatsAppManager.createSession(id, companyId);

        res.json({ success: true, message: 'جاري الاتصال...' });
    } catch (error) {
        console.error('❌ Error connecting session:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء الاتصال' });
    }
}

/**
 * قطع الاتصال بجلسة
 * POST /api/whatsapp/sessions/:id/disconnect
 */
async function disconnectSession(req, res) {
    try {
        const { companyId } = req.user;
        const { id } = req.params;

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        // قطع الاتصال
        await WhatsAppManager.closeSession(id);

        res.json({ success: true, message: 'تم قطع الاتصال' });
    } catch (error) {
        console.error('❌ Error disconnecting session:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء قطع الاتصال' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 المحادثات والرسائل
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * جلب المحادثات (جهات الاتصال)
 * GET /api/whatsapp/conversations
 */
async function getConversations(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, page = 1, limit = 50, search, category, archived } = req.query;

        // جلب جلسات الشركة
        const sessionIds = sessionId
            ? [sessionId]
            : (await prisma.whatsAppSession.findMany({
                where: { companyId },
                select: { id: true }
            })).map(s => s.id);

        const where = {
            sessionId: { in: sessionIds },
            isArchived: archived === 'true'
        };

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { pushName: { contains: search } },
                { phoneNumber: { contains: search } }
            ];
        }

        if (category) {
            where.category = category;
        }

        const contacts = await prisma.whatsAppContact.findMany({
            where,
            orderBy: [
                { isPinned: 'desc' },
                { lastMessageAt: 'desc' }
            ],
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit),
            select: {
                id: true,
                sessionId: true,
                jid: true,
                phoneNumber: true,
                name: true,
                pushName: true,
                profilePicUrl: true,
                isGroup: true,
                category: true,
                unreadCount: true,
                lastMessageAt: true,
                isArchived: true,
                isPinned: true,
                isMuted: true,
                session: {
                    select: { name: true, phoneNumber: true }
                },
                customer: {
                    select: { firstName: true, lastName: true, status: true }
                }
            }
        });

        const total = await prisma.whatsAppContact.count({ where });

        // جلب آخر رسالة لكل محادثة
        const conversationsWithLastMessage = await Promise.all(
            contacts.map(async (contact) => {
                try {
                    const lastMessage = await prisma.whatsAppMessage.findFirst({
                        where: {
                            sessionId: contact.sessionId,
                            remoteJid: contact.jid
                        },
                        orderBy: { timestamp: 'desc' },
                        select: {
                            content: true,
                            messageType: true,
                            fromMe: true,
                            timestamp: true
                        }
                    });

                    return {
                        ...contact,
                        lastMessage: lastMessage || null
                    };
                } catch (error) {
                    console.error(`❌ Error getting last message for contact ${contact.id}:`, error);
                    return {
                        ...contact,
                        lastMessage: null
                    };
                }
            })
        );

        res.json({
            conversations: conversationsWithLastMessage,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('❌ Error getting conversations:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب المحادثات' });
    }
}

/**
 * جلب رسائل محادثة
 * GET /api/whatsapp/conversations/:jid/messages
 */
async function getMessages(req, res) {
    try {
        const { companyId } = req.user;
        const { jid } = req.params;
        const { sessionId, page = 1, limit = 50 } = req.query;

        if (!sessionId) {
            return res.status(400).json({ error: 'معرف الجلسة مطلوب' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        const result = await WhatsAppMessageHandler.getMessages(sessionId, jid, {
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json(result);
    } catch (error) {
        console.error('❌ Error getting messages:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الرسائل' });
    }
}

/**
 * إرسال رسالة
 * POST /api/whatsapp/messages/send
 */
async function sendMessage(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, text, quotedMessageId } = req.body;

        if (!sessionId || !to || !text) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        const message = await WhatsAppMessageHandler.sendText(sessionId, to, text, {
            quotedMessageId
        });

        res.json({ success: true, message });
    } catch (error) {
        console.error('❌ Error sending message:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إرسال الرسالة' });
    }
}

/**
 * إرسال وسائط
 * POST /api/whatsapp/messages/send-media
 */
async function sendMedia(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, mediaType, mediaUrl, caption } = req.body;

        if (!sessionId || !to || !mediaType || !mediaUrl) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        let message;
        const mediaSource = { url: mediaUrl };

        switch (mediaType) {
            case 'image':
                message = await WhatsAppMessageHandler.sendImage(sessionId, to, mediaSource, caption);
                break;
            case 'video':
                message = await WhatsAppMessageHandler.sendVideo(sessionId, to, mediaSource, caption);
                break;
            case 'audio':
                message = await WhatsAppMessageHandler.sendAudio(sessionId, to, mediaSource);
                break;
            case 'document':
                message = await WhatsAppMessageHandler.sendDocument(sessionId, to, mediaSource, { caption });
                break;
            default:
                return res.status(400).json({ error: 'نوع الوسائط غير مدعوم' });
        }

        res.json({ success: true, message });
    } catch (error) {
        console.error('❌ Error sending media:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إرسال الوسائط' });
    }
}

/**
 * تحديد الرسائل كمقروءة
 * POST /api/whatsapp/messages/read
 */
async function markAsRead(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, remoteJid } = req.body;

        if (!sessionId || !remoteJid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppMessageHandler.markAsRead(sessionId, remoteJid);

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error marking as read:', error);
        res.status(500).json({ error: 'حدث خطأ' });
    }
}

/**
 * إرسال رسالة بأزرار تفاعلية
 * POST /api/whatsapp/messages/send-buttons
 */
async function sendButtons(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, text, buttons, footer, header } = req.body;

        if (!sessionId || !to || !text || !buttons || !Array.isArray(buttons)) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        if (buttons.length > 3) {
            return res.status(400).json({ error: 'الحد الأقصى للأزرار هو 3' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        const message = await WhatsAppMessageHandler.sendButtons(
            sessionId,
            to,
            text,
            buttons,
            { footer, header }
        );

        res.json({ success: true, message });
    } catch (error) {
        console.error('❌ Error sending buttons:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إرسال الأزرار' });
    }
}

/**
 * إرسال رسالة بقائمة
 * POST /api/whatsapp/messages/send-list
 */
async function sendList(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, text, buttonText, sections, title, footer, description } = req.body;

        if (!sessionId || !to || !text || !buttonText || !sections || !Array.isArray(sections)) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        if (sections.length > 10) {
            return res.status(400).json({ error: 'الحد الأقصى للأقسام هو 10' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        const message = await WhatsAppMessageHandler.sendList(
            sessionId,
            to,
            text,
            buttonText,
            sections,
            { title, footer, description }
        );

        res.json({ success: true, message });
    } catch (error) {
        console.error('❌ Error sending list:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إرسال القائمة' });
    }
}

/**
 * إرسال منتج
 * POST /api/whatsapp/messages/send-product
 */
async function sendProduct(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, product, buttons, footer } = req.body;

        if (!sessionId || !to || !product || !product.name) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        const message = await WhatsAppMessageHandler.sendProduct(
            sessionId,
            to,
            product,
            { buttons, footer }
        );

        res.json({ success: true, message });
    } catch (error) {
        console.error('❌ Error sending product:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إرسال المنتج' });
    }
}

/**
 * إرسال تفاعل (Reaction)
 * POST /api/whatsapp/messages/send-reaction
 */
async function sendReaction(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, messageId, emoji } = req.body;

        if (!sessionId || !to || !messageId || !emoji) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        const result = await WhatsAppMessageHandler.sendReaction(
            sessionId,
            to,
            messageId,
            emoji
        );

        res.json({ success: true, result });
    } catch (error) {
        console.error('❌ Error sending reaction:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إرسال التفاعل' });
    }
}

/**
 * تعديل رسالة
 * POST /api/whatsapp/messages/edit
 */
async function editMessage(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, key, newText } = req.body;

        if (!sessionId || !to || !key || !newText) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.editMessage(sessionId, to, key, newText);

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error editing message:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تعديل الرسالة' });
    }
}

/**
 * حذف رسالة
 * POST /api/whatsapp/messages/delete
 */
async function deleteMessage(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, key } = req.body;

        if (!sessionId || !to || !key) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.deleteMessage(sessionId, to, key);

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting message:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف الرسالة' });
    }
}

/**
 * إعادة توجيه رسالة
 * POST /api/whatsapp/messages/forward
 */
async function forwardMessage(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, message } = req.body;

        if (!sessionId || !to || !message) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.forwardMessage(sessionId, to, message);

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error forwarding message:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إعادة توجيه الرسالة' });
    }
}

/**
 * أرشفة محادثة
 * POST /api/whatsapp/chats/archive
 */
async function archiveChat(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, jid, archive } = req.body;

        if (!sessionId || !jid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.archiveChat(sessionId, jid, archive);

        // Update local DB
        await prisma.whatsAppContact.updateMany({
            where: { sessionId, jid },
            data: { isArchived: archive }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error archiving chat:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء أرشفة المحادثة' });
    }
}

/**
 * تثبيت محادثة
 * POST /api/whatsapp/chats/pin
 */
async function pinChat(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, jid, pin } = req.body;

        if (!sessionId || !jid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.pinChat(sessionId, jid, pin);

        // Update local DB
        await prisma.whatsAppContact.updateMany({
            where: { sessionId, jid },
            data: { isPinned: pin }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error pinning chat:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تثبيت المحادثة' });
    }
}

/**
 * كتم محادثة
 * POST /api/whatsapp/chats/mute
 */
async function muteChat(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, jid, mute } = req.body;

        if (!sessionId || !jid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.muteChat(sessionId, jid, mute);

        // Update local DB
        await prisma.whatsAppContact.updateMany({
            where: { sessionId, jid },
            data: { isMuted: mute }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error muting chat:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء كتم المحادثة' });
    }
}

/**
 * تحديد كغير مقروء
 * POST /api/whatsapp/chats/unread
 */
async function markChatUnread(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, jid, unread } = req.body;

        if (!sessionId || !jid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.markChatUnread(sessionId, jid, unread);

        // Update local DB if needed (optional, as unread count comes from messages usually)
        if (unread) {
            await prisma.whatsAppContact.updateMany({
                where: { sessionId, jid },
                data: { unreadCount: { increment: 1 } } // Artificial increment
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error marking chat unread:', error);
        res.status(500).json({ error: 'حدث خطأ' });
    }
}

/**
 * حذف محادثة
 * POST /api/whatsapp/chats/delete
 */
async function deleteChat(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, jid } = req.body;

        if (!sessionId || !jid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        // Delete from Baileys (Clear chat)
        const activeSession = WhatsAppManager.getSession(sessionId);
        if (activeSession?.status === 'connected') {
            try {
                await activeSession.sock.chatModify({
                    delete: true,
                    lastMessages: [{
                        key: { remoteJid: jid, fromMe: true, id: 'AAA' },
                        messageTimestamp: Math.floor(Date.now() / 1000)
                    }]
                }, jid);
            } catch (baileysError) {
                console.error('⚠️ Error deleting chat from Baileys (continuing with DB delete):', baileysError);
                // Continue with DB deletion even if Baileys fails
            }
        }

        // Delete from DB
        await prisma.whatsAppMessage.deleteMany({
            where: { sessionId, remoteJid: jid }
        });

        await prisma.whatsAppContact.deleteMany({
            where: { sessionId, jid }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting chat:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف المحادثة' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 👤 جهات الاتصال
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * تحديث جهة اتصال
 * PUT /api/whatsapp/contacts/:id
 */
async function updateContact(req, res) {
    try {
        const { companyId } = req.user;
        const { id } = req.params;
        const { name, category, tags, notes, customerId, isArchived, isPinned, isMuted } = req.body;

        // التحقق من الملكية
        const contact = await prisma.whatsAppContact.findFirst({
            where: { id },
            include: {
                session: { select: { companyId: true } }
            }
        });

        if (!contact || contact.session.companyId !== companyId) {
            return res.status(404).json({ error: 'جهة الاتصال غير موجودة' });
        }

        const updatedContact = await prisma.whatsAppContact.update({
            where: { id },
            data: {
                name,
                category,
                tags: tags ? JSON.stringify(tags) : undefined,
                notes,
                customerId,
                isArchived,
                isPinned,
                isMuted
            }
        });

        res.json({ success: true, contact: updatedContact });
    } catch (error) {
        console.error('❌ Error updating contact:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث جهة الاتصال' });
    }
}

/**
 * ربط جهة اتصال بعميل
 * POST /api/whatsapp/contacts/:id/link-customer
 */
async function linkCustomer(req, res) {
    try {
        const { companyId } = req.user;
        const { id } = req.params;
        const { customerId } = req.body;

        // التحقق من الملكية
        const contact = await prisma.whatsAppContact.findFirst({
            where: { id },
            include: {
                session: { select: { companyId: true } }
            }
        });

        if (!contact || contact.session.companyId !== companyId) {
            return res.status(404).json({ error: 'جهة الاتصال غير موجودة' });
        }

        // التحقق من العميل
        const customer = await prisma.customer.findFirst({
            where: { id: customerId, companyId }
        });

        if (!customer) {
            return res.status(404).json({ error: 'العميل غير موجود' });
        }

        const updatedContact = await prisma.whatsAppContact.update({
            where: { id },
            data: { customerId },
            include: { customer: true }
        });

        res.json({ success: true, contact: updatedContact });
    } catch (error) {
        console.error('❌ Error linking customer:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء ربط العميل' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 الردود السريعة
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * جلب الردود السريعة
 * GET /api/whatsapp/quick-replies
 */
async function getQuickReplies(req, res) {
    try {
        const { companyId } = req.user;
        const { category } = req.query;

        const where = { companyId, isActive: true };
        if (category) where.category = category;

        const quickReplies = await prisma.whatsAppQuickReply.findMany({
            where,
            orderBy: [
                { sortOrder: 'asc' },
                { usageCount: 'desc' }
            ]
        });

        res.json({ quickReplies });
    } catch (error) {
        console.error('❌ Error getting quick replies:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الردود السريعة' });
    }
}

/**
 * إنشاء رد سريع
 * POST /api/whatsapp/quick-replies
 */
async function createQuickReply(req, res) {
    try {
        const { companyId } = req.user;
        const { title, shortcut, content, category, variables, mediaUrl, mediaType } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'العنوان والمحتوى مطلوبان' });
        }

        const quickReply = await prisma.whatsAppQuickReply.create({
            data: {
                companyId,
                title,
                shortcut,
                content,
                category: category || 'general',
                variables: variables ? JSON.stringify(variables) : null,
                mediaUrl,
                mediaType
            }
        });

        res.status(201).json({ success: true, quickReply });
    } catch (error) {
        console.error('❌ Error creating quick reply:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الرد السريع' });
    }
}

/**
 * تحديث رد سريع
 * PUT /api/whatsapp/quick-replies/:id
 */
async function updateQuickReply(req, res) {
    try {
        const { companyId } = req.user;
        const { id } = req.params;
        const { title, shortcut, content, category, variables, mediaUrl, mediaType, isActive, sortOrder } = req.body;

        // التحقق من الملكية
        const existing = await prisma.whatsAppQuickReply.findFirst({
            where: { id, companyId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'الرد السريع غير موجود' });
        }

        const quickReply = await prisma.whatsAppQuickReply.update({
            where: { id },
            data: {
                title,
                shortcut,
                content,
                category,
                variables: variables ? JSON.stringify(variables) : undefined,
                mediaUrl,
                mediaType,
                isActive,
                sortOrder
            }
        });

        res.json({ success: true, quickReply });
    } catch (error) {
        console.error('❌ Error updating quick reply:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث الرد السريع' });
    }
}

/**
 * حذف رد سريع
 * DELETE /api/whatsapp/quick-replies/:id
 */
async function deleteQuickReply(req, res) {
    try {
        const { companyId } = req.user;
        const { id } = req.params;

        // التحقق من الملكية
        const existing = await prisma.whatsAppQuickReply.findFirst({
            where: { id, companyId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'الرد السريع غير موجود' });
        }

        await prisma.whatsAppQuickReply.delete({ where: { id } });

        res.json({ success: true, message: 'تم حذف الرد السريع' });
    } catch (error) {
        console.error('❌ Error deleting quick reply:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف الرد السريع' });
    }
}

/**
 * إرسال رد سريع
 * POST /api/whatsapp/quick-replies/:id/send
 */
async function sendQuickReply(req, res) {
    try {
        const { companyId } = req.user;
        const { id } = req.params;
        const { sessionId, to, variables } = req.body;

        // التحقق من الملكية
        const quickReply = await prisma.whatsAppQuickReply.findFirst({
            where: { id, companyId }
        });

        if (!quickReply) {
            return res.status(404).json({ error: 'الرد السريع غير موجود' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        const message = await WhatsAppMessageHandler.sendQuickReply(sessionId, to, id, variables || {});

        res.json({ success: true, message });
    } catch (error) {
        console.error('❌ Error sending quick reply:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إرسال الرد السريع' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ الإعدادات
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * جلب الإعدادات
 * GET /api/whatsapp/settings
 */
async function getSettings(req, res) {
    try {
        const { companyId } = req.user;

        let settings = await prisma.whatsAppSettings.findUnique({
            where: { companyId }
        });

        // إنشاء إعدادات افتراضية إذا لم تكن موجودة
        if (!settings) {
            settings = await prisma.whatsAppSettings.create({
                data: { companyId }
            });
        }

        res.json({ settings });
    } catch (error) {
        console.error('❌ Error getting settings:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الإعدادات' });
    }
}

/**
 * تحديث الإعدادات
 * PUT /api/whatsapp/settings
 */
async function updateSettings(req, res) {
    try {
        const { companyId } = req.user;
        const {
            isEnabled,
            maxSessions,
            notificationSound,
            browserNotifications,
            defaultAIMode,
            aiWelcomeEnabled,
            aiAwayEnabled,
            maxImageSize,
            maxVideoSize,
            maxDocumentSize,
            autoCompressImages,
            autoArchiveDays
        } = req.body;

        const settings = await prisma.whatsAppSettings.upsert({
            where: { companyId },
            update: {
                isEnabled,
                maxSessions,
                notificationSound,
                browserNotifications,
                defaultAIMode,
                aiWelcomeEnabled,
                aiAwayEnabled,
                maxImageSize,
                maxVideoSize,
                maxDocumentSize,
                autoCompressImages,
                autoArchiveDays
            },
            create: {
                companyId,
                isEnabled,
                maxSessions,
                notificationSound,
                browserNotifications,
                defaultAIMode,
                aiWelcomeEnabled,
                aiAwayEnabled,
                maxImageSize,
                maxVideoSize,
                maxDocumentSize,
                autoCompressImages,
                autoArchiveDays
            }
        });

        res.json({ success: true, settings });
    } catch (error) {
        console.error('❌ Error updating settings:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث الإعدادات' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 الإحصائيات
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * جلب الإحصائيات
 * GET /api/whatsapp/stats
 */
async function getStats(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, period = '7d' } = req.query;

        // حساب التاريخ
        const periodDays = parseInt(period) || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        // جلب معرفات الجلسات
        const sessionIds = sessionId
            ? [sessionId]
            : (await prisma.whatsAppSession.findMany({
                where: { companyId },
                select: { id: true }
            })).map(s => s.id);

        // إحصائيات الرسائل
        const totalMessages = await prisma.whatsAppMessage.count({
            where: {
                sessionId: { in: sessionIds },
                timestamp: { gte: startDate }
            }
        });

        const sentMessages = await prisma.whatsAppMessage.count({
            where: {
                sessionId: { in: sessionIds },
                fromMe: true,
                timestamp: { gte: startDate }
            }
        });

        const receivedMessages = totalMessages - sentMessages;

        const aiResponses = await prisma.whatsAppMessage.count({
            where: {
                sessionId: { in: sessionIds },
                isAIResponse: true,
                timestamp: { gte: startDate }
            }
        });

        // إحصائيات المحادثات
        const totalConversations = await prisma.whatsAppContact.count({
            where: { sessionId: { in: sessionIds } }
        });

        const activeConversations = await prisma.whatsAppContact.count({
            where: {
                sessionId: { in: sessionIds },
                lastMessageAt: { gte: startDate }
            }
        });

        // إحصائيات يومية
        let dailyStats = [];

        if (sessionIds.length > 0) {
            dailyStats = await prisma.$queryRaw`
                SELECT 
                    DATE(timestamp) as date,
                    COUNT(*) as total,
                    SUM(CASE WHEN fromMe = true THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN fromMe = false THEN 1 ELSE 0 END) as received
                FROM whatsapp_messages
                WHERE sessionId IN (${Prisma.join(sessionIds)})
                AND timestamp >= ${startDate}
                GROUP BY DATE(timestamp)
                ORDER BY date
            `.catch((e) => {
                console.error('Error in daily stats query:', e);
                return [];
            });

            // Convert BigInt to Number
            dailyStats = dailyStats.map(stat => ({
                date: stat.date,
                total: Number(stat.total || 0),
                sent: Number(stat.sent || 0),
                received: Number(stat.received || 0)
            }));
        }

        res.json({
            stats: {
                messages: {
                    total: totalMessages,
                    sent: sentMessages,
                    received: receivedMessages,
                    aiResponses
                },
                conversations: {
                    total: totalConversations,
                    active: activeConversations
                },
                daily: dailyStats
            }
        });
    } catch (error) {
        console.error('❌ Error getting stats:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
    }
}

/**
 * تعديل رسالة
 * POST /api/whatsapp/messages/edit
 */
async function editMessage(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, key, newText } = req.body;

        if (!sessionId || !to || !key || !newText) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.editMessage(sessionId, to, key, newText);

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error editing message:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تعديل الرسالة' });
    }
}

/**
 * حذف رسالة
 * POST /api/whatsapp/messages/delete
 */
async function deleteMessage(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, key } = req.body;

        if (!sessionId || !to || !key) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.deleteMessage(sessionId, to, key);

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting message:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف الرسالة' });
    }
}

/**
 * إعادة توجيه رسالة
 * POST /api/whatsapp/messages/forward
 */
async function forwardMessage(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, to, message } = req.body;

        if (!sessionId || !to || !message) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        // التحقق من الملكية
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.forwardMessage(sessionId, to, message);

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error forwarding message:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إعادة توجيه الرسالة' });
    }
}

/**
 * أرشفة محادثة
 * POST /api/whatsapp/chats/archive
 */
async function archiveChat(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, jid, archive } = req.body;

        if (!sessionId || !jid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.archiveChat(sessionId, jid, archive);

        // Update local DB
        await prisma.whatsAppContact.updateMany({
            where: { sessionId, jid },
            data: { isArchived: archive }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error archiving chat:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء أرشفة المحادثة' });
    }
}

/**
 * تثبيت محادثة
 * POST /api/whatsapp/chats/pin
 */
async function pinChat(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, jid, pin } = req.body;

        if (!sessionId || !jid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.pinChat(sessionId, jid, pin);

        // Update local DB
        await prisma.whatsAppContact.updateMany({
            where: { sessionId, jid },
            data: { isPinned: pin }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error pinning chat:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تثبيت المحادثة' });
    }
}

/**
 * كتم محادثة
 * POST /api/whatsapp/chats/mute
 */
async function muteChat(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, jid, mute } = req.body;

        if (!sessionId || !jid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.muteChat(sessionId, jid, mute);

        // Update local DB
        await prisma.whatsAppContact.updateMany({
            where: { sessionId, jid },
            data: { isMuted: mute }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error muting chat:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء كتم المحادثة' });
    }
}

/**
 * تحديد كغير مقروء
 * POST /api/whatsapp/chats/unread
 */
async function markChatUnread(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, jid, unread } = req.body;

        if (!sessionId || !jid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        await WhatsAppManager.markChatUnread(sessionId, jid, unread);

        // Update local DB if needed (optional, as unread count comes from messages usually)
        if (unread) {
            await prisma.whatsAppContact.updateMany({
                where: { sessionId, jid },
                data: { unreadCount: { increment: 1 } } // Artificial increment
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error marking chat unread:', error);
        res.status(500).json({ error: 'حدث خطأ' });
    }
}

/**
 * مسح محادثة
 * POST /api/whatsapp/chats/clear
 */
async function clearChat(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, jid } = req.body;

        if (!sessionId || !jid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        // Clear chat from Baileys
        const activeSession = WhatsAppManager.getSession(sessionId);
        if (activeSession?.status === 'connected') {
            await WhatsAppManager.clearChat(sessionId, jid);
        }

        // Delete messages from local DB
        await prisma.whatsAppMessage.deleteMany({
            where: { sessionId, remoteJid: jid }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error clearing chat:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء مسح المحادثة' });
    }
}

/**
 * حذف محادثة
 * POST /api/whatsapp/chats/delete
 */
async function deleteChat(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId, jid } = req.body;

        if (!sessionId || !jid) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        // Delete from Baileys (Clear chat)
        const activeSession = WhatsAppManager.getSession(sessionId);
        if (activeSession?.status === 'connected') {
            try {
                await activeSession.sock.chatModify({
                    delete: true,
                    lastMessages: [{
                        key: { remoteJid: jid, fromMe: true, id: 'AAA' },
                        messageTimestamp: Math.floor(Date.now() / 1000)
                    }]
                }, jid);
            } catch (baileysError) {
                console.error('⚠️ Error deleting chat from Baileys (continuing with DB delete):', baileysError);
                // Continue with DB deletion even if Baileys fails
            }
        }

        // Delete from DB
        await prisma.whatsAppMessage.deleteMany({
            where: { sessionId, remoteJid: jid }
        });

        await prisma.whatsAppContact.deleteMany({
            where: { sessionId, jid }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting chat:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف المحادثة' });
    }
}

/**
 * نقل بيانات المصادقة من الملفات إلى قاعدة البيانات
 * POST /api/whatsapp/migrate-auth
 */
async function migrateAuthToDatabase(req, res) {
    try {
        const { companyId } = req.user;
        const { sessionId } = req.body;

        const path = require('path');
        const fs = require('fs').promises;
        const fsSync = require('fs');

        const SESSIONS_DIR = path.join(__dirname, '../data/whatsapp-sessions');

        async function readJsonFile(filePath) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(content);
            } catch (error) {
                return null;
            }
        }

        async function migrateSession(sessionId) {
            const sessionPath = path.join(SESSIONS_DIR, sessionId);
            
            if (!fsSync.existsSync(sessionPath)) {
                return { success: false, error: 'Session directory not found' };
            }

            const files = await fs.readdir(sessionPath);
            let authState = { creds: null, keys: {} };

            // creds.json
            const credsPath = path.join(sessionPath, 'creds.json');
            if (fsSync.existsSync(credsPath)) {
                const creds = await readJsonFile(credsPath);
                if (creds) authState.creds = creds;
            }

            // sessions
            const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.json'));
            if (sessionFiles.length > 0) {
                authState.keys['session'] = {};
                for (const file of sessionFiles) {
                    const data = await readJsonFile(path.join(sessionPath, file));
                    if (data) {
                        const id = file.replace('session-', '').replace('.json', '');
                        authState.keys['session'][id] = data;
                    }
                }
            }

            // pre-keys
            const preKeyFiles = files.filter(f => f.startsWith('pre-key-') && f.endsWith('.json'));
            if (preKeyFiles.length > 0) {
                authState.keys['pre-key'] = {};
                for (const file of preKeyFiles) {
                    const data = await readJsonFile(path.join(sessionPath, file));
                    if (data) {
                        const id = file.replace('pre-key-', '').replace('.json', '');
                        authState.keys['pre-key'][id] = data;
                    }
                }
            }

            // sender-keys
            const senderKeyFiles = files.filter(f => f.startsWith('sender-key-') && f.endsWith('.json'));
            if (senderKeyFiles.length > 0) {
                authState.keys['sender-key'] = {};
                for (const file of senderKeyFiles) {
                    const data = await readJsonFile(path.join(sessionPath, file));
                    if (data) {
                        const id = file.replace('sender-key-', '').replace('.json', '');
                        authState.keys['sender-key'][id] = data;
                    }
                }
            }

            // Save to database
            await prisma.whatsAppSession.update({
                where: { id: sessionId },
                data: {
                    authState: JSON.stringify(authState),
                    updatedAt: new Date()
                }
            });

            return { success: true };
        }

        if (sessionId) {
            // Migrate single session
            const session = await prisma.whatsAppSession.findFirst({
                where: { id: sessionId, companyId }
            });

            if (!session) {
                return res.status(404).json({ error: 'الجلسة غير موجودة' });
            }

            const result = await migrateSession(sessionId);
            res.json(result);
        } else {
            // Migrate all sessions
            const sessions = await prisma.whatsAppSession.findMany({
                where: { companyId },
                select: { id: true, name: true }
            });

            let success = 0;
            let failed = 0;
            const results = [];

            for (const session of sessions) {
                const result = await migrateSession(session.id);
                if (result.success) {
                    success++;
                } else {
                    failed++;
                }
                results.push({ sessionId: session.id, name: session.name, ...result });
            }

            res.json({
                success: true,
                summary: { total: sessions.length, success, failed },
                results
            });
        }
    } catch (error) {
        console.error('❌ Migration error:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء نقل البيانات' });
    }
}

module.exports = {
    // Sessions
    createSession,
    getSessions,
    getSession,
    updateSession,
    deleteSession,
    connectSession,
    disconnectSession,

    // Conversations & Messages
    getConversations,
    getMessages,
    sendMessage,
    sendMedia,
    markAsRead,
    sendButtons,
    sendList,
    sendProduct,
    sendReaction,

    // Contacts
    updateContact,
    linkCustomer,

    // Quick Replies
    getQuickReplies,
    createQuickReply,
    updateQuickReply,
    deleteQuickReply,
    sendQuickReply,

    // Settings
    getSettings,
    updateSettings,

    // Stats
    getStats,

    // Message Management
    editMessage,
    deleteMessage,
    forwardMessage,

    // Chat Management
    archiveChat,
    pinChat,
    muteChat,
    markChatUnread,
    clearChat,
    deleteChat , 

    migrateAuthToDatabase
};


