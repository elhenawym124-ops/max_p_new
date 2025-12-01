const { getSharedPrismaClient } = require('./services/sharedDatabase');
const prisma = getSharedPrismaClient();

async function checkMessageStatus() {
    try {
        console.log('🔍 Checking last sent messages...');

        const messages = await prisma.whatsAppMessage.findMany({
            where: {
                fromMe: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 5
        });

        if (messages.length === 0) {
            console.log('❌ No sent messages found in DB.');
        } else {
            console.log('✅ Last 5 sent messages:');
            messages.forEach(msg => {
                console.log(`- ID: ${msg.messageId}`);
                console.log(`  To: ${msg.remoteJid}`);
                console.log(`  Status: ${msg.status}`);
                console.log(`  Content: ${msg.content}`);
                console.log(`  Time: ${msg.createdAt}`);
                console.log('---');
            });
        }

    } catch (error) {
        console.error('❌ Error checking messages:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkMessageStatus();
