const { PrismaClient } = require('@prisma/client');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

/**
 * Store Settings Controller
 * Handles branches and shipping zones management
 */

// Helper function to get Prisma client
function getPrisma() {
  return getSharedPrismaClient();
}

// ============ Store Settings ============

/**
 * Get all store settings (branches and shipping zones)
 */
exports.getStoreSettings = async (req, res) => {
  try {
    const { companyId } = req.user;
    const prisma = getPrisma();

    const [branches, shippingZones] = await Promise.all([
      prisma.branch.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.shippingZone.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    res.json({
      success: true,
      data: {
        branches,
        shippingZones
      }
    });
  } catch (error) {
    console.error('Error fetching store settings:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب إعدادات المتجر',
      error: error.message
    });
  }
};

// ============ Branches ============

/**
 * Get all branches
 */
exports.getBranches = async (req, res) => {
  try {
    const { companyId } = req.user;
    const prisma = getPrisma();

    const branches = await prisma.branch.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: branches
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الفروع',
      error: error.message
    });
  }
};

/**
 * Get active branches only
 */
exports.getActiveBranches = async (req, res) => {
  try {
    const { companyId } = req.user;
    const prisma = getPrisma();

    const branches = await prisma.branch.findMany({
      where: { 
        companyId,
        isActive: true 
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: branches
    });
  } catch (error) {
    console.error('Error fetching active branches:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الفروع النشطة',
      error: error.message
    });
  }
};

/**
 * Create new branch
 */
exports.createBranch = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { name, address, city, phone, email, workingHours } = req.body;

    if (!name || !address || !city || !phone) {
      return res.status(400).json({
        success: false,
        message: 'الاسم والعنوان والمدينة والهاتف مطلوبة'
      });
    }

    const prisma = getPrisma();
    const branch = await prisma.branch.create({
      data: {
        name,
        address,
        city,
        phone,
        email,
        workingHours,
        companyId,
        isActive: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الفرع بنجاح',
      data: branch
    });
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إنشاء الفرع',
      error: error.message
    });
  }
};

/**
 * Update branch
 */
exports.updateBranch = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;
    const { name, address, city, phone, email, workingHours, isActive } = req.body;

    const prisma = getPrisma();
    
    // Verify branch belongs to company
    const existingBranch = await prisma.branch.findFirst({
      where: { id, companyId }
    });

    if (!existingBranch) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name,
        address,
        city,
        phone,
        email,
        workingHours,
        isActive
      }
    });

    res.json({
      success: true,
      message: 'تم تحديث الفرع بنجاح',
      data: branch
    });
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث الفرع',
      error: error.message
    });
  }
};

/**
 * Toggle branch status
 */
exports.toggleBranchStatus = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const prisma = getPrisma();
    
    // Verify branch belongs to company
    const existingBranch = await prisma.branch.findFirst({
      where: { id, companyId }
    });

    if (!existingBranch) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        isActive: !existingBranch.isActive
      }
    });

    res.json({
      success: true,
      message: `تم ${branch.isActive ? 'تفعيل' : 'تعطيل'} الفرع بنجاح`,
      data: branch
    });
  } catch (error) {
    console.error('Error toggling branch status:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تغيير حالة الفرع',
      error: error.message
    });
  }
};

/**
 * Delete branch
 */
exports.deleteBranch = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const prisma = getPrisma();
    
    // Verify branch belongs to company
    const existingBranch = await prisma.branch.findFirst({
      where: { id, companyId }
    });

    if (!existingBranch) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }

    await prisma.branch.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'تم حذف الفرع بنجاح'
    });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف الفرع',
      error: error.message
    });
  }
};

// ============ Shipping Zones ============

/**
 * Get all shipping zones
 */
exports.getShippingZones = async (req, res) => {
  try {
    const { companyId } = req.user;
    const prisma = getPrisma();

    const shippingZones = await prisma.shippingZone.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: shippingZones
    });
  } catch (error) {
    console.error('Error fetching shipping zones:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب مناطق الشحن',
      error: error.message
    });
  }
};

/**
 * Get active shipping zones only
 */
exports.getActiveShippingZones = async (req, res) => {
  try {
    const { companyId } = req.user;
    const prisma = getPrisma();

    const shippingZones = await prisma.shippingZone.findMany({
      where: { 
        companyId,
        isActive: true 
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: shippingZones
    });
  } catch (error) {
    console.error('Error fetching active shipping zones:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب مناطق الشحن النشطة',
      error: error.message
    });
  }
};

/**
 * Find shipping price by governorate
 */
