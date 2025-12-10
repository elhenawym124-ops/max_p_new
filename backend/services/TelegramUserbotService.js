let TelegramClient, Api, StringSession;
try {
    const telegramModule = require("telegram");
    TelegramClient = telegramModule.TelegramClient;
    Api = telegramModule.Api;

    const sessionsModule = require("telegram/sessions");
    StringSession = sessionsModule.StringSession;

    // Validate imports
    if (!TelegramClient || typeof TelegramClient !== 'function') {
        console.error("❌ [TELEGRAM] TelegramClient is not a function:", typeof TelegramClient);
        throw new Error("TelegramClient is not properly imported");
    }
    if (!StringSession || typeof StringSession !== 'function') {
        console.error("❌ [TELEGRAM] StringSession is not a function:", typeof StringSession);
        throw new Error("StringSession is not properly imported");
    }
    console.log("✅ [TELEGRAM] TelegramClient and StringSession imported successfully");
} catch (importError) {
    console.error("❌ [TELEGRAM] Failed to import telegram modules:", importError);
    throw importError;
}

const { getSharedPrismaClient } = require('./sharedDatabase');
const input = require("input"); // For console input if ever needed
const fs = require('fs');
const path = require('path');
const os = require('os');

class TelegramUserbotService {
    constructor() {
        this.clients = new Map(); // userbotConfigId -> TelegramClient
        this.prisma = getSharedPrismaClient();
    }

    // --- Private Helpers ---

    /**
     * Retrieves a stored session string from the database.
     */
    async _getSession(userbotConfigId) {
        try {
            const config = await this.prisma.telegramConfig.findFirst({
                where: {
                    id: userbotConfigId,
                    type: 'USERBOT'
                }
            });

            if (!config) {
                console.warn(`⚠️ [_getSession] Config not found for userbotConfigId: ${userbotConfigId}`);
                return "";
            }

            // Use sessionString if available, otherwise fallback to clientSession (for backward compatibility)
            const session = config.sessionString || config.clientSession || "";
            return session;
        } catch (error) {
            console.error(`❌ [_getSession] Error getting session:`, error);
            return "";
        }
    }

    /**
     * Retrieves the userbot configuration.
     */
    async _getUserbotConfig(userbotConfigId, companyId) {
        const config = await this.prisma.telegramConfig.findFirst({
            where: {
                id: userbotConfigId,
                companyId,
                type: 'USERBOT'
            }
        });
        return config;
    }

    /**
     * Centralized method to get or create a Telegram Client.
     * Handles memory caching, validation, and restoring from session.
     */
    async _getClient(userbotConfigId, companyId) {
        // 1. Check Memory
        let clientData = this.clients.get(userbotConfigId);
        let client = null;

        // Extract client from stored data (it might be an object wrap or direct client)
        if (clientData) {
            if (typeof clientData === 'object' && clientData.client) {
                client = clientData.client;
            } else {
                client = clientData;
            }
        }

        // 2. Validate In-Memory Client
        let isClientValid = false;
        try {
            if (client) {
                if (client instanceof TelegramClient) {
                    isClientValid = true;
                } else if (typeof client === 'object' && client.constructor && client.constructor.name === 'TelegramClient') {
                    isClientValid = true;
                }
            }
        } catch (e) {
            console.warn("⚠️ [_getClient] Client validation warning:", e.message);
            isClientValid = false;
        }

        if (isClientValid && client.connected) {
            // Optional: Check connection status if possible, but usually existence implies we tried to connect
            return client;
        }

        // 3. Restore from Session if memory failed
        console.log(`🔄 [_getClient] Restoring client for ${userbotConfigId}...`);

        const config = await this._getUserbotConfig(userbotConfigId, companyId);
        if (!config || !config.apiId || !config.apiHash) {
            console.error(`❌ [_getClient] Missing config or API credentials for ${userbotConfigId}`);
            throw new Error("Userbot configuration not found or missing API credentials");
        }

        const sessionString = await this._getSession(userbotConfigId);
        if (!sessionString || sessionString.trim() === '') {
            console.error(`❌ [_getClient] No session string found for ${userbotConfigId}`);
            throw new Error("Not logged in (No session found)");
        }

        try {
            console.log(`🔧 [_getClient] Creating new TelegramClient instance...`);
            client = new TelegramClient(new StringSession(sessionString), parseInt(config.apiId), config.apiHash, {
                connectionRetries: 5,
            });
            console.log(`🔌 [_getClient] Connecting...`);
            await client.connect();

            // Update memory
            this.clients.set(userbotConfigId, client);
            console.log(`✅ [_getClient] Client restored and connected.`);
            return client;
        } catch (error) {
            console.error(`❌ [_getClient] Failed to restore client:`, error);
            throw error;
        }
    }

