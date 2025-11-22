/**
 * اختبار حفظ Pixel ID في Database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSavePixelId() {
  try {
    console.log('🧪 Testing Pixel ID save...\n');

    // جلب أول شركة
    const company = await prisma.company.findFirst();
    
    if (!company) {
      console.log('❌ No company found in database');
      process.exit(1);
    }

    console.log('✅ Company found:', company.id);
    console.log('📝 Company name:', company.name);

    // محاولة حفظ Pixel ID
    const testPixelId = '123456789012345';
    
    console.log('\n📝 Saving Pixel ID:', testPixelId);

    const settings = await prisma.storefrontSettings.upsert({
      where: { companyId: company.id },
      update: {
        facebookPixelEnabled: true,
        facebookPixelId: testPixelId,
        pixelTrackPageView: true,
        pixelTrackViewContent: true,
        pixelTrackAddToCart: true,
      },
      create: {
        companyId: company.id,
        facebookPixelEnabled: true,
        facebookPixelId: testPixelId,
        pixelTrackPageView: true,
        pixelTrackViewContent: true,
        pixelTrackAddToCart: true,
        supportedLanguages: ['ar']
      }
    });

    console.log('\n✅ Settings saved successfully!');
    console.log('\n📊 Saved data:');
    console.log({
      id: settings.id,
      companyId: settings.companyId,
      facebookPixelEnabled: settings.facebookPixelEnabled,
      facebookPixelId: settings.facebookPixelId,
      pixelTrackPageView: settings.pixelTrackPageView,
      pixelTrackViewContent: settings.pixelTrackViewContent,
      pixelTrackAddToCart: settings.pixelTrackAddToCart,
    });

    // التحقق من الحفظ
    console.log('\n🔍 Verifying save...');
    const verified = await prisma.storefrontSettings.findUnique({
      where: { companyId: company.id },
      select: {
        facebookPixelEnabled: true,
        facebookPixelId: true,
      }
    });

    console.log('\n✅ Verification result:');
    console.log(verified);

    if (verified.facebookPixelId === testPixelId) {
      console.log('\n🎉 SUCCESS! Pixel ID saved and verified!');
    } else {
      console.log('\n❌ FAILED! Pixel ID not saved correctly');
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n📋 Full error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testSavePixelId();
