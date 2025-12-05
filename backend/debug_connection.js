const { getSharedPrismaClient } = require('./services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

async function debugSession() {
    try {
        console.log('🔍 Starting Connection Debugger...');

        // 1. Find the session
        const session = await getSharedPrismaClient().whatsAppSession.findFirst({
            where: { name: '0004' }
        });

        if (!session) {
            console.error('❌ Session "0004" not found in database!');
            return;
        }

        console.log('✅ Found Session in DB:', {
            id: session.id,
            name: session.name,
            status: session.status,
            phoneNumber: session.phoneNumber,
            companyId: session.companyId
        });

        // 2. Check Session Files
        const SESSIONS_DIR = path.join(__dirname, 'data/whatsapp-sessions');
        const sessionPath = path.join(SESSIONS_DIR, session.id);

        if (fs.existsSync(sessionPath)) {
            console.log(`✅ Session directory exists: ${sessionPath}`);
            const files = fs.readdirSync(sessionPath);
            console.log(`📂 Files in session dir: ${files.length} files`);
            if (files.length === 0) {
                console.warn('⚠️ Session directory is empty!');
            }
        } else {
            console.error(`❌ Session directory NOT found: ${sessionPath}`);
            console.log('   This means credentials are not saved on disk.');
        }

        // 3. Attempt to Load Auth State
        console.log('🔄 Attempting to load auth state...');
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        console.log('📊 Auth State Loaded:', {
            creds: !!state.creds,
            keys: Object.keys(state.keys).length
        });

        if (!state.creds || !state.creds.me) {
            console.warn('⚠️ No "me" object in creds. Session might not be fully logged in.');
        } else {
            console.log('👤 Logged in as:', state.creds.me);
        }

    } catch (error) {
        console.error('❌ Error during debug:', error);
    } finally {
        await getSharedPrismaClient().$disconnect();
    }
}

debugSession();

