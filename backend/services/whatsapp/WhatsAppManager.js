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

const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');
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
// مسار حفظ الوسائط
const MEDIA_DIR = path.join(__dirname, '../../public/uploads/whatsapp');

/**
 * تهيئة مجلد الجلسات والوسائط
 */
async function initSessionsDirectory() {
    try {
        await fs.mkdir(SESSIONS_DIR, { recursive: true });
        await fs.mkdir(MEDIA_DIR, { recursive: true });

        // Lazy load to avoid circular dependency
        const WhatsAppMediaHandler = require('./WhatsAppMediaHandler');
        await WhatsAppMediaHandler.initMediaDirectory();

        console.log('📁 WhatsApp sessions and media directories initialized');
    } catch (error) {
        console.error('❌ Error creating directories:', error);
    }
}

// ... (rest of the file until extractMessageContent)

/**
 * استخراج محتوى الرسالة (Async)
 */
async function extractMessageContent(msg, sock) {
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

    // دالة مساعدة لتحميل الوسائط
    const downloadMedia = async (messageType, fileExtension) => {
        try {
            const buffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                {
                    logger: pino({ level: 'silent' }),
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            const filename = `media_${msg.key.id}_${Date.now()}.${fileExtension}`;
            const filepath = path.join(MEDIA_DIR, filename);
            await fs.writeFile(filepath, buffer);
            return `/uploads/whatsapp/${filename}`;
        } catch (error) {
            console.error('❌ Error downloading media:', error);
            return null;
        }
    };

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
        mediaType = 'image';
        mediaUrl = await downloadMedia('imageMessage', 'jpg');
    }
    // فيديو
    else if (message.videoMessage) {
        type = 'VIDEO';
        text = message.videoMessage.caption;
        mimetype = message.videoMessage.mimetype;
        mediaType = 'video';
        mediaUrl = await downloadMedia('videoMessage', 'mp4');
    }
    // صوت
    else if (message.audioMessage) {
        type = 'AUDIO';
        mimetype = message.audioMessage.mimetype;
        mediaType = 'audio';
        // تحديد الامتداد بناءً على mimetype (ogg للصوتيات عادةً)
        const ext = mimetype.includes('mp4') ? 'm4a' : 'ogg';
        mediaUrl = await downloadMedia('audioMessage', ext);
    }
    // ملف
    else if (message.documentMessage) {
        type = 'DOCUMENT';
        text = message.documentMessage.caption;
        mimetype = message.documentMessage.mimetype;
        fileName = message.documentMessage.fileName;
        mediaType = 'document';
        // محاولة استخراج الامتداد من اسم الملف
        const ext = fileName ? fileName.split('.').pop() : 'bin';
        mediaUrl = await downloadMedia('documentMessage', ext);
    }
    // ستيكر
    else if (message.stickerMessage) {
        type = 'STICKER';
        mimetype = message.stickerMessage.mimetype;
        mediaType = 'sticker';
        mediaUrl = await downloadMedia('stickerMessage', 'webp');
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

            // DEBUG: Log incoming message key
            await logEvent(sessionId, companyId, 'debug_incoming_msg', {
                key: msg.key,
                pushName: msg.pushName
            });

            let remoteJid = msg.key.remoteJid;
            const fromMe = msg.key.fromMe;
            const messageId = msg.key.id;

            // Handle @lid (Linked Device ID)
            if (remoteJid && remoteJid.includes('@lid')) {
                // Try to find the phone number JID from participant or senderPn (specific to LIDs)
                const phoneJid = msg.key.participant || msg.key.senderPn;

                if (phoneJid && phoneJid.includes('@s.whatsapp.net')) {
                    remoteJid = phoneJid;
                } else {
                    // If we can't find the phone number, skip this message to avoid creating ghost contacts
                    console.log(`⚠️ Skipping message from LID without participant/senderPn: ${remoteJid}`);
                    continue;
                }
            }

            // Normalize JID (only for non-group, non-broadcast, and already valid-looking JIDs)
            if (remoteJid && !remoteJid.includes('@g.us') && remoteJid !== 'status@broadcast' && remoteJid.includes('@s.whatsapp.net')) {
                const bareJid = remoteJid.split('@')[0].split(':')[0];
                const cleaned = bareJid.replace(/\D/g, '');
                remoteJid = `${cleaned}@s.whatsapp.net`;
            }

            // استخراج محتوى الرسالة
            const messageContent = await extractMessageContent(msg, sock, sessionId);
            if (!messageContent) continue;

            console.log(`📩 New message in session ${sessionId}: ${messageContent.type} from ${remoteJid}`);

            // حفظ الرسالة في قاعدة البيانات
            // حفظ الرسالة في قاعدة البيانات
            const savedMessage = await prisma.whatsAppMessage.upsert({
                where: { messageId },
                update: {
                    status: 'SENT', // تأكيد الحالة
                    messageType: messageContent.type,
                    content: messageContent.text,
                    mediaUrl: messageContent.mediaUrl,
                    mediaType: messageContent.mediaType,
                    mediaMimeType: messageContent.mimetype,
                    mediaFileName: messageContent.fileName,
                    quotedMessageId: messageContent.quotedId,
                    quotedContent: messageContent.quotedText,
                    metadata: JSON.stringify(msg),
                    participant: msg.key.participant // تحديث المشارك
                },
                create: {
                    sessionId,
                    remoteJid,
                    messageId,
                    fromMe,
                    participant: msg.key.participant, // حفظ المشارك
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
            const contact = await updateOrCreateContact(sessionId, remoteJid, msg, sock, { isOutgoing: fromMe });

            // إذا كانت رسالة مجموعة، نحفظ المرسل كجهة اتصال أيضاً
            if (remoteJid.endsWith('@g.us') && msg.key.participant) {
                await updateOrCreateContact(sessionId, msg.key.participant, msg, sock, {
                    isOutgoing: false,
                    isGroupParticipant: true
                });
            }

            // إرسال الرسالة عبر Socket.IO
            io?.to(`company_${companyId}`).emit('whatsapp:message:new', {
                sessionId,
                message: savedMessage,
                raw: msg
            });

            // 🔔 إنشاء إشعار للرسالة الجديدة (فقط للرسائل الواردة)
            if (!fromMe) {
                try {
                    // جلب إعدادات الإشعارات
                    const settings = await prisma.whatsAppSettings.findUnique({
                        where: { companyId }
                    });

                    // الإشعارات مفعلة افتراضياً إذا لم تكن موجودة
                    const notificationsEnabled = settings?.browserNotifications !== false;
                    const soundEnabled = settings?.notificationSound !== false;

                    const contactName = contact?.name || contact?.pushName || remoteJid.split('@')[0];
                    const notificationContent = messageContent.text
                        ? (messageContent.text.length > 50 ? messageContent.text.substring(0, 50) + '...' : messageContent.text)
                        : (messageContent.type === 'IMAGE' ? '📷 صورة' :
                            messageContent.type === 'VIDEO' ? '🎥 فيديو' :
                                messageContent.type === 'AUDIO' ? '🎵 صوت' :
                                    messageContent.type === 'DOCUMENT' ? '📎 ملف' : 'رسالة جديدة');

                    // إنشاء إشعار في قاعدة البيانات إذا كانت الإشعارات مفعلة
                    if (notificationsEnabled) {
                        await prisma.notification.create({
                            data: {
                                companyId,
                                userId: null, // إشعار عام للشركة
                                type: 'new_message',
                                title: `رسالة جديدة من ${contactName}`,
                                message: notificationContent,
                                data: JSON.stringify({
                                    sessionId,
                                    messageId: savedMessage.id,
                                    remoteJid,
                                    contactId: contact?.id,
                                    messageType: messageContent.type
                                })
                            }
                        });
                    }

                    // إرسال إشعار عبر Socket دائماً (Frontend يتحقق من الإعدادات)
                    io?.to(`company_${companyId}`).emit('whatsapp:notification:new', {
                        sessionId,
                        contactName,
                        message: notificationContent,
                        messageType: messageContent.type,
                        timestamp: savedMessage.timestamp,
                        soundEnabled,
                        notificationsEnabled
                    });

                    console.log(`🔔 [NOTIFICATION] Sent WhatsApp message notification for company ${companyId}`, {
                        contactName,
                        messageType: messageContent.type,
                        notificationsEnabled,
                        soundEnabled
                    });
                } catch (notifError) {
                    console.error('❌ [NOTIFICATION] Error creating WhatsApp message notification:', notifError);
                }
            }

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
/**
 * استخراج محتوى الرسالة
 */
async function extractMessageContent(msg, sock, sessionId) {
    const message = msg.message;
    if (!message) return null;

    // Lazy load to avoid circular dependency
    const WhatsAppMediaHandler = require('./WhatsAppMediaHandler');

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
        try {
            const media = await WhatsAppMediaHandler.downloadMedia(msg, sessionId);
            if (media) {
                mediaUrl = media.url;
                mediaType = 'image';
                fileName = media.fileName;
            }
        } catch (e) {
            console.error('Failed to download image:', e);
        }
    }
    // فيديو
    else if (message.videoMessage) {
        type = 'VIDEO';
        text = message.videoMessage.caption;
        mimetype = message.videoMessage.mimetype;
        try {
            const media = await WhatsAppMediaHandler.downloadMedia(msg, sessionId);
            if (media) {
                mediaUrl = media.url;
                mediaType = 'video';
                fileName = media.fileName;
            }
        } catch (e) {
            console.error('Failed to download video:', e);
        }
    }
    // صوت
    else if (message.audioMessage) {
        type = 'AUDIO';
        mimetype = message.audioMessage.mimetype;
        try {
            const media = await WhatsAppMediaHandler.downloadMedia(msg, sessionId);
            if (media) {
                mediaUrl = media.url;
                mediaType = 'audio';
                fileName = media.fileName;
            }
        } catch (e) {
            console.error('Failed to download audio:', e);
        }
    }
    // ملف
    else if (message.documentMessage) {
        type = 'DOCUMENT';
        text = message.documentMessage.caption;
        mimetype = message.documentMessage.mimetype;
        fileName = message.documentMessage.fileName;
        try {
            const media = await WhatsAppMediaHandler.downloadMedia(msg, sessionId);
            if (media) {
                mediaUrl = media.url;
                mediaType = 'document';
                // Keep original filename if available
                if (!fileName) fileName = media.fileName;
            }
        } catch (e) {
            console.error('Failed to download document:', e);
        }
    }
    // ستيكر
    else if (message.stickerMessage) {
        type = 'STICKER';
        mimetype = message.stickerMessage.mimetype;
        try {
            const media = await WhatsAppMediaHandler.downloadMedia(msg, sessionId);
            if (media) {
                mediaUrl = media.url;
                mediaType = 'sticker';
                fileName = media.fileName;
            }
        } catch (e) {
            console.error('Failed to download sticker:', e);
        }
    }
    // موقع
    else if (message.locationMessage) {
        type = 'LOCATION';
        text = JSON.stringify({
            latitude: message.locationMessage.degreesLatitude,
            longitude: message.locationMessage.degreesLongitude,
            address: message.locationMessage.address,
            name: message.locationMessage.name
        });
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
/**
 * تحديث أو إنشاء جهة اتصال
 */
async function updateOrCreateContact(sessionId, remoteJid, msg, sock, options = {}) {
    try {
        const { isOutgoing = false, isGroupParticipant = false } = options;

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

        const updateData = {
            pushName,
            profilePicUrl,
        };

        // Only update chat metadata if it's NOT a background participant update
        if (!isGroupParticipant) {
            updateData.lastMessageAt = new Date();
            updateData.totalMessages = { increment: 1 };

            // Only increment unreadCount if it's an incoming message
            if (!isOutgoing) {
                updateData.unreadCount = { increment: 1 };
            }
        }

        const createData = {
            sessionId,
            jid: remoteJid,
            phoneNumber,
            pushName,
            profilePicUrl,
            lastMessageAt: new Date(),
            unreadCount: (!isOutgoing && !isGroupParticipant) ? 1 : 0,
            totalMessages: 1,
            isGroup
        };

        const contact = await prisma.whatsAppContact.upsert({
            where: {
                sessionId_jid: {
                    sessionId,
                    jid: remoteJid
                }
            },
            update: updateData,
            create: createData
        });

        return contact;
    } catch (error) {
        console.error('❌ Error updating contact:', error);
        return null;
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

    // إذا تم تمرير userId، قم بتحديث الرسالة
    if (options.userId && result.key.id) {
        try {
            await prisma.whatsAppMessage.upsert({
                where: { messageId: result.key.id },
                update: { senderId: options.userId },
                create: {
                    sessionId,
                    remoteJid: jid,
                    messageId: result.key.id,
                    fromMe: true,
                    messageType: 'TEXT',
                    content: text,
                    timestamp: new Date(),
                    senderId: options.userId,
                    status: 'SENT'
                }
            });
        } catch (e) {
            console.error('Failed to save senderId for message:', e);
        }
    }

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

    // إذا تم تمرير userId، قم بتحديث الرسالة
    if (options.userId && result.key.id) {
        try {
            await prisma.whatsAppMessage.upsert({
                where: { messageId: result.key.id },
                update: { senderId: options.userId },
                create: {
                    sessionId,
                    remoteJid: jid,
                    messageId: result.key.id,
                    fromMe: true,
                    messageType: 'IMAGE', // افتراضي، سيتم تحديثه لاحقاً
                    timestamp: new Date(),
                    senderId: options.userId,
                    status: 'SENT'
                }
            });
        } catch (e) {
            console.error('Failed to save senderId for media message:', e);
        }
    }

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

    try {
        if (typeof session.sock.readMessages === 'function') {
            await session.sock.readMessages(messageKeys);
        } else if (typeof session.sock.chatModify === 'function') {
            // For chatModify we need the last message key usually
            // If messageKeys is passed, we can use the last one
            const lastKey = messageKeys[messageKeys.length - 1];
            if (lastKey) {
                await session.sock.chatModify({
                    markRead: true,
                    lastMessages: [{ key: lastKey }]
                }, remoteJid);
            }
        }
    } catch (e) {
        console.warn('Failed to mark read on socket:', e);
    }

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
async function updateContact(sessionId, remoteJid, msg, sock, options = {}) {
    return await updateOrCreateContact(sessionId, remoteJid, msg, sock, options);
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


/**
 * إنشاء مجموعة جديدة
 */
async function createGroup(sessionId, subject, participants) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        const group = await session.sock.groupCreate(subject, participants);
        console.log(`👥 Group created: ${group.id}`);
        return group;
    } catch (error) {
        console.error('❌ Error creating group:', error);
        throw error;
    }
}

/**
 * تحديث المشاركين في المجموعة (إضافة، حذف، ترقية، خفض رتبة)
 * action: 'add' | 'remove' | 'promote' | 'demote'
 */
async function updateGroupParticipants(sessionId, jid, participants, action) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        const response = await session.sock.groupParticipantsUpdate(jid, participants, action);
        console.log(`👥 Group participants updated (${action}): ${jid}`);
        return response;
    } catch (error) {
        console.error(`❌ Error updating group participants (${action}):`, error);
        throw error;
    }
}

/**
 * جلب بيانات المجموعة
 */
async function getGroupMetadata(sessionId, jid) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        const metadata = await session.sock.groupMetadata(jid);
        return metadata;
    } catch (error) {
        console.error('❌ Error getting group metadata:', error);
        throw error;
    }
}

/**
 * تحديث اسم المجموعة
 */
async function updateGroupSubject(sessionId, jid, subject) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        await session.sock.groupSubjectUpdate(jid, subject);
        console.log(`📝 Group subject updated: ${jid}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating group subject:', error);
        throw error;
    }
}

/**
 * تحديث وصف المجموعة
 */
async function updateGroupDescription(sessionId, jid, description) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        await session.sock.groupUpdateDescription(jid, description);
        console.log(`📝 Group description updated: ${jid}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating group description:', error);
        throw error;
    }
}

/**
 * تحديث إعدادات المجموعة
 * settings: 'announcement' | 'not_announcement' | 'locked' | 'unlocked'
 */
async function updateGroupSettings(sessionId, jid, settings) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        await session.sock.groupSettingUpdate(jid, settings);
        console.log(`⚙️ Group settings updated: ${jid} -> ${settings}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating group settings:', error);
        throw error;
    }
}

/**
 * مغادرة المجموعة
 */
async function leaveGroup(sessionId, jid) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        await session.sock.groupLeave(jid);
        console.log(`👋 Left group: ${jid}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error leaving group:', error);
        throw error;
    }
}

/**
 * الحصول على رابط دعوة المجموعة
 */
async function getGroupInviteCode(sessionId, jid) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        const code = await session.sock.groupInviteCode(jid);
        return code;
    } catch (error) {
        console.error('❌ Error getting group invite code:', error);
        throw error;
    }
}

