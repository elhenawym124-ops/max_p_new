const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

/**
 * Public Products Routes
 * No authentication required - accessible by anyone
 * Company isolation through subdomain middleware
 */

// Helper function to get Prisma client
function getPrisma() {
  return getSharedPrismaClient();
}

// Get all public products
router.get('/products', async (req, res) => {
  try {
    const { company } = req; // from middleware
    const { 
      category, 
      search, 
      page = 1, 
      limit = 20,
      sort = 'createdAt',
      order = 'desc',
      minPrice,
      maxPrice
    } = req.query;

    const prisma = getPrisma();
    const where = {
      companyId: company.id,
      isActive: true,
      stock: { gt: 0 }
    };

    // Filtering
    if (category) {
      where.categoryId = category;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    // Sorting
    const orderBy = { [sort]: order };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        include: {
          category: true,
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get product details by ID
router.get('/products/:id', async (req, res) => {
  try {
    const { company } = req;
    const { id } = req.params;

    const prisma = getPrisma();
    const product = await prisma.product.findFirst({
      where: {
        id,
        companyId: company.id,
        isActive: true
      },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: 'المنتج غير موجود' 
      });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const { company } = req;

    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      where: {
        companyId: company.id,
        isActive: true
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            products: {
              where: { isActive: true, stock: { gt: 0 } }
            }
          }
        }
      }
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get category by ID
router.get('/categories/:id', async (req, res) => {
  try {
    const { company } = req;
    const { id } = req.params;

    const prisma = getPrisma();
    const category = await prisma.category.findFirst({
      where: {
        id,
        companyId: company.id,
        isActive: true
      },
      include: {
        _count: {
          select: {
            products: {
              where: { isActive: true, stock: { gt: 0 } }
            }
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ 
        success: false, 
        error: 'الفئة غير موجودة' 
      });
    }

    res.json({ success: true, data: category });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get store info
router.get('/store-info', async (req, res) => {
  try {
    const { company } = req;
    
    res.json({ 
      success: true, 
      data: {
        id: company.id,
        name: company.name,
        description: company.description || '',
        logo: company.logo || null,
        subdomain: company.subdomain || null,
        contactEmail: company.email || null,
        contactPhone: company.phone || null
      }
    });
  } catch (error) {
    console.error('Error fetching store info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get featured products
router.get('/featured-products', async (req, res) => {
  try {
    const { company } = req;
    const { limit = 8 } = req.query;
    
    const prisma = getPrisma();
    const products = await prisma.product.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        stock: { gt: 0 }
      },
      orderBy: [
        { createdAt: 'desc' }
      ],
      take: parseInt(limit),
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
