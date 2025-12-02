const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkRecentMessages() {
    const prisma = getSharedPrismaClient();
    try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        console.log(`🔎 Checking for ANY messages created after ${tenMinutesAgo.toISOString()}`);

        const messages = await prisma.whatsAppMessage.findMany({
            where: {
                timestamp: { gt: tenMinutesAgo }
            },
            include: {
                session: true
            },
            orderBy: { timestamp: 'desc' }
        });

        console.log(`Found ${messages.length} recent messages:`);
        messages.forEach(m => {
            console.log(`   [${m.timestamp.toISOString()}] Session: ${m.session?.name} | To: ${m.remoteJid} | Content: ${m.content}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkRecentMessages();
