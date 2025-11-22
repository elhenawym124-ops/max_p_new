/**
 * Company Identification Middleware
 * Extracts company information from subdomain for public storefront routes
 */

const { getSharedPrismaClient } = require('../services/sharedDatabase');

// Helper function to get Prisma client
function getPrisma() {
  return getSharedPrismaClient();
}

/**
 * Middleware to identify company from subdomain
 * This should be applied to all public routes
 */
const getCompanyFromSubdomain = async (req, res, next) => {
  try {
    console.log('🔍 [Company Middleware] ===== Company Resolution =====');
    console.log('🔍 [Company Middleware] Request URL:', req.originalUrl);
    console.log('🔍 [Company Middleware] Query params:', req.query);
    console.log('🔍 [Company Middleware] Headers host:', req.headers.host);
    console.log('🔍 [Company Middleware] Headers x-subdomain:', req.headers['x-subdomain']);
    
    const prisma = getPrisma();
    let company = null;

    // Method 1: Try to get from subdomain (PRIMARY METHOD)
    const hostHeader = req.headers['x-subdomain'] || req.headers['host'];
    
    if (hostHeader) {
      // استخراج الـ subdomain من hostname
      const hostname = hostHeader.split(':')[0]; // إزالة port إن وجد
      const parts = hostname.split('.');
      
      // التحقق من وجود subdomain
      // مثال: storename.mokhtarelhenawy.online -> storename
      if (parts.length >= 3 && parts[0] !== 'www') {
        const subdomain = parts[0];
        
        console.log('🔍 [Company Middleware] Extracted subdomain:', subdomain);
        
        // البحث عن الشركة باستخدام slug
        company = await prisma.company.findFirst({
          where: {
            slug: subdomain,
            isActive: true
          },
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            settings: true,
            isActive: true,
            email: true,
            phone: true,
            website: true,
            currency: true
          }
        });
        
        if (company) {
          console.log('✅ [Company Middleware] Company found via subdomain:', company.name);
        }
      }
    }
    
    // Method 2: Fallback to subdomain from header
    if (!company && req.headers['x-company-subdomain']) {
      const subdomain = req.headers['x-company-subdomain'];
      console.log('🔍 [Company Middleware] Fallback to subdomain from header:', subdomain);
      
      company = await prisma.company.findFirst({
        where: {
          slug: subdomain,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          settings: true,
          isActive: true,
          email: true,
          phone: true,
          website: true,
          currency: true
        }
      });
      
      if (company) {
        console.log('✅ [Company Middleware] Company found via subdomain header:', company.name);
      }
    }

    // Method 3: Fallback to subdomain from query parameter
    if (!company && req.query.subdomain) {
      const subdomain = req.query.subdomain;
      console.log('🔍 [Company Middleware] Fallback to subdomain from query:', subdomain);
      
      company = await prisma.company.findFirst({
        where: {
          slug: subdomain,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          settings: true,
          isActive: true,
          email: true,
          phone: true,
          website: true,
          currency: true
        }
      });
      
      if (company) {
        console.log('✅ [Company Middleware] Company found via subdomain query:', company.name);
      }
    }
    
    // Method 3: Fallback to companyId from header (for development)
    if (!company && req.headers['x-company-id']) {
      const companyId = req.headers['x-company-id'];
      console.log('🔍 [Company Middleware] Fallback to companyId from header:', companyId);
      
      // Try to find by ID first
      company = await prisma.company.findFirst({
        where: {
          id: companyId,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          settings: true,
          isActive: true,
          email: true,
          phone: true,
          website: true,
          currency: true
        }
      });
      
      // If not found by ID, try by slug
      if (!company) {
        console.log('🔍 [Company Middleware] Not found by ID in header, trying slug...');
        company = await prisma.company.findFirst({
          where: {
            slug: companyId,
            isActive: true
          },
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            settings: true,
            isActive: true,
            email: true,
            phone: true,
            website: true,
            currency: true
          }
        });
      }
      
      if (company) {
        console.log('✅ [Company Middleware] Company found via companyId header:', company.name);
      }
    }

    // Method 4: Fallback to companyId from query parameter (for backward compatibility)
    // Try both ID and slug since companyId might be either
    if (!company && req.query.companyId) {
      const companyId = req.query.companyId;
      console.log('🔍 [Company Middleware] Fallback to companyId from query:', companyId);
      
      // Try to find by ID first
      company = await prisma.company.findFirst({
        where: {
          id: companyId,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          settings: true,
          isActive: true,
          email: true,
          phone: true,
          website: true,
          currency: true
        }
      });
      
      // If not found by ID, try by slug
      if (!company) {
        console.log('🔍 [Company Middleware] Not found by ID, trying slug...');
        company = await prisma.company.findFirst({
          where: {
            slug: companyId,
            isActive: true
          },
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            settings: true,
            isActive: true,
            email: true,
            phone: true,
            website: true,
            currency: true
          }
        });
      }
      
      if (company) {
        console.log('✅ [Company Middleware] Company found via companyId query:', company.name);
      } else {
        console.log('❌ [Company Middleware] Company not found by ID or slug:', companyId);
      }
    }

    // إذا لم يتم العثور على الشركة
    if (!company) {
      console.log('❌ [Company Middleware] Company not found!');
      console.log('❌ [Company Middleware] Tried subdomain from host:', hostHeader);
      console.log('❌ [Company Middleware] Tried subdomain from header:', req.headers['x-company-subdomain']);
      console.log('❌ [Company Middleware] Tried subdomain from query:', req.query.subdomain);
      console.log('❌ [Company Middleware] Tried companyId from header:', req.headers['x-company-id']);
      console.log('❌ [Company Middleware] Tried companyId from query:', req.query.companyId);
      
      // In development mode, allow requests to continue even if company not found
      // This allows testing without requiring a company in the database
      const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
      
      if (isDevelopment && (req.query.companyId || req.headers['x-company-id'])) {
        const companyId = req.query.companyId || req.headers['x-company-id'];
        console.log('⚠️ [Company Middleware] Development mode: Allowing request with companyId:', companyId);
        console.log('⚠️ [Company Middleware] Note: Company not found in database, but allowing request to proceed');
        
        // Create a mock company object for development
        req.company = {
          id: companyId,
          name: 'Development Company',
          slug: companyId,
          isActive: true
        };
        req.companyId = companyId;
        
        return next();
      }
      
      return res.status(404).json({ 
        success: false, 
        error: 'المتجر غير موجود أو غير نشط',
        hint: 'استخدم https://storename.mokhtarelhenawy.online أو أضف ?companyId=xxx'
      });
    }

    // Add company to request object
    req.company = company;
    req.companyId = company.id;
    
    next();
  } catch (error) {
    console.error('❌ [Company Middleware] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Middleware to validate company ownership for authenticated routes
 * Ensures the user belongs to the same company as the subdomain
 */
const validateCompanyOwnership = (req, res, next) => {
  try {
    // If no company identified yet, skip validation
    if (!req.company) {
      return next();
    }

    // If no user authenticated, skip validation
    if (!req.user) {
      return next();
    }

    // Check if user belongs to the identified company
    if (req.user.companyId !== req.company.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied: You do not belong to this company' 
      });
    }

    next();
  } catch (error) {
    console.error('Error in company ownership validation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Middleware to add CORS headers for public routes
 * Allows cross-origin requests from the company's frontend
 */
const addPublicCORS = (req, res, next) => {
  try {
    const origin = req.get('origin');
    
    // Always set CORS headers for public routes
    if (origin) {
      // Check if origin is allowed
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
      const isMokhtarDomain = origin.includes('mokhtarelhenawy.online');
      
      if (isLocalhost || isMokhtarDomain) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      }
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-cart-id, x-session-id, X-Company-Subdomain, X-Company-Id');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    next();
  } catch (error) {
    console.error('Error in public CORS middleware:', error);
    next();
  }
};

module.exports = {
  getCompanyFromSubdomain,
  validateCompanyOwnership,
  addPublicCORS
};
