const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function findSession() {
    const prisma = getSharedPrismaClient();
    try {
        const session = await prisma.whatsAppSession.findFirst({
            where: {
                OR: [
                    { phoneNumber: { contains: '01123087745' } },
                    { name: { contains: '01123087745' } }
                ]
            }
        });

        if (session) {
            console.log(`FOUND_SESSION_ID:${session.id}`);
            console.log(`Session Name: ${session.name}`);
            console.log(`Session Phone: ${session.phoneNumber}`);
            console.log(`Session Status: ${session.status}`);
        } else {
            console.log('SESSION_NOT_FOUND');
        }
    } catch (error) {
        console.error('Error finding session:', error);
    } finally {
        // await prisma.$disconnect();
    }
}

findSession();
