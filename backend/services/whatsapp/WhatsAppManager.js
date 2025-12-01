/**
 * 📱 WhatsApp Manager Service
 * إدارة جلسات WhatsApp المتعددة باستخدام Baileys
 * 
 * المميزات:
 * - إدارة جلسات متعددة لكل شركة
 * - حفظ واستعادة الجلسات من قاعدة البيانات
 * - إعادة الاتصال التلقائي
 * - إرسال الأحداث عبر Socket.IO
 */

const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { useDatabaseAuthState } = require('./DatabaseAuthState');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs').promises;
const { getSharedPrismaClient } = require('../sharedDatabase');
const prisma = getSharedPrismaClient();
const socketService = require('../socketService');
const getIO = () => socketService.getIO();

// تخزين الجلسات النشطة في الذاكرة
const activeSessions = new Map();

// مسار حفظ بيانات الجلسات
const SESSIONS_DIR = path.join(__dirname, '../../data/whatsapp-sessions');

/**
 * تهيئة مجلد الجلسات
 */
async function initSessionsDirectory() {
    try {
        await fs.mkdir(SESSIONS_DIR, { recursive: true });
        console.log('📁 WhatsApp sessions directory initialized');
    } catch (error) {
        console.error('❌ Error creating sessions directory:', error);
    }
}

/**
 * الحصول على مسار جلسة معينة
 */
function getSessionPath(sessionId) {
    return path.join(SESSIONS_DIR, sessionId);
}

/**
 * إنشاء جلسة WhatsApp جديدة
 * @param {string} sessionId - معرف الجلسة
 * @param {string} companyId - معرف الشركة
 * @param {object} options - خيارات إضافية
 */
async function createSession(sessionId, companyId, options = {}) {
    try {
        console.log(`📱 Creating WhatsApp session: ${sessionId} for company: ${companyId}`);

        // التحقق من وجود جلسة نشطة
        if (activeSessions.has(sessionId)) {
            console.log(`⚠️ Session ${sessionId} already exists, returning existing session`);
            return activeSessions.get(sessionId);
        }

        // تحميل حالة المصادقة من قاعدة البيانات
        const { state, saveCreds } = await useDatabaseAuthState(sessionId);

        // الحصول على أحدث إصدار من Baileys
        const { version } = await fetchLatestBaileysVersion();
        console.log(`📦 Using Baileys version: ${version.join('.')}`);

        // إنشاء Socket
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ['MaxBot', 'Chrome', '120.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: true,
            markOnlineOnConnect: true,
            ...options
        });

        // حفظ الجلسة في الذاكرة
        const sessionData = {
            sock,
            sessionId,
            companyId,
            status: 'connecting',
            qrCode: null,
            phoneNumber: null,
            createdAt: new Date()
        };
        activeSessions.set(sessionId, sessionData);

        // معالجة أحداث الاتصال
        sock.ev.on('connection.update', async (update) => {
            await handleConnectionUpdate(sessionId, companyId, update, sock);
        });

        // حفظ بيانات المصادقة
        sock.ev.on('creds.update', saveCreds);

        // معالجة الرسائل الواردة
        sock.ev.on('messages.upsert', async (m) => {
            await handleIncomingMessages(sessionId, companyId, m, sock);
        });

        // معالجة تحديث حالة الرسائل
        sock.ev.on('messages.update', async (updates) => {
            await handleMessageStatusUpdate(sessionId, companyId, updates);
        });

        // معالجة أحداث المجموعات
        sock.ev.on('groups.update', async (updates) => {
            await handleGroupsUpdate(sessionId, companyId, updates);
        });

        // معالجة أحداث جهات الاتصال
        sock.ev.on('contacts.update', async (updates) => {
            await handleContactsUpdate(sessionId, companyId, updates);
        });

        // معالجة أحداث الحضور (typing, online, etc.)
        sock.ev.on('presence.update', async (update) => {
            await handlePresenceUpdate(sessionId, companyId, update);
        });

        return sessionData;
    } catch (error) {
        console.error(`❌ Error creating session ${sessionId}:`, error);
        throw error;
    }
}

