const { PrismaClient } = require('@prisma/client');
const telegramBotService = require('./services/TelegramBotService');

const prisma = new PrismaClient();

const COMPANY_ID = 'cmem8ayyr004cufakqkcsyn97';
const BOT_TOKEN = '8547460022:AAEbWBpQu88dR7ZEBtdxaS6JDNKX70b9I34';
const LABEL = 'Verification Bot';

async function verifyBotLogic() {
    try {
        console.log('🔄 Connecting to DB...');

        // 1. Create or Update Config directly in DB
        const config = await prisma.telegramConfig.create({
            data: {
                companyId: COMPANY_ID,
                botToken: BOT_TOKEN,
                label: LABEL,
                isActive: true
            }
        });

        console.log('✅ DB Record Created:', config.id);

        // 2. Start the Bot Service
        console.log('🔄 Starting Bot Service...');
        await telegramBotService.startBot(config.id, COMPANY_ID, BOT_TOKEN);

        console.log('✅ Bot Service Started Successfully!');

        // 3. Verify it's in the map
        if (telegramBotService.bots.has(config.id)) {
            console.log('✅ Verification PASSED: Bot is running in memory.');

            // Get Bot Info to be super sure
            const botInstance = telegramBotService.bots.get(config.id);
            const botInfo = await botInstance.telegram.getMe();
            console.log('🤖 Bot Info:', botInfo);

        } else {
            console.error('❌ Verification FAILED: Bot not found in memory map.');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        await prisma.$disconnect();
        // Keep process alive briefly to allow async logs
        setTimeout(() => process.exit(0), 2000);
    }
}

verifyBotLogic();
