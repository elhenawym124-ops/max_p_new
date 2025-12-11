const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('../services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
const axios = require('axios');

const getAllCustomer = async (req, res) => {
  try {
    // التحقق من المصادقة والشركة
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    //console.log('👥 Fetching customers for company:', companyId);

    const customers = await getSharedPrismaClient().customer.findMany({
      where: { companyId }, // فلترة بـ companyId
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({
      success: true,
      data: customers,
      message: `تم جلب ${customers.length} عميل للشركة`
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب العملاء'
    });
  }
};

const deleteAllConversations = async (req, res) => {
  try {
    const deleted = await getSharedPrismaClient().conversation.deleteMany({});

    res.json({
      success: true,
      deletedCount: deleted.count,
      message: `تم مسح ${deleted.count} محادثة`
    });
  } catch (error) {
    console.error('❌ Error deleting conversations:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في مسح المحادثات'
    });
  }
};

// 🗑️ مسح كل العملاء بدون فلترة
const deleteAllCustomers = async (req, res) => {
  try {
    const deleted = await getSharedPrismaClient().customer.deleteMany({});

    res.json({
      success: true,
      deletedCount: deleted.count,
      message: `تم مسح ${deleted.count} عميل`
    });
  } catch (error) {
    console.error('❌ Error deleting customers:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في مسح العملاء'
    });
  }
};


// 🚫 حظر عميل على صفحة فيس بوك معينة
const blockCustomerOnPage = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { customerId, pageId, reason } = req.body;

    if (!customerId || !pageId) {
      return res.status(400).json({
        success: false,
        message: 'معرف العميل ومعرف الصفحة مطلوبان'
      });
    }

    // التحقق من وجود العميل والشركة
    const customer = await getSharedPrismaClient().customer.findUnique({
      where: { id: customerId },
      select: { id: true, companyId: true, facebookId: true }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'العميل غير موجود'
      });
    }

    if (customer.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذا العميل'
      });
    }

    // التحقق من وجود صفحة الفيس بوك
    const facebookPage = await getSharedPrismaClient().facebookPage.findUnique({
      where: { pageId: pageId },
      select: { id: true, companyId: true, pageAccessToken: true }
    });

    if (!facebookPage) {
      return res.status(404).json({
        success: false,
        message: 'صفحة الفيس بوك غير موجودة'
      });
    }

    if (facebookPage.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذه الصفحة'
      });
    }

    // التحقق من عدم وجود حظر سابق
    const existingBlock = await getSharedPrismaClient().blockedCustomerOnPage.findFirst({
      where: {
        facebookPageId: facebookPage.id,
        customerId: customerId
      }
    });

    if (existingBlock) {
      return res.status(400).json({
        success: false,
        message: 'العميل محظور بالفعل على هذه الصفحة'
      });
    }

    // 🚫 التواصل مع Facebook API لحظر المستخدم من الصفحة مباشرة
    let facebookBlockResult = null;
    const facebookUserId = customer.facebookId || null;

    if (facebookUserId && facebookPage.pageAccessToken) {
      try {
        console.log(`🚫 [FB-API] Blocking user ${facebookUserId} on Facebook page ${pageId} via Graph API...`);

        // استخدام Facebook Graph API لحظر المستخدم
        const fbResponse = await axios.post(
          `https://graph.facebook.com/v18.0/${pageId}/blocked`,
          {
            user: facebookUserId
          },
          {
            params: {
              access_token: facebookPage.pageAccessToken
            },
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        facebookBlockResult = {
          success: true,
          facebookResponse: fbResponse.data
        };
        console.log(`✅ [FB-API] User blocked successfully on Facebook page:`, fbResponse.data);
      } catch (fbError) {
        console.error(`❌ [FB-API] Error blocking user on Facebook:`, fbError.response?.data || fbError.message);
        facebookBlockResult = {
          success: false,
          error: fbError.response?.data || fbError.message
        };
        // نستمر في حفظ الحظر في قاعدة البيانات حتى لو فشل Facebook API
      }
    } else {
      console.log(`⚠️ [FB-API] Cannot block on Facebook: missing facebookId (${!!facebookUserId}) or pageAccessToken (${!!facebookPage.pageAccessToken})`);
    }

    // إنشاء الحظر في قاعدة البيانات
    const blocked = await getSharedPrismaClient().blockedCustomerOnPage.create({
      data: {
        facebookPageId: facebookPage.id,
        pageId: pageId,
        customerId: customer.id,
        facebookId: customer.facebookId || '',
        blockedBy: userId || null,
        reason: reason || null,
        metadata: facebookBlockResult ? JSON.stringify(facebookBlockResult) : null // حفظ نتيجة Facebook API
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            facebookId: true
          }
        },
        facebookPage: {
          select: {
            pageId: true,
            pageName: true
          }
        }
      }
    });

    console.log(`🚫 [BLOCK] Customer ${customer.id} blocked on page ${pageId} by user ${userId}`);

    res.json({
      success: true,
      data: blocked,
      message: 'تم حظر العميل على الصفحة بنجاح'
    });
  } catch (error) {
    console.error('❌ Error blocking customer:', error);

    // معالجة أخطاء Prisma
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'العميل محظور بالفعل على هذه الصفحة'
      });
    }

    res.status(500).json({
      success: false,
      message: 'خطأ في حظر العميل',
      error: error.message
    });
  }
};

