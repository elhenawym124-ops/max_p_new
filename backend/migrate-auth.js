/**
 * 🔄 Migration Script - نقل بيانات المصادقة من الملفات إلى قاعدة البيانات
 */

const { getSharedPrismaClient } = require('./services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const SESSIONS_DIR = path.join(__dirname, 'data/whatsapp-sessions');

async function readJsonFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        return null;
    }
}

async function migrateSession(sessionId) {
    console.log(`\n🔄 Migrating: ${sessionId}`);
    
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    
    if (!fsSync.existsSync(sessionPath)) {
        console.log(`⚠️ Directory not found`);
        return false;
    }

    const files = await fs.readdir(sessionPath);
    console.log(`📂 Found ${files.length} files`);

    let authState = { creds: null, keys: {} };

    // creds.json
    const credsPath = path.join(sessionPath, 'creds.json');
    if (fsSync.existsSync(credsPath)) {
        const creds = await readJsonFile(credsPath);
        if (creds) {
            authState.creds = creds;
            console.log('✅ Loaded creds');
        }
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
        console.log(`✅ Loaded ${sessionFiles.length} sessions`);
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
        console.log(`✅ Loaded ${preKeyFiles.length} pre-keys`);
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
        console.log(`✅ Loaded ${senderKeyFiles.length} sender-keys`);
    }

    // Save to database
    try {
        await getSharedPrismaClient().whatsAppSession.update({
            where: { id: sessionId },
            data: {
                authState: JSON.stringify(authState),
                updatedAt: new Date()
            }
        });
        console.log(`✅ Saved to database`);
        return true;
    } catch (error) {
        console.error(`❌ Error:`, error.message);
        return false;
    }
}

async function main() {
    try {
        console.log('🚀 Starting migration from files to database...\n');

        const sessions = await getSharedPrismaClient().whatsAppSession.findMany({
            select: { id: true, name: true }
        });

        if (sessions.length === 0) {
            console.log('⚠️ No sessions found in database');
            return;
        }

        console.log(`📋 Found ${sessions.length} sessions to migrate\n`);

        let success = 0;
        let failed = 0;

        for (const session of sessions) {
            console.log(`\n📱 Processing: ${session.name || session.id}`);
            if (await migrateSession(session.id)) {
                success++;
            } else {
                failed++;
            }
        }

        console.log(`\n\n📊 Migration Summary:`);
        console.log(`✅ Success: ${success}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📁 Total: ${sessions.length}`);
        console.log(`\n✅ Migration completed!`);

    } catch (error) {
        console.error('\n❌ Migration error:', error);
        throw error; // Re-throw to allow caller to handle
    } finally {
        await getSharedPrismaClient().$disconnect();
    }
}

// Run migration
if (require.main === module) {
    main();
}

module.exports = { migrateSession, main };


