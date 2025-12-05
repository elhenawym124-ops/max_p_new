
const { getSharedPrismaClient } = require('./services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues

async function testGetConversations() {
    try {
        console.log('🚀 Starting getConversations test...');

        // 1. Get a valid company ID (from user logs)
        const companyId = 'cmem8ayyr004cufakqkcsyn97';
        console.log(`🏢 Using company: ${companyId}`);

        // 2. Get sessions
        const sessions = await getSharedPrismaClient().whatsAppSession.findMany({
            where: { companyId: companyId }
        });
        console.log(`📱 Found ${sessions.length} sessions`);
        const sessionIds = sessions.map(s => s.id);

        if (sessionIds.length === 0) {
            console.log('⚠️ No sessions found, skipping contacts check');
            return;
        }

        // 3. Fetch contacts (simulate controller logic)
        console.log('🔍 Fetching contacts...');
        const contacts = await getSharedPrismaClient().whatsAppContact.findMany({
            where: { sessionId: { in: sessionIds } },
            take: 5,
            select: { id: true, jid: true, sessionId: true }
        });
        console.log(`👥 Found ${contacts.length} contacts`);

        // 4. Test the problematic loop
        console.log('🔄 Testing last message loop...');
        if (contacts.length > 0) {
            const jids = contacts.map(c => c.jid);
            const lastMessagesPromises = jids.map(async (jid) => {
                try {
                    console.log(`   - Fetching last message for ${jid}...`);
                    const msg = await getSharedPrismaClient().whatsAppMessage.findFirst({
                        where: {
                            sessionId: { in: sessionIds },
                            remoteJid: jid
                        },
                        orderBy: { timestamp: 'desc' },
                        select: {
                            remoteJid: true,
                            content: true,
                            messageType: true,
                            fromMe: true,
                            timestamp: true,
                            status: true
                        }
                    });
                    console.log(`     ✅ Found message for ${jid}: ${msg ? 'Yes' : 'No'}`);
                    return msg;
                } catch (err) {
                    console.error(`     ❌ Error fetching last message for JID ${jid}:`, err);
                    return null;
                }
            });

            const lastMessages = (await Promise.all(lastMessagesPromises)).filter(Boolean);
            console.log(`✅ Successfully fetched ${lastMessages.length} last messages`);
        }

        console.log('✅ Test completed successfully');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await getSharedPrismaClient().$disconnect();
    }
}

testGetConversations();

