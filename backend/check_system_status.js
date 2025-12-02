const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkSystemStatus() {
    const prisma = getSharedPrismaClient();
    try {
        // 1. Check Sessions
        const sessions = await prisma.whatsAppSession.findMany();
        console.log('--- Sessions ---');
        sessions.forEach(s => {
            console.log(`${s.name} (${s.phoneNumber}): ${s.status}`);
        });

        // 2. Check ANY messages in last 30 mins
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const messages = await prisma.whatsAppMessage.findMany({
            where: { timestamp: { gt: thirtyMinutesAgo } },
            orderBy: { timestamp: 'desc' },
            take: 10
        });

        console.log('\n--- Recent Messages (Last 30 mins) ---');
        if (messages.length === 0) console.log('No messages found.');
        messages.forEach(m => {
            console.log(`[${m.timestamp.toISOString()}] ${m.fromMe ? 'OUT' : 'IN'} -> ${m.remoteJid}: ${m.content} (${m.status})`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkSystemStatus();
