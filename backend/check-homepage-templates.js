const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function checkTemplates() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 جاري البحث عن الصفحات الرئيسية...\n');

    const templates = await prisma.homepageTemplate.findMany({
      include: {
        company: {
          select: {
            name: true,
            slug: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 عدد الصفحات الرئيسية: ${templates.length}\n`);

    if (templates.length === 0) {
      console.log('❌ لا توجد صفحات رئيسية في النظام بعد.\n');
      console.log('💡 يمكنك إنشاء صفحة رئيسية من خلال:');
      console.log('   1. الذهاب إلى: /settings/homepage');
      console.log('   2. الضغط على "إنشاء قالب تجريبي"\n');
    } else {
      console.log('✅ الصفحات الرئيسية الموجودة:\n');
      
      templates.forEach((template, index) => {
        console.log(`${index + 1}. ${template.name}`);
        console.log(`   📌 الشركة: ${template.company.name}`);
        console.log(`   🔗 Slug: ${template.company.slug}`);
        console.log(`   📝 الوصف: ${template.description || 'لا يوجد'}`);
        console.log(`   ${template.isActive ? '✅ نشط' : '⚪ غير نشط'}`);
        console.log(`   📅 تاريخ الإنشاء: ${new Date(template.createdAt).toLocaleString('ar-EG')}`);
        
        // Parse content to show sections count
        try {
          const content = JSON.parse(template.content);
          console.log(`   📦 عدد الأقسام: ${content.sections?.length || 0}`);
        } catch (e) {
          console.log(`   ⚠️  خطأ في قراءة المحتوى`);
        }
        
        console.log('');
      });

      // Show active template
      const activeTemplate = templates.find(t => t.isActive);
      if (activeTemplate) {
        console.log('🌟 الصفحة النشطة حالياً:');
        console.log(`   ${activeTemplate.name} (${activeTemplate.company.name})\n`);
      } else {
        console.log('⚠️  لا توجد صفحة نشطة حالياً.\n');
      }
    }

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error('\nتفاصيل الخطأ:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplates();