/**
 * معالجة تحديثات الاتصال
 */
async function handleConnectionUpdate(sessionId, companyId, update, sock) {
    const { connection, lastDisconnect, qr } = update;
    const io = getIO();

    try {
        // إرسال QR Code
        if (qr) {
            console.log(`📱 QR Code generated for session: ${sessionId}`);

            const sessionData = activeSessions.get(sessionId);
            if (sessionData) {
                sessionData.qrCode = qr;
                sessionData.status = 'qr_pending';
            }

            // تحديث قاعدة البيانات
            await prisma.whatsAppSession.update({
                where: { id: sessionId },
                data: { status: 'QR_PENDING' }
            });

            // إرسال QR عبر Socket.IO
            if (io) {
                // إرسال للـ company room
                io.to(`company_${companyId}`).emit('whatsapp:qr', {
                    sessionId,
                    qr
                });
                // إرسال لجميع المتصلين (fallback)
                io.emit('whatsapp:qr', {
                    sessionId,
                    companyId,
                    qr
                });
                console.log(`📤 QR Code sent via Socket.IO for session: ${sessionId}`);
            }

            // تسجيل الحدث
            await logEvent(sessionId, companyId, 'qr_generated', { qr: 'generated' });
        }

        // معالجة حالة الاتصال
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`🔌 Connection closed for session ${sessionId}, status: ${statusCode}, reconnect: ${shouldReconnect}`);

            // تحديث الحالة
            const sessionData = activeSessions.get(sessionId);
            if (sessionData) {
                sessionData.status = 'disconnected';
            }

            // تحديث قاعدة البيانات
            await prisma.whatsAppSession.update({
                where: { id: sessionId },
                data: {
                    status: statusCode === DisconnectReason.loggedOut ? 'LOGGED_OUT' : 'DISCONNECTED',
                    lastDisconnectedAt: new Date()
                }
            });

            // إرسال حدث الانقطاع
            io?.to(`company_${companyId}`).emit('whatsapp:connection', {
                sessionId,
                status: 'disconnected',
                reason: statusCode
            });

            // تسجيل الحدث
            await logEvent(sessionId, companyId, 'disconnected', { statusCode, shouldReconnect }, 'warning');

            // إعادة الاتصال إذا لزم الأمر
            if (shouldReconnect) {
                console.log(`🔄 Attempting to reconnect session ${sessionId}...`);
                setTimeout(() => {
                    reconnectSession(sessionId, companyId);
                }, 5000);
            } else {
                // حذف الجلسة من الذاكرة
                activeSessions.delete(sessionId);
            }
        } else if (connection === 'open') {
            console.log(`✅ WhatsApp connected for session: ${sessionId}`);

            // الحصول على معلومات المستخدم
            const user = sock.user;
            const phoneNumber = user?.id?.split(':')[0] || user?.id?.split('@')[0];

            // تحديث الحالة
            const sessionData = activeSessions.get(sessionId);
            if (sessionData) {
                sessionData.status = 'connected';
                sessionData.phoneNumber = phoneNumber;
                sessionData.qrCode = null;
            }

            // تحديث قاعدة البيانات
            await prisma.whatsAppSession.update({
                where: { id: sessionId },
                data: {
                    status: 'CONNECTED',
                    phoneNumber,
                    lastConnectedAt: new Date()
                }
            });

            // إرسال حدث الاتصال
            io?.to(`company_${companyId}`).emit('whatsapp:connection', {
                sessionId,
                status: 'connected',
                phoneNumber
            });

            // تسجيل الحدث
            await logEvent(sessionId, companyId, 'connected', { phoneNumber });
        }
    } catch (error) {
        console.error(`❌ Error handling connection update for ${sessionId}:`, error);
        await logEvent(sessionId, companyId, 'error', { error: error.message }, 'error');
    }
}

/**
 * معالجة الرسائل الواردة
 */
