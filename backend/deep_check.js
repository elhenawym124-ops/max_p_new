const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function deepCheck() {
    const prisma = getSharedPrismaClient();
    try {
        // 1. Find the connected session for the phone number 01123087745
        const session = await prisma.whatsAppSession.findFirst({
            where: {
                phoneNumber: { contains: '01123087745' },
                status: 'CONNECTED'
            }
        });

        if (!session) {
            console.log('❌ No connected session found for 01123087745');
            return;
        }

        console.log(`✅ Found Session: ${session.id} (${session.name})`);

        // 2. Find the contact 'swan' or the number 01112257060
        const contact = await prisma.whatsAppContact.findFirst({
            where: {
                sessionId: session.id,
                OR: [
                    { pushName: { contains: 'swan' } },
                    { name: { contains: 'swan' } },
                    { phoneNumber: { contains: '01112257060' } }
                ]
            }
        });

        if (!contact) {
            console.log('❌ Contact not found');
        } else {
            console.log('✅ Found Contact:');
            console.log(`   JID: ${contact.jid}`);
            console.log(`   Name: ${contact.name}`);
            console.log(`   PushName: ${contact.pushName}`);
            console.log(`   Unread Count: ${contact.unreadCount}`);
            console.log(`   Last Message At: ${contact.lastMessageAt}`);
        }

        // 3. Get the last 5 messages for this contact
        if (contact) {
            const messages = await prisma.whatsAppMessage.findMany({
                where: {
                    sessionId: session.id,
                    remoteJid: contact.jid
                },
                orderBy: { timestamp: 'desc' },
                take: 5
            });

            console.log(`✅ Found ${messages.length} messages:`);
            messages.forEach(m => {
                console.log(`   [${m.timestamp.toISOString()}] ${m.fromMe ? 'OUT' : 'IN'} (${m.status}): ${m.content}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

deepCheck();
