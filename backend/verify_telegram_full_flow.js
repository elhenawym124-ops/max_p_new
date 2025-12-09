const { PrismaClient } = require('@prisma/client');
const telegramBotService = require('./services/TelegramBotService');

const prisma = new PrismaClient();

const COMPANY_ID = 'cmem8ayyr004cufakqkcsyn97';
const VALID_TOKEN = '8547460022:AAEbWBpQu88dR7ZEBtdxaS6JDNKX70b9I34';
const INVALID_TOKEN = '123456:ABC-InvalidToken';

async function runTests() {
    console.log('🧪 Starting Telegram Verification Tests...');

    try {
        // Test 1: Invalid Token (Should Fail)
        console.log('\n--- Test 1: Invalid Token Handling ---');
        try {
            await telegramBotService.startBot('test-bad-config', COMPANY_ID, INVALID_TOKEN);
            console.error('❌ Test 1 FAILED: Expected error but got success');
        } catch (error) {
            console.log('✅ Test 1 PASSED: Caught expected error:', error.message);
        }

        // Test 2: Valid Token (Should Succeed)
        console.log('\n--- Test 2: Valid Token Connection ---');

        // Ensure config exists
        let config = await prisma.telegramConfig.findFirst({
            where: { botToken: VALID_TOKEN }
        });

        if (!config) {
            config = await prisma.telegramConfig.create({
                data: {
                    companyId: COMPANY_ID,
                    botToken: VALID_TOKEN,
                    label: 'Verification Bot'
                }
            });
        }

        try {
            await telegramBotService.startBot(config.id, COMPANY_ID, VALID_TOKEN);

            if (telegramBotService.bots.has(config.id)) {
                console.log('✅ Test 2 PASSED: Bot started and found in memory.');
                const botUser = await telegramBotService.bots.get(config.id).telegram.getMe();
                console.log('🤖 Bot Identity:', botUser.username);

                // Stop to allow script to exit
                await telegramBotService.stopBot(config.id);
                console.log('🛑 Test Bot Stopped cleanly.');
            } else {
                console.error('❌ Test 2 FAILED: Bot not in memory map');
            }
        } catch (error) {
            console.error('❌ Test 2 FAILED with error:', error.message);
        }

    } catch (err) {
        console.error('🔥 Critical Test Error:', err);
    } finally {
        await prisma.$disconnect();
        // Force exit after a buffer
        setTimeout(() => process.exit(0), 1000);
    }
}

runTests();
