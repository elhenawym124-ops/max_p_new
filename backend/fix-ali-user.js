const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('./services/sharedDatabase');
const bcrypt = require('bcryptjs');

async function fixAliUser() {
  try {
    console.log('🔧 [FIX-ALI] Starting user fix for ali@ali.com...');
    
    // Initialize database
    await initializeSharedDatabase();
    const prisma = getSharedPrismaClient();
    
    const email = 'ali@ali.com';
    const password = '0165676135'; // Default password based on fix_ali_correct_password.js
    
    // Check if user exists
    console.log('🔍 [FIX-ALI] Checking if user exists...');
    let user = await executeWithRetry(async () => {
      return await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          company: true
        }
      });
    }, 3);
    
    if (user) {
      console.log('✅ [FIX-ALI] User found:', {
        email: user.email,
        isActive: user.isActive,
        hasCompany: !!user.company,
        companyId: user.companyId,
        role: user.role
      });
      
      // Ensure user has a company
      if (!user.company && user.role !== 'SUPER_ADMIN') {
        console.log('⚠️ [FIX-ALI] User has no company, creating one...');
        
        // Find or create a company
        let company = await executeWithRetry(async () => {
          return await prisma.company.findFirst();
        }, 3);
        
        if (!company) {
          company = await executeWithRetry(async () => {
            return await prisma.company.create({
              data: {
                name: 'شركة علي',
                email: email,
                phone: '+201234567890',
                plan: 'PRO',
                isActive: true
              }
            });
          }, 3);
          console.log('✅ [FIX-ALI] Created company:', company.name);
        }
        
        // Update user with company
        user = await executeWithRetry(async () => {
          return await prisma.user.update({
            where: { id: user.id },
            data: {
              companyId: company.id
            },
            include: {
              company: true
            }
          });
        }, 3);
        console.log('✅ [FIX-ALI] Updated user with company');
      }
      
      // Ensure user and company are active
      const updates = {};
      if (!user.isActive) {
        updates.isActive = true;
        console.log('⚠️ [FIX-ALI] User is inactive, activating...');
      }
      if (!user.isEmailVerified) {
        updates.isEmailVerified = true;
        updates.emailVerifiedAt = new Date();
        console.log('⚠️ [FIX-ALI] User email not verified, verifying...');
      }
      if (user.company && !user.company.isActive) {
        console.log('⚠️ [FIX-ALI] Company is inactive, activating...');
        await executeWithRetry(async () => {
          return await prisma.company.update({
            where: { id: user.company.id },
            data: { isActive: true }
          });
        }, 3);
      }
      
      if (Object.keys(updates).length > 0) {
        user = await executeWithRetry(async () => {
          return await prisma.user.update({
            where: { id: user.id },
            data: updates,
            include: {
              company: true
            }
          });
        }, 3);
        console.log('✅ [FIX-ALI] Updated user status');
      }
      
      // Update password
      console.log('🔑 [FIX-ALI] Updating password...');
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await executeWithRetry(async () => {
        return await prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword
          },
          include: {
            company: true
          }
        });
      }, 3);
      
      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password);
      console.log('✅ [FIX-ALI] Password verification:', passwordMatch ? 'PASS' : 'FAIL');
      
    } else {
      console.log('❌ [FIX-ALI] User not found, creating new user...');
      
      // Find or create a company
      let company = await executeWithRetry(async () => {
        return await prisma.company.findFirst();
      }, 3);
      
      if (!company) {
        company = await executeWithRetry(async () => {
          return await prisma.company.create({
            data: {
              name: 'شركة علي',
              email: email,
              phone: '+201234567890',
              plan: 'PRO',
              isActive: true
            }
          });
        }, 3);
        console.log('✅ [FIX-ALI] Created company:', company.name);
      }
      
      // Create user
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await executeWithRetry(async () => {
        return await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName: 'علي',
            lastName: 'المستخدم',
            role: 'COMPANY_ADMIN',
            isActive: true,
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
            companyId: company.id
          },
          include: {
            company: true
          }
        });
      }, 3);
      
      console.log('✅ [FIX-ALI] Created user:', user.email);
      
      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password);
      console.log('✅ [FIX-ALI] Password verification:', passwordMatch ? 'PASS' : 'FAIL');
    }
    
    console.log('\n🎉 [FIX-ALI] User fix completed!');
    console.log('\n📋 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   User Active: ${user.isActive}`);
    console.log(`   Email Verified: ${user.isEmailVerified}`);
    console.log(`   Has Company: ${!!user.company}`);
    console.log(`   Company Active: ${user.company?.isActive || 'N/A'}`);
    console.log(`   Role: ${user.role}`);
    
  } catch (error) {
    console.error('❌ [FIX-ALI] Error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the fix
fixAliUser().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});




