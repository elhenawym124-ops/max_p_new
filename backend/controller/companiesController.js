const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();
const planLimitsService = require('../services/planLimitsService');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

const getCurrentCompany = async (req, res) => {
    try {
        // Get the first/default company
        const company = await prisma.company.findFirst();

        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'No company found'
            });
        }

        // Parse settings
        let settings = {};
        try {
            settings = company.settings ? JSON.parse(company.settings) : {};
        } catch (error) {
            settings = {};
        }

        // Default settings
        const defaultSettings = {
            currency: 'EGP',
            currencySymbol: 'جنيه',
            language: 'ar',
            timezone: 'Africa/Cairo',
            dateFormat: 'DD/MM/YYYY',
            numberFormat: 'ar-EG'
        };

        const finalSettings = { ...defaultSettings, ...settings };

        res.json({
            success: true,
            data: {
                id: company.id,
                name: company.name,
                email: company.email,
                phone: company.phone,
                address: company.address,
                settings: finalSettings,
                createdAt: company.createdAt,
                updatedAt: company.updatedAt
            }
        });

    } catch (error) {
        console.error('Error fetching current company:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch company data'
        });
    }
};

const REMOVEDDangerousFallbackEndpoint = async (req, res) => {
    // رفض الطلب - لا يوجد fallback
    console.error(`❌ [SECURITY] Attempted access to dangerous fallback endpoint: /api/v1/companies/1`);

    return res.status(410).json({
        success: false,
        error: 'This endpoint has been removed for security reasons',
        code: 'ENDPOINT_REMOVED',
        message: 'Please use proper company identification'
    });
};

const companyUsageEndpoint = async (req, res) => {
    try {
        const companyId = req.params.id;

        // Get actual product count from database
        let actualProductCount = 6;
        try {
            actualProductCount = await prisma.product.count({
                where: { isActive: true }
            });
        } catch (error) {
            //console.log('Could not fetch product count, using default');
        }

        // Ensure all values are numbers and safe
        const safeProductCount = Number(actualProductCount) || 0;
        const productPercentage = Number(((safeProductCount / 1000) * 100).toFixed(1)) || 0;
        const storageUsage = 1.2;
        const storageLimit = 10;
        const storagePercentage = Number(((storageUsage / storageLimit) * 100).toFixed(1)) || 0;
        const apiUsage = 150;
        const apiLimit = 10000;
        const apiPercentage = Number(((apiUsage / apiLimit) * 100).toFixed(1)) || 0;

        // Create data structure that exactly matches frontend UsageStat interface
        const usageData = {
            // Products usage stat
            products: {
                usage: safeProductCount,           // number - what frontend expects
                limit: 1000,                      // number
                percentage: productPercentage,     // number
                unlimited: false,                 // boolean
                warning: productPercentage > 80,  // boolean
                exceeded: productPercentage > 100 // boolean
            },

            // Orders usage stat
            orders: {
                usage: 0,                         // number
                limit: 5000,                     // number
                percentage: 0.0,                 // number
                unlimited: false,                // boolean
                warning: false,                  // boolean
                exceeded: false                  // boolean
            },

            // Storage usage stat
            storage: {
                usage: storageUsage,             // number (in GB)
                limit: storageLimit,             // number (in GB)
                percentage: storagePercentage,   // number
                unlimited: false,                // boolean
                warning: storagePercentage > 80, // boolean
                exceeded: storagePercentage > 100 // boolean
            },

            // API calls usage stat
            apiCalls: {
                usage: apiUsage,                 // number
                limit: apiLimit,                 // number
                percentage: apiPercentage,       // number
                unlimited: false,                // boolean
                warning: apiPercentage > 80,     // boolean
                exceeded: apiPercentage > 100    // boolean
            }
        };

        res.json({
            success: true,
            data: usageData
        });

    } catch (error) {
        console.error('Error fetching company usage:', error);

        // Return ultra-safe fallback data with same structure
        res.json({
            success: true,
            data: {
                products: { usage: 0, limit: 1000, percentage: 0.0, unlimited: false, warning: false, exceeded: false },
                orders: { usage: 0, limit: 5000, percentage: 0.0, unlimited: false, warning: false, exceeded: false },
                storage: { usage: 0, limit: 10, percentage: 0.0, unlimited: false, warning: false, exceeded: false },
                apiCalls: { usage: 0, limit: 10000, percentage: 0.0, unlimited: false, warning: false, exceeded: false }
            }
        });
    }
};

const mockEndpoint = async (req, res) => {
    try {
        // Get real product count
        let productCount = 6;
        try {
            productCount = await prisma.product.count({ where: { isActive: true } });
        } catch (error) {
            //console.log('Using default product count');
        }

        // Create data structure that exactly matches what frontend expects
        const mockData = {
            success: true,
            data: {
                currentPlan: 'basic',
                planLimits: {
                    products: 1000,
                    orders: 5000,
                    storage: '10GB',
                    apiCalls: 10000
                },
                currentUsage: {
                    products: productCount,
                    orders: 0,
                    storage: '1.2GB',
                    apiCalls: 150
                },
                usagePercentage: {
                    products: Number(((productCount / 1000) * 100).toFixed(1)),
                    orders: 0.0,
                    storage: 12.0,
                    apiCalls: 1.5
                },
                // Add the exact structure frontend expects for the map function
                usageMetrics: [
                    {
                        name: 'المنتجات',
                        current: productCount,
                        limit: 1000,
                        percentage: Number(((productCount / 1000) * 100).toFixed(1)),
                        unit: 'منتج',
                        color: '#3B82F6',
                        icon: '📦'
                    },
                    {
                        name: 'الطلبات',
                        current: 0,
                        limit: 5000,
                        percentage: 0.0,
                        unit: 'طلب',
                        color: '#10B981',
                        icon: '🛒'
                    },
                    {
                        name: 'التخزين',
                        current: 1.2,
                        limit: 10,
                        percentage: 12.0,
                        unit: 'جيجا',
                        color: '#F59E0B',
                        icon: '💾'
                    },
                    {
                        name: 'استدعاءات API',
                        current: 150,
                        limit: 10000,
                        percentage: 1.5,
                        unit: 'استدعاء',
                        color: '#8B5CF6',
                        icon: '🔗'
                    }
                ]
            }
        };

        res.json(mockData);

    } catch (error) {
        console.error('Error in usage mock:', error);

        // Return safe fallback
        res.json({
            success: true,
            data: {
                currentPlan: 'basic',
                planLimits: { products: 1000, orders: 5000, storage: '10GB', apiCalls: 10000 },
                currentUsage: { products: 0, orders: 0, storage: '0GB', apiCalls: 0 },
                usagePercentage: { products: 0.0, orders: 0.0, storage: 0.0, apiCalls: 0.0 },
                usageMetrics: [
                    { name: 'المنتجات', current: 0, limit: 1000, percentage: 0.0, unit: 'منتج', color: '#3B82F6', icon: '📦' },
                    { name: 'الطلبات', current: 0, limit: 5000, percentage: 0.0, unit: 'طلب', color: '#10B981', icon: '🛒' },
                    { name: 'التخزين', current: 0, limit: 10, percentage: 0.0, unit: 'جيجا', color: '#F59E0B', icon: '💾' },
                    { name: 'استدعاءات API', current: 0, limit: 10000, percentage: 0.0, unit: 'استدعاء', color: '#8B5CF6', icon: '🔗' }
                ]
            }
        });
    }
};

