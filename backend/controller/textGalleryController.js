const { getSharedPrismaClient } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();

/**
 * 📥 الحصول على جميع النصوص المحفوظة للمستخدم
 * GET /user/text-gallery
 */
const getTextGallery = async (req, res) => {
  try {
    // ✅ التحقق من وجود user authentication
    // Support both userId (from verifyToken) and id (from requireAuth)
    const userId = req.user?.userId || req.user?.id;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      console.error('❌ Missing user authentication in GET:', {
        hasUser: !!req.user,
        userId,
        companyId,
        userObject: req.user
      });
      return res.status(401).json({
        success: false,
        message: 'المصادقة مطلوبة'
      });
    }

    const texts = await prisma.textGallery.findMany({
      where: {
        userId: userId,
        companyId: companyId
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        content: true,
        imageUrls: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // تنسيق البيانات للفرونت إند
    const formattedTexts = texts.map(text => ({
      id: text.id,
      title: text.title || 'بدون عنوان',
      content: text.content,
      imageUrls: text.imageUrls || [],
      createdAt: text.createdAt,
      updatedAt: text.updatedAt
    }));

    res.status(200).json({
      success: true,
      texts: formattedTexts
    });
  } catch (error) {
    console.error('❌ Error loading text gallery:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحميل النصوص'
    });
  }
};

/**
 * ➕ حفظ نص جديد في الحافظة
 * POST /user/text-gallery
 */
const saveTextToGallery = async (req, res) => {
  try {
    // ✅ التحقق من وجود user authentication
    // Support both userId (from verifyToken) and id (from requireAuth)
    const userId = req.user?.userId || req.user?.id;
    const companyId = req.user?.companyId;
    const { title, content, imageUrls } = req.body;

    console.log('📥 Saving text to gallery:', {
      userId,
      companyId,
      title,
      contentLength: content?.length,
      imageUrlsCount: imageUrls?.length || 0
    });

    if (!userId || !companyId) {
      console.error('❌ Missing user authentication in POST:', {
        hasUser: !!req.user,
        userId,
        companyId,
        userObject: req.user
      });
      return res.status(401).json({
        success: false,
        message: 'المصادقة مطلوبة'
      });
    }

    // التحقق من البيانات المطلوبة (يجب أن يكون هناك نص أو صور على الأقل)
    if ((!content || content.trim().length === 0) && (!imageUrls || imageUrls.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'يجب إدخال محتوى النص أو إرفاق صور على الأقل'
      });
    }

    // حفظ النص الجديد مع الصور
    const newText = await prisma.textGallery.create({
      data: {
        userId: userId,
        companyId: companyId,
        title: title || null,
        content: content?.trim() || null,
        imageUrls: imageUrls && imageUrls.length > 0 ? imageUrls : null
      }
    });

    res.status(201).json({
      success: true,
      message: 'تم حفظ النص بنجاح',
      text: {
        id: newText.id,
        title: newText.title || 'بدون عنوان',
        content: newText.content,
        imageUrls: newText.imageUrls || [],
        createdAt: newText.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Error saving text to gallery:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حفظ النص'
    });
  }
};

/**
 * ✏️ تعديل نص في الحافظة
 * PUT /user/text-gallery/:id
 */
const updateTextInGallery = async (req, res) => {
  try {
    // ✅ التحقق من وجود user authentication
    const userId = req.user?.userId || req.user?.id;
    const companyId = req.user?.companyId;
    const textId = req.params.id;
    const { title, content, imageUrls } = req.body;

    if (!userId || !companyId) {
      return res.status(401).json({
        success: false,
        message: 'المصادقة مطلوبة'
      });
    }

    // التحقق من البيانات المطلوبة (يجب أن يكون هناك نص أو صور على الأقل)
    if ((!content || content.trim().length === 0) && (!imageUrls || imageUrls.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'يجب إدخال محتوى النص أو إرفاق صور على الأقل'
      });
    }

    // التحقق من أن النص يخص المستخدم
    const text = await prisma.textGallery.findFirst({
      where: {
        id: textId,
        userId: userId,
        companyId: companyId
      }
    });

    if (!text) {
      return res.status(404).json({
        success: false,
        message: 'النص غير موجود'
      });
    }

    // تحديث النص
    const updatedText = await prisma.textGallery.update({
      where: {
        id: textId
      },
      data: {
        title: title || null,
        content: content?.trim() || null,
        imageUrls: imageUrls && imageUrls.length > 0 ? imageUrls : null,
        updatedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'تم تحديث النص بنجاح',
      text: {
        id: updatedText.id,
        title: updatedText.title || 'بدون عنوان',
        content: updatedText.content,
        imageUrls: updatedText.imageUrls || [],
        updatedAt: updatedText.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Error updating text in gallery:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث النص'
    });
  }
};

/**
 * 🗑️ حذف نص من الحافظة
 * DELETE /user/text-gallery/:id
 */
const deleteTextFromGallery = async (req, res) => {
  try {
    // ✅ التحقق من وجود user authentication
    // Support both userId (from verifyToken) and id (from requireAuth)
    const userId = req.user?.userId || req.user?.id;
    const companyId = req.user?.companyId;
    const textId = req.params.id;

    if (!userId || !companyId) {
      return res.status(401).json({
        success: false,
        message: 'المصادقة مطلوبة'
      });
    }

    // التحقق من أن النص يخص المستخدم
    const text = await prisma.textGallery.findFirst({
      where: {
        id: textId,
        userId: userId,
        companyId: companyId
      }
    });

    if (!text) {
      return res.status(404).json({
        success: false,
        message: 'النص غير موجود'
      });
    }

    // حذف النص
    await prisma.textGallery.delete({
      where: {
        id: textId
      }
    });

    res.status(200).json({
      success: true,
      message: 'تم حذف النص بنجاح'
    });
  } catch (error) {
    console.error('❌ Error deleting text from gallery:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف النص'
    });
  }
};

module.exports = {
  getTextGallery,
  saveTextToGallery,
  updateTextInGallery,
  deleteTextFromGallery
};

