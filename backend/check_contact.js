const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkContact() {
    // const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
    try {
        const contact = await getSharedPrismaClient().whatsAppContact.findFirst({
            where: {
                jid: '201112257060@s.whatsapp.net'
            }
        });

        if (contact) {
            console.log('✅ Contact Found:');
            console.log(`Name: ${contact.name}`);
            console.log(`PushName: ${contact.pushName}`);
            console.log(`PhoneNumber: ${contact.phoneNumber}`);
            console.log(`SessionId: ${contact.sessionId}`);
        } else {
            console.log('❌ Contact 201112257060@s.whatsapp.net NOT FOUND');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkContact();

