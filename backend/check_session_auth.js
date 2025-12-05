const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkSessionAuth() {
    // const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
    try {
        const sessions = await getSharedPrismaClient().whatsAppSession.findMany();

        console.log(`Found ${sessions.length} sessions.`);

        for (const session of sessions) {
            console.log(`\nSession: ${session.name} (${session.id})`);
            console.log(`Status: ${session.status}`);

            // Check if authState exists and has data
            if (session.authState) {
                const authState = typeof session.authState === 'string'
                    ? JSON.parse(session.authState)
                    : session.authState;

                const keys = Object.keys(authState);
                console.log(`✅ Auth State Present. Keys: ${keys.length}`);
                console.log(`   Creds present: ${!!authState.creds}`);
                console.log(`   Keys present: ${!!authState.keys}`);
            } else {
                console.log('❌ Auth State is NULL or EMPTY');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkSessionAuth();