async function handleIncomingMessages(sessionId, companyId, m, sock) {
    const { messages, type } = m;
    const io = getIO();

    if (type !== 'notify') return;

    for (const msg of messages) {
        try {
            // تجاهل الرسائل القديمة
            if (msg.messageTimestamp < Date.now() / 1000 - 60) continue;

            const remoteJid = msg.key.remoteJid;
            const fromMe = msg.key.fromMe;
            const messageId = msg.key.id;

            // استخراج محتوى الرسالة
            const messageContent = extractMessageContent(msg);
            if (!messageContent) continue;

            console.log(`📩 New message in session ${sessionId}: ${messageContent.type} from ${remoteJid}`);

            // حفظ الرسالة في قاعدة البيانات
            const savedMessage = await prisma.whatsAppMessage.create({
                data: {
                    sessionId,
                    remoteJid,
                    messageId,
                    fromMe,
                    messageType: messageContent.type,
                    content: messageContent.text,
                    mediaUrl: messageContent.mediaUrl,
                    mediaType: messageContent.mediaType,
                    mediaMimeType: messageContent.mimetype,
                    mediaFileName: messageContent.fileName,
                    quotedMessageId: messageContent.quotedId,
                    quotedContent: messageContent.quotedText,
                    timestamp: new Date(msg.messageTimestamp * 1000),
                    metadata: JSON.stringify(msg)
                }
            });

            // تحديث أو إنشاء جهة الاتصال
            await updateOrCreateContact(sessionId, remoteJid, msg, sock);

            // إرسال الرسالة عبر Socket.IO
            io?.to(`company_${companyId}`).emit('whatsapp:message:new', {
                sessionId,
                message: savedMessage,
                raw: msg
            });

            // معالجة AI إذا كان مفعلاً
            if (!fromMe) {
                await processAIResponse(sessionId, companyId, savedMessage, sock);
            }

        } catch (error) {
            console.error(`❌ Error processing message:`, error);
            await logEvent(sessionId, companyId, 'message_error', { error: error.message }, 'error');
        }
    }
}

/**
 * استخراج محتوى الرسالة
 */
function extractMessageContent(msg) {
    const message = msg.message;
    if (!message) return null;

    let type = 'TEXT';
    let text = null;
    let mediaUrl = null;
    let mediaType = null;
    let mimetype = null;
    let fileName = null;
    let quotedId = null;
    let quotedText = null;

    // نص عادي
    if (message.conversation) {
        text = message.conversation;
    }
    // نص موسع
    else if (message.extendedTextMessage) {
        text = message.extendedTextMessage.text;
        if (message.extendedTextMessage.contextInfo?.quotedMessage) {
            quotedId = message.extendedTextMessage.contextInfo.stanzaId;
            quotedText = message.extendedTextMessage.contextInfo.quotedMessage.conversation ||
                message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text;
        }
    }
    // صورة
    else if (message.imageMessage) {
        type = 'IMAGE';
        text = message.imageMessage.caption;
        mimetype = message.imageMessage.mimetype;
    }
    // فيديو
    else if (message.videoMessage) {
        type = 'VIDEO';
        text = message.videoMessage.caption;
        mimetype = message.videoMessage.mimetype;
    }
    // صوت
    else if (message.audioMessage) {
        type = 'AUDIO';
        mimetype = message.audioMessage.mimetype;
    }
    // ملف
    else if (message.documentMessage) {
        type = 'DOCUMENT';
        text = message.documentMessage.caption;
        mimetype = message.documentMessage.mimetype;
        fileName = message.documentMessage.fileName;
    }
    // ستيكر
    else if (message.stickerMessage) {
        type = 'STICKER';
        mimetype = message.stickerMessage.mimetype;
    }
    // موقع
    else if (message.locationMessage) {
        type = 'LOCATION';
        text = `${message.locationMessage.degreesLatitude},${message.locationMessage.degreesLongitude}`;
    }
    // جهة اتصال
    else if (message.contactMessage) {
        type = 'CONTACT';
        text = message.contactMessage.displayName;
    }
    // تفاعل
    else if (message.reactionMessage) {
        type = 'REACTION';
        text = message.reactionMessage.text;
    }
    // أزرار تفاعلية
    else if (message.buttonsMessage) {
        type = 'BUTTONS';
        text = message.buttonsMessage.contentText || message.buttonsMessage.text;
    }
    // قائمة
    else if (message.listMessage) {
        type = 'LIST';
        text = message.listMessage.description || message.listMessage.title;
    }
    // منتج (قد يكون في templateMessage)
    else if (message.templateMessage) {
        type = 'TEMPLATE';
        text = message.templateMessage.hydratedTemplate?.hydratedContentText ||
            message.templateMessage.hydratedTemplate?.templateId;
    }
    else {
        return null;
    }

    return { type, text, mediaUrl, mediaType, mimetype, fileName, quotedId, quotedText };
}