// ✅ إلغاء حظر عميل على صفحة فيس بوك معينة
const unblockCustomerOnPage = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { customerId, pageId } = req.body;

    if (!customerId || !pageId) {
      return res.status(400).json({
        success: false,
        message: 'معرف العميل ومعرف الصفحة مطلوبان'
      });
    }

    // التحقق من وجود صفحة الفيس بوك
    const facebookPage = await getSharedPrismaClient().facebookPage.findUnique({
      where: { pageId: pageId },
      select: { id: true, companyId: true, pageAccessToken: true }
    });

    if (!facebookPage) {
      return res.status(404).json({
        success: false,
        message: 'صفحة الفيس بوك غير موجودة'
      });
    }

    if (facebookPage.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذه الصفحة'
      });
    }

    // البحث عن الحظر وحذفه
    const blocked = await getSharedPrismaClient().blockedCustomerOnPage.findFirst({
      where: {
        facebookPageId: facebookPage.id,
        customerId: customerId
      },
      include: {
        customer: {
          select: {
            facebookId: true
          }
        }
      }
    });

    if (!blocked) {
      return res.status(404).json({
        success: false,
        message: 'العميل غير محظور على هذه الصفحة'
      });
    }

    // ✅ التواصل مع Facebook API لإلغاء حظر المستخدم من الصفحة مباشرة
    const facebookUserId = blocked.customer?.facebookId || blocked.facebookId;
    let facebookUnblockResult = null;

    if (facebookUserId && facebookPage.pageAccessToken) {
      try {
        console.log(`✅ [FB-API] Unblocking user ${facebookUserId} on Facebook page ${pageId} via Graph API...`);

        // استخدام Facebook Graph API لإلغاء حظر المستخدم
        const fbResponse = await axios.delete(
          `https://graph.facebook.com/v18.0/${pageId}/blocked/${facebookUserId}`,
          {
            params: {
              access_token: facebookPage.pageAccessToken
            },
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        facebookUnblockResult = {
          success: true,
          facebookResponse: fbResponse.data
        };
        console.log(`✅ [FB-API] User unblocked successfully on Facebook page`);
      } catch (fbError) {
        console.error(`❌ [FB-API] Error unblocking user on Facebook:`, fbError.response?.data || fbError.message);
        facebookUnblockResult = {
          success: false,
          error: fbError.response?.data || fbError.message
        };
        // نستمر في حذف الحظر من قاعدة البيانات حتى لو فشل Facebook API
      }
    } else {
      console.log(`⚠️ [FB-API] Cannot unblock on Facebook: missing facebookId (${!!facebookUserId}) or pageAccessToken (${!!facebookPage.pageAccessToken})`);
    }

    // حذف الحظر من قاعدة البيانات
    await getSharedPrismaClient().blockedCustomerOnPage.delete({
      where: { id: blocked.id }
    });

    console.log(`✅ [UNBLOCK] Customer ${customerId} unblocked on page ${pageId}`);

    res.json({
      success: true,
      message: 'تم إلغاء حظر العميل على الصفحة بنجاح'
    });
  } catch (error) {
    console.error('❌ Error unblocking customer:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إلغاء حظر العميل',
      error: error.message
    });
  }
};

