/**
 * Script بسيط للتحقق من قيمة aiMaxTokens
 */

const { getSharedPrismaClient } = require('../services/sharedDatabase');

async function main() {
  // const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
  
  try {
    console.log('🔄 Connecting to database...\n');
    
    const settings = await getSharedPrismaClient().aiSettings.findMany({
      select: {
        companyId: true,
        aiMaxTokens: true,
        updatedAt: true,
        company: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log('═'.repeat(60));
    console.log('📊 AI Max Tokens في قاعدة البيانات:\n');
    
    if (settings.length === 0) {
      console.log('⚠️  لا توجد إعدادات AI في قاعدة البيانات');
      console.log('   النظام سيستخدم القيمة الافتراضية: 2048 tokens\n');
    } else {
      settings.forEach((s, i) => {
        console.log(`${i + 1}. الشركة: ${s.company?.name || 'N/A'}`);
        console.log(`   Company ID: ${s.companyId}`);
        console.log(`   aiMaxTokens: ${s.aiMaxTokens !== null ? s.aiMaxTokens : 'NULL (سيستخدم 2048)'}`);
        console.log(`   آخر تحديث: ${s.updatedAt.toISOString()}`);
        console.log('');
      });
    }
    
    console.log('═'.repeat(60));
    console.log(`\n📋 الإجمالي: ${settings.length} سجل`);
    
    const custom = settings.filter(s => s.aiMaxTokens !== null && s.aiMaxTokens !== 2048);
    if (custom.length > 0) {
      console.log(`\n✅ قيم مخصصة (≠ 2048): ${custom.length}`);
      custom.forEach(s => {
        console.log(`   - ${s.companyId}: ${s.aiMaxTokens} tokens`);
      });
    }
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await getSharedPrismaClient().$disconnect();
  }
}

main();


