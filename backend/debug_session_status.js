const { getSharedPrismaClient } = require('./services/sharedDatabase');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

async function debugSession() {
    try {
        console.log('🔍 Starting Session Debugger...');
        const sessionId = 'cmintez5r0042ufxwank74fox';

        // 1. Find the session
        const session = await getSharedPrismaClient().whatsAppSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            console.error(`❌ Session "${sessionId}" not found in database!`);
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
        const { state } = await useMultiFileAuthState(sessionPath);

        console.log('📊 Auth State Loaded:', {
            creds: !!state.creds,
            keys: state.keys ? Object.keys(state.keys).length : 0
        });

        if (!state.creds || !state.creds.me) {
            console.warn('⚠️ No "me" object in creds. Session might not be fully logged in.');
            if (state.creds) {
                console.log('Creds content:', JSON.stringify(state.creds, null, 2));
            }
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
