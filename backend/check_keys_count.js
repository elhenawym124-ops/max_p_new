const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkKeysContent() {
    const prisma = getSharedPrismaClient();
    try {
        const sessions = await prisma.whatsAppSession.findMany();

        for (const session of sessions) {
            console.log(`\nSession: ${session.name}`);
            if (session.authState) {
                const authState = JSON.parse(session.authState);
                const keys = authState.keys || {};
                const keyCount = Object.keys(keys).length;
                console.log(`   Keys Object Key Count: ${keyCount}`);
                if (keyCount > 0) {
                    console.log(`   Sample Key Types: ${Object.keys(keys).slice(0, 3).join(', ')}`);
                } else {
                    console.log('   ⚠️ KEYS ARE EMPTY!');
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkKeysContent();
