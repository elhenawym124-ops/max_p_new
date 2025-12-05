require('dotenv').config();
const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { useDatabaseAuthState } = require('./services/whatsapp/DatabaseAuthState');
const { getSharedPrismaClient } = require('./services/sharedDatabase');
const pino = require('pino');

async function debugRestore() {
    // const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
    const sessionId = 'cminq88q1000duf24dqonnhbh'; // 01123087745 (New ID)

    try {
        console.log(`🔍 Attempting to restore session: ${sessionId}`);

        // 1. Load Auth State
        console.log('📂 Loading Auth State...');
        const { state, saveCreds } = await useDatabaseAuthState(sessionId);

        console.log('✅ Auth State Loaded.');
        console.log(`   Creds exists: ${!!state.creds}`);
        console.log(`   Me: ${JSON.stringify(state.creds.me)}`);

        // Check keys via the interface (if possible, or just trust the loader)
        // Since state.keys is the interface, we can't inspect it easily unless we call get
        // But we know keysData was loaded.

        // 2. Fetch Version
        const { version } = await fetchLatestBaileysVersion();
        console.log(`📦 Baileys Version: ${version.join('.')}`);

        // 3. Create Socket
        console.log('🔌 Connecting to WhatsApp...');
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'info' }), // Enable logs to see connection issues
            connectTimeoutMs: 60000,
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('⚠️ QR Code generated! Session is NOT authenticated.');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                console.log(`❌ Connection closed. Status: ${statusCode}, Reconnect: ${shouldReconnect}`);
                console.log('Error:', lastDisconnect?.error);

                if (!shouldReconnect) {
                    console.log('⛔ Logged out. Auth state is invalid.');
                    process.exit(1);
                }
            } else if (connection === 'open') {
                console.log('✅ Connection OPEN! Session is valid.');
                console.log('User:', sock.user);
                process.exit(0);
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugRestore();