    /**
     * Centralized error handler for Telegram API errors.
     * Specifically handles session expiration (AUTH_KEY_UNREGISTERED).
     */
    async _handleAuthError(error, userbotConfigId, companyId) {
        const errorMessage = error.message || '';
        const errorString = error.toString() || '';
        const isAuthError = errorMessage.includes('AUTH_KEY_UNREGISTERED') ||
            errorString.includes('AUTH_KEY_UNREGISTERED') ||
            errorMessage.includes('401') ||
            error.code === 401;

        if (isAuthError) {
            console.warn(`⚠️ [_handleAuthError] Session expired for ${userbotConfigId}. Clearing data.`);
            try {
                // Clear DB
                await this.prisma.telegramConfig.updateMany({
                    where: {
                        id: userbotConfigId,
                        companyId: companyId,
                        type: 'USERBOT'
                    },
                    data: {
                        sessionString: null,
                        clientSession: null,
                        clientPhone: null,
                        isActive: false
                    }
                });

                // Clear Memory
                this.clients.delete(userbotConfigId);
            } catch (clearError) {
                console.error(`❌ [_handleAuthError] Failed to clear session:`, clearError);
            }

            return {
                success: false,
                error: "AUTH_KEY_UNREGISTERED",
                message: "Session expired. Please login again.",
                requiresReauth: true
            };
        }

        // Return original error if not auth-related
        return { success: false, error: error.message || "Unknown error occurred" };
    }

    // --- Public Info Methods ---

    // For backward compatibility if needed, but _getSession is preferred internally
    async getSession(userbotConfigId) {
        return this._getSession(userbotConfigId);
    }

    async getUserbotConfig(userbotConfigId, companyId) {
        return this._getUserbotConfig(userbotConfigId, companyId);
    }

    // --- Auth Step 1: Send Code ---
    async sendCode(userbotConfigId, companyId, phoneNumber) {
        console.log(`🔍 [SEND-CODE] Starting for ${userbotConfigId}, phone: ${phoneNumber}`);
        try {
            const config = await this._getUserbotConfig(userbotConfigId, companyId);
            if (!config || !config.apiId || !config.apiHash) {
                return { success: false, error: "API credentials not configured." };
            }

            const session = new StringSession("");
            const client = new TelegramClient(session, parseInt(config.apiId), config.apiHash, {
                connectionRetries: 5,
            });

            await client.connect();

            // Store temporarily for verify step
            const tempData = { client, phoneNumber, phoneCodeHash: null, companyId };
            this.clients.set(userbotConfigId, tempData);

            const apiCredentials = {
                apiId: parseInt(config.apiId),
                apiHash: config.apiHash
            };

            const result = await client.sendCode(apiCredentials, phoneNumber);

            // Update stored data with hash
            tempData.phoneCodeHash = result.phoneCodeHash;
            this.clients.set(userbotConfigId, tempData);

            return { success: true, message: "Code sent successfully" };

        } catch (error) {
            console.error("❌ [SEND-CODE] Error:", error);
            // This is pre-login, so we don't need _handleAuthError usually, but good to be safe
            // However, usually sendCode fails due to config/network, not auth key
            return { success: false, error: error.message || "Failed to send code" };
        }
    }

    // --- Auth Step 2: Sign In ---
    async signIn(userbotConfigId, companyId, code, password) {
        const temp = this.clients.get(userbotConfigId);
        if (!temp || (typeof temp !== 'object') || !temp.client) {
            return { success: false, error: "Session expired or not found. Try sending code again." };
        }

        try {
            const { client, phoneNumber, phoneCodeHash } = temp;

            let authResult;
            try {
                authResult = await client.invoke(
                    new Api.auth.SignIn({
                        phoneNumber,
                        phoneCodeHash,
                        phoneCode: code,
                    })
                );
            } catch (error) {
                if (error.errorMessage === 'SESSION_PASSWORD_NEEDED' || error.message?.includes('password')) {
                    if (!password) {
                        return {
                            success: false,
                            error: "Two-factor authentication is enabled. Password is required.",
                            requiresPassword: true
                        };
                    }

                    const passwordHash = await client.invoke(new Api.account.GetPassword());
                    const { computeCheck } = require('telegram/Password');
                    const passwordCheck = await computeCheck(passwordHash, password);

                    authResult = await client.invoke(
                        new Api.auth.CheckPassword({ password: passwordCheck })
                    );
                } else {
                    throw error;
                }
            }

            const sessionString = client.session.save();

            // Save to DB
            await this.prisma.telegramConfig.update({
                where: { id: userbotConfigId },
                data: { sessionString, isActive: true, clientPhone: phoneNumber }
            });

            // Store actual client instance (clean up temp object)
            this.clients.set(userbotConfigId, client);

            return { success: true, message: "Logged in successfully" };

        } catch (error) {
            console.error("❌ [SIGN-IN] Error:", error);
            return { success: false, error: error.message };
        }
    }

    // --- Main Features ---

