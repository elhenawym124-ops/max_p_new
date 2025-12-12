const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseCentralKeys() {
    console.log('🔍 Diagnosing Central Keys...\n');

    // 1. Check all Central Keys
    const centralKeys = await prisma.geminiKey.findMany({
        where: {
            keyType: 'CENTRAL',
            companyId: null
        },
        include: {
            models: true
        }
    });

    console.log(`📊 Total Central Keys: ${centralKeys.length}\n`);

    if (centralKeys.length === 0) {
        console.log('❌ No Central Keys found in database!');
        await prisma.$disconnect();
        return;
    }

    // 2. Analyze each key
    for (const key of centralKeys) {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔑 Key: ${key.name} (ID: ${key.id})`);
        console.log(`   Type: ${key.keyType}`);
        console.log(`   Active: ${key.isActive ? '✅ YES' : '❌ NO'}`);
        console.log(`   Priority: ${key.priority}`);
        console.log(`   API Key: ${key.apiKey.substring(0, 20)}...`);
        console.log(`   CompanyId: ${key.companyId || 'NULL (Central)'}`);
        console.log(`\n   📋 Models (${key.models.length}):`);

        if (key.models.length === 0) {
            console.log(`      ⚠️  No models associated with this key!`);
        } else {
            for (const model of key.models) {
                const usage = model.usage ? JSON.parse(model.usage) : {};
                console.log(`      • ${model.model}`);
                console.log(`        - Enabled: ${model.isEnabled ? '✅' : '❌'}`);
                console.log(`        - Priority: ${model.priority}`);
                console.log(`        - Usage: ${usage.used || 0}/${usage.limit || 'N/A'}`);
                console.log(`        - RPM: ${usage.rpm?.used || 0}/${usage.rpm?.limit || 'N/A'}`);
                console.log(`        - RPD: ${usage.rpd?.used || 0}/${usage.rpd?.limit || 'N/A'}`);
            }
        }
        console.log('');
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // 3. Check if there's an active central key with enabled models
    const activeKeyWithModels = centralKeys.find(k =>
        k.isActive && k.models.some(m => m.isEnabled)
    );

    if (activeKeyWithModels) {
        console.log(`✅ Found active central key with enabled models: ${activeKeyWithModels.name}`);
        console.log(`   Enabled models: ${activeKeyWithModels.models.filter(m => m.isEnabled).map(m => m.model).join(', ')}`);
    } else {
        console.log(`❌ PROBLEM FOUND:`);
        const inactiveKeys = centralKeys.filter(k => !k.isActive);
        const keysWithoutModels = centralKeys.filter(k => k.models.length === 0);
        const keysWithDisabledModels = centralKeys.filter(k =>
            k.models.length > 0 && k.models.every(m => !m.isEnabled)
        );

        if (inactiveKeys.length > 0) {
            console.log(`   • ${inactiveKeys.length} keys are INACTIVE`);
            inactiveKeys.forEach(k => console.log(`     - ${k.name}`));
        }
        if (keysWithoutModels.length > 0) {
            console.log(`   • ${keysWithoutModels.length} keys have NO models`);
            keysWithoutModels.forEach(k => console.log(`     - ${k.name}`));
        }
        if (keysWithDisabledModels.length > 0) {
            console.log(`   • ${keysWithDisabledModels.length} keys have ALL models disabled`);
            keysWithDisabledModels.forEach(k => console.log(`     - ${k.name}`));
        }
    }

    await prisma.$disconnect();
}

diagnoseCentralKeys().catch(console.error);