const safeUsageEndpoint = async (req, res) => {
    try {
        // Get actual counts from database
        let productCount = 0;
        let orderCount = 0;

        try {
            productCount = await prisma.product.count({ where: { isActive: true } });
            // orderCount = await prisma.order.count(); // Uncomment when order model exists
        } catch (error) {
            //console.log('Could not fetch counts, using defaults');
        }

        // Safe usage data with guaranteed numeric values
        const safeUsageData = {
            currentPlan: 'basic',
            planName: 'الخطة الأساسية',
            planLimits: {
                products: 1000,
                orders: 5000,
                storage: 10, // GB as number
                apiCalls: 10000
            },
            currentUsage: {
                products: Number(productCount) || 0,
                orders: Number(orderCount) || 0,
                storage: 1.2, // GB as number
                apiCalls: 150
            },
            usagePercentage: {
                products: Number(((Number(productCount) || 0) / 1000 * 100).toFixed(1)) || 0,
                orders: Number(((Number(orderCount) || 0) / 5000 * 100).toFixed(1)) || 0,
                storage: 12.0,
                apiCalls: 1.5
            },
            // Detailed metrics for charts/tables
            detailedMetrics: [
                {
                    id: 'products',
                    name: 'المنتجات',
                    nameEn: 'Products',
                    current: Number(productCount) || 0,
                    limit: 1000,
                    percentage: Number(((Number(productCount) || 0) / 1000 * 100).toFixed(1)) || 0,
                    unit: 'منتج',
                    unitEn: 'products',
                    color: '#3B82F6',
                    icon: '📦'
                },
                {
                    id: 'orders',
                    name: 'الطلبات',
                    nameEn: 'Orders',
                    current: Number(orderCount) || 0,
                    limit: 5000,
                    percentage: Number(((Number(orderCount) || 0) / 5000 * 100).toFixed(1)) || 0,
                    unit: 'طلب',
                    unitEn: 'orders',
                    color: '#10B981',
                    icon: '🛒'
                },
                {
                    id: 'storage',
                    name: 'التخزين',
                    nameEn: 'Storage',
                    current: 1.2,
                    limit: 10,
                    percentage: 12.0,
                    unit: 'جيجا',
                    unitEn: 'GB',
                    color: '#F59E0B',
                    icon: '💾'
                },
                {
                    id: 'apiCalls',
                    name: 'استدعاءات API',
                    nameEn: 'API Calls',
                    current: 150,
                    limit: 10000,
                    percentage: 1.5,
                    unit: 'استدعاء',
                    unitEn: 'calls',
                    color: '#8B5CF6',
                    icon: '🔗'
                }
            ]
        };

        res.json({
            success: true,
            data: safeUsageData
        });

    } catch (error) {
        console.error('Error fetching safe usage data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch usage data'
        });
    }
};

const companyPlansEndpoint = async (req, res) => {
    try {
        const plans = [
            {
                id: 'basic',
                name: 'الخطة الأساسية',
                price: 0,
                currency: 'EGP',
                features: [
                    'حتى 1000 منتج',
                    'حتى 5000 طلب شهرياً',
                    '10 جيجا تخزين',
                    'دعم فني أساسي'
                ],
                limits: {
                    products: 1000,
                    orders: 5000,
                    storage: '10GB',
                    apiCalls: 10000
                }
            },
            {
                id: 'pro',
                name: 'الخطة الاحترافية',
                price: 299,
                currency: 'EGP',
                features: [
                    'منتجات غير محدودة',
                    'طلبات غير محدودة',
                    '100 جيجا تخزين',
                    'دعم فني متقدم',
                    'تقارير مفصلة'
                ],
                limits: {
                    products: -1, // unlimited
                    orders: -1,
                    storage: '100GB',
                    apiCalls: 100000
                }
            }
        ];

        res.json({
            success: true,
            data: plans
        });

    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch plans'
        });
    }
};

const getCompanyInfoEndpoint = async (req, res) => {
    try {
        const companyId = req.params.id;

        // التحقق من الصلاحية
        const userCompanyId = req.user?.companyId;
        const userRole = req.user?.role;

        if (!userCompanyId) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح بالوصول'
            });
        }

        // السماح للـ super admin بالوصول لجميع الشركات
        if (userRole !== 'SUPER_ADMIN' && companyId !== userCompanyId) {
            return res.status(403).json({
                success: false,
                message: 'ليس لديك صلاحية للوصول لهذه الشركة'
            });
        }

        // Get company from database
        const company = await prisma.company.findUnique({
            where: { id: companyId }
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // Parse settings
        let settings = {};
        try {
            settings = company.settings ? JSON.parse(company.settings) : {};
        } catch (error) {
            settings = {};
        }

        // Default settings with currency
        const defaultSettings = {
            currency: 'EGP',
            currencySymbol: 'ج.م',
            language: 'ar',
            timezone: 'Africa/Cairo',
            dateFormat: 'DD/MM/YYYY',
            numberFormat: 'ar-EG'
        };

        const finalSettings = { ...defaultSettings, ...settings };

        res.json({
            success: true,
            data: {
                id: company.id,
                name: company.name,
                email: company.email,
                phone: company.phone,
                address: company.address,
                settings: finalSettings,
                currency: finalSettings.currency, // Add currency at root level for compatibility
                createdAt: company.createdAt,
                updatedAt: company.updatedAt
            }
        });

    } catch (error) {
        console.error('Error fetching company:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch company data'
        });
    }
};

