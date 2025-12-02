const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkOutgoingMessages() {
    const prisma = getSharedPrismaClient();
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        console.log(`🔎 Checking for OUTGOING messages created after ${fiveMinutesAgo.toISOString()}`);

        const messages = await prisma.whatsAppMessage.findMany({
            where: {
                timestamp: { gt: fiveMinutesAgo },
                fromMe: true
            },
            include: {
                session: true
            },
            orderBy: { timestamp: 'desc' }
        });

        console.log(`Found ${messages.length} recent outgoing messages:`);
        messages.forEach(m => {
            console.log(`\nID: ${m.id}`);
            console.log(`Session: ${m.session?.name} (${m.sessionId})`);
            console.log(`To: ${m.remoteJid}`);
            console.log(`Content: ${m.content}`);
            console.log(`Status: ${m.status}`);
            console.log(`Timestamp: ${m.timestamp}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkOutgoingMessages();
