/**
 * اختبار سريع للتحقق من وجود الحقول الجديدة في Database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDatabaseFields() {
  try {
    console.log('🔍 Testing database fields...\n');

    // محاولة جلب الإعدادات
    const settings = await prisma.storefrontSettings.findFirst({
      select: {
        id: true,
        companyId: true,
        facebookPixelEnabled: true,
        facebookPixelId: true,
        facebookConvApiEnabled: true,
        facebookConvApiToken: true,
        pixelTrackPageView: true,
        capiTrackPageView: true,
        eventDeduplicationEnabled: true,
        eventMatchQualityTarget: true,
        gdprCompliant: true,
        hashUserData: true,
      }
    });

    if (settings) {
      console.log('✅ Database fields are available!');
      console.log('\n📊 Sample data:');
      console.log(JSON.stringify(settings, null, 2));
    } else {
      console.log('⚠️ No settings found in database');
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testDatabaseFields();