    async getDialogs(userbotConfigId, companyId) {
        try {
            const client = await this._getClient(userbotConfigId, companyId);
            const dialogs = await client.getDialogs({ limit: 50 });

            const formatted = dialogs.map(d => {
                try {
                    const chatId = d.entity?.id?.toString() || d.id?.toString() || 'unknown';
                    const title = d.title || d.name || d.entity?.title || d.entity?.firstName || 'Unknown';

                    return {
                        id: chatId,
                        name: title,
                        unreadCount: d.unreadCount || 0,
                        lastMessage: d.message?.message || d.message?.text || "",
                        date: d.date || new Date(),
                        isGroup: d.isGroup || false,
                        isUser: d.isUser || false,
                        isChannel: d.isChannel || false
                    };
                } catch (e) {
                    return { id: 'error', name: 'Error', unreadCount: 0, lastMessage: '', date: new Date() };
                }
            });

            return { success: true, data: formatted };
        } catch (error) {
            return this._handleAuthError(error, userbotConfigId, companyId);
        }
    }

    async sendMessage(userbotConfigId, companyId, chatId, message) {
        try {
            const client = await this._getClient(userbotConfigId, companyId);

            // Resolve entity (works for IDs or Usernames)
            const entity = await client.getEntity(chatId);
            await client.sendMessage(entity, { message });

            return { success: true };
        } catch (error) {
            return this._handleAuthError(error, userbotConfigId, companyId);
        }
    }

    async getMessages(userbotConfigId, companyId, chatId, limit = 50) {
        try {
            const client = await this._getClient(userbotConfigId, companyId);

            let entity;
            try {
                const numericChatId = typeof chatId === 'string' ? BigInt(chatId) : chatId;
                entity = await client.getEntity(numericChatId);
            } catch (e) {
                entity = await client.getEntity(chatId);
            }

            // Fetch messages (fallback to GetHistory if getMessages helper fails)
            let messages;
            try {
                messages = await client.getMessages(entity, { limit: parseInt(limit) || 50 });
            } catch (e) {
                const result = await client.invoke(
                    new Api.messages.GetHistory({
                        peer: entity,
                        limit: parseInt(limit) || 50,
                        offsetId: 0,
                        offsetDate: 0,
                        addOffset: 0,
                        maxId: 0,
                        minId: 0,
                        hash: BigInt(0)
                    })
                );
                messages = result.messages || [];
            }

            const formattedMessages = await Promise.all(messages.map(async (msg) => {
                try {
                    let senderName = 'System';
                    let senderId = 'system';

                    if (msg.out) {
                        senderName = 'You';
                        senderId = 'me';
                    } else if (msg.fromId) {
                        try {
                            const senderEntity = await client.getEntity(msg.fromId);
                            senderName = senderEntity.firstName || senderEntity.title || senderEntity.username || 'Unknown';
                            if (senderEntity.lastName) senderName += ' ' + senderEntity.lastName;
                            senderId = msg.fromId?.value?.toString() || msg.fromId?.toString() || 'unknown';
                        } catch (e) {
                            senderName = 'Unknown';
                            senderId = msg.fromId?.toString();
                        }
                    }

                    return {
                        id: msg.id?.toString() || String(msg.id),
                        text: msg.message || msg.text || '',
                        date: msg.date ? (msg.date instanceof Date ? Math.floor(msg.date.getTime() / 1000) : msg.date) : 0,
                        fromId: senderId,
                        senderName,
                        isOut: msg.out || false,
                        media: msg.media ? { type: msg.media.className || 'unknown' } : null
                    };
                } catch (e) {
                    return { id: 'error', text: 'Error formatting' };
                }
            }));

            // Sort by date ascending
            formattedMessages.sort((a, b) => a.date - b.date);

            return { success: true, data: formattedMessages };

        } catch (error) {
            return this._handleAuthError(error, userbotConfigId, companyId);
        }
    }

    async sendFile(userbotConfigId, companyId, chatId, fileBuffer, fileName, caption) {
        try {
            const client = await this._getClient(userbotConfigId, companyId);

            const tempPath = path.join(os.tmpdir(), fileName || `upload_${Date.now()}.dat`);
            try {
                fs.writeFileSync(tempPath, fileBuffer);

                const entity = await client.getEntity(chatId);
                await client.sendMessage(entity, {
                    message: caption || "",
                    file: tempPath
                });

                fs.unlinkSync(tempPath);
                return { success: true };
            } catch (fileError) {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                throw fileError;
            }
        } catch (error) {
            return this._handleAuthError(error, userbotConfigId, companyId);
        }
    }

    async logout(userbotConfigId, companyId) {
        const clientData = this.clients.get(userbotConfigId);
        let client = null;

        if (clientData) {
            if (typeof clientData === 'object' && clientData.client) {
                client = clientData.client;
            } else {
                client = clientData;
            }
        }

        if (client && client.connected) {
            try { await client.disconnect(); } catch (e) { }
        }

        this.clients.delete(userbotConfigId);

        await this.prisma.telegramConfig.update({
            where: { id: userbotConfigId },
            data: { sessionString: null, isActive: false, clientPhone: null }
        });

        return { success: true };
    }
}

module.exports = new TelegramUserbotService();
