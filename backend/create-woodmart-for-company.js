const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function createWoodMartForCompany() {
  const prisma = new PrismaClient();

  try {
    console.log('🎨 Creating WoodMart Fashion template for your company...\n');

    // Use the specific company ID from the logs
    const companyId = 'cmem8ayyr004cufakqkcsyn97'; // شركة التسويق

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      console.error('❌ Company not found!');
      process.exit(1);
    }

    console.log(`📊 Using company: ${company.name} (${companyId})\n`);

    // Deactivate all existing templates for this company
    await prisma.homepageTemplate.updateMany({
      where: { companyId },
      data: { isActive: false }
    });

    // Create WoodMart-inspired template
    const woodmartContent = {
      sections: [
        {
          id: 'hero-slider',
          type: 'hero',
          title: 'مجموعة الموضة الجديدة 2024',
          subtitle: 'اكتشف أحدث صيحات الموضة لهذا الموسم - خصومات تصل إلى 50%',
          buttonText: 'تسوق الآن',
          buttonLink: '/shop',
          backgroundImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b',
          overlayOpacity: 0.3,
          textAlign: 'center',
          height: 'large'
        },
        {
          id: 'categories-grid',
          type: 'categories',
          title: 'تسوق حسب الفئة',
          displayStyle: 'grid-large',
          showCount: true,
          columns: 4
        },
        {
          id: 'featured-products',
          type: 'products',
          title: 'المنتجات المميزة',
          subtitle: 'اختيارنا الخاص لك',
          displayType: 'featured',
          layout: 'grid',
          columns: 4,
          limit: 8
        },
        {
          id: 'banner-promo',
          type: 'banner',
          title: 'عرض خاص - خصم يصل إلى 50%',
          subtitle: 'على مجموعة مختارة من المنتجات',
          buttonText: 'اكتشف العروض',
          buttonLink: '/offers',
          backgroundImage: 'https://images.unsplash.com/photo-1607082349566-187342175e2f',
          backgroundColor: '#1a1a1a',
          textColor: '#ffffff'
        },
        {
          id: 'new-arrivals',
          type: 'products',
          title: 'وصل حديثاً',
          subtitle: 'أحدث المنتجات في متجرنا',
          displayType: 'new',
          layout: 'grid',
          columns: 4,
          limit: 8
        },
        {
          id: 'features-icons',
          type: 'features',
          title: 'لماذا تختارنا؟',
          items: [
            {
              icon: 'truck',
              title: 'شحن مجاني',
              description: 'للطلبات فوق 500 جنيه'
            },
            {
              icon: 'shield',
              title: 'دفع آمن',
              description: 'معاملات مشفرة 100%'
            },
            {
              icon: 'support',
              title: 'دعم 24/7',
              description: 'فريق دعم متاح دائماً'
            },
            {
              icon: 'return',
              title: 'إرجاع سهل',
              description: 'خلال 30 يوم'
            }
          ]
        },
        {
          id: 'trending-products',
          type: 'products',
          title: 'الأكثر مبيعاً',
          subtitle: 'المنتجات الأكثر طلباً',
          displayType: 'bestseller',
          layout: 'grid',
          columns: 4,
          limit: 8
        },
        {
          id: 'testimonials',
          type: 'testimonials',
          title: 'آراء عملائنا',
          subtitle: 'ماذا يقول عملاؤنا عنا',
          items: [
            {
              name: 'سارة أحمد',
              rating: 5,
              comment: 'منتجات رائعة وجودة عالية. التوصيل كان سريع جداً والتعامل احترافي.',
              avatar: 'https://i.pravatar.cc/150?img=1'
            },
            {
              name: 'محمد علي',
              rating: 5,
              comment: 'أفضل متجر إلكتروني تعاملت معه. الأسعار ممتازة والخدمة رائعة.',
              avatar: 'https://i.pravatar.cc/150?img=2'
            },
            {
              name: 'فاطمة حسن',
              rating: 4,
              comment: 'تجربة تسوق ممتازة. المنتجات كما في الصور تماماً.',
              avatar: 'https://i.pravatar.cc/150?img=3'
            }
          ]
        }
      ],
      settings: {
        containerWidth: 'full',
        spacing: 'normal',
        animation: true
      }
    };

    // Create the template
    const template = await prisma.homepageTemplate.create({
      data: {
        name: 'WoodMart Fashion - Modern',
        description: 'تصميم عصري مستوحى من WoodMart Fashion Flat مع تخطيط احترافي وميزات متقدمة',
        content: JSON.stringify(woodmartContent),
        thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
        companyId,
        isActive: true
      }
    });

    console.log('✅ Template created successfully!\n');
    console.log('📋 Template Details:');
    console.log(`   ID: ${template.id}`);
    console.log(`   Name: ${template.name}`);
    console.log(`   Company: ${company.name}`);
    console.log(`   Sections: ${woodmartContent.sections.length}`);
    console.log(`   Status: Active ✅\n`);

    console.log('🎉 WoodMart Fashion template is ready!\n');
    console.log('💡 Next steps:');
    console.log('   1. Go to: /settings/homepage');
    console.log('   2. You will see the new template');
    console.log('   3. Click "معاينة" to preview');
    console.log('   4. Click "تعديل" to customize\n');

  } catch (error) {
    console.error('❌ Error creating template:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createWoodMartForCompany();