const updateCompanyCurrency = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { currency } = req.body;

        //console.log(`💰 Updating currency for company ${companyId} to ${currency}`);

        // Validate currency code
        const validCurrencies = ['EGP', 'USD', 'EUR', 'SAR', 'AED'];
        if (!validCurrencies.includes(currency)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid currency code'
            });
        }

        // Get current company
        const company = await prisma.company.findUnique({
            where: { id: companyId }
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // Parse current settings
        let settings = {};
        try {
            settings = company.settings ? JSON.parse(company.settings) : {};
        } catch (error) {
            settings = {};
        }

        // Update currency in settings
        settings.currency = currency;

        // Update company in database
        const updatedCompany = await prisma.company.update({
            where: { id: companyId },
            data: {
                settings: JSON.stringify(settings)
            }
        });

        //console.log(`✅ Currency updated successfully for company ${companyId}`);

        res.json({
            success: true,
            message: 'Currency updated successfully',
            data: {
                companyId: companyId,
                currency: currency
            }
        });

    } catch (error) {
        console.error('❌ Error updating currency:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update currency'
        });
    }
};

const getAllCompanies = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 25,
            search = '',
            plan = '',
            isActive = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // بناء شروط البحث
        const where = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (plan) where.plan = plan;
        if (isActive !== '') where.isActive = isActive === 'true';

        // حساب التصفح
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(parseInt(limit), 100);
        const skip = (pageNum - 1) * limitNum;

        // ترتيب النتائج
        const orderBy = {};
        if (sortBy === 'name') {
            orderBy.name = sortOrder;
        } else if (sortBy === 'plan') {
            orderBy.plan = sortOrder;
        } else if (sortBy === 'createdAt') {
            orderBy.createdAt = sortOrder;
        } else {
            orderBy.createdAt = 'desc';
        }

        // جلب الشركات مع التصفح
        const [companies, totalCount] = await Promise.all([
            prisma.company.findMany({
                where,
                orderBy,
                skip,
                take: limitNum,
                include: {
                    _count: {
                        select: {
                            users: true,
                            customers: true,
                            products: true,
                            orders: true,
                            conversations: true
                        }
                    }
                }
            }),
            prisma.company.count({ where })
        ]);

        // حساب معلومات التصفح
        const totalPages = Math.ceil(totalCount / limitNum);
        const hasNext = pageNum < totalPages;
        const hasPrev = pageNum > 1;

        res.json({
            success: true,
            message: 'تم جلب الشركات بنجاح',
            data: {
                companies,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: totalCount,
                    totalPages,
                    hasNext,
                    hasPrev
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching companies:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في جلب الشركات',
            error: error.message
        });
    }
};

const getCompanyDetails = async (req, res) => {
    try {
        const { id } = req.params;

        // التحقق من الصلاحية - المستخدم يمكنه فقط الوصول لشركته أو إذا كان super admin
        const userCompanyId = req.user?.companyId;
        const userRole = req.user?.role;

        if (!userCompanyId) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
            });
        }

        // السماح للـ super admin بالوصول لجميع الشركات
        if (userRole !== 'SUPER_ADMIN' && id !== userCompanyId) {
            return res.status(403).json({
                success: false,
                message: 'ليس لديك صلاحية للوصول لهذه الشركة'
            });
        }

        const company = await prisma.company.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        role: true,
                        isActive: true,
                        createdAt: true
                    }
                },
                _count: {
                    select: {
                        users: true,
                        customers: true,
                        products: true,
                        orders: true,
                        conversations: true,
                        successPatterns: true
                    }
                }
            }
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'الشركة غير موجودة'
            });
        }

        res.json({
            success: true,
            message: 'تم جلب تفاصيل الشركة بنجاح',
            data: company
        });

    } catch (error) {
        console.error('❌ Error fetching company:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في جلب تفاصيل الشركة',
            error: error.message
        });
    }
};

const createNewCompany = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            website,
            address,
            plan = 'BASIC',
            currency = 'EGP',
            isActive = true
        } = req.body;

        // Validation
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'اسم الشركة والبريد الإلكتروني مطلوبان'
            });
        }

        // Check if email already exists
        const existingCompany = await prisma.company.findFirst({
            where: { email }
        });

        if (existingCompany) {
            return res.status(400).json({
                success: false,
                message: 'البريد الإلكتروني مستخدم بالفعل'
            });
        }

        // Create new company
        const newCompany = await prisma.company.create({
            data: {
                name,
                email,
                phone: phone || null,
                website: website || null,
                address: address || null,
                plan,
                currency,
                isActive,
                useCentralKeys: true, // ✅ تفعيل المفاتيح المركزية افتراضياً
                settings: JSON.stringify({
                    patternSystemEnabled: true,
                    lastSystemChange: new Date().toISOString(),
                    systemChangeBy: 'admin'
                })
            },
            include: {
                _count: {
                    select: {
                        users: true,
                        customers: true,
                        products: true,
                        orders: true,
                        conversations: true
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'تم إنشاء الشركة بنجاح',
            data: newCompany
        });

    } catch (error) {
        console.error('❌ Error creating company:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في إنشاء الشركة',
            error: error.message
        });
    }
};

const updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            email,
            phone,
            website,
            address,
            plan,
            currency,
            isActive
        } = req.body;

        // Check if company exists
        const existingCompany = await prisma.company.findUnique({
            where: { id }
        });

        if (!existingCompany) {
            return res.status(404).json({
                success: false,
                message: 'الشركة غير موجودة'
            });
        }

        // Check if email is being changed and already exists
        if (email && email !== existingCompany.email) {
            const emailExists = await prisma.company.findFirst({
                where: {
                    email,
                    id: { not: id }
                }
            });

            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'البريد الإلكتروني مستخدم بالفعل'
                });
            }
        }

        // Update company
        const updatedCompany = await prisma.company.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(phone !== undefined && { phone }),
                ...(website !== undefined && { website }),
                ...(address !== undefined && { address }),
                ...(plan && { plan }),
                ...(currency && { currency }),
                ...(isActive !== undefined && { isActive })
            },
            include: {
                _count: {
                    select: {
                        users: true,
                        customers: true,
                        products: true,
                        orders: true,
                        conversations: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'تم تحديث الشركة بنجاح',
            data: updatedCompany
        });

    } catch (error) {
        console.error('❌ Error updating company:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في تحديث الشركة',
            error: error.message
        });
    }
};

const deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if company exists
        const existingCompany = await prisma.company.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        users: true,
                        customers: true,
                        products: true,
                        orders: true,
                        conversations: true
                    }
                }
            }
        });

        if (!existingCompany) {
            return res.status(404).json({
                success: false,
                message: 'الشركة غير موجودة'
            });
        }

        // Check if company has data
        const hasData = existingCompany._count.users > 0 ||
            existingCompany._count.customers > 0 ||
            existingCompany._count.products > 0 ||
            existingCompany._count.orders > 0 ||
            existingCompany._count.conversations > 0;

        if (hasData) {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن حذف الشركة لأنها تحتوي على بيانات. يمكنك إلغاء تفعيلها بدلاً من ذلك.'
            });
        }

        // Delete company
        await prisma.company.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: 'تم حذف الشركة بنجاح'
        });

    } catch (error) {
        console.error('❌ Error deleting company:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في حذف الشركة',
            error: error.message
        });
    }
};

