const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('./services/sharedDatabase');
const bcrypt = require('bcryptjs');

async function checkAliUser() {
  try {
    console.log('🔍 [CHECK-ALI] Checking user status for ali@ali.com...');
    
    // Initialize database
    await initializeSharedDatabase();
    const prisma = getSharedPrismaClient();
    
    const email = 'ali@ali.com';
    
    // Check if user exists
    const user = await executeWithRetry(async () => {
      return await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              plan: true,
              isActive: true
            }
          }
        }
      });
    }, 3);
    
    if (!user) {
      console.log('❌ [CHECK-ALI] User NOT FOUND in database');
      console.log('💡 [CHECK-ALI] Solution: Run "node backend/fix-ali-user.js" to create the user');
      return;
    }
    
    console.log('\n✅ [CHECK-ALI] User found!');
    console.log('\n📋 User Details:');
    console.log(`   Email: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Is Active: ${user.isActive ? '✅ YES' : '❌ NO'}`);
    console.log(`   Email Verified: ${user.isEmailVerified ? '✅ YES' : '❌ NO'}`);
    console.log(`   Company ID: ${user.companyId || 'NONE'}`);
    
    if (user.company) {
      console.log('\n🏢 Company Details:');
      console.log(`   Name: ${user.company.name}`);
      console.log(`   ID: ${user.company.id}`);
      console.log(`   Plan: ${user.company.plan}`);
      console.log(`   Is Active: ${user.company.isActive ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('\n⚠️ [CHECK-ALI] User has NO COMPANY associated');
      if (user.role !== 'SUPER_ADMIN') {
        console.log('❌ [CHECK-ALI] This will cause login to fail!');
        console.log('💡 [CHECK-ALI] Solution: Run "node backend/fix-ali-user.js" to fix');
      }
    }
    
    // Check potential login issues
    console.log('\n🔍 [CHECK-ALI] Login Status Check:');
    const issues = [];
    
    if (!user.isActive) {
      issues.push('❌ User account is INACTIVE');
    }
    
    if (!user.isEmailVerified) {
      issues.push('⚠️ Email is not verified (might not block login)');
    }
    
    if (!user.company && user.role !== 'SUPER_ADMIN') {
      issues.push('❌ User has NO COMPANY (will block login)');
    }
    
    if (user.company && !user.company.isActive) {
      issues.push('❌ Company account is INACTIVE');
    }
    
    if (issues.length === 0) {
      console.log('✅ All checks passed! User should be able to login.');
      console.log('💡 If login still fails, check the password.');
    } else {
      console.log('❌ Issues found:');
      issues.forEach(issue => console.log(`   ${issue}`));
      console.log('\n💡 Solution: Run "node backend/fix-ali-user.js" to fix these issues');
    }
    
    // Test password if provided
    if (process.argv[2]) {
      const testPassword = process.argv[2];
      console.log(`\n🔑 [CHECK-ALI] Testing password: ${testPassword}`);
      const isPasswordValid = await bcrypt.compare(testPassword, user.password);
      console.log(`   Password match: ${isPasswordValid ? '✅ YES' : '❌ NO'}`);
      
      if (!isPasswordValid) {
        console.log('❌ [CHECK-ALI] Password is INCORRECT');
        console.log('💡 [CHECK-ALI] Solution: Run "node backend/fix-ali-user.js" to reset password');
      }
    } else {
      console.log('\n💡 [CHECK-ALI] Tip: Test password by running:');
      console.log('   node backend/check-ali-user.js <password>');
    }
    
  } catch (error) {
    console.error('❌ [CHECK-ALI] Error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the check
checkAliUser().then(() => {
  console.log('\n✅ Check completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Check failed:', error);
  process.exit(1);
});