/**
 * تحديث أو إنشاء جهة اتصال
 */
async function updateOrCreateContact(sessionId, remoteJid, msg, sock) {
    try {
        // Ensure JID is normalized using the same logic as MessageHandler
        const formatJid = (to) => {
            if (!to) return to;
            const bareJid = to.split('@')[0].split(':')[0];
            const cleaned = bareJid.replace(/\D/g, '');
            return `${cleaned}@s.whatsapp.net`;
        };

        const normalizedJid = formatJid(remoteJid);
        const phoneNumber = normalizedJid.split('@')[0];
        const isGroup = remoteJid.endsWith('@g.us'); // Keep original for group check if needed, but storage should be normalized for contacts

        // Use normalizedJid for database operations
        remoteJid = isGroup ? remoteJid : normalizedJid;

        let pushName = msg.pushName;

        // إذا كانت مجموعة، نحاول الحصول على اسم المجموعة
        if (isGroup) {
            try {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                pushName = groupMetadata.subject;
            } catch (e) {
                // تجاهل الخطأ إذا فشل جلب بيانات المجموعة
                console.log('Failed to fetch group metadata for:', remoteJid);
            }
        }

        // محاولة الحصول على صورة البروفايل
        let profilePicUrl = null;
        try {
            profilePicUrl = await sock.profilePictureUrl(remoteJid, 'image');
        } catch (e) {
            // تجاهل الخطأ إذا لم تكن الصورة متاحة
        }

        await prisma.whatsAppContact.upsert({
            where: {
                sessionId_jid: {
                    sessionId,
                    jid: remoteJid
                }
            },
            update: {
                pushName,
                profilePicUrl,
                lastMessageAt: new Date(),
                unreadCount: { increment: 1 },
                totalMessages: { increment: 1 }
            },
            create: {
                sessionId,
                jid: remoteJid,
                phoneNumber,
                pushName,
                profilePicUrl,
                isGroup,
                lastMessageAt: new Date(),
                unreadCount: 1,
                totalMessages: 1
            }
        });
    } catch (error) {
        console.error('❌ Error updating contact:', error);
    }
}

/**
 * معالجة رد AI
 */
async function processAIResponse(sessionId, companyId, message, sock) {
    try {
        // جلب إعدادات الجلسة
        const session = await prisma.whatsAppSession.findUnique({
            where: { id: sessionId }
        });

        if (!session?.aiEnabled) return;

        // استيراد خدمة AI
        const { WhatsAppAIIntegration } = require('./WhatsAppAIIntegration');

        // معالجة الرد
        await WhatsAppAIIntegration.processMessage(sessionId, companyId, message, sock, session);

    } catch (error) {
        console.error('❌ Error processing AI response:', error);
    }
}

/**
 * معالجة تحديث حالة الرسائل
 */
async function handleMessageStatusUpdate(sessionId, companyId, updates) {
    const io = getIO();

    for (const update of updates) {
        try {
            const { key, update: statusUpdate } = update;

            if (statusUpdate.status) {
                const statusMap = {
                    1: 'PENDING',
                    2: 'SENT',
                    3: 'DELIVERED',
                    4: 'READ'
                };

                const status = statusMap[statusUpdate.status] || 'SENT';

                await prisma.whatsAppMessage.updateMany({
                    where: { messageId: key.id },
                    data: { status }
                });

                io?.to(`company_${companyId}`).emit('whatsapp:message:status', {
                    sessionId,
                    messageId: key.id,
                    status
                });
            }
        } catch (error) {
            console.error('❌ Error updating message status:', error);
        }
    }
}

/**
 * معالجة تحديث المجموعات
 */
async function handleGroupsUpdate(sessionId, companyId, updates) {
    // يمكن إضافة منطق معالجة المجموعات هنا
    console.log(`📢 Groups update for session ${sessionId}:`, updates);
}

/**
 * معالجة تحديث جهات الاتصال
 */
async function handleContactsUpdate(sessionId, companyId, updates) {
    for (const update of updates) {
        try {
            if (update.id) {
                await prisma.whatsAppContact.updateMany({
                    where: {
                        sessionId,
                        jid: update.id
                    },
                    data: {
                        name: update.notify || update.name,
                        profilePicUrl: update.imgUrl
                    }
                });
            }
        } catch (error) {
            console.error('❌ Error updating contact:', error);
        }
    }
}

/**
 * معالجة تحديث الحضور
 */
async function handlePresenceUpdate(sessionId, companyId, update) {
    const io = getIO();

    io?.to(`company_${companyId}`).emit('whatsapp:presence', {
        sessionId,
        jid: update.id,
        presence: update.presences
    });
}

/**
 * إعادة الاتصال بجلسة
 */
async function reconnectSession(sessionId, companyId) {
    try {
        // حذف الجلسة القديمة
        activeSessions.delete(sessionId);

        // إنشاء جلسة جديدة
        await createSession(sessionId, companyId);
    } catch (error) {
        console.error(`❌ Error reconnecting session ${sessionId}:`, error);
    }
}

/**
 * إرسال رسالة نصية
 */
async function sendTextMessage(sessionId, to, text, options = {}) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    const result = await session.sock.sendMessage(jid, {
        text,
        ...options
    });

    return result;
}

/**
 * إرسال رسالة وسائط
 */
async function sendMediaMessage(sessionId, to, media, options = {}) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    const result = await session.sock.sendMessage(jid, media, options);

    return result;
}

/**
 * تحديد الرسائل كمقروءة
 */
async function markAsRead(sessionId, remoteJid, messageKeys) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    await session.sock.readMessages(messageKeys);

    // تحديث قاعدة البيانات
    await prisma.whatsAppContact.updateMany({
        where: {
            sessionId,
            jid: remoteJid
        },
        data: {
            unreadCount: 0
        }
    });
}

/**
 * إرسال حالة الكتابة
 */
async function sendTyping(sessionId, to, isTyping = true) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') return;

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    await session.sock.sendPresenceUpdate(isTyping ? 'composing' : 'paused', jid);
}

/**
 * تعديل رسالة
 */
async function editMessage(sessionId, to, key, newText) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    await session.sock.sendMessage(jid, {
        text: newText,
        edit: key
    });
}

/**
 * حذف رسالة (للجميع)
 */
async function deleteMessage(sessionId, to, key) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    await session.sock.sendMessage(jid, {
        delete: key
    });
}

/**
 * إعادة توجيه رسالة
 */
async function forwardMessage(sessionId, to, message) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    await session.sock.sendMessage(jid, {
        forward: message
    });
}

/**
 * أرشفة/إلغاء أرشفة محادثة
 */
async function archiveChat(sessionId, jid, archive = true) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    await session.sock.chatModify({ archive }, jid);
}

/**
 * تثبيت/إلغاء تثبيت محادثة
 */
async function pinChat(sessionId, jid, pin = true) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    await session.sock.chatModify({ pin }, jid);
}

/**
 * كتم/إلغاء كتم محادثة
 */
async function muteChat(sessionId, jid, mute = true) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    // mute for 8 hours if true, or unmute (null)
    const muteTime = mute ? 8 * 60 * 60 * 1000 : null;
    await session.sock.chatModify({ mute: muteTime }, jid);
}

/**
 * تحديد كغير مقروء
 */
async function markChatUnread(sessionId, jid, unread = true) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    await session.sock.chatModify({ markRead: !unread }, jid);
}

/**
 * إرسال تفاعل (Reaction)
 */