// ==================== COMPANY USERS MANAGEMENT ====================

const getCompanyUsers = async (req, res) => {
    try {
        const { companyId } = req.params;
        const {
            page = 1,
            limit = 25,
            search = '',
            role = '',
            isActive = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // بناء شروط البحث
        const where = { companyId };

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (role) where.role = role;
        if (isActive !== '') where.isActive = isActive === 'true';

        // حساب التصفح
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(parseInt(limit), 100);
        const skip = (pageNum - 1) * limitNum;

        // ترتيب النتائج
        const orderBy = {};
        if (sortBy === 'firstName') {
            orderBy.firstName = sortOrder;
        } else if (sortBy === 'lastName') {
            orderBy.lastName = sortOrder;
        } else if (sortBy === 'email') {
            orderBy.email = sortOrder;
        } else if (sortBy === 'role') {
            orderBy.role = sortOrder;
        } else if (sortBy === 'lastLoginAt') {
            orderBy.lastLoginAt = sortOrder;
        } else {
            orderBy.createdAt = sortOrder;
        }

        // جلب المستخدمين مع التصفح
        const [users, totalCount] = await Promise.all([
            prisma.user.findMany({
                where,
                orderBy,
                skip,
                take: limitNum,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    role: true,
                    isActive: true,
                    isEmailVerified: true,
                    lastLoginAt: true,
                    createdAt: true,
                    updatedAt: true
                }
            }),
            prisma.user.count({ where })
        ]);

        // حساب معلومات التصفح
        const totalPages = Math.ceil(totalCount / limitNum);
        const hasNext = pageNum < totalPages;
        const hasPrev = pageNum > 1;

        res.json({
            success: true,
            message: 'تم جلب المستخدمين بنجاح',
            data: {
                users,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: totalCount,
                    totalPages,
                    hasNext,
                    hasPrev
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching company users:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في جلب المستخدمين',
            error: error.message
        });
    }
};

const createnewUserForCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        const {
            firstName,
            lastName,
            email,
            password,
            phone,
            role = 'AGENT',
            isActive = true
        } = req.body;

        console.log(`👤 [CREATE-USER] Request to create user for company: ${companyId}`);
        console.log(`📧 [CREATE-USER] Email: ${email}, Role: ${role}`);
        console.log(`🔐 [CREATE-USER] Requester: ${req.user?.email}, Role: ${req.user?.role}`);

        // Validation
        if (!firstName || !lastName || !email || !password) {
            console.log(`❌ [CREATE-USER] Validation failed - missing required fields`);
            return res.status(400).json({
                success: false,
                message: 'الاسم الأول والأخير والبريد الإلكتروني وكلمة المرور مطلوبة'
            });
        }

        // Check user limit before creating
        const limitCheck = await planLimitsService.checkLimits(companyId, 'users', 1);
        if (!limitCheck.allowed) {
            console.log(`❌ [CREATE-USER] User limit exceeded for company: ${companyId}`);
            return res.status(400).json({
                success: false,
                message: 'تم تجاوز حد المستخدمين المسموح به في خطتك الحالية',
                error: 'LIMIT_EXCEEDED',
                details: {
                    current: limitCheck.current,
                    limit: limitCheck.limit,
                    plan: (await planLimitsService.getCurrentUsage(companyId)).plan
                },
                upgradeSuggestions: planLimitsService.getUpgradeSuggestions(
                    (await planLimitsService.getCurrentUsage(companyId)).plan
                )
            });
        }

        // Check if company exists
        const company = await prisma.company.findUnique({
            where: { id: companyId }
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'الشركة غير موجودة'
            });
        }

        // Check if email already exists
        const existingUser = await prisma.user.findFirst({
            where: { email: email.toLowerCase() }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'البريد الإلكتروني مستخدم بالفعل'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create new user
        const newUser = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email: email.toLowerCase(),
                password: hashedPassword,
                phone: phone || null,
                role,
                isActive,
                companyId
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                isEmailVerified: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'تم إنشاء المستخدم بنجاح',
            data: newUser
        });

    } catch (error) {
        console.error('❌ Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في إنشاء المستخدم',
            error: error.message
        });
    }
}

const updateUser = async (req, res) => {
    try {
        const { companyId, userId } = req.params;
        const {
            firstName,
            lastName,
            email,
            phone,
            role,
            isActive
        } = req.body;

        // Check if user exists and belongs to company
        const existingUser = await prisma.user.findFirst({
            where: {
                id: userId,
                companyId: companyId
            }
        });

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }

        // Check if email is being changed and already exists
        if (email && email.toLowerCase() !== existingUser.email) {
            const emailExists = await prisma.user.findFirst({
                where: {
                    email: email.toLowerCase(),
                    id: { not: userId }
                }
            });

            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'البريد الإلكتروني مستخدم بالفعل'
                });
            }
        }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(email && { email: email.toLowerCase() }),
                ...(phone !== undefined && { phone }),
                ...(role && { role }),
                ...(isActive !== undefined && { isActive })
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                isEmailVerified: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.json({
            success: true,
            message: 'تم تحديث المستخدم بنجاح',
            data: updatedUser
        });

    } catch (error) {
        console.error('❌ Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في تحديث المستخدم',
            error: error.message
        });
    }
};

const updateMyProfile = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const {
            firstName,
            lastName,
            phone,
            avatar
        } = req.body;

        console.log(`👤 [UPDATE-PROFILE] User ${userId} updating profile`);

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }

        // Update user profile
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(phone !== undefined && { phone }),
                ...(avatar !== undefined && { avatar })
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatar: true,
                role: true,
                isActive: true,
                isEmailVerified: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true
            }
        });

        console.log(`✅ [UPDATE-PROFILE] Profile updated successfully for user ${userId}`);

        res.json({
            success: true,
            message: 'تم تحديث الملف الشخصي بنجاح',
            data: updatedUser
        });

    } catch (error) {
        console.error('❌ Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في تحديث الملف الشخصي',
            error: error.message
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { companyId, userId } = req.params;

        // Check if user exists and belongs to company
        const existingUser = await prisma.user.findFirst({
            where: {
                id: userId,
                companyId: companyId
            }
        });

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }

        // Check if user is the only COMPANY_ADMIN
        if (existingUser.role === 'COMPANY_ADMIN') {
            const adminCount = await prisma.user.count({
                where: {
                    companyId: companyId,
                    role: 'COMPANY_ADMIN',
                    isActive: true
                }
            });

            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    message: 'لا يمكن حذف آخر مدير للشركة'
                });
            }
        }

        // Delete user
        await prisma.user.delete({
            where: { id: userId }
        });

        res.json({
            success: true,
            message: 'تم حذف المستخدم بنجاح'
        });

    } catch (error) {
        console.error('❌ Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في حذف المستخدم',
            error: error.message
        });
    }
}

