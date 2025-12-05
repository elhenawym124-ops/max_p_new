const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkCorrectJid() {
    // const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
    const sessionId = 'cminpms7r002eufvkd4kvfoin';
    const correctJid = '201112257060@s.whatsapp.net'; // Egypt code + number

    try {
        console.log(`🔎 Checking for messages with JID: ${correctJid}`);

        const messages = await getSharedPrismaClient().whatsAppMessage.findMany({
            where: {
                sessionId: sessionId,
                remoteJid: { contains: '1112257060' } // Search by partial number
            },
            orderBy: { timestamp: 'desc' }
        });

        console.log(`Found ${messages.length} messages matching partial number '1112257060':`);
        messages.forEach(m => {
            console.log(`   JID: ${m.remoteJid} | ${m.content} | ${m.timestamp}`);
        });

        // Also check if there's a contact for the correct JID
        const contact = await getSharedPrismaClient().whatsAppContact.findFirst({
            where: {
                sessionId: sessionId,
                jid: { contains: '1112257060' }
            }
        });

        if (contact) {
            console.log(`✅ Found Contact for correct number: ${contact.jid} (${contact.pushName})`);
        } else {
            console.log('❌ No contact found for correct number');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkCorrectJid();

