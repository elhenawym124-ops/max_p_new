const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkIncomingMessages() {
    const prisma = getSharedPrismaClient();
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        console.log(`🔎 Checking for INCOMING messages created after ${fiveMinutesAgo.toISOString()}`);

        const messages = await prisma.whatsAppMessage.findMany({
            where: {
                timestamp: { gt: fiveMinutesAgo },
                fromMe: false
            },
            include: {
                session: true
            },
            orderBy: { timestamp: 'desc' }
        });

        console.log(`Found ${messages.length} recent incoming messages:`);
        messages.forEach(m => {
            console.log(`\nID: ${m.id}`);
            console.log(`Session: ${m.session?.name}`);
            console.log(`From: ${m.remoteJid}`);
            console.log(`Content: ${m.content}`);
            console.log(`Timestamp: ${m.timestamp}`);
        });

        // Also check session status
        const sessions = await prisma.whatsAppSession.findMany();
        console.log('\n--- Session Status ---');
        sessions.forEach(s => {
            console.log(`${s.name}: ${s.status}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkIncomingMessages();
