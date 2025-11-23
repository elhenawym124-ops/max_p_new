const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function createWoodMartTemplate() {
  const prisma = new PrismaClient();

  try {
    console.log('🎨 Creating WoodMart Fashion Flat inspired template...\n');

    // Get the first company (you can modify this to use a specific company)
    const companies = await prisma.company.findMany({
      take: 1
    });

    if (companies.length === 0) {
      console.error('❌ No companies found. Please create a company first.');
      process.exit(1);
    }

    const companyId = companies[0].id;
    console.log(`📊 Using company: ${companies[0].name} (${companyId})\n`);

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
          title: 'مجموعة الموضة الجديدة',
          subtitle: 'اكتشف أحدث صيحات الموضة لهذا الموسم',
          buttonText: 'تسوق الآن',
          buttonLink: '/shop',
          backgroundImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b',
          overlayOpacity: 0.3,
          textAlign: 'center',
          height: 'large',
          style: {
            backgroundColor: '#f8f9fa',
            textColor: '#ffffff'
          }
        },
        {
          id: 'categories-grid',
          type: 'categories',
          title: 'تسوق حسب الفئة',
          displayStyle: 'grid-large',
          showCount: true,
          columns: 4,
          categories: [
            {
              name: 'ملابس نسائية',
              image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d',
              link: '/shop?category=women',
              count: 150
            },
            {
              name: 'ملابس رجالية',
              image: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891',
              link: '/shop?category=men',
              count: 120
            },
            {
              name: 'إكسسوارات',
              image: 'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93',
              link: '/shop?category=accessories',
              count: 80
            },
            {
              name: 'أحذية',
              image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2',
              link: '/shop?category=shoes',
              count: 95
            }
          ]
        },
        {
          id: 'featured-products',
          type: 'products',
          title: 'المنتجات المميزة',
          subtitle: 'اختيارنا الخاص لك',
          displayType: 'featured',
          layout: 'grid',
          columns: 4,
          limit: 8,
          showQuickView: true,
          showWishlist: true,
          showCompare: true,
          showRating: true,
          showBadges: true
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
          textColor: '#ffffff',
          height: 'medium',
          overlay: true,
          overlayOpacity: 0.4
        },
        {
          id: 'new-arrivals',
          type: 'products',
          title: 'وصل حديثاً',
          subtitle: 'أحدث المنتجات في متجرنا',
          displayType: 'new',
          layout: 'grid',
          columns: 4,
          limit: 8,
          showQuickView: true,
          showWishlist: true,
          showTimer: true
        },
        {
          id: 'features-icons',
          type: 'features',
          title: 'لماذا تختارنا؟',
          layout: 'horizontal',
          items: [
            {
              icon: 'truck',
              title: 'شحن مجاني',
              description: 'للطلبات فوق 500 جنيه',
              iconColor: '#4F46E5'
            },
            {
              icon: 'shield',
              title: 'دفع آمن',
              description: 'معاملات مشفرة 100%',
              iconColor: '#10B981'
            },
            {
              icon: 'support',
              title: 'دعم 24/7',
              description: 'فريق دعم متاح دائماً',
              iconColor: '#F59E0B'
            },
            {
              icon: 'return',
              title: 'إرجاع سهل',
              description: 'خلال 30 يوم',
              iconColor: '#EF4444'
            }
          ]
        },
        {
          id: 'trending-products',
          type: 'products',
          title: 'الأكثر مبيعاً',
          subtitle: 'المنتجات الأكثر طلباً',
          displayType: 'bestseller',
          layout: 'carousel',
          columns: 5,
          limit: 10,
          autoplay: true,
          showQuickView: true,
          showWishlist: true
        },
        {
          id: 'instagram-feed',
          type: 'custom',
          title: 'تابعنا على Instagram',
          subtitle: '@yourstore',
          customType: 'instagram',
          layout: 'grid',
          columns: 6,
          showFollowButton: true
        },
        {
          id: 'brands-slider',
          type: 'custom',
          title: 'العلامات التجارية الشريكة',
          customType: 'brands',
          layout: 'carousel',
          autoplay: true,
          brands: [
            { name: 'Brand 1', logo: '/brands/brand1.png' },
            { name: 'Brand 2', logo: '/brands/brand2.png' },
            { name: 'Brand 3', logo: '/brands/brand3.png' },
            { name: 'Brand 4', logo: '/brands/brand4.png' },
            { name: 'Brand 5', logo: '/brands/brand5.png' }
          ]
        },
        {
          id: 'testimonials',
          type: 'testimonials',
          title: 'آراء عملائنا',
          subtitle: 'ماذا يقول عملاؤنا عنا',
          layout: 'carousel',
          showRating: true,
          showAvatar: true,
          items: [
            {
              name: 'سارة أحمد',
              rating: 5,
              comment: 'منتجات رائعة وجودة عالية. التوصيل كان سريع جداً والتعامل احترافي.',
              avatar: 'https://i.pravatar.cc/150?img=1',
              date: '2024-01-15'
            },
            {
              name: 'محمد علي',
              rating: 5,
              comment: 'أفضل متجر إلكتروني تعاملت معه. الأسعار ممتازة والخدمة رائعة.',
              avatar: 'https://i.pravatar.cc/150?img=2',
              date: '2024-01-10'
            },
            {
              name: 'فاطمة حسن',
              rating: 4,
              comment: 'تجربة تسوق ممتازة. المنتجات كما في الصور تماماً.',
              avatar: 'https://i.pravatar.cc/150?img=3',
              date: '2024-01-05'
            }
          ]
        },
        {
          id: 'newsletter',
          type: 'custom',
          title: 'اشترك في نشرتنا البريدية',
          subtitle: 'احصل على آخر العروض والتحديثات',
          customType: 'newsletter',
          backgroundColor: '#4F46E5',
          textColor: '#ffffff',
          showSocialLinks: true,
          placeholder: 'أدخل بريدك الإلكتروني',
          buttonText: 'اشترك الآن'
        }
      ],
      settings: {
        containerWidth: 'full',
        spacing: 'normal',
        animation: true,
        lazyLoad: true,
        stickyHeader: true,
        showBreadcrumbs: true,
        colorScheme: {
          primary: '#4F46E5',
          secondary: '#10B981',
          accent: '#F59E0B',
          background: '#ffffff',
          text: '#1a1a1a'
        },
        typography: {
          fontFamily: 'Cairo, sans-serif',
          headingFont: 'Tajawal, sans-serif'
        },
        layout: {
          headerStyle: 'modern',
          footerStyle: 'detailed',
          productCardStyle: 'modern'
        }
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
    console.log(`   Sections: ${woodmartContent.sections.length}`);
    console.log(`   Status: ${template.isActive ? 'Active ✅' : 'Inactive'}\n`);

    console.log('🎉 WoodMart Fashion template is ready!\n');
    console.log('💡 You can now view it at: /settings/homepage\n');

  } catch (error) {
    console.error('❌ Error creating template:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createWoodMartTemplate();
