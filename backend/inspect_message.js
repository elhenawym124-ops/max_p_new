const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function inspectMessage() {
    const prisma = getSharedPrismaClient();
    try {
        const message = await prisma.whatsAppMessage.findFirst({
            where: {
                content: { contains: 'Ffff' }
            }
        });

        if (message) {
            console.log('Message Found:');
            console.log('ID:', message.id);
            console.log('JID:', message.remoteJid);
            console.log('FromMe:', message.fromMe);
            console.log('Timestamp:', message.timestamp);
            console.log('SessionId:', message.sessionId);
        } else {
            console.log('Message Ffff not found');
        }

        // Also check contact for this JID
        if (message) {
            const contact = await prisma.whatsAppContact.findFirst({
                where: {
                    sessionId: message.sessionId,
                    jid: message.remoteJid
                }
            });
            if (contact) {
                console.log('Contact Found:');
                console.log('JID:', contact.jid);
                console.log('Phone:', contact.phoneNumber);
                console.log('Name:', contact.name);
                console.log('PushName:', contact.pushName);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

inspectMessage();