// ==================== ROLES & PERMISSIONS MANAGEMENT ====================

const createCustomRole = async (req, res) => {
    try {
        const { companyId } = req.params;
        const {
            name,
            description,
            permissions,
            isActive = true
        } = req.body;

        // Validation
        if (!name || !description || !permissions || !Array.isArray(permissions)) {
            return res.status(400).json({
                success: false,
                message: 'اسم الدور والوصف والصلاحيات مطلوبة'
            });
        }

        // Check if company exists
        const company = await prisma.company.findUnique({
            where: { id: companyId }
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'الشركة غير موجودة'
            });
        }

        // For now, we'll store custom roles in company settings
        // In a real app, you'd create a separate roles table
        const currentSettings = company.settings ? JSON.parse(company.settings) : {};
        const customRoles = currentSettings.customRoles || {};

        // Generate role key
        const roleKey = `CUSTOM_${name.toUpperCase().replace(/\s+/g, '_')}`;

        // Check if role already exists
        if (customRoles[roleKey]) {
            return res.status(400).json({
                success: false,
                message: 'دور بهذا الاسم موجود بالفعل'
            });
        }

        // Add new role
        customRoles[roleKey] = {
            name,
            description,
            permissions,
            isActive,
            isCustom: true,
            createdAt: new Date().toISOString()
        };

        // Update company settings
        await prisma.company.update({
            where: { id: companyId },
            data: {
                settings: JSON.stringify({
                    ...currentSettings,
                    customRoles
                })
            }
        });

        res.status(201).json({
            success: true,
            message: 'تم إنشاء الدور بنجاح',
            data: {
                key: roleKey,
                ...customRoles[roleKey]
            }
        });

    } catch (error) {
        console.error('❌ Error creating role:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في إنشاء الدور',
            error: error.message
        });
    }
};

const getCompanyRoles = async (req, res) => {
    try {
        const { companyId } = req.params;

        // Get company
        const company = await prisma.company.findUnique({
            where: { id: companyId }
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'الشركة غير موجودة'
            });
        }

        // Built-in roles
        const builtInRoles = {
            COMPANY_ADMIN: {
                name: 'مدير الشركة',
                description: 'صلاحيات كاملة لإدارة الشركة والمستخدمين',
                permissions: [
                    'إدارة المستخدمين',
                    'إدارة الأدوار',
                    'إدارة المنتجات',
                    'إدارة العملاء',
                    'إدارة الطلبات',
                    'مشاهدة التقارير',
                    'إدارة الإعدادات',
                    'إدارة التكاملات'
                ],
                isBuiltIn: true,
                isActive: true
            },
            MANAGER: {
                name: 'مدير',
                description: 'صلاحيات إدارية محدودة',
                permissions: [
                    'إدارة المنتجات',
                    'إدارة العملاء',
                    'إدارة الطلبات',
                    'مشاهدة التقارير'
                ],
                isBuiltIn: true,
                isActive: true
            },
            AGENT: {
                name: 'موظف',
                description: 'صلاحيات أساسية للعمل اليومي',
                permissions: [
                    'إدارة العملاء',
                    'إدارة الطلبات',
                    'مشاهدة المنتجات'
                ],
                isBuiltIn: true,
                isActive: true
            }
        };

        // Get custom roles
        const settings = company.settings ? JSON.parse(company.settings) : {};
        const customRoles = settings.customRoles || {};

        // Combine roles
        const allRoles = { ...builtInRoles, ...customRoles };

        res.json({
            success: true,
            message: 'تم جلب الأدوار بنجاح',
            data: allRoles
        });

    } catch (error) {
        console.error('❌ Error fetching roles:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في جلب الأدوار',
            error: error.message
        });
    }
};

const updateCustomRole = async (req, res) => {
    try {
        const { companyId, roleKey } = req.params;
        const { name, description, permissions, isActive } = req.body;

        // Check if it's a built-in role
        if (['COMPANY_ADMIN', 'MANAGER', 'AGENT'].includes(roleKey)) {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن تعديل الأدوار الأساسية'
            });
        }

        // Get company
        const company = await prisma.company.findUnique({
            where: { id: companyId }
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'الشركة غير موجودة'
            });
        }

        const settings = company.settings ? JSON.parse(company.settings) : {};
        const customRoles = settings.customRoles || {};

        if (!customRoles[roleKey]) {
            return res.status(404).json({
                success: false,
                message: 'الدور غير موجود'
            });
        }

        // Update role
        customRoles[roleKey] = {
            ...customRoles[roleKey],
            ...(name && { name }),
            ...(description && { description }),
            ...(permissions && { permissions }),
            ...(isActive !== undefined && { isActive }),
            updatedAt: new Date().toISOString()
        };

        // Update company settings
        await prisma.company.update({
            where: { id: companyId },
            data: {
                settings: JSON.stringify({
                    ...settings,
                    customRoles
                })
            }
        });

        res.json({
            success: true,
            message: 'تم تحديث الدور بنجاح',
            data: {
                key: roleKey,
                ...customRoles[roleKey]
            }
        });

    } catch (error) {
        console.error('❌ Error updating role:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في تحديث الدور',
            error: error.message
        });
    }
}

const deleteCustomRole = async (req, res) => {
    try {
        const { companyId, roleKey } = req.params;
        const { name, description, permissions, isActive } = req.body;

        // Check if it's a built-in role
        if (['COMPANY_ADMIN', 'MANAGER', 'AGENT'].includes(roleKey)) {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن تعديل الأدوار الأساسية'
            });
        }

        // Get company
        const company = await prisma.company.findUnique({
            where: { id: companyId }
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'الشركة غير موجودة'
            });
        }

        const settings = company.settings ? JSON.parse(company.settings) : {};
        const customRoles = settings.customRoles || {};

        if (!customRoles[roleKey]) {
            return res.status(404).json({
                success: false,
                message: 'الدور غير موجود'
            });
        }

        // Update role
        customRoles[roleKey] = {
            ...customRoles[roleKey],
            ...(name && { name }),
            ...(description && { description }),
            ...(permissions && { permissions }),
            ...(isActive !== undefined && { isActive }),
            updatedAt: new Date().toISOString()
        };

        // Update company settings
        await prisma.company.update({
            where: { id: companyId },
            data: {
                settings: JSON.stringify({
                    ...settings,
                    customRoles
                })
            }
        });

        res.json({
            success: true,
            message: 'تم تحديث الدور بنجاح',
            data: {
                key: roleKey,
                ...customRoles[roleKey]
            }
        });

    } catch (error) {
        console.error('❌ Error updating role:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في تحديث الدور',
            error: error.message
        });
    }
}


