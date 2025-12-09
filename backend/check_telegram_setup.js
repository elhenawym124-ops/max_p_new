
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- DIAGNOSTIC START ---');

    // 1. Check Env Vars
    const apiId = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;

    console.log('TELEGRAM_API_ID type:', typeof apiId);
    console.log('TELEGRAM_API_ID exists:', !!apiId);
    console.log('TELEGRAM_API_ID valid number:', !isNaN(parseInt(apiId)));

    console.log('TELEGRAM_API_HASH type:', typeof apiHash);
    console.log('TELEGRAM_API_HASH exists:', !!apiHash);

    // 2. Check Package
    try {
        const telegram = require('telegram');
        console.log('telegram package imported:', true);
    } catch (e) {
        console.error('telegram package import failed:', e.message);
    }

    // 3. Check Database Table
    try {
        console.log('Checking TelegramConfig table...');
        const count = await prisma.telegramConfig.count();
        console.log('TelegramConfig table exists. Count:', count);
    } catch (e) {
        console.error('TelegramConfig table check failed:', e.message);
    }

    console.log('--- DIAGNOSTIC END ---');
    await prisma.$disconnect();
}

check();