exports.findShippingPrice = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { governorate } = req.query;

    if (!governorate) {
      return res.status(400).json({
        success: false,
        message: 'اسم المحافظة مطلوب'
      });
    }

    const prisma = getPrisma();
    
    // Find shipping zone that includes this governorate
    const shippingZones = await prisma.shippingZone.findMany({
      where: { 
        companyId,
        isActive: true 
      }
    });

    // Search for matching governorate in JSON arrays
    const matchingZone = shippingZones.find(zone => {
      const governorates = Array.isArray(zone.governorates) 
        ? zone.governorates 
        : JSON.parse(zone.governorates || '[]');
      
      return governorates.some(gov => 
        gov.toLowerCase().includes(governorate.toLowerCase()) ||
        governorate.toLowerCase().includes(gov.toLowerCase())
      );
    });

    if (!matchingZone) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على منطقة شحن لهذه المحافظة'
      });
    }

    res.json({
      success: true,
      data: {
        price: matchingZone.price,
        deliveryTime: matchingZone.deliveryTime,
        zoneName: matchingZone.name
      }
    });
  } catch (error) {
    console.error('Error finding shipping price:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في البحث عن سعر الشحن',
      error: error.message
    });
  }
};

/**
 * Create new shipping zone
 */
exports.createShippingZone = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { name, governorates, price, deliveryTime } = req.body;

    if (!name || !governorates || !price || !deliveryTime) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }

    if (!Array.isArray(governorates) || governorates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب إضافة محافظة واحدة على الأقل'
      });
    }

    const prisma = getPrisma();
    const shippingZone = await prisma.shippingZone.create({
      data: {
        name,
        governorates: JSON.stringify(governorates),
        price: parseFloat(price),
        deliveryTime,
        companyId,
        isActive: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء منطقة الشحن بنجاح',
      data: {
        ...shippingZone,
        governorates: JSON.parse(shippingZone.governorates)
      }
    });
  } catch (error) {
    console.error('Error creating shipping zone:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إنشاء منطقة الشحن',
      error: error.message
    });
  }
};

/**
 * Update shipping zone
 */
exports.updateShippingZone = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;
    const { name, governorates, price, deliveryTime, isActive } = req.body;

    const prisma = getPrisma();
    
    // Verify shipping zone belongs to company
    const existingZone = await prisma.shippingZone.findFirst({
      where: { id, companyId }
    });

    if (!existingZone) {
      return res.status(404).json({
        success: false,
        message: 'منطقة الشحن غير موجودة'
      });
    }

    const shippingZone = await prisma.shippingZone.update({
      where: { id },
      data: {
        name,
        governorates: governorates ? JSON.stringify(governorates) : undefined,
        price: price ? parseFloat(price) : undefined,
        deliveryTime,
        isActive
      }
    });

    res.json({
      success: true,
      message: 'تم تحديث منطقة الشحن بنجاح',
      data: {
        ...shippingZone,
        governorates: JSON.parse(shippingZone.governorates)
      }
    });
  } catch (error) {
    console.error('Error updating shipping zone:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث منطقة الشحن',
      error: error.message
    });
  }
};

/**
 * Toggle shipping zone status
 */
exports.toggleZoneStatus = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const prisma = getPrisma();
    
    // Verify shipping zone belongs to company
    const existingZone = await prisma.shippingZone.findFirst({
      where: { id, companyId }
    });

    if (!existingZone) {
      return res.status(404).json({
        success: false,
        message: 'منطقة الشحن غير موجودة'
      });
    }

    const shippingZone = await prisma.shippingZone.update({
      where: { id },
      data: {
        isActive: !existingZone.isActive
      }
    });

    res.json({
      success: true,
      message: `تم ${shippingZone.isActive ? 'تفعيل' : 'تعطيل'} منطقة الشحن بنجاح`,
      data: {
        ...shippingZone,
        governorates: JSON.parse(shippingZone.governorates)
      }
    });
  } catch (error) {
    console.error('Error toggling shipping zone status:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تغيير حالة منطقة الشحن',
      error: error.message
    });
  }
};

/**
 * Delete shipping zone
 */
exports.deleteShippingZone = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const prisma = getPrisma();
    
    // Verify shipping zone belongs to company
    const existingZone = await prisma.shippingZone.findFirst({
      where: { id, companyId }
    });

    if (!existingZone) {
      return res.status(404).json({
        success: false,
        message: 'منطقة الشحن غير موجودة'
      });
    }

    await prisma.shippingZone.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'تم حذف منطقة الشحن بنجاح'
    });
  } catch (error) {
    console.error('Error deleting shipping zone:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف منطقة الشحن',
      error: error.message
    });
  }
};