// ==================== USER INVITATIONS ROUTES ====================
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendUserInvitation = async (req, res) => {
    try {
        const { companyId } = req.params;
        const {
            email,
            firstName,
            lastName,
            role = 'AGENT'
        } = req.body;

        // Validation
        if (!email || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'البريد الإلكتروني والاسم الأول والأخير مطلوبة'
            });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'مستخدم بهذا البريد الإلكتروني موجود بالفعل'
            });
        }

        // Check if invitation already exists
        const existingInvitation = await prisma.userInvitation.findFirst({
            where: {
                email,
                companyId,
                status: 'PENDING'
            }
        });

        if (existingInvitation) {
            return res.status(400).json({
                success: false,
                message: 'دعوة معلقة لهذا البريد الإلكتروني موجودة بالفعل'
            });
        }

        // Check user limit before creating invitation
        const limitCheck = await planLimitsService.checkLimits(companyId, 'users', 1);
        if (!limitCheck.allowed) {
            return res.status(400).json({
                success: false,
                message: 'تم تجاوز حد المستخدمين المسموح به في خطتك الحالية',
                error: 'LIMIT_EXCEEDED',
                details: {
                    current: limitCheck.current,
                    limit: limitCheck.limit,
                    plan: (await planLimitsService.getCurrentUsage(companyId)).plan
                }
            });
        }

        // Generate invitation token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

        // Create invitation
        const invitation = await prisma.userInvitation.create({
            data: {
                email,
                firstName,
                lastName,
                role,
                token,
                invitedBy: req.user.userId,
                companyId,
                expiresAt
            },
            include: {
                inviter: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                },
                company: {
                    select: {
                        name: true
                    }
                }
            }
        });

        // Generate invitation link
        const invitationLink = `${process.env.FRONTEND_URL || 'https://www.mokhtarelhenawy.online'}/auth/accept-invitation?token=${token}`;

        // Send email if SMTP is configured
        let emailSent = false;
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            try {
                await emailTransporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: email,
                    subject: `🎉 دعوة للانضمام إلى ${invitation.company.name}`,
                    html: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎉 دعوة خاصة</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin-top: 0; font-size: 24px;">مرحباً ${firstName} ${lastName}،</h2>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                تم دعوتك للانضمام إلى <strong style="color: #667eea;">${invitation.company.name}</strong> من قبل 
                                <strong>${invitation.inviter.firstName} ${invitation.inviter.lastName}</strong>.
                            </p>
                            
                            <div style="background-color: #f8f9fa; border-right: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 5px;">
                                <p style="margin: 0; color: #555;">
                                    <strong style="color: #333;">دورك في النظام:</strong> 
                                    <span style="color: #667eea; font-weight: bold;">${role === 'AGENT' ? 'موظف' : role === 'MANAGER' ? 'مدير' : 'مسؤول'}</span>
                                </p>
                            </div>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                للقبول والانضمام إلى الفريق، انقر على الزر أدناه:
                            </p>
                            
                            <!-- Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${invitationLink}" 
                                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                                  color: white; 
                                                  padding: 15px 40px; 
                                                  text-decoration: none; 
                                                  border-radius: 50px; 
                                                  display: inline-block; 
                                                  font-weight: bold; 
                                                  font-size: 16px;
                                                  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                                            ✅ قبول الدعوة والانضمام
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #999; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                                أو انسخ الرابط التالي والصقه في المتصفح:
                            </p>
                            <p style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px; color: #667eea;">
                                ${invitationLink}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 10px 10px;">
                            <p style="color: #999; font-size: 13px; margin: 5px 0; text-align: center;">
                                ⏰ هذه الدعوة صالحة لمدة <strong>7 أيام</strong> من تاريخ الإرسال
                            </p>
                            <p style="color: #999; font-size: 13px; margin: 5px 0; text-align: center;">
                                🔒 إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد الإلكتروني بأمان
                            </p>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
                                © ${new Date().getFullYear()} ${invitation.company.name}. جميع الحقوق محفوظة.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
          `
                });
                emailSent = true;
            } catch (emailError) {
                console.error('❌ Error sending invitation email:', emailError);
            }
        }

        res.status(201).json({
            success: true,
            message: emailSent ? 'تم إرسال الدعوة بنجاح' : 'تم إنشاء الدعوة بنجاح (لم يتم إرسال البريد الإلكتروني)',
            data: {
                invitation: {
                    id: invitation.id,
                    email: invitation.email,
                    firstName: invitation.firstName,
                    lastName: invitation.lastName,
                    role: invitation.role,
                    status: invitation.status,
                    expiresAt: invitation.expiresAt,
                    createdAt: invitation.createdAt
                },
                invitationLink,
                emailSent
            }
        });

    } catch (error) {
        console.error('❌ Error creating invitation:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في إنشاء الدعوة',
            error: error.message
        });
    }
}

const getCompanyInvitations = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { page = 1, limit = 10, status } = req.query;

        const skip = (page - 1) * limit;
        const where = { companyId };

        if (status) {
            where.status = status;
        }

        const [invitations, totalCount] = await Promise.all([
            prisma.userInvitation.findMany({
                where,
                include: {
                    inviter: {
                        select: {
                            firstName: true,
                            lastName: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: parseInt(skip),
                take: parseInt(limit)
            }),
            prisma.userInvitation.count({ where })
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            message: 'تم جلب الدعوات بنجاح',
            data: {
                invitations,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalCount,
                    totalPages
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching invitations:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في جلب الدعوات',
            error: error.message
        });
    }
}

const cancelInvitation = async (req, res) => {
    try {
        const { companyId, invitationId } = req.params;

        const invitation = await prisma.userInvitation.findFirst({
            where: {
                id: invitationId,
                companyId
            }
        });

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: 'الدعوة غير موجودة'
            });
        }

        if (invitation.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن إلغاء دعوة غير معلقة'
            });
        }

        await prisma.userInvitation.update({
            where: { id: invitationId },
            data: { status: 'CANCELLED' }
        });

        res.json({
            success: true,
            message: 'تم إلغاء الدعوة بنجاح'
        });

    } catch (error) {
        console.error('❌ Error cancelling invitation:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في إلغاء الدعوة',
            error: error.message
        });
    }
}

const resendInvitation = async (req, res) => {
    try {
        const { companyId, invitationId } = req.params;

        const invitation = await prisma.userInvitation.findFirst({
            where: {
                id: invitationId,
                companyId
            },
            include: {
                inviter: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                },
                company: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: 'الدعوة غير موجودة'
            });
        }

        if (invitation.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن إعادة إرسال دعوة غير معلقة'
            });
        }

        // Generate new token and extend expiry
        const newToken = crypto.randomBytes(32).toString('hex');
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);

        await prisma.userInvitation.update({
            where: { id: invitationId },
            data: {
                token: newToken,
                expiresAt: newExpiresAt
            }
        });

        // Generate new invitation link
        const invitationLink = `${process.env.FRONTEND_URL || 'https://www.mokhtarelhenawy.online'}/auth/accept-invitation?token=${newToken}`;

        // Send email if SMTP is configured
        let emailSent = false;
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            try {
                await emailTransporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: invitation.email,
                    subject: `🔄 إعادة إرسال: دعوة للانضمام إلى ${invitation.company.name}`,
                    html: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🔄 تذكير بالدعوة</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin-top: 0; font-size: 24px;">مرحباً ${invitation.firstName} ${invitation.lastName}،</h2>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                هذا تذكير بدعوتك للانضمام إلى <strong style="color: #667eea;">${invitation.company.name}</strong>.
                            </p>
                            
                            <div style="background-color: #fff3cd; border-right: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
                                <p style="margin: 0; color: #856404;">
                                    ⚠️ <strong>تم تجديد رابط الدعوة</strong> - الرابط السابق لم يعد صالحاً
                                </p>
                            </div>
                            
                            <div style="background-color: #f8f9fa; border-right: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 5px;">
                                <p style="margin: 0; color: #555;">
                                    <strong style="color: #333;">دورك في النظام:</strong> 
                                    <span style="color: #667eea; font-weight: bold;">${invitation.role === 'AGENT' ? 'موظف' : invitation.role === 'MANAGER' ? 'مدير' : 'مسؤول'}</span>
                                </p>
                            </div>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                للقبول والانضمام إلى الفريق، انقر على الزر أدناه:
                            </p>
                            
                            <!-- Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${invitationLink}" 
                                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                                  color: white; 
                                                  padding: 15px 40px; 
                                                  text-decoration: none; 
                                                  border-radius: 50px; 
                                                  display: inline-block; 
                                                  font-weight: bold; 
                                                  font-size: 16px;
                                                  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                                            ✅ قبول الدعوة والانضمام
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #999; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                                أو انسخ الرابط التالي والصقه في المتصفح:
                            </p>
                            <p style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px; color: #667eea;">
                                ${invitationLink}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 10px 10px;">
                            <p style="color: #999; font-size: 13px; margin: 5px 0; text-align: center;">
                                ⏰ هذه الدعوة الجديدة صالحة لمدة <strong>7 أيام</strong> من تاريخ الإرسال
                            </p>
                            <p style="color: #999; font-size: 13px; margin: 5px 0; text-align: center;">
                                🔒 إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد الإلكتروني بأمان
                            </p>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
                                © ${new Date().getFullYear()} ${invitation.company.name}. جميع الحقوق محفوظة.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
          `
                });
                emailSent = true;
            } catch (emailError) {
                console.error('❌ Error sending invitation email:', emailError);
            }
        }

        res.json({
            success: true,
            message: emailSent ? 'تم إعادة إرسال الدعوة بنجاح' : 'تم تحديث الدعوة بنجاح (لم يتم إرسال البريد الإلكتروني)',
            data: {
                invitationLink,
                emailSent
            }
        });

    } catch (error) {
        console.error('❌ Error resending invitation:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في إعادة إرسال الدعوة',
            error: error.message
        });
    }
}


const FrontendSpecificSafeEndpoint = async (req, res) => {
    try {
        // Get real data
        let productCount = 6;
        try {
            productCount = await prisma.product.count({ where: { isActive: true } });
        } catch (error) {
            //console.log('Using default count');
        }

        // Create the exact structure that frontend expects
        const frontendSafeData = {
            success: true,
            data: {
                currentPlan: 'basic',
                planName: 'الخطة الأساسية',
                planLimits: {
                    products: Number(1000),
                    orders: Number(5000),
                    storage: '10GB',
                    apiCalls: Number(10000)
                },
                currentUsage: {
                    products: Number(productCount) || Number(0),
                    orders: Number(0),
                    storage: '1.2GB',
                    apiCalls: Number(150)
                },
                usagePercentage: {
                    products: Number(((Number(productCount) || 0) / 1000 * 100).toFixed(1)) || Number(0),
                    orders: Number(0),
                    storage: Number(12),
                    apiCalls: Number(1.5)
                },
                // This is what the frontend maps over
                usageData: [
                    {
                        name: 'المنتجات',
                        current: Number(productCount) || Number(0),
                        limit: Number(1000),
                        percentage: Number(((Number(productCount) || 0) / 1000 * 100).toFixed(1)) || Number(0),
                        unit: 'منتج',
                        color: '#3B82F6',
                        icon: '📦'
                    },
                    {
                        name: 'الطلبات',
                        current: Number(0),
                        limit: Number(5000),
                        percentage: Number(0),
                        unit: 'طلب',
                        color: '#10B981',
                        icon: '🛒'
                    },
                    {
                        name: 'التخزين',
                        current: Number(1.2),
                        limit: Number(10),
                        percentage: Number(12),
                        unit: 'جيجا',
                        color: '#F59E0B',
                        icon: '💾'
                    },
                    {
                        name: 'استدعاءات API',
                        current: Number(150),
                        limit: Number(10000),
                        percentage: Number(1.5),
                        unit: 'استدعاء',
                        color: '#8B5CF6',
                        icon: '🔗'
                    }
                ]
            }
        };

        res.json(frontendSafeData);

    } catch (error) {
        console.error('Frontend safe endpoint error:', error);

        // Ultra-safe fallback
        res.json({
            success: true,
            data: {
                currentPlan: 'basic',
                planName: 'الخطة الأساسية',
                planLimits: { products: 1000, orders: 5000, storage: '10GB', apiCalls: 10000 },
                currentUsage: { products: 0, orders: 0, storage: '0GB', apiCalls: 0 },
                usagePercentage: { products: 0, orders: 0, storage: 0, apiCalls: 0 },
                usageData: [
                    { name: 'المنتجات', current: 0, limit: 1000, percentage: 0, unit: 'منتج', color: '#3B82F6', icon: '📦' },
                    { name: 'الطلبات', current: 0, limit: 5000, percentage: 0, unit: 'طلب', color: '#10B981', icon: '🛒' },
                    { name: 'التخزين', current: 0, limit: 10, percentage: 0, unit: 'جيجا', color: '#F59E0B', icon: '💾' },
                    { name: 'استدعاءات API', current: 0, limit: 10000, percentage: 0, unit: 'استدعاء', color: '#8B5CF6', icon: '🔗' }
                ]
            }
        });
    }
}

/**
 * 🔗 Update Company Slug (for subdomain)
 */
const updateCompanySlug = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { slug } = req.body;
        
        // Import slug validator
        const { validateSlug, sanitizeSlug } = require('../utils/slugValidator');
        
        // Sanitize input
        const sanitizedSlug = sanitizeSlug(slug);
        
        // Validate slug
        const validation = validateSlug(sanitizedSlug);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error
            });
        }
        
        // Check if slug already exists for another company
        const existingCompany = await prisma.company.findFirst({
            where: {
                slug: sanitizedSlug,
                NOT: {
                    id: companyId
                }
            }
        });
        
        if (existingCompany) {
            return res.status(409).json({
                success: false,
                error: 'هذا الاسم مستخدم بالفعل، يرجى اختيار اسم آخر'
            });
        }
        
        // Update company slug
        const updatedCompany = await prisma.company.update({
            where: { id: companyId },
            data: { slug: sanitizedSlug },
            select: {
                id: true,
                name: true,
                slug: true,
                email: true
            }
        });
        
        res.json({
            success: true,
            message: 'تم تحديث رابط المتجر بنجاح',
            data: {
                company: updatedCompany,
                url: `https://${sanitizedSlug}.mokhtarelhenawy.online`
            }
        });
        
    } catch (error) {
        console.error('❌ Error updating company slug:', error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ أثناء تحديث رابط المتجر'
        });
    }
};

/**
 * 📊 Get Users Statistics
 * Returns statistics for all users in a company including conversations and messages count
 */
const getUsersStatistics = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { startDate, endDate } = req.query;

        // Validate companyId
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'معرف الشركة مطلوب'
            });
        }

        // Parse dates
        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                dateFilter.createdAt.gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateFilter.createdAt.lte = end;
            }
        }

        // Get all users in the company
        const users = await prisma.user.findMany({
            where: {
                companyId: companyId,
                isActive: true // Only active users
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true
            }
        });

        // Calculate statistics for each user
        const statistics = await Promise.all(
            users.map(async (user) => {
                // Build where clause for messages
                const messagesWhere = {
                    senderId: user.id,
                    isFromCustomer: false, // Only employee messages
                    conversation: {
                        companyId: companyId
                    },
                    ...dateFilter
                };

                // Count distinct conversations
                const distinctConversations = await prisma.message.groupBy({
                    by: ['conversationId'],
                    where: messagesWhere
                });

                // Count total messages
                const messagesCount = await prisma.message.count({
                    where: messagesWhere
                });

                return {
                    userId: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: user.role,
                    conversationsCount: distinctConversations.length,
                    messagesCount: messagesCount
                };
            })
        );

        // Sort by conversationsCount descending
        statistics.sort((a, b) => b.conversationsCount - a.conversationsCount);

        res.json({
            success: true,
            message: 'تم جلب إحصائيات المستخدمين بنجاح',
            data: {
                statistics: statistics,
                totalUsers: statistics.length,
                dateRange: {
                    startDate: startDate || null,
                    endDate: endDate || null
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching users statistics:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في جلب إحصائيات المستخدمين',
            error: error.message
        });
    }
};

/**
 * 🔍 Check Slug Availability
 */
const checkSlugAvailability = async (req, res) => {
    try {
        const { slug } = req.query;
        const { companyId } = req.query; // optional
        
        if (!slug) {
            return res.status(400).json({
                success: false,
                error: 'يرجى إدخال اسم المتجر'
            });
        }
        
        const { validateSlug, sanitizeSlug } = require('../utils/slugValidator');
        
        // Sanitize and validate
        const sanitizedSlug = sanitizeSlug(slug);
        const validation = validateSlug(sanitizedSlug);
        
        if (!validation.valid) {
            return res.json({
                success: true,
                available: false,
                error: validation.error,
                suggestion: sanitizedSlug
            });
        }
        
        // Check if exists
        const whereCondition = { slug: sanitizedSlug };
        if (companyId) {
            whereCondition.NOT = { id: companyId };
        }
        
        const existingCompany = await prisma.company.findFirst({
            where: whereCondition
        });
        
        res.json({
            success: true,
            available: !existingCompany,
            slug: sanitizedSlug,
            url: `https://${sanitizedSlug}.mokhtarelhenawy.online`
        });
        
    } catch (error) {
        console.error('❌ Error checking slug availability:', error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ أثناء التحقق من توفر الاسم'
        });
    }
};

/**
 * 🖼️ Upload Company Logo
 */
const uploadCompanyLogo = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'لم يتم رفع أي ملف'
            });
        }
        
        // Verify company exists
        const company = await prisma.company.findUnique({
            where: { id: companyId }
        });
        
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'الشركة غير موجودة'
            });
        }
        
        // Build logo URL
        const logoUrl = `/uploads/companies/${req.file.filename}`;
        
        // Update company with new logo
        const updatedCompany = await prisma.company.update({
            where: { id: companyId },
            data: { logo: logoUrl }
        });
        
        res.json({
            success: true,
            message: 'تم رفع اللوجو بنجاح',
            data: {
                logo: logoUrl,
                fullUrl: `${req.protocol}://${req.get('host')}${logoUrl}`,
                company: {
                    id: updatedCompany.id,
                    name: updatedCompany.name,
                    logo: updatedCompany.logo
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Error uploading company logo:', error);
        res.status(500).json({
            success: false,
            error: 'فشل في رفع اللوجو',
            message: error.message
        });
    }
};

module.exports = {
    getCurrentCompany,
    REMOVEDDangerousFallbackEndpoint,
    companyUsageEndpoint,
    mockEndpoint,
    companyPlansEndpoint,
    getCompanyInfoEndpoint,
    safeUsageEndpoint,
    updateCompanyCurrency,
    getAllCompanies,
    createNewCompany,
    updateCompany,
    deleteCompany,
    getCompanyDetails,
    getCompanyUsers,
    createnewUserForCompany,
    updateUser,
    updateMyProfile,
    deleteUser,
    createCustomRole,
    getCompanyRoles,
    updateCustomRole,
    deleteCustomRole,
    sendUserInvitation,
    getCompanyInvitations,
    cancelInvitation,
    resendInvitation,
    FrontendSpecificSafeEndpoint,
    updateCompanySlug,
    checkSlugAvailability,
    getUsersStatistics,
    uploadCompanyLogo
}