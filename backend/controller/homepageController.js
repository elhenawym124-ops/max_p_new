const { PrismaClient } = require('@prisma/client');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

/**
 * Homepage Controller
 * Handles homepage templates and settings management
 */

// Helper function to get Prisma client
function getPrisma() {
  return getSharedPrismaClient();
}

// ============ Homepage Templates ============

/**
 * Get all homepage templates for a company
 */
exports.getHomepageTemplates = async (req, res) => {
  try {
    const { companyId } = req.user;
    const prisma = getPrisma();

    const templates = await prisma.homepageTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching homepage templates:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب قوالب الصفحة الرئيسية',
      error: error.message
    });
  }
};

/**
 * Get active homepage template
 */
exports.getActiveHomepage = async (req, res) => {
  try {
    const { companyId } = req.user;
    const prisma = getPrisma();

    const activeTemplate = await prisma.homepageTemplate.findFirst({
      where: { 
        companyId,
        isActive: true 
      }
    });

    if (!activeTemplate) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد صفحة رئيسية نشطة'
      });
    }

    res.json({
      success: true,
      data: activeTemplate
    });
  } catch (error) {
    console.error('Error fetching active homepage:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الصفحة الرئيسية النشطة',
      error: error.message
    });
  }
};

/**
 * Get public active homepage (for storefront)
 * PUBLIC ROUTE - NO AUTHENTICATION REQUIRED
 */
exports.getPublicActiveHomepage = async (req, res) => {
  console.log('🏠 [PUBLIC-HOMEPAGE] ===== Request Received =====');
  console.log('🏠 [PUBLIC-HOMEPAGE] URL:', req.url);
  console.log('🏠 [PUBLIC-HOMEPAGE] Method:', req.method);
  console.log('🏠 [PUBLIC-HOMEPAGE] Params:', req.params);
  console.log('🏠 [PUBLIC-HOMEPAGE] Headers:', req.headers);
  
  try {
    const { companyId } = req.params;
    console.log('🏠 [PUBLIC-HOMEPAGE] Company ID:', companyId);
    
    const prisma = getPrisma();

    const activeTemplate = await prisma.homepageTemplate.findFirst({
      where: { 
        companyId,
        isActive: true 
      }
    });

    console.log('🏠 [PUBLIC-HOMEPAGE] Active template found:', !!activeTemplate);

    if (!activeTemplate) {
      console.log('🏠 [PUBLIC-HOMEPAGE] No active template - returning 404');
      return res.status(404).json({
        success: false,
        message: 'لا توجد صفحة رئيسية نشطة'
      });
    }

    console.log('🏠 [PUBLIC-HOMEPAGE] Returning template:', activeTemplate.name);
    res.json({
      success: true,
      data: activeTemplate
    });
  } catch (error) {
    console.error('❌ [PUBLIC-HOMEPAGE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الصفحة الرئيسية',
      error: error.message
    });
  }
};

/**
 * Create new homepage template
 */
exports.createHomepageTemplate = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { name, description, content, thumbnail, isActive } = req.body;

    if (!name || !content) {
      return res.status(400).json({
        success: false,
        message: 'الاسم والمحتوى مطلوبان'
      });
    }

    const prisma = getPrisma();

    // If this template should be active, deactivate all others
    if (isActive) {
      await prisma.homepageTemplate.updateMany({
        where: { companyId },
        data: { isActive: false }
      });
    }

    const template = await prisma.homepageTemplate.create({
      data: {
        name,
        description,
        content: JSON.stringify(content),
        thumbnail,
        companyId,
        isActive: isActive || false
      }
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء القالب بنجاح',
      data: {
        ...template,
        content: JSON.parse(template.content)
      }
    });
  } catch (error) {
    console.error('Error creating homepage template:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إنشاء القالب',
      error: error.message
    });
  }
};

/**
 * Update homepage template
 */
exports.updateHomepageTemplate = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;
    const { name, description, content, thumbnail, isActive } = req.body;

    const prisma = getPrisma();
    
    // Verify template belongs to company
    const existingTemplate = await prisma.homepageTemplate.findFirst({
      where: { id, companyId }
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'القالب غير موجود'
      });
    }

    // If this template should be active, deactivate all others
    if (isActive && !existingTemplate.isActive) {
      await prisma.homepageTemplate.updateMany({
        where: { 
          companyId,
          id: { not: id }
        },
        data: { isActive: false }
      });
    }

    const template = await prisma.homepageTemplate.update({
      where: { id },
      data: {
        name,
        description,
        content: content ? JSON.stringify(content) : undefined,
        thumbnail,
        isActive
      }
    });

    res.json({
      success: true,
      message: 'تم تحديث القالب بنجاح',
      data: {
        ...template,
        content: JSON.parse(template.content)
      }
    });
  } catch (error) {
    console.error('Error updating homepage template:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث القالب',
      error: error.message
    });
  }
};

/**
 * Set active homepage template
 */
exports.setActiveHomepage = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const prisma = getPrisma();
    
    // Verify template belongs to company
    const existingTemplate = await prisma.homepageTemplate.findFirst({
      where: { id, companyId }
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'القالب غير موجود'
      });
    }

    // Deactivate all templates
    await prisma.homepageTemplate.updateMany({
      where: { companyId },
      data: { isActive: false }
    });

    // Activate selected template
    const template = await prisma.homepageTemplate.update({
      where: { id },
      data: { isActive: true }
    });

    res.json({
      success: true,
      message: 'تم تفعيل الصفحة الرئيسية بنجاح',
      data: {
        ...template,
        content: JSON.parse(template.content)
      }
    });
  } catch (error) {
    console.error('Error setting active homepage:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تفعيل الصفحة الرئيسية',
      error: error.message
    });
  }
};