// 📋 جلب قائمة العملاء المحظورين على صفحة معينة
const getBlockedCustomersOnPage = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { pageId } = req.params;

    if (!pageId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الصفحة مطلوب'
      });
    }

    // التحقق من وجود صفحة الفيس بوك
    const facebookPage = await getSharedPrismaClient().facebookPage.findUnique({
      where: { pageId: pageId },
      select: { id: true, companyId: true }
    });

    if (!facebookPage) {
      return res.status(404).json({
        success: false,
        message: 'صفحة الفيس بوك غير موجودة'
      });
    }

    if (facebookPage.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذه الصفحة'
      });
    }

    // جلب العملاء المحظورين
    const blockedCustomers = await getSharedPrismaClient().blockedCustomerOnPage.findMany({
      where: {
        facebookPageId: facebookPage.id
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            facebookId: true,
            avatar: true
          }
        }
      },
      orderBy: {
        blockedAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: blockedCustomers,
      count: blockedCustomers.length,
      message: `تم جلب ${blockedCustomers.length} عميل محظور`
    });
  } catch (error) {
    console.error('❌ Error fetching blocked customers:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب العملاء المحظورين',
      error: error.message
    });
  }
};

// 🔍 التحقق من حالة حظر عميل على صفحة معينة
const checkCustomerBlockStatus = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { customerId, pageId } = req.query;

    if (!customerId || !pageId) {
      return res.status(400).json({
        success: false,
        message: 'معرف العميل ومعرف الصفحة مطلوبان'
      });
    }

    // التحقق من وجود صفحة الفيس بوك
    const facebookPage = await getSharedPrismaClient().facebookPage.findUnique({
      where: { pageId: pageId },
      select: { id: true, companyId: true }
    });

    if (!facebookPage) {
      return res.status(404).json({
        success: false,
        message: 'صفحة الفيس بوك غير موجودة'
      });
    }

    if (facebookPage.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذه الصفحة'
      });
    }

    // البحث عن الحظر
    const blocked = await getSharedPrismaClient().blockedCustomerOnPage.findFirst({
      where: {
        facebookPageId: facebookPage.id,
        customerId: customerId
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            facebookId: true
          }
        }
      }
    });

    res.json({
      success: true,
      isBlocked: !!blocked,
      data: blocked || null
    });
  } catch (error) {
    console.error('❌ Error checking block status:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في التحقق من حالة الحظر',
      error: error.message
    });
  }
};

// جلب طلبات العميل
const getCustomerOrders = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'معرف العميل مطلوب'
      });
    }

    // التحقق من أن العميل ينتمي للشركة
    const customer = await getSharedPrismaClient().customer.findUnique({
      where: { id: customerId },
      select: { id: true, companyId: true }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'العميل غير موجود'
      });
    }

    if (customer.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذا العميل'
      });
    }

    // جلب طلبات العميل
    const orders = await getSharedPrismaClient().order.findMany({
      where: {
        customerId: customerId,
        companyId: companyId
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // تحويل البيانات للصيغة المطلوبة
    const formattedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status.toLowerCase(),
      total: parseFloat(order.total),
      createdAt: order.createdAt,
      items: order.items.map(item => ({
        name: item.product?.name || 'منتج غير معروف',
        quantity: item.quantity,
        price: parseFloat(item.price),
        image: item.product?.images ? JSON.parse(item.product.images)[0] : null
      }))
    }));

    res.json({
      success: true,
      data: formattedOrders
    });
  } catch (error) {
    console.error('❌ Error fetching customer orders:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب طلبات العميل',
      error: error.message
    });
  }
};

