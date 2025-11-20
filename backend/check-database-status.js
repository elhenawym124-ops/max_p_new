const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('./services/sharedDatabase');

async function checkDatabaseStatus() {
  try {
    console.log('🔍 [DB-STATUS] Checking database status...\n');
    
    // Initialize database
    await initializeSharedDatabase();
    const prisma = getSharedPrismaClient();
    
    const stats = {};
    
    // Check Users
    console.log('📊 Checking Users...');
    const userCount = await executeWithRetry(async () => {
      return await prisma.user.count();
    }, 3);
    stats.users = userCount;
    console.log(`   ✅ Users: ${userCount}`);
    
    // Check Companies
    console.log('📊 Checking Companies...');
    const companyCount = await executeWithRetry(async () => {
      return await prisma.company.count();
    }, 3);
    stats.companies = companyCount;
    console.log(`   ✅ Companies: ${companyCount}`);
    
    // Check Customers
    console.log('📊 Checking Customers...');
    const customerCount = await executeWithRetry(async () => {
      return await prisma.customer.count();
    }, 3);
    stats.customers = customerCount;
    console.log(`   ✅ Customers: ${customerCount}`);
    
    // Check Conversations
    console.log('📊 Checking Conversations...');
    const conversationCount = await executeWithRetry(async () => {
      return await prisma.conversation.count();
    }, 3);
    stats.conversations = conversationCount;
    console.log(`   ✅ Conversations: ${conversationCount}`);
    
    // Check Messages
    console.log('📊 Checking Messages...');
    const messageCount = await executeWithRetry(async () => {
      return await prisma.message.count();
    }, 3);
    stats.messages = messageCount;
    console.log(`   ✅ Messages: ${messageCount}`);
    
    // Check Products
    console.log('📊 Checking Products...');
    const productCount = await executeWithRetry(async () => {
      return await prisma.product.count();
    }, 3);
    stats.products = productCount;
    console.log(`   ✅ Products: ${productCount}`);
    
    // Check Orders
    console.log('📊 Checking Orders...');
    const orderCount = await executeWithRetry(async () => {
      return await prisma.order.count();
    }, 3);
    stats.orders = orderCount;
    console.log(`   ✅ Orders: ${orderCount}`);
    
    // Check Facebook Pages
    console.log('📊 Checking Facebook Pages...');
    const facebookPageCount = await executeWithRetry(async () => {
      return await prisma.facebookPage.count();
    }, 3);
    stats.facebookPages = facebookPageCount;
    console.log(`   ✅ Facebook Pages: ${facebookPageCount}`);
    
    // Check Facebook Comments
    console.log('📊 Checking Facebook Comments...');
    const facebookCommentCount = await executeWithRetry(async () => {
      return await prisma.facebookComment.count();
    }, 3);
    stats.facebookComments = facebookCommentCount;
    console.log(`   ✅ Facebook Comments: ${facebookCommentCount}`);
    
    // Check Categories
    console.log('📊 Checking Categories...');
    const categoryCount = await executeWithRetry(async () => {
      return await prisma.category.count();
    }, 3);
    stats.categories = categoryCount;
    console.log(`   ✅ Categories: ${categoryCount}`);
    
    // Check Integrations
    console.log('📊 Checking Integrations...');
    const integrationCount = await executeWithRetry(async () => {
      return await prisma.integration.count();
    }, 3);
    stats.integrations = integrationCount;
    console.log(`   ✅ Integrations: ${integrationCount}`);
    
    // Check User Invitations
    console.log('📊 Checking User Invitations...');
    const invitationCount = await executeWithRetry(async () => {
      return await prisma.userInvitation.count();
    }, 3);
    stats.invitations = invitationCount;
    console.log(`   ✅ User Invitations: ${invitationCount}`);
    
    // Check AI Interactions
    console.log('📊 Checking AI Interactions...');
    const aiInteractionCount = await executeWithRetry(async () => {
      return await prisma.aiInteraction.count();
    }, 3);
    stats.aiInteractions = aiInteractionCount;
    console.log(`   ✅ AI Interactions: ${aiInteractionCount}`);
    
    // Check Tasks
    console.log('📊 Checking Tasks...');
    const taskCount = await executeWithRetry(async () => {
      return await prisma.task.count();
    }, 3);
    stats.tasks = taskCount;
    console.log(`   ✅ Tasks: ${taskCount}`);
    
    // Check Projects
    console.log('📊 Checking Projects...');
    const projectCount = await executeWithRetry(async () => {
      return await prisma.project.count();
    }, 3);
    stats.projects = projectCount;
    console.log(`   ✅ Projects: ${projectCount}`);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 DATABASE SUMMARY');
    console.log('='.repeat(60));
    console.log(`👥 Users: ${stats.users}`);
    console.log(`🏢 Companies: ${stats.companies}`);
    console.log(`👤 Customers: ${stats.customers}`);
    console.log(`💬 Conversations: ${stats.conversations}`);
    console.log(`📨 Messages: ${stats.messages}`);
    console.log(`📦 Products: ${stats.products}`);
    console.log(`🛒 Orders: ${stats.orders}`);
    console.log(`📘 Facebook Pages: ${stats.facebookPages}`);
    console.log(`💬 Facebook Comments: ${stats.facebookComments}`);
    console.log(`📁 Categories: ${stats.categories}`);
    console.log(`🔗 Integrations: ${stats.integrations}`);
    console.log(`📧 Invitations: ${stats.invitations}`);
    console.log(`🤖 AI Interactions: ${stats.aiInteractions}`);
    console.log(`✅ Tasks: ${stats.tasks}`);
    console.log(`📁 Projects: ${stats.projects}`);
    console.log('='.repeat(60));
    
    // Determine if database is empty
    const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);
    const essentialRecords = stats.users + stats.companies;
    
    if (essentialRecords === 0) {
      console.log('\n❌ DATABASE IS COMPLETELY EMPTY');
      console.log('   No users or companies found!');
    } else if (totalRecords === essentialRecords) {
      console.log('\n⚠️  DATABASE IS MOSTLY EMPTY');
      console.log('   Only users and companies exist.');
      console.log('   All other data (customers, conversations, etc.) is missing.');
    } else if (totalRecords < 10) {
      console.log('\n⚠️  DATABASE HAS MINIMAL DATA');
      console.log('   Very few records found.');
    } else {
      console.log('\n✅ DATABASE HAS DATA');
      console.log(`   Total records: ${totalRecords}`);
    }
    
    // Check if recent users were created
    if (stats.users > 0) {
      console.log('\n📅 Checking user creation dates...');
      const recentUsers = await executeWithRetry(async () => {
        return await prisma.user.findMany({
          select: {
            email: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        });
      }, 3);
      
      recentUsers.forEach(user => {
        const date = new Date(user.createdAt);
        const now = new Date();
        const diffHours = (now - date) / (1000 * 60 * 60);
        console.log(`   ${user.email}: Created ${diffHours.toFixed(1)} hours ago (${date.toLocaleString()})`);
      });
    }
    
  } catch (error) {
    console.error('❌ [DB-STATUS] Error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the check
checkDatabaseStatus().then(() => {
  console.log('\n✅ Check completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Check failed:', error);
  process.exit(1);
});




