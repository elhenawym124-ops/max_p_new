const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function createCompleteWoodMart() {
  const prisma = new PrismaClient();

  try {
    console.log('🎨 Creating Complete WoodMart Fashion Flat Template...\n');

    const companyId = 'cmem8ayyr004cufakqkcsyn97'; // شركة التسويق

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      console.error('❌ Company not found!');
      process.exit(1);
    }

    console.log(`📊 Company: ${company.name}\n`);

    // Deactivate all existing templates
    await prisma.homepageTemplate.updateMany({
      where: { companyId },
      data: { isActive: false }
    });

    // Complete WoodMart Fashion Flat Template
    const completeTemplate = {
      sections: [
        // 1. Main Hero Slider with Multiple Slides
        {
          id: 'hero-main-slider',
          type: 'hero',
          variant: 'slider',
          autoplay: true,
          autoplaySpeed: 5000,
          slides: [
            {
              id: 'slide-1',
              title: 'مجموعة الربيع الجديدة',
              subtitle: 'خصم يصل إلى 50% على جميع المنتجات',
              buttonText: 'تسوق الآن',
              buttonLink: '/shop',
              backgroundImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1920&q=80',
              textAlign: 'left',
              textColor: '#ffffff',
              overlayOpacity: 0.3
            },
            {
              id: 'slide-2',
              title: 'أحدث صيحات الموضة',
              subtitle: 'اكتشف مجموعتنا الحصرية',
              buttonText: 'اكتشف المزيد',
              buttonLink: '/shop/new',
              backgroundImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1920&q=80',
              textAlign: 'center',
              textColor: '#ffffff',
              overlayOpacity: 0.4
            },
            {
              id: 'slide-3',
              title: 'إكسسوارات فاخرة',
              subtitle: 'أكمل إطلالتك بلمسة أنيقة',
              buttonText: 'تسوق الإكسسوارات',
              buttonLink: '/shop/accessories',
              backgroundImage: 'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=1920&q=80',
              textAlign: 'right',
              textColor: '#ffffff',
              overlayOpacity: 0.35
            }
          ]
        },

        // 2. Category Banners - 3 Columns
        {
          id: 'category-banners',
          type: 'custom',
          customType: 'category-banners',
          title: '',
          layout: 'three-columns',
          items: [
            {
              title: 'ملابس نسائية',
              subtitle: 'مجموعة حصرية',
              image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80',
              link: '/shop/women',
              buttonText: 'تسوق الآن',
              overlay: true
            },
            {
              title: 'ملابس رجالية',
              subtitle: 'أناقة عصرية',
              image: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=800&q=80',
              link: '/shop/men',
              buttonText: 'تسوق الآن',
              overlay: true
            },
            {
              title: 'إكسسوارات',
              subtitle: 'لمسة نهائية',
              image: 'https://images.unsplash.com/photo-1509941943102-10c232535736?w=800&q=80',
              link: '/shop/accessories',
              buttonText: 'تسوق الآن',
              overlay: true
            }
          ]
        },

        // 3. Featured Products with Tabs
        {
          id: 'featured-products-tabs',
          type: 'products',
          title: 'منتجاتنا المميزة',
          variant: 'tabs',
          tabs: [
            {
              id: 'featured',
              label: 'مميزة',
              filter: 'featured'
            },
            {
              id: 'bestseller',
              label: 'الأكثر مبيعاً',
              filter: 'bestseller'
            },
            {
              id: 'new',
              label: 'جديد',
              filter: 'new'
            },
            {
              id: 'sale',
              label: 'تخفيضات',
              filter: 'sale'
            }
          ],
          layout: 'grid',
          columns: 4,
          rows: 2,
          limit: 8,
          showQuickView: true,
          showWishlist: true,
          showCompare: true,
          showRating: true,
          showBadges: true,
          hoverEffect: 'zoom'
        },

        // 4. Large Promo Banner
        {
          id: 'promo-banner-large',
          type: 'banner',
          variant: 'full-width',
          title: 'عرض خاص لفترة محدودة',
          subtitle: 'خصم يصل إلى 70% على مجموعة مختارة',
          buttonText: 'تسوق العروض',
          buttonLink: '/offers',
          backgroundImage: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1920&q=80',
          backgroundColor: '#000000',
          textColor: '#ffffff',
          height: 'large',
          textAlign: 'center',
          overlay: true,
          overlayOpacity: 0.5,
          countdown: {
            enabled: true,
            endDate: '2024-12-31T23:59:59'
          }
        },

        // 5. Two Column Banners
        {
          id: 'two-column-banners',
          type: 'custom',
          customType: 'split-banners',
          layout: 'two-columns',
          items: [
            {
              title: 'مجموعة الصيف',
              subtitle: 'خصم 40%',
              image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1000&q=80',
              link: '/shop/summer',
              buttonText: 'اكتشف المزيد',
              textAlign: 'left',
              textColor: '#ffffff'
            },
            {
              title: 'أحذية رياضية',
              subtitle: 'تشكيلة جديدة',
              image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000&q=80',
              link: '/shop/shoes',
              buttonText: 'تسوق الآن',
              textAlign: 'right',
              textColor: '#ffffff'
            }
          ]
        },

        // 6. New Arrivals
        {
          id: 'new-arrivals',
          type: 'products',
          title: 'وصل حديثاً',
          subtitle: 'أحدث المنتجات في متجرنا',
          displayType: 'new',
          layout: 'carousel',
          columns: 5,
          limit: 10,
          autoplay: true,
          autoplaySpeed: 3000,
          showQuickView: true,
          showWishlist: true,
          showTimer: true,
          showBadges: true
        },

        // 7. Features Section
        {
          id: 'features-modern',
          type: 'features',
          variant: 'modern',
          backgroundColor: '#f8f9fa',
          items: [
            {
              icon: 'truck',
              iconType: 'outline',
              title: 'شحن مجاني',
              description: 'للطلبات فوق 500 جنيه',
              iconColor: '#4F46E5',
              link: '/shipping-info'
            },
            {
              icon: 'shield-check',
              iconType: 'outline',
              title: 'دفع آمن 100%',
              description: 'معاملات مشفرة',
              iconColor: '#10B981',
              link: '/payment-security'
            },
            {
              icon: 'clock',
              iconType: 'outline',
              title: 'دعم 24/7',
              description: 'نحن هنا لمساعدتك',
              iconColor: '#F59E0B',
              link: '/support'
            },
            {
              icon: 'arrow-path',
              iconType: 'outline',
              title: 'إرجاع سهل',
              description: 'خلال 30 يوم',
              iconColor: '#EF4444',
              link: '/returns'
            },
            {
              icon: 'gift',
              iconType: 'outline',
              title: 'هدايا مجانية',
              description: 'مع كل طلب',
              iconColor: '#8B5CF6',
              link: '/gifts'
            }
          ]
        },

        // 8. Trending Products
        {
          id: 'trending-products',
          type: 'products',
          title: 'المنتجات الرائجة',
          subtitle: 'الأكثر طلباً هذا الأسبوع',
          displayType: 'trending',
          layout: 'grid',
          columns: 4,
          limit: 8,
          showQuickView: true,
          showWishlist: true,
          showCompare: true,
          showSoldCount: true
        },

        // 9. Instagram Feed
        {
          id: 'instagram-feed',
          type: 'custom',
          customType: 'instagram',
          title: 'تابعنا على Instagram',
          subtitle: '@yourstore - شارك صورك معنا',
          layout: 'grid',
          columns: 6,
          showFollowButton: true,
          hashtag: '#yourstore',
          images: [
            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80',
            'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=400&q=80',
            'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&q=80',
            'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=400&q=80',
            'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80',
            'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80'
          ]
        },

        // 10. Brand Logos Carousel
        {
          id: 'brands-carousel',
          type: 'custom',
          customType: 'brands',
          title: 'العلامات التجارية الشريكة',
          layout: 'carousel',
          autoplay: true,
          autoplaySpeed: 2000,
          showArrows: false,
          showDots: false,
          grayscale: true,
          brands: [
            { name: 'Nike', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg' },
            { name: 'Adidas', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg' },
            { name: 'Puma', logo: 'https://upload.wikimedia.org/wikipedia/en/4/49/Puma_AG_Logo.svg' },
            { name: 'Zara', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Zara_Logo.svg' },
            { name: 'H&M', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/53/H%26M-Logo.svg' }
          ]
        },

        // 11. Customer Reviews
        {
          id: 'customer-reviews',
          type: 'testimonials',
          title: 'ماذا يقول عملاؤنا',
          subtitle: 'آراء حقيقية من عملاء راضين',
          layout: 'carousel',
          variant: 'modern',
          showRating: true,
          showAvatar: true,
          showDate: true,
          autoplay: true,
          items: [
            {
              name: 'سارة أحمد',
              role: 'عميلة مميزة',
              rating: 5,
              comment: 'تجربة تسوق رائعة! المنتجات عالية الجودة والتوصيل كان سريع جداً. بالتأكيد سأطلب مرة أخرى.',
              avatar: 'https://i.pravatar.cc/150?img=1',
              date: '2024-01-15',
              verified: true
            },
            {
              name: 'محمد علي',
              role: 'عميل دائم',
              rating: 5,
              comment: 'أفضل متجر إلكتروني تعاملت معه. الأسعار ممتازة والخدمة احترافية للغاية.',
              avatar: 'https://i.pravatar.cc/150?img=2',
              date: '2024-01-10',
              verified: true
            },
            {
              name: 'فاطمة حسن',
              role: 'عميلة جديدة',
              rating: 4,
              comment: 'منتجات رائعة ومطابقة للوصف. التعامل مع خدمة العملاء كان ممتاز.',
              avatar: 'https://i.pravatar.cc/150?img=3',
              date: '2024-01-05',
              verified: true
            },
            {
              name: 'أحمد خالد',
              role: 'عميل مميز',
              rating: 5,
              comment: 'جودة عالية وأسعار منافسة. أنصح الجميع بالتسوق من هنا.',
              avatar: 'https://i.pravatar.cc/150?img=4',
              date: '2024-01-01',
              verified: true
            }
          ]
        },

        // 12. Blog Posts
        {
          id: 'blog-posts',
          type: 'custom',
          customType: 'blog',
          title: 'أحدث المقالات',
          subtitle: 'نصائح وأخبار الموضة',
          layout: 'grid',
          columns: 3,
          showDate: true,
          showAuthor: true,
          showExcerpt: true,
          posts: [
            {
              title: 'أحدث صيحات الموضة لربيع 2024',
              excerpt: 'اكتشف أهم الترندات والألوان الرائجة هذا الموسم',
              image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80',
              author: 'فريق التحرير',
              date: '2024-01-20',
              category: 'موضة',
              link: '/blog/spring-2024-trends'
            },
            {
              title: 'كيف تختار الملابس المناسبة لشكل جسمك',
              excerpt: 'دليل شامل لاختيار الملابس التي تناسبك',
              image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80',
              author: 'سارة محمد',
              date: '2024-01-18',
              category: 'نصائح',
              link: '/blog/body-shape-guide'
            },
            {
              title: 'العناية بالملابس: نصائح للحفاظ على جودتها',
              excerpt: 'طرق فعالة للعناية بملابسك وإطالة عمرها',
              image: 'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=600&q=80',
              author: 'أحمد علي',
              date: '2024-01-15',
              category: 'عناية',
              link: '/blog/clothing-care-tips'
            }
          ]
        },

        // 13. Newsletter Subscription
        {
          id: 'newsletter',
          type: 'custom',
          customType: 'newsletter',
          variant: 'modern',
          title: 'اشترك في نشرتنا البريدية',
          subtitle: 'احصل على آخر العروض والتحديثات مباشرة في بريدك',
          backgroundColor: '#4F46E5',
          textColor: '#ffffff',
          placeholder: 'أدخل بريدك الإلكتروني',
          buttonText: 'اشترك الآن',
          showPrivacyNote: true,
          privacyText: 'نحترم خصوصيتك ولن نشارك بياناتك مع أطراف ثالثة',
          showSocialLinks: true,
          socialLinks: [
            { platform: 'facebook', url: 'https://facebook.com/yourstore' },
            { platform: 'instagram', url: 'https://instagram.com/yourstore' },
            { platform: 'twitter', url: 'https://twitter.com/yourstore' },
            { platform: 'youtube', url: 'https://youtube.com/yourstore' }
          ],
          benefits: [
            'خصومات حصرية للمشتركين',
            'أولوية الوصول للمنتجات الجديدة',
            'نصائح موضة أسبوعية',
            'هدايا مجانية'
          ]
        }
      ],

      // Advanced Settings
      settings: {
        containerWidth: 'full',
        spacing: 'normal',
        animation: true,
        lazyLoad: true,
        stickyHeader: true,
        showBreadcrumbs: true,
        
        // Color Scheme
        colorScheme: {
          primary: '#4F46E5',
          secondary: '#10B981',
          accent: '#F59E0B',
          background: '#ffffff',
          text: '#1a1a1a',
          border: '#e5e7eb',
          muted: '#6b7280'
        },

        // Typography
        typography: {
          fontFamily: 'Cairo, sans-serif',
          headingFont: 'Tajawal, sans-serif',
          fontSize: {
            base: '16px',
            h1: '48px',
            h2: '36px',
            h3: '28px',
            h4: '24px'
          }
        },

        // Layout
        layout: {
          headerStyle: 'modern',
          footerStyle: 'detailed',
          productCardStyle: 'modern',
          buttonStyle: 'rounded',
          inputStyle: 'rounded'
        },

        // Performance
        performance: {
          lazyLoadImages: true,
          deferNonCriticalCSS: true,
          minifyHTML: true,
          enableCaching: true
        },

        // SEO
        seo: {
          metaTitle: 'متجر الموضة العصرية - أفضل الأسعار والجودة',
          metaDescription: 'اكتشف أحدث صيحات الموضة بأفضل الأسعار. شحن مجاني، دفع آمن، وإرجاع سهل.',
          metaKeywords: 'موضة، ملابس، تسوق أونلاين، أزياء'
        }
      }
    };

    // Create the template
    const template = await prisma.homepageTemplate.create({
      data: {
        name: 'WoodMart Fashion - Complete',
        description: 'تصميم كامل ومتقدم مستوحى من WoodMart Fashion Flat مع جميع الميزات والصور عالية الجودة',
        content: JSON.stringify(completeTemplate),
        thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
        companyId,
        isActive: true
      }
    });

    console.log('✅ Complete Template Created Successfully!\n');
    console.log('📋 Template Details:');
    console.log(`   ID: ${template.id}`);
    console.log(`   Name: ${template.name}`);
    console.log(`   Company: ${company.name}`);
    console.log(`   Sections: ${completeTemplate.sections.length}`);
    console.log(`   Status: Active ✅\n`);

    console.log('🎨 Template Includes:');
    console.log('   ✅ Hero Slider (3 slides)');
    console.log('   ✅ Category Banners (3 columns)');
    console.log('   ✅ Featured Products with Tabs');
    console.log('   ✅ Large Promo Banner with Countdown');
    console.log('   ✅ Two Column Banners');
    console.log('   ✅ New Arrivals Carousel');
    console.log('   ✅ Features Section (5 features)');
    console.log('   ✅ Trending Products');
    console.log('   ✅ Instagram Feed (6 images)');
    console.log('   ✅ Brand Logos Carousel');
    console.log('   ✅ Customer Reviews (4 reviews)');
    console.log('   ✅ Blog Posts (3 articles)');
    console.log('   ✅ Newsletter Subscription\n');

    console.log('🎉 Template is Ready!\n');
    console.log('💡 Next Steps:');
    console.log('   1. Refresh your browser (F5)');
    console.log('   2. Go to: /settings/homepage');
    console.log('   3. View the new template');
    console.log('   4. Click "معاينة" to see the full design\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createCompleteWoodMart();
