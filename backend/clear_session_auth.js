
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SESSION_ID = 'cmimbo3jg0024uf6kjj5bed1r';

async function clearSessionAuth() {
    try {
        console.log(`🗑️ Clearing auth state for session: ${SESSION_ID}`);

        const result = await prisma.whatsAppSession.update({
            where: { id: SESSION_ID },
            data: {
                authState: null,
                status: 'DISCONNECTED'
            }
        });

        console.log('✅ Auth state cleared successfully.');
        console.log('🔄 The server should now attempt to create a new session and generate a QR code.');

    } catch (error) {
        console.error('❌ Error clearing auth state:', error);
    } finally {
        await prisma.$disconnect();
    }
}

clearSessionAuth();
