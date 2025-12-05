const { getSharedPrismaClient } = require('./services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues

async function checkIncomingMedia() {
    try {
        const lastIncoming = await getSharedPrismaClient().whatsAppMessage.findFirst({
            where: {
                fromMe: false,
                messageType: 'IMAGE'
            },
            orderBy: { createdAt: 'desc' },
            take: 1
        });
        console.log('Last Incoming Image Message:', JSON.stringify(lastIncoming, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await getSharedPrismaClient().$disconnect();
    }
}

checkIncomingMedia();