/**
 * إلغاء رابط دعوة المجموعة
 */
async function revokeGroupInviteCode(sessionId, jid) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        const code = await session.sock.groupRevokeInvite(jid);
        return code;
    } catch (error) {
        console.error('❌ Error revoking group invite code:', error);
        throw error;
    }
}

/**
 * الحصول على بيانات المجموعة (المشاركين، الوصف، الإعدادات)
 */
async function getGroupMetadata(sessionId, jid) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        const metadata = await session.sock.groupMetadata(jid);
        return metadata;
    } catch (error) {
        console.error('❌ Error getting group metadata:', error);
        throw error;
    }
}

/**
 * حظر جهة اتصال
 */
async function blockContact(sessionId, jid) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        await session.sock.updateBlockStatus(jid, 'block');
        console.log(`🚫 Blocked contact: ${jid}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error blocking contact:', error);
        throw error;
    }
}

/**
 * إلغاء حظر جهة اتصال
 */
async function unblockContact(sessionId, jid) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        await session.sock.updateBlockStatus(jid, 'unblock');
        console.log(`✅ Unblocked contact: ${jid}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error unblocking contact:', error);
        throw error;
    }
}

/**
 * تحديث حالة الملف الشخصي (About)
 */
async function updateProfileStatus(sessionId, status) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        await session.sock.updateProfileStatus(status);
        console.log(`📝 Profile status updated`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating profile status:', error);
        throw error;
    }
}

/**
 * تحديث اسم الملف الشخصي (Push Name)
 */
async function updateProfileName(sessionId, name) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        await session.sock.updateProfileName(name);
        console.log(`📝 Profile name updated: ${name}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating profile name:', error);
        throw error;
    }
}

/**
 * تحديث صورة الملف الشخصي
 */
async function updateProfilePicture(sessionId, jid, content) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        await session.sock.updateProfilePicture(jid, content);
        console.log(`🖼️ Profile picture updated for: ${jid}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating profile picture:', error);
        throw error;
    }
}

/**
 * التحقق من وجود الرقم على واتساب
 */
async function onWhatsApp(sessionId, number) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    try {
        const [result] = await session.sock.onWhatsApp(number);
        return result;
    } catch (error) {
        console.error('❌ Error checking number on WhatsApp:', error);
        throw error;
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
    updateContact,
    createGroup,
    updateGroupParticipants,
    updateGroupSubject,
    updateGroupDescription,
    updateGroupSettings,
    leaveGroup,
    getGroupInviteCode,
    revokeGroupInviteCode,
    blockContact,
    unblockContact,
    updateProfileStatus,
    updateProfileName,
    updateProfilePicture,
    onWhatsApp,
    getGroupMetadata,
    getProfile
};

/**
 * الحصول على الملف الشخصي
 */
async function getProfile(sessionId) {
    const session = getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const jid = session.sock.user.id;
    // Clean JID (remove :device@...)
    const cleanJid = jid.split(':')[0] + '@s.whatsapp.net';

    try {
        const status = await session.sock.fetchStatus(cleanJid);
        let profilePicUrl;
        try {
            profilePicUrl = await session.sock.profilePictureUrl(cleanJid, 'image');
        } catch (err) {
            profilePicUrl = null;
        }

        return {
            name: session.sock.user.name || session.sock.user.notify,
            status: status?.status || '',
            profilePicUrl: profilePicUrl
        };
    } catch (error) {
        console.error('❌ Error fetching profile:', error);
        throw new Error('Failed to fetch profile');
    }
}

