/**
 * Script للتحقق من قيمة aiMaxTokens في قاعدة البيانات
 * Check aiMaxTokens value in database
 */

const { getSharedPrismaClient } = require('../services/sharedDatabase');

async function checkAIMaxTokens() {
  const prisma = getSharedPrismaClient();
  
  try {
    console.log('🔄 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Connected to database\n');
    
    // جلب جميع الشركات مع إعدادات AI
    console.log('🔍 Fetching all companies with AI settings...\n');
    const aiSettings = await prisma.aiSettings.findMany({
      select: {
        id: true,
        companyId: true,
        aiMaxTokens: true,
        aiTemperature: true,
        aiTopP: true,
        aiTopK: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    console.log(`📊 Found ${aiSettings.length} AI settings record(s)\n`);
    console.log('═'.repeat(80));
    
    if (aiSettings.length === 0) {
      console.log('⚠️  No AI settings found in database');
      console.log('   This means no company has saved AI settings yet.');
      console.log('   The system will use default value: 2048 tokens');
    } else {
      aiSettings.forEach((setting, index) => {
        console.log(`\n${index + 1}. Company: ${setting.company?.name || 'N/A'}`);
        console.log('   Company ID:', setting.companyId);
        console.log('   Company Email:', setting.company?.email || 'N/A');
        console.log('   ──────────────────────────────────────────────────────────');
        console.log('   📊 AI Settings:');
        console.log('      • aiMaxTokens:', setting.aiMaxTokens !== null ? setting.aiMaxTokens : 'NULL (will use default: 2048)');
        console.log('      • aiTemperature:', setting.aiTemperature !== null ? setting.aiTemperature : 'NULL');
        console.log('      • aiTopP:', setting.aiTopP !== null ? setting.aiTopP : 'NULL');
        console.log('      • aiTopK:', setting.aiTopK !== null ? setting.aiTopK : 'NULL');
        console.log('   ──────────────────────────────────────────────────────────');
        console.log('   📅 Last Updated:', setting.updatedAt.toISOString());
        
        // تحليل القيمة
        if (setting.aiMaxTokens === null || setting.aiMaxTokens === undefined) {
          console.log('   ⚠️  Status: Using DEFAULT value (2048) from constants');
        } else if (setting.aiMaxTokens === 2048) {
          console.log('   ✅ Status: Using DEFAULT value (2048)');
        } else {
          console.log(`   ✅ Status: Using CUSTOM value (${setting.aiMaxTokens}) from UI`);
        }
      });
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('\n📋 Summary:');
    console.log(`   Total records: ${aiSettings.length}`);
    
    const withCustomValue = aiSettings.filter(s => s.aiMaxTokens !== null && s.aiMaxTokens !== 2048);
    const withDefaultValue = aiSettings.filter(s => s.aiMaxTokens === 2048);
    const withNullValue = aiSettings.filter(s => s.aiMaxTokens === null || s.aiMaxTokens === undefined);
    
    console.log(`   • Custom values (≠ 2048): ${withCustomValue.length}`);
    if (withCustomValue.length > 0) {
      withCustomValue.forEach(s => {
        console.log(`     - Company ${s.companyId}: ${s.aiMaxTokens} tokens`);
      });
    }
    
    console.log(`   • Default values (2048): ${withDefaultValue.length}`);
    console.log(`   • NULL values (will use default): ${withNullValue.length}`);
    
    // جلب القيمة الافتراضية من constants
    const { DEFAULT_AI_SETTINGS } = require('../services/aiAgent/aiConstants');
    console.log(`\n🔧 Default value in constants: ${DEFAULT_AI_SETTINGS.MAX_OUTPUT_TOKENS} tokens`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

// تشغيل السكريبت
(async () => {
  try {
    await checkAIMaxTokens();
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
})();

