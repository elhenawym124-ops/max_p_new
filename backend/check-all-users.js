const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('./services/sharedDatabase');

async function checkAllUsers() {
  try {
    console.log('🔍 [CHECK-ALL] Checking all users in database...');
    
    // Initialize database
    await initializeSharedDatabase();
    const prisma = getSharedPrismaClient();
    
    // Get all users
    const users = await executeWithRetry(async () => {
      return await prisma.user.findMany({
        include: {
          company: {
            select: {
              id: true,
              name: true,
              isActive: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    }, 3);
    
    console.log(`\n📊 [CHECK-ALL] Total users found: ${users.length}\n`);
    
    if (users.length === 0) {
      console.log('❌ [CHECK-ALL] No users found in database!');
      console.log('💡 [CHECK-ALL] Database might be empty or reset');
      return;
    }
    
    console.log('📋 [CHECK-ALL] Users list:');
    console.log('='.repeat(80));
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User Details:`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.isActive ? '✅ YES' : '❌ NO'}`);
      console.log(`   Email Verified: ${user.isEmailVerified ? '✅ YES' : '❌ NO'}`);
      console.log(`   Created: ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}`);
      console.log(`   Company: ${user.company ? `${user.company.name} (${user.company.isActive ? 'Active' : 'Inactive'})` : 'NONE'}`);
    });
    
    // Check for ali@ali.com specifically
    const aliUser = users.find(u => u.email.toLowerCase() === 'ali@ali.com');
    if (aliUser) {
      console.log('\n✅ [CHECK-ALL] ali@ali.com FOUND in the list above!');
    } else {
      console.log('\n❌ [CHECK-ALL] ali@ali.com NOT FOUND in database');
    }
    
    // Get all companies
    console.log('\n\n🏢 [CHECK-ALL] Companies list:');
    console.log('='.repeat(80));
    
    const companies = await executeWithRetry(async () => {
      return await prisma.company.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });
    }, 3);
    
    console.log(`\n📊 Total companies found: ${companies.length}\n`);
    
    companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name}`);
      console.log(`   Email: ${company.email}`);
      console.log(`   ID: ${company.id}`);
      console.log(`   Active: ${company.isActive ? '✅ YES' : '❌ NO'}`);
      console.log(`   Plan: ${company.plan}`);
      console.log(`   Created: ${company.createdAt ? new Date(company.createdAt).toLocaleString() : 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ [CHECK-ALL] Error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the check
checkAllUsers().then(() => {
  console.log('\n✅ Check completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Check failed:', error);
  process.exit(1);
});