async function sendReaction(sessionId, to, key, emoji) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    await session.sock.sendMessage(jid, {
        react: {
            text: emoji,
            key: key
        }
    });
}

/**
 * الحصول على جلسة نشطة
 */
function getSession(sessionId) {
    return activeSessions.get(sessionId);
}

/**
 * الحصول على كل الجلسات النشطة لشركة
 */
function getCompanySessions(companyId) {
    const sessions = [];
    for (const [id, session] of activeSessions) {
        if (session.companyId === companyId) {
            sessions.push({
                sessionId: id,
                status: session.status,
                phoneNumber: session.phoneNumber,
                qrCode: session.qrCode
            });
        }
    }
    return sessions;
}

/**
 * إغلاق جلسة
 */
async function closeSession(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
        try {
            await session.sock.logout();
        } catch (e) {
            // تجاهل الخطأ
        }
        activeSessions.delete(sessionId);
    }

    // تحديث قاعدة البيانات
    await prisma.whatsAppSession.update({
        where: { id: sessionId },
        data: {
            status: 'DISCONNECTED',
            lastDisconnectedAt: new Date()
        }
    });
}

/**
 * حذف جلسة نهائياً
 */
async function deleteSession(sessionId) {
    await closeSession(sessionId);

    // حذف ملفات الجلسة
    const sessionPath = getSessionPath(sessionId);
    try {
        await fs.rm(sessionPath, { recursive: true, force: true });
    } catch (e) {
        // تجاهل الخطأ
    }

    // حذف من قاعدة البيانات
    await prisma.whatsAppSession.delete({
        where: { id: sessionId }
    });
}

/**
 * تسجيل حدث
 */
async function logEvent(sessionId, companyId, eventType, eventData, level = 'info') {
    try {
        await prisma.whatsAppEventLog.create({
            data: {
                sessionId,
                companyId,
                eventType,
                eventData: JSON.stringify(eventData),
                level
            }
        });
    } catch (error) {
        console.error('❌ Error logging event:', error);
    }
}

/**
 * استعادة الجلسات عند بدء السيرفر
 */
async function restoreAllSessions() {
    try {
        console.log('🔄 Restoring WhatsApp sessions...');

        await initSessionsDirectory();

        // جلب الجلسات النشطة من قاعدة البيانات
        const sessions = await prisma.whatsAppSession.findMany({
            where: {
                status: {
                    in: ['CONNECTED', 'DISCONNECTED']
                }
            }
        });

        for (const session of sessions) {
            try {
                await createSession(session.id, session.companyId);
                console.log(`✅ Restored session: ${session.id}`);
            } catch (error) {
                console.error(`❌ Failed to restore session ${session.id}:`, error);
            }
        }

        console.log(`📱 Restored ${sessions.length} WhatsApp sessions`);
    } catch (error) {
        console.error('❌ Error restoring sessions:', error);
    }
}

module.exports = {
    createSession,
    getSession,
    getCompanySessions,
    closeSession,
    deleteSession,
    archiveChat,
    pinChat,
    muteChat,
    markChatUnread,
    editMessage,
    deleteMessage,
    forwardMessage,
    sendReaction,
    sendReaction,
    clearChat,
    restoreAllSessions
};

/**
 * أرشفة/ إلغاء أرشفة محادثة
 */
async function archiveChat(sessionId, jid, archive = true) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    await session.sock.chatModify({ archive }, jid);
}

/**
 * تثبيت/إلغاء تثبيت محادثة
 */
async function pinChat(sessionId, jid, pin = true) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    await session.sock.chatModify({ pin }, jid);
}

/**
 * كتم/إلغاء كتم محادثة
 */
async function muteChat(sessionId, jid, mute = true) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    // mute for 8 hours if true, or unmute (null)
    const muteTime = mute ? 8 * 60 * 60 * 1000 : null;
    await session.sock.chatModify({ mute: muteTime }, jid);
}

/**
 * تحديد كغير مقروء
 */
async function markChatUnread(sessionId, jid, unread = true) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    await session.sock.chatModify({ markRead: !unread }, jid);
}

