const { getSharedPrismaClient } = require('./services/sharedDatabase');
const prisma = getSharedPrismaClient();

async function checkLastMessage() {
    try {
        const lastMessage = await prisma.whatsAppMessage.findFirst({
            orderBy: { createdAt: 'desc' },
            take: 1
        });
        console.log('Last Message:', JSON.stringify(lastMessage, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkLastMessage();
