const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function testConversationsAPI() {
  try {
    const prisma = getSharedPrismaClient();
    const companyId = 'cmem8ayyr004cufakqkcsyn97';
    const platform = 'telegram';
    
    console.log('\n🔍 Testing Conversations API Query...\n');
    console.log(`CompanyID: ${companyId}`);
    console.log(`Platform: ${platform}\n`);
    
    const where = {
      companyId: companyId,
      channel: platform.toUpperCase()
    };
    
    console.log('WHERE clause:', JSON.stringify(where, null, 2));
    
    try {
      console.log('\n📊 Executing findMany...');
      const conversations = await prisma.conversation.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              profilePic: true
            }
          }
        },
        orderBy: {
          lastMessageAt: 'desc'
        },
        take: 10
      });
      
      console.log(`✅ Found ${conversations.length} conversations\n`);
      
      conversations.slice(0, 3).forEach((conv, index) => {
        console.log(`Conversation #${index + 1}:`);
        console.log(`  ID: ${conv.id}`);
        console.log(`  Customer: ${conv.customer ? `${conv.customer.firstName} ${conv.customer.lastName}` : 'N/A'}`);
        console.log(`  Channel: ${conv.channel}`);
        console.log(`  Last Message: ${conv.lastMessagePreview || 'N/A'}`);
        console.log('');
      });
      
    } catch (queryError) {
      console.error('❌ Query Error:', queryError.message);
      console.error('Stack:', queryError.stack);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testConversationsAPI();