// 📊 جلب سجل نشاطات العميل
const getCustomerActivity = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'معرف العميل مطلوب'
      });
    }

    // التحقق من أن العميل ينتمي للشركة
    const customer = await getSharedPrismaClient().customer.findUnique({
      where: { id: customerId },
      select: { id: true, companyId: true }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'العميل غير موجود'
      });
    }

    if (customer.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذا العميل'
      });
    }

    // جلب آخر المحادثات
    const conversations = await getSharedPrismaClient().conversation.findMany({
      where: {
        customerId: customerId,
        companyId: companyId
      },
      select: {
        id: true,
        channel: true,
        lastMessageAt: true,
        createdAt: true
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 10
    });

    // جلب آخر الطلبات
    const orders = await getSharedPrismaClient().order.findMany({
      where: {
        customerId: customerId,
        companyId: companyId
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // دمج النشاطات وترتيبها حسب التاريخ
    const activities = [
      ...conversations.map(conv => ({
        type: 'conversation',
        id: conv.id,
        platform: conv.channel,
        timestamp: conv.lastMessageAt || conv.createdAt,
        data: conv
      })),
      ...orders.map(order => ({
        type: 'order',
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: parseFloat(order.total),
        timestamp: order.createdAt,
        data: order
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('❌ Error fetching customer activity:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب سجل النشاطات',
      error: error.message
    });
  }
};

// 📝 جلب ملاحظات العميل
const getCustomerNotes = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'معرف العميل مطلوب'
      });
    }

    // التحقق من أن العميل ينتمي للشركة
    const customer = await getSharedPrismaClient().customer.findUnique({
      where: { id: customerId },
      select: { id: true, companyId: true }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'العميل غير موجود'
      });
    }

    if (customer.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذا العميل'
      });
    }

    const notes = await getSharedPrismaClient().customerNote.findMany({
      where: { customerId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: notes
    });

  } catch (error) {
    console.error('❌ Error fetching customer notes:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الملاحظات',
      error: error.message
    });
  }
};

// 📝 إضافة ملاحظة جديدة
const addCustomerNote = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const authorId = req.user?.userId || req.user?.id;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { customerId } = req.params;
    const { content } = req.body;

    if (!customerId || !content) {
      return res.status(400).json({
        success: false,
        message: 'معرف العميل ونص الملاحظة مطلوبان'
      });
    }

    // التحقق من أن العميل ينتمي للشركة
    const customer = await getSharedPrismaClient().customer.findUnique({
      where: { id: customerId },
      select: { id: true, companyId: true }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'العميل غير موجود'
      });
    }

    if (customer.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذا العميل'
      });
    }

    const note = await getSharedPrismaClient().customerNote.create({
      data: {
        customerId,
        authorId,
        content
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: note,
      message: 'تم إضافة الملاحظة بنجاح'
    });

  } catch (error) {
    console.error('❌ Error adding customer note:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إضافة الملاحظة',
      error: error.message
    });
  }
};

// 🗑️ حذف ملاحظة
const deleteCustomerNote = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.userId || req.user?.id;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { noteId } = req.params;

    const note = await getSharedPrismaClient().customerNote.findUnique({
      where: { id: noteId },
      include: {
        customer: {
          select: { companyId: true }
        }
      }
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'الملاحظة غير موجودة'
      });
    }

    if (note.customer.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذه الملاحظة'
      });
    }

    await getSharedPrismaClient().customerNote.delete({
      where: { id: noteId }
    });

    res.json({
      success: true,
      message: 'تم حذف الملاحظة بنجاح'
    });

  } catch (error) {
    console.error('❌ Error deleting customer note:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في حذف الملاحظة',
      error: error.message
    });
  }
};


// تفاصيل العميل (info tab)
const getCustomerDetails = async (req, res) => {
  try {
    const { customerId } = req.params;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const customer = await getSharedPrismaClient().customer.findUnique({
      where: { id: customerId },
      include: {
        _count: {
          select: { orders: true }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'العميل غير موجود'
      });
    }

    if (customer.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذا العميل'
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب بيانات العميل'
    });
  }
};

module.exports = {
  getAllCustomer,
  deleteAllConversations,
  deleteAllCustomers,
  blockCustomerOnPage,
  unblockCustomerOnPage,
  getBlockedCustomersOnPage,
  checkCustomerBlockStatus,
  getCustomerOrders,
  getCustomerActivity,
  getCustomerNotes,
  addCustomerNote,
  deleteCustomerNote,
  getCustomerDetails
}