/**
 * Duplicate homepage template
 */
exports.duplicateHomepageTemplate = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const prisma = getPrisma();
    
    // Verify template belongs to company
    const existingTemplate = await prisma.homepageTemplate.findFirst({
      where: { id, companyId }
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'القالب غير موجود'
      });
    }

    // Create duplicate
    const template = await prisma.homepageTemplate.create({
      data: {
        name: `${existingTemplate.name} (نسخة)`,
        description: existingTemplate.description,
        content: existingTemplate.content,
        thumbnail: existingTemplate.thumbnail,
        companyId,
        isActive: false
      }
    });

    res.status(201).json({
      success: true,
      message: 'تم نسخ القالب بنجاح',
      data: {
        ...template,
        content: JSON.parse(template.content)
      }
    });
  } catch (error) {
    console.error('Error duplicating homepage template:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في نسخ القالب',
      error: error.message
    });
  }
};

/**
 * Delete homepage template
 */
exports.deleteHomepageTemplate = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const prisma = getPrisma();
    
    // Verify template belongs to company
    const existingTemplate = await prisma.homepageTemplate.findFirst({
      where: { id, companyId }
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'القالب غير موجود'
      });
    }

    // Don't allow deleting active template
    if (existingTemplate.isActive) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن حذف الصفحة الرئيسية النشطة. قم بتفعيل صفحة أخرى أولاً'
      });
    }

    await prisma.homepageTemplate.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'تم حذف القالب بنجاح'
    });
  } catch (error) {
    console.error('Error deleting homepage template:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف القالب',
      error: error.message
    });
  }
};

/**
 * Create default demo template for a company
 */
exports.createDemoTemplate = async (req, res) => {
  try {
    const { companyId } = req.user;
    const prisma = getPrisma();

    // Check if demo already exists
    const existingDemo = await prisma.homepageTemplate.findFirst({
      where: { 
        companyId,
        name: 'PressMart - Modern Demo'
      }
    });

    if (existingDemo) {
      return res.status(400).json({
        success: false,
        message: 'القالب التجريبي موجود بالفعل'
      });
    }

    // Deactivate all templates if this is the first one
    const templatesCount = await prisma.homepageTemplate.count({
      where: { companyId }
    });

    const isFirstTemplate = templatesCount === 0;

    if (isFirstTemplate) {
      await prisma.homepageTemplate.updateMany({
        where: { companyId },
        data: { isActive: false }
      });
    }

    // Create demo template with modern design
    const demoContent = {
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'مرحباً بك في متجرنا الإلكتروني',
          subtitle: 'اكتشف أفضل المنتجات بأسعار مميزة',
          buttonText: 'تسوق الآن',
          buttonLink: '/shop',
          backgroundImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
          overlayOpacity: 0.5
        },
        {
          id: 'features',
          type: 'features',
          title: 'لماذا تختارنا؟',
          items: [
            {
              icon: 'truck',
              title: 'شحن سريع',
              description: 'توصيل سريع لجميع المحافظات'
            },
            {
              icon: 'shield',
              title: 'دفع آمن',
              description: 'معاملات آمنة ومشفرة'
            },
            {
              icon: 'support',
              title: 'دعم 24/7',
              description: 'فريق دعم متاح دائماً'
            },
            {
              icon: 'return',
              title: 'إرجاع مجاني',
              description: 'سياسة إرجاع مرنة'
            }
          ]
        },
        {
          id: 'products',
          type: 'products',
          title: 'منتجاتنا المميزة',
          displayType: 'featured',
          limit: 8
        },
        {
          id: 'banner',
          type: 'banner',
          title: 'عرض خاص',
          subtitle: 'خصم يصل إلى 50% على منتجات مختارة',
          buttonText: 'اكتشف العروض',
          buttonLink: '/offers',
          backgroundImage: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da',
          backgroundColor: '#4F46E5'
        },
        {
          id: 'categories',
          type: 'categories',
          title: 'تسوق حسب الفئة',
          displayStyle: 'grid'
        },
        {
          id: 'testimonials',
          type: 'testimonials',
          title: 'آراء عملائنا',
          items: [
            {
              name: 'أحمد محمد',
              rating: 5,
              comment: 'منتجات رائعة وخدمة ممتازة',
              avatar: ''
            },
            {
              name: 'فاطمة علي',
              rating: 5,
              comment: 'تجربة تسوق مميزة',
              avatar: ''
            },
            {
              name: 'محمود حسن',
              rating: 4,
              comment: 'سرعة في التوصيل',
              avatar: ''
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

    const template = await prisma.homepageTemplate.create({
      data: {
        name: 'PressMart - Modern Demo',
        description: 'قالب حديث وعصري مستوحى من PressMart مع تصميم احترافي وسهل التعديل',
        content: JSON.stringify(demoContent),
        thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
        companyId,
        isActive: isFirstTemplate
      }
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء القالب التجريبي بنجاح',
      data: {
        ...template,
        content: JSON.parse(template.content)
      }
    });
  } catch (error) {
    console.error('Error creating demo template:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إنشاء القالب التجريبي',
      error: error.message
    });
  }
};
