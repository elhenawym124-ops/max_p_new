const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { getSharedPrismaClient } = require('./sharedDatabase');
const input = require("input"); // For console input if ever needed

class TelegramUserbotService {
    constructor() {
        this.clients = new Map(); // userId -> TelegramClient
        this.prisma = getSharedPrismaClient();

        if (!process.env.TELEGRAM_API_ID || !process.env.TELEGRAM_API_HASH) {
            console.warn("⚠️ [TELEGRAM] Missing TELEGRAM_API_ID or TELEGRAM_API_HASH in .env");
        }
    }

    // Helper: Get stored session for a company/user
    async getSession(companyId) {
        const config = await this.prisma.telegramConfig.findFirst({
            where: { companyId, isActive: true, type: 'USERBOT' }
        });
        return config ? config.sessionString : "";
    }

    // 1. Send Login Code (Step 1)
    async sendCode(companyId, phoneNumber) {
        if (!process.env.TELEGRAM_API_ID || !process.env.TELEGRAM_API_HASH) {
            return { success: false, error: "Server configuration error: Missing TELEGRAM_API_ID/HASH" };
        }

        const session = new StringSession("");
        const client = new TelegramClient(session, parseInt(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH, {
            connectionRetries: 5,
        });

        await client.connect();

        // Store client temporarily for the next step (verify)
        this.clients.set(companyId, { client, phoneNumber, phoneCodeHash: null });

        try {
            const result = await client.sendCode({
                apiId: parseInt(process.env.TELEGRAM_API_ID),
                apiHash: process.env.TELEGRAM_API_HASH,
                phoneNumber: phoneNumber,
            });

            // Save phoneCodeHash for step 2
            const clientData = this.clients.get(companyId);
            clientData.phoneCodeHash = result.phoneCodeHash;
            this.clients.set(companyId, clientData);

            return { success: true, message: "Code sent successfully" };
        } catch (error) {
            console.error("❌ Send Code Error:", error);
            return { success: false, error: error.message };
        }
    }

    // 2. Sign In with Code (Step 2)
    async signIn(companyId, code, password) {
        const temp = this.clients.get(companyId);
        if (!temp || !temp.client) {
            return { success: false, error: "Session expired or not found. Try sending code again." };
        }

        try {
            const { client, phoneNumber, phoneCodeHash } = temp;

            await client.invoke(
                new Api.auth.SignIn({
                    phoneNumber: phoneNumber,
                    phoneCodeHash: phoneCodeHash,
                    phoneCode: code,
                })
            );

            // If 2FA is enabled and password provided, logic would go here.

            const sessionString = client.session.save();

            // Save session to DB
            await this.prisma.telegramConfig.upsert({
                where: { companyId_type: { companyId, type: 'USERBOT' } },
                update: { sessionString, isActive: true },
                create: { companyId, sessionString, isActive: true, type: 'USERBOT' }
            });

            // Keep client connected
            this.clients.set(companyId, client);

            return { success: true, message: "Logged in successfully" };
        } catch (error) {
            console.error("❌ Sign In Error:", error);
            return { success: false, error: error.message };
        }
    }

    // 3. Get Dialogs (Chats)
    async getDialogs(companyId) {
        // Retrieve client
        let client = this.clients.get(companyId);

        // If not in memory, try to restore from DB
        if (!client || !(client instanceof TelegramClient)) {
            const sessionString = await this.getSession(companyId);
            if (!sessionString) return { success: false, error: "Not logged in" };

            client = new TelegramClient(new StringSession(sessionString), parseInt(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH, {});
            await client.connect();
            this.clients.set(companyId, client);
        }

        try {
            const dialogs = await client.getDialogs({ limit: 50 });
            // Format for frontend
            const formatted = dialogs.map(d => ({
                id: d.id.toString(),
                name: d.title,
                unreadCount: d.unreadCount,
                lastMessage: d.message ? d.message.message : "",
                date: d.date,
                isGroup: d.isGroup,
                isUser: d.isUser,
                isChannel: d.isChannel
            }));
            return { success: true, data: formatted };
        } catch (error) {
            console.error("❌ Get Dialogs Error:", error);
            // If error is related to auth, might need to clear session
            return { success: false, error: error.message };
        }
    }

    // 4. Send Message
    async sendMessage(companyId, chatId, message) {
        let client = this.clients.get(companyId);
        if (!client || !(client instanceof TelegramClient)) {
            const sessionString = await this.getSession(companyId);
            if (!sessionString) return { success: false, error: "Not logged in" };
            client = new TelegramClient(new StringSession(sessionString), parseInt(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH, {});
            await client.connect();
            this.clients.set(companyId, client);
        }

        try {
            await client.sendMessage(chatId, { message });
            return { success: true };
        } catch (error) {
            console.error("❌ Send Message Error:", error);
            return { success: false, error: error.message };
        }
    }

    // 5. Get Messages (History)
    async getMessages(companyId, chatId, limit = 50) {
        let client = this.clients.get(companyId);
        if (!client || !(client instanceof TelegramClient)) {
            const sessionString = await this.getSession(companyId);
            if (!sessionString) return { success: false, error: "Not logged in" };
            client = new TelegramClient(new StringSession(sessionString), parseInt(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH, {});
            await client.connect();
            this.clients.set(companyId, client);
        }

        try {
            const messages = await client.getMessages(chatId, { limit });
            // Format messages
            const formatted = messages.map(m => ({
                id: m.id,
                text: m.message || "",
                date: m.date,
                senderId: m.senderId ? m.senderId.toString() : null,
                isOut: m.out, // true if sent by me
                media: m.media ? true : false
            }));
            return { success: true, data: formatted.reverse() }; // Oldest first for chat UI
        } catch (error) {
            console.error("❌ Get Messages Error:", error);
            return { success: false, error: error.message };
        }
    }

    // 6. Logout
    async logout(companyId) {
        let client = this.clients.get(companyId);
        // If stored client, disconnect it
        if (client && client instanceof TelegramClient) {
            try {
                await client.disconnect();
            } catch (e) { console.error("Error disconnecting client", e); }
        }

        // Remove from memory
        this.clients.delete(companyId);

        // Remove from DB
        await this.prisma.telegramConfig.deleteMany({
            where: { companyId_type: { companyId, type: 'USERBOT' } } // Assuming schema supports this composite key or we verify logic
        });

        // Fallback if schema is different, trying deleteMany based on companyId only IF it's safe (but checking type is safer)
        // For MVP, if schema isn't updated, let's just clear the string
        const config = await this.prisma.telegramConfig.findFirst({
            where: { companyId, isActive: true, type: 'USERBOT' }
        });
        if (config) {
            await this.prisma.telegramConfig.update({
                where: { id: config.id },
                data: { sessionString: "", isActive: false }
            });
        }

        return { success: true };
    }

    // 7. Send File
    async sendFile(companyId, chatId, fileBuffer, fileName, caption) {
        let client = this.clients.get(companyId);
        if (!client || !(client instanceof TelegramClient)) {
            const sessionString = await this.getSession(companyId);
            if (!sessionString) return { success: false, error: "Not logged in" };
            client = new TelegramClient(new StringSession(sessionString), parseInt(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH, {});
            await client.connect();
            this.clients.set(companyId, client);
        }

        try {
            // Using GramJS sendFile
            /* 
              GramJS accepts 'file' as path, or Buffer, or CustomFile.
              If Buffer, we need to ensure it has a 'name' property hack or use 'workers' appropriately.
              The simplest way for buffer is often providing it directly with attribute.
            */
            const toSend = new CustomFile(fileName, fileBuffer.length, "", fileBuffer);

            await client.sendMessage(chatId, {
                message: caption || "",
                file: toSend
            });
            return { success: true };
        } catch (error) {
            console.error("❌ Send File Error:", error);
            return { success: false, error: error.message };
        }
    }
}

// Minimal CustomFile polyfill for GramJS if needed or just use buffer with specific option
// Actually GramJS 'sendFile' helper handles Buffer directly if we pass it right.
// Let's refine the sendFile logic to be safer for Buffer.
// Instead of CustomFile (which needs import), we can use the buffer directly and let GramJS handle it or save to temp.
// For robust serverless, temp file is safer. But let's try direct buffer first.
const fs = require('fs');
const path = require('path');
const os = require('os');

// Monkey-patching / enhancing the method above
TelegramUserbotService.prototype.sendFile = async function (companyId, chatId, fileBuffer, fileName, caption) {
    let client = this.clients.get(companyId);
    if (!client || !(client instanceof TelegramClient)) {
        const sessionString = await this.getSession(companyId);
        if (!sessionString) return { success: false, error: "Not logged in" };
        client = new TelegramClient(new StringSession(sessionString), parseInt(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH, {});
        await client.connect();
        this.clients.set(companyId, client);
    }

    // Save buffer to temp file
    const tempPath = path.join(os.tmpdir(), fileName || 'upload.dat');
    try {
        fs.writeFileSync(tempPath, fileBuffer);

        await client.sendMessage(chatId, {
            message: caption || "",
            file: tempPath
        });

        // Cleanup
        fs.unlinkSync(tempPath);
        return { success: true };
    } catch (error) {
        console.error("❌ Send File Error:", error);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return { success: false, error: error.message };
    }
};

module.exports = new TelegramUserbotService();
