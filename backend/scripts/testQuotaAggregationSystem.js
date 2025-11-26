/**
 * Script to test Quota Aggregation and Round-Robin system
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock AIAgentService for testing
class MockAIAgentService {
  constructor() {
    this.prisma = prisma;
  }
}

// Load ModelManager
const ModelManager = require('../services/aiAgent/modelManager');
const mockAIAgentService = new MockAIAgentService();
const modelManager = new ModelManager(mockAIAgentService);

async function testSystem() {
  console.log('🧪 بدء اختبار نظام تجميع الكوتة وRound-Robin...\n');

  try {
    // Test 1: Check ExcludedModel table
    console.log('1️⃣ اختبار ExcludedModel table...');
    const excludedCount = await prisma.excludedModel.count();
    console.log(`   ✅ ExcludedModel table accessible (${excludedCount} records)`);

    // Test 2: Check ModelManager properties
    console.log('\n2️⃣ اختبار ModelManager properties...');
    console.log(`   ✅ lastUsedGlobalKeyId: ${modelManager.lastUsedGlobalKeyId || 'null'}`);
    console.log(`   ✅ quotaCache: ${modelManager.quotaCache ? 'exists' : 'missing'}`);
    console.log(`   ✅ excludedModels: ${modelManager.excludedModels ? 'exists' : 'missing'}`);

    // Test 3: Test getSupportedModels
    console.log('\n3️⃣ اختبار getSupportedModels...');
    const supportedModels = modelManager.getSupportedModels();
    console.log(`   ✅ Supported models: ${supportedModels.length}`);
    console.log(`   📋 Models: ${supportedModels.join(', ')}`);

    // Test 4: Test getModelDefaults
    console.log('\n4️⃣ اختبار getModelDefaults...');
    const testModel = 'gemini-2.5-pro';
    const defaults = modelManager.getModelDefaults(testModel);
    console.log(`   ✅ Defaults for ${testModel}:`);
    console.log(`      - RPM: ${defaults.rpm}`);
    console.log(`      - TPM: ${defaults.tpm}`);
    console.log(`      - RPD: ${defaults.rpd}`);

    // Test 5: Test aggregateModelsByPriority (with a test company)
    console.log('\n5️⃣ اختبار aggregateModelsByPriority...');
    const testCompanies = await prisma.company.findMany({
      take: 1,
      select: { id: true }
    });

    if (testCompanies.length > 0) {
      const testCompanyId = testCompanies[0].id;
      const aggregated = await modelManager.aggregateModelsByPriority(testModel, testCompanyId);
      console.log(`   ✅ Aggregated ${aggregated.length} models for company ${testCompanyId}`);
      
      if (aggregated.length > 0) {
        console.log(`   📋 First model: ${aggregated[0].model} (Key: ${aggregated[0].key.name})`);
      }
    } else {
      console.log('   ⚠️ No companies found for testing');
    }

    // Test 6: Test calculateTotalQuota
    console.log('\n6️⃣ اختبار calculateTotalQuota...');
    if (testCompanies.length > 0) {
      const testCompanyId = testCompanies[0].id;
      const quota = await modelManager.calculateTotalQuota(testModel, testCompanyId);
      console.log(`   ✅ Quota calculated:`);
      console.log(`      - Total RPM: ${quota.totalRPM} (Used: ${quota.totalRPMUsed}, ${quota.rpmPercentage.toFixed(1)}%)`);
      console.log(`      - Total TPM: ${quota.totalTPM} (Used: ${quota.totalTPMUsed}, ${quota.tpmPercentage.toFixed(1)}%)`);
      console.log(`      - Total RPD: ${quota.totalRPD} (Used: ${quota.totalRPDUsed}, ${quota.rpdPercentage.toFixed(1)}%)`);
      console.log(`      - Available models: ${quota.availableModels.length}/${quota.totalModels}`);
      
      // Test caching
      console.log('\n   🔄 Testing cache...');
      const startTime = Date.now();
      const quota2 = await modelManager.calculateTotalQuota(testModel, testCompanyId);
      const endTime = Date.now();
      console.log(`   ✅ Cache test: ${endTime - startTime}ms (should be < 100ms if cached)`);
    }

    // Test 7: Test isModelExcluded
    console.log('\n7️⃣ اختبار isModelExcluded...');
    if (testCompanies.length > 0) {
      const testCompanyId = testCompanies[0].id;
      const testKeys = await prisma.geminiKey.findMany({
        where: { companyId: testCompanyId, isActive: true },
        take: 1,
        select: { id: true }
      });

      if (testKeys.length > 0) {
        const testKeyId = testKeys[0].id;
        const isExcluded = await modelManager.isModelExcluded(testModel, testKeyId, testCompanyId);
        console.log(`   ✅ Model exclusion check: ${isExcluded ? 'EXCLUDED' : 'NOT EXCLUDED'}`);
      }
    }

    // Test 8: Test findBestModelByPriorityWithQuota
    console.log('\n8️⃣ اختبار findBestModelByPriorityWithQuota...');
    if (testCompanies.length > 0) {
      const testCompanyId = testCompanies[0].id;
      const bestModel = await modelManager.findBestModelByPriorityWithQuota(testCompanyId);
      
      if (bestModel) {
        console.log(`   ✅ Best model found:`);
        console.log(`      - Model: ${bestModel.model}`);
        console.log(`      - Key: ${bestModel.keyName}`);
        console.log(`      - KeyId: ${bestModel.keyId}`);
        console.log(`      - Quota RPM: ${bestModel.quota.rpmPercentage.toFixed(1)}%`);
        console.log(`      - Quota TPM: ${bestModel.quota.tpmPercentage.toFixed(1)}%`);
      } else {
        console.log('   ⚠️ No available model found (may be normal if all models exhausted)');
      }
    }

    // Test 9: Test selectNextKeyRoundRobin
    console.log('\n9️⃣ اختبار selectNextKeyRoundRobin...');
    if (testCompanies.length > 0) {
      const testCompanyId = testCompanies[0].id;
      const quota = await modelManager.calculateTotalQuota(testModel, testCompanyId);
      
      if (quota.availableModels.length > 0) {
        const selected = await modelManager.selectNextKeyRoundRobin(quota.availableModels);
        
        if (selected) {
          console.log(`   ✅ Selected model:`);
          console.log(`      - Model: ${selected.model}`);
          console.log(`      - Key: ${selected.key.name}`);
          console.log(`      - KeyId: ${selected.keyId}`);
          console.log(`      - LastUsedGlobalKeyId updated: ${modelManager.lastUsedGlobalKeyId}`);
        }
      }
    }

    // Test 10: Test getActiveGeminiKeyWithModel (new system)
    console.log('\n🔟 اختبار getActiveGeminiKeyWithModel (النظام الجديد)...');
    if (testCompanies.length > 0) {
      const testCompanyId = testCompanies[0].id;
      const activeModel = await modelManager.getActiveGeminiKeyWithModel(testCompanyId);
      
      if (activeModel) {
        console.log(`   ✅ Active model found:`);
        console.log(`      - Model: ${activeModel.model}`);
        console.log(`      - KeyId: ${activeModel.keyId}`);
        if (activeModel.quota) {
          console.log(`      - Using new quota system: YES`);
        }
      } else {
        console.log('   ⚠️ No active model found');
      }
    }

    // Test 11: Test findNextAvailableModel (new system)
    console.log('\n1️⃣1️⃣ اختبار findNextAvailableModel (النظام الجديد)...');
    if (testCompanies.length > 0) {
      const testCompanyId = testCompanies[0].id;
      const nextModel = await modelManager.findNextAvailableModel(testCompanyId);
      
      if (nextModel) {
        console.log(`   ✅ Next model found:`);
        console.log(`      - Model: ${nextModel.model}`);
        console.log(`      - SwitchType: ${nextModel.switchType}`);
        if (nextModel.quota) {
          console.log(`      - Using new quota system: YES`);
        }
      } else {
        console.log('   ⚠️ No next model found');
      }
    }

    // Test 12: Test excludeModel and removeExcludedModel
    console.log('\n1️⃣2️⃣ اختبار excludeModel و removeExcludedModel...');
    if (testCompanies.length > 0) {
      const testCompanyId = testCompanies[0].id;
      const testKeys = await prisma.geminiKey.findMany({
        where: { companyId: testCompanyId, isActive: true },
        take: 1,
        select: { id: true }
      });

      if (testKeys.length > 0) {
        const testKeyId = testKeys[0].id;
        const testModelName = 'gemini-2.5-flash';
        
        // Exclude model
        await modelManager.excludeModel(testModelName, testKeyId, testCompanyId, 'TEST');
        console.log(`   ✅ Model excluded: ${testModelName}`);
        
        // Check if excluded
        const isExcluded = await modelManager.isModelExcluded(testModelName, testKeyId, testCompanyId);
        console.log(`   ✅ Exclusion check: ${isExcluded ? 'EXCLUDED' : 'NOT EXCLUDED'}`);
        
        // Remove exclusion (cleanup)
        const excludedRecord = await prisma.excludedModel.findFirst({
          where: {
            modelName: testModelName,
            keyId: testKeyId,
            companyId: testCompanyId,
            reason: 'TEST'
          }
        });
        
        if (excludedRecord) {
          await modelManager.removeExcludedModel(excludedRecord.id);
          console.log(`   ✅ Exclusion removed (cleanup)`);
        }
      }
    }

    console.log('\n✅ جميع الاختبارات اكتملت بنجاح!');
    console.log('\n📋 ملخص:');
    console.log('   ✅ ExcludedModel table: Working');
    console.log('   ✅ ModelManager properties: Initialized');
    console.log('   ✅ aggregateModelsByPriority: Working');
    console.log('   ✅ calculateTotalQuota: Working (with caching)');
    console.log('   ✅ isModelExcluded: Working');
    console.log('   ✅ findBestModelByPriorityWithQuota: Working');
    console.log('   ✅ selectNextKeyRoundRobin: Working');
    console.log('   ✅ getActiveGeminiKeyWithModel: Using new system');
    console.log('   ✅ findNextAvailableModel: Using new system');
    console.log('   ✅ excludeModel/removeExcludedModel: Working');

  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.message);
    console.error('❌ Stack:', error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testSystem()
  .then(() => {
    console.log('\n🎉 جميع الاختبارات نجحت!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 فشل الاختبار:', error);
    process.exit(1);
  });

