const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to generate unique IDs
function generateId() {
  return 'cm' + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
}

async function addGeminiKeyDirectly() {
    try {
        console.log('🚀 Adding Gemini Key Directly Using Raw SQL');
        console.log('=' * 50);
        
        // Target company ID for شركة التسويق
        const targetCompanyId = 'cmem8ayyr004cufakqkcsyn97';
        
        // New Gemini key details
        const newKeyData = {
            name: 'Production API Key',
            apiKey: 'AIzaSyChIIlqr04fB2SjZ8-JtrUq_Bc0VUcN0wI',
            description: 'Production Gemini API key for marketing company'
        };
        
        console.log('📊 Step 1: Checking existing keys using raw SQL...');
        const keyCountResult = await prisma.$queryRaw`
            SELECT COUNT(*) as count FROM gemini_keys WHERE companyId = ${targetCompanyId}
        `;
        
        const existingKeysCount = Number(keyCountResult[0]?.count || 0);
        const priority = existingKeysCount + 1;
        const isFirstKey = existingKeysCount === 0;
        
        console.log(`📋 Current keys: ${existingKeysCount}, New priority: ${priority}, First key: ${isFirstKey}`);
        
        // Create the main key
        const keyId = generateId();
        const defaultDescription = `مفتاح رقم ${priority} - يدعم جميع النماذج`;
        
        console.log('🔑 Step 2: Creating main key...');
        console.log('Key details:', {
            keyId,
            name: newKeyData.name,
            companyId: targetCompanyId,
            priority,
            isFirstKey
        });
        
        await prisma.$executeRaw`
            INSERT INTO gemini_keys (id, name, apiKey, model, isActive, priority, description, companyId, createdAt, updatedAt, \`usage\`, currentUsage, maxRequestsPerDay)
            VALUES (${keyId}, ${newKeyData.name}, ${newKeyData.apiKey}, 'gemini-2.5-flash', ${isFirstKey}, ${priority}, ${newKeyData.description || defaultDescription}, ${targetCompanyId}, NOW(), NOW(), '{"used": 0, "limit": 1000000}', 0, 1500)
        `;
        
        console.log('✅ Main key created successfully');
        
        // Create models
        const availableModels = [
            // 🆕 أحدث نماذج 2025
            { model: 'gemini-3-pro', limit: 50000, priority: 1 },
            { model: 'gemini-2.5-pro', limit: 50000, priority: 2 },
            { model: 'gemini-2.5-flash', limit: 250000, priority: 3 },
            { model: 'gemini-2.5-flash-lite', limit: 1000000, priority: 4 },
            { model: 'gemini-2.5-flash-tts', limit: 15, priority: 5 },
            
            // نماذج Gemini 2.0
            { model: 'gemini-2.0-flash', limit: 200000, priority: 6 },
            { model: 'gemini-2.0-flash-lite', limit: 200000, priority: 7 },
            
            // نماذج Live API
            { model: 'gemini-2.5-flash-live', limit: 1000000, priority: 8 },
            { model: 'gemini-2.0-flash-live', limit: 1000000, priority: 9 },
            { model: 'gemini-2.5-flash-native-audio-dialog', limit: 1000000, priority: 10 },
            
            // نماذج مستقرة 1.5
            { model: 'gemini-1.5-pro', limit: 50, priority: 11 },
            { model: 'gemini-1.5-flash', limit: 1500, priority: 12 },
            
            // نماذج متخصصة
            { model: 'gemini-robotics-er-1.5-preview', limit: 250000, priority: 13 },
            { model: 'learnlm-2.0-flash-experimental', limit: 1500000, priority: 14 },
            
            // نماذج Gemma
            { model: 'gemma-3-12b', limit: 14400, priority: 15 },
            { model: 'gemma-3-27b', limit: 14400, priority: 16 },
            { model: 'gemma-3-4b', limit: 14400, priority: 17 },
            { model: 'gemma-3-2b', limit: 14400, priority: 18 }
        ];
        
        console.log('📦 Step 3: Creating models...');
        let modelsCreated = 0;
        for (const modelInfo of availableModels) {
            try {
                const modelId = generateId();
                await prisma.$executeRaw`
                    INSERT INTO \`gemini_key_models\`
                    (\`id\`, \`keyId\`, \`model\`, \`usage\`, \`isEnabled\`, \`priority\`, \`createdAt\`, \`updatedAt\`)
                    VALUES
                    (${modelId}, ${keyId}, ${modelInfo.model}, ${JSON.stringify({
                        used: 0,
                        limit: modelInfo.limit,
                        resetDate: null
                    })}, true, ${modelInfo.priority}, NOW(), NOW())
                `;
                modelsCreated++;
                console.log(`✅ Created model: ${modelInfo.model} (${modelInfo.limit} limit)`);
            } catch (error) {
                console.log(`⚠️ Warning: Could not create model ${modelInfo.model}:`, error.message);
            }
        }
        
        // Verify the insertion
        console.log('📊 Step 4: Verifying the insertion...');
        const finalCountResult = await prisma.$queryRaw`
            SELECT COUNT(*) as count FROM gemini_keys WHERE companyId = ${targetCompanyId}
        `;
        const finalCount = Number(finalCountResult[0]?.count || 0);
        
        // Get the created key details
        const createdKeyResult = await prisma.$queryRaw`
            SELECT * FROM gemini_keys WHERE id = ${keyId}
        `;
        const createdKey = createdKeyResult[0];
        
        console.log('🎉 SUCCESS! Gemini key added successfully');
        console.log('📊 Summary:');
        console.log(`   - Company: شركة التسويق (${targetCompanyId})`);
        console.log(`   - Key: ${newKeyData.name} (${keyId})`);
        console.log(`   - Models created: ${modelsCreated}`);
        console.log(`   - Total company keys: ${finalCount}`);
        console.log(`   - Key is active: ${createdKey.isActive}`);
        console.log(`   - Key priority: ${createdKey.priority}`);
        
        // Test verification
        console.log('\n🧪 Step 5: Testing the key integration...');
        const testKeyResult = await prisma.$queryRaw`
            SELECT gk.*, COUNT(gkm.id) as model_count 
            FROM gemini_keys gk 
            LEFT JOIN gemini_key_models gkm ON gk.id = gkm.keyId 
            WHERE gk.id = ${keyId}
            GROUP BY gk.id
        `;
        
        if (testKeyResult[0]) {
            const testKey = testKeyResult[0];
            console.log(`✅ Key verification successful:`);
            console.log(`   - Key name: ${testKey.name}`);
            console.log(`   - Models count: ${testKey.model_count}`);
            console.log(`   - Active: ${testKey.isActive}`);
            console.log(`   - API Key (masked): ${testKey.apiKey.substring(0, 10)}...${testKey.apiKey.slice(-4)}`);
        }
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Refresh the frontend AI Management page');
        console.log('2. The new key should appear in the list');
        console.log('3. Test the key functionality from the UI');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code) {
            console.error('❌ Error code:', error.code);
        }
        if (error.meta) {
            console.error('❌ Error meta:', error.meta);
        }
    } finally {
        await prisma.$disconnect();
    }
}

addGeminiKeyDirectly();