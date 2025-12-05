const { getSharedPrismaClient } = require('./services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues

async function checkLastMessage() {
    try {
        const lastMessage = await getSharedPrismaClient().whatsAppMessage.findFirst({
            orderBy: { createdAt: 'desc' },
            take: 1
        });
        console.log('Last Message:', JSON.stringify(lastMessage, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await getSharedPrismaClient().$disconnect();
    }
}

checkLastMessage();

