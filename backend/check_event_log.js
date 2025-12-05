const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkEventLog() {
    // const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
    try {
        const logs = await getSharedPrismaClient().whatsAppEventLog.findMany({
            where: {
                eventType: 'debug_incoming_msg'
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        console.log(`Found ${logs.length} debug logs:`);
        logs.forEach(log => {
            console.log('\n--- Log Entry ---');
            console.log(`Time: ${log.timestamp}`);
            console.log(`Data: ${JSON.stringify(log.eventData, null, 2)}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkEventLog();

