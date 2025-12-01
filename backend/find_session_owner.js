const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findSessionOwner() {
    const sessionId = 'cmimbo3jg0024uf6kjj5bed1r';
    console.log(`🔍 Looking for owner of session: ${sessionId}`);

    const session = await prisma.whatsAppSession.findUnique({
        where: { id: sessionId },
        include: { company: true }
    });

    if (!session) {
        console.log('❌ Session not found in DB');
        return;
    }

    console.log(`✅ Session found. Company ID: ${session.companyId}`);

    const user = await prisma.user.findFirst({
        where: { companyId: session.companyId }
    });

    if (!user) {
        console.log('❌ No user found for this company');
        return;
    }

    console.log(`✅ User found: ${user.email} (ID: ${user.id})`);
}

findSessionOwner()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