/**
 * مسح محتوى المحادثة
 */
async function clearChat(sessionId, jid) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    // Baileys uses chatModify with delete: true and lastMessages to clear chat
    await session.sock.chatModify({
        delete: true,
        lastMessages: [{
            key: { remoteJid: jid, fromMe: true, id: 'AAA' },
            messageTimestamp: Math.floor(Date.now() / 1000)
        }]
    }, jid);
}

/**
 * إرسال تفاعل (Reaction)
 */
async function sendReaction(sessionId, to, key, emoji) {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
        throw new Error('Session not connected');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    await session.sock.sendMessage(jid, {
        react: {
            text: emoji,
            key: key
        }
    });
}

/**
 * تحديث أو إنشاء جهة اتصال (Public)
 */
async function updateContact(sessionId, remoteJid, msg, sock) {
    return await updateOrCreateContact(sessionId, remoteJid, msg, sock);
}

/**
 * الحصول على جلسة نشطة
 */
function getSession(sessionId) {
    return activeSessions.get(sessionId);
}

/**
 * الحصول على كل الجلسات النشطة لشركة
 */
function getCompanySessions(companyId) {
    const sessions = [];
    for (const [id, session] of activeSessions) {
        if (session.companyId === companyId) {
            sessions.push({
                sessionId: id,
                status: session.status,
                phoneNumber: session.phoneNumber,
                qrCode: session.qrCode
            });
        }
    }
    return sessions;
}

/**
 * إغلاق جلسة
 */
async function closeSession(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
        try {
            await session.sock.logout();
        } catch (e) {
            // تجاهل الخطأ
        }
        activeSessions.delete(sessionId);
    }

    // تحديث قاعدة البيانات
    await prisma.whatsAppSession.update({
        where: { id: sessionId },
        data: {
            status: 'DISCONNECTED',
            lastDisconnectedAt: new Date()
        }
    });
}

/**
 * حذف جلسة نهائياً
 */
async function deleteSession(sessionId) {
    await closeSession(sessionId);

    // حذف ملفات الجلسة
    const sessionPath = getSessionPath(sessionId);
    try {
        await fs.rm(sessionPath, { recursive: true, force: true });
    } catch (e) {
        // تجاهل الخطأ
    }

    // حذف من قاعدة البيانات
    await prisma.whatsAppSession.delete({
        where: { id: sessionId }
    });
}

/**
 * تسجيل حدث
 */
async function logEvent(sessionId, companyId, eventType, eventData, level = 'info') {
    try {
        await prisma.whatsAppEventLog.create({
            data: {
                sessionId,
                companyId,
                eventType,
                eventData: JSON.stringify(eventData),
                level
            }
        });
    } catch (error) {
        console.error('❌ Error logging event:', error);
    }
}

/**
 * استعادة الجلسات عند بدء السيرفر
 */
async function restoreAllSessions() {
    try {
        console.log('🔄 Restoring WhatsApp sessions...');

        await initSessionsDirectory();

        // جلب الجلسات النشطة من قاعدة البيانات
        const sessions = await prisma.whatsAppSession.findMany({
            where: {
                status: {
                    in: ['CONNECTED', 'DISCONNECTED']
                }
            }
        });

        for (const session of sessions) {
            try {
                await createSession(session.id, session.companyId);
                console.log(`✅ Restored session: ${session.id}`);
            } catch (error) {
                console.error(`❌ Failed to restore session ${session.id}:`, error);
            }
        }

        console.log(`📱 Restored ${sessions.length} WhatsApp sessions`);
    } catch (error) {
        console.error('❌ Error restoring sessions:', error);
    }
}

module.exports = {
    createSession,
    getSession,
    getCompanySessions,
    closeSession,
    deleteSession,
    sendTextMessage,
    sendMediaMessage,
    markAsRead,
    sendTyping,
    restoreAllSessions,
    editMessage,
    deleteMessage,
    forwardMessage,
    archiveChat,
    pinChat,
    muteChat,
    markChatUnread,
    clearChat,
    sendReaction,
    initSessionsDirectory,
    logEvent,
    updateContact
};
