
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugSession() {
    const phoneNumber = '0112257060';
    console.log(`🔍 Searching for session with phone number containing: ${phoneNumber}`);

    try {
        // 1. Find ALL Sessions
        const sessions = await prisma.whatsAppSession.findMany();

        console.log(`Found ${sessions.length} total sessions.`);

        if (sessions.length === 0) {
            console.log('❌ No session found for this phone number.');
            return;
        }

        for (const session of sessions) {
            console.log('\n---------------------------------------------------');
            console.log(`🆔 Session ID: ${session.id}`);
            console.log(`👤 Name: ${session.name}`);
            console.log(`📱 Phone: ${session.phoneNumber}`);
            console.log(`🔌 Status: ${session.status}`);
            console.log(`📅 Last Connected: ${session.lastConnectedAt}`);
            console.log(`📅 Created At: ${session.createdAt}`);

            // 2. Check Recent Messages
            const recentMessages = await prisma.whatsAppMessage.findMany({
                where: { sessionId: session.id },
                orderBy: { timestamp: 'desc' },
                take: 5
            });

            console.log(`\n📨 Recent Messages (Last 5):`);
            if (recentMessages.length === 0) {
                console.log('   (No messages found)');
            } else {
                recentMessages.forEach(msg => {
                    console.log(`   - [${msg.timestamp.toISOString()}] ${msg.fromMe ? 'Me' : 'Them'}: ${msg.content ? msg.content.substring(0, 50) : '[Media]'} (${msg.status})`);
                });
            }

            // 3. Check Contacts
            const contactCount = await prisma.whatsAppContact.count({
                where: { sessionId: session.id }
            });
            console.log(`\n👥 Total Contacts: ${contactCount}`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugSession();
