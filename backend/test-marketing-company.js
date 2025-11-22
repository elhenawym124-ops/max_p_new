/**
 * اختبار حفظ وتحميل Pixel ID لشركة التسويق
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMarketingCompany() {
  try {
    console.log('🧪 Testing Marketing Company...\n');

    // البحث عن شركة التسويق
    const company = await prisma.company.findFirst({
      where: {
        OR: [
          { name: { contains: 'تسويق' } },
          { name: { contains: 'التسويق' } },
          { name: { contains: 'marketing' } }
        ]
      }
    });
    
    if (!company) {
      console.log('❌ Marketing company not found');
      console.log('📋 Available companies:');
      const allCompanies = await prisma.company.findMany({
        select: { id: true, name: true }
      });
      allCompanies.forEach(c => {
        console.log(`  - ${c.name} (${c.id})`);
      });
      process.exit(1);
    }

    console.log('✅ Company found:', company.name);
    console.log('📝 Company ID:', company.id);

    // جلب الإعدادات الحالية
    console.log('\n📥 Loading current settings...');
    const currentSettings = await prisma.storefrontSettings.findUnique({
      where: { companyId: company.id },
      select: {
        id: true,
        facebookPixelEnabled: true,
        facebookPixelId: true,
        facebookConvApiEnabled: true,
        facebookConvApiToken: true,
        pixelTrackPageView: true,
        pixelTrackViewContent: true,
        pixelTrackAddToCart: true,
      }
    });

    if (currentSettings) {
      console.log('✅ Current settings found:');
      console.log(JSON.stringify(currentSettings, null, 2));
    } else {
      console.log('⚠️ No settings found yet');
    }

    // اختبار الحفظ
    const testPixelId = '252061987690295';
    console.log('\n💾 Saving Pixel ID:', testPixelId);

    const updatedSettings = await prisma.storefrontSettings.upsert({
      where: { companyId: company.id },
      update: {
        facebookPixelEnabled: true,
        facebookPixelId: testPixelId,
        pixelTrackPageView: true,
        pixelTrackViewContent: true,
        pixelTrackAddToCart: true,
        pixelTrackInitiateCheckout: true,
        pixelTrackPurchase: true,
        pixelTrackSearch: true,
      },
      create: {
        companyId: company.id,
        facebookPixelEnabled: true,
        facebookPixelId: testPixelId,
        pixelTrackPageView: true,
        pixelTrackViewContent: true,
        pixelTrackAddToCart: true,
        pixelTrackInitiateCheckout: true,
        pixelTrackPurchase: true,
        pixelTrackSearch: true,
        supportedLanguages: ['ar']
      }
    });

    console.log('\n✅ Settings saved successfully!');
    console.log('📊 Saved data:');
    console.log({
      id: updatedSettings.id,
      companyId: updatedSettings.companyId,
      facebookPixelEnabled: updatedSettings.facebookPixelEnabled,
      facebookPixelId: updatedSettings.facebookPixelId,
      pixelTrackPageView: updatedSettings.pixelTrackPageView,
    });

    // التحقق من الحفظ (محاكاة GET request)
    console.log('\n🔍 Verifying save (simulating GET request)...');
    const verifiedSettings = await prisma.storefrontSettings.findUnique({
      where: { companyId: company.id }
    });

    console.log('\n✅ Verification result:');
    console.log({
      facebookPixelEnabled: verifiedSettings.facebookPixelEnabled,
      facebookPixelId: verifiedSettings.facebookPixelId,
      pixelTrackPageView: verifiedSettings.pixelTrackPageView,
      pixelTrackViewContent: verifiedSettings.pixelTrackViewContent,
      pixelTrackAddToCart: verifiedSettings.pixelTrackAddToCart,
    });

    if (verifiedSettings.facebookPixelId === testPixelId && 
        verifiedSettings.facebookPixelEnabled === true) {
      console.log('\n🎉 SUCCESS! Data saved and verified correctly!');
      console.log('\n📋 Summary:');
      console.log(`  Company: ${company.name}`);
      console.log(`  Pixel ID: ${verifiedSettings.facebookPixelId}`);
      console.log(`  Enabled: ${verifiedSettings.facebookPixelEnabled}`);
      console.log(`  Track PageView: ${verifiedSettings.pixelTrackPageView}`);
      console.log(`  Track ViewContent: ${verifiedSettings.pixelTrackViewContent}`);
      console.log(`  Track AddToCart: ${verifiedSettings.pixelTrackAddToCart}`);
    } else {
      console.log('\n❌ FAILED! Data not saved correctly');
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

testMarketingCompany();
