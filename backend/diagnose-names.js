const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function diagnoseNames() {
  try {
    const prisma = getSharedPrismaClient();
    const companyId = 'cmem8ayyr004cufakqkcsyn97';
    
    console.log('\n🔍 ===== DIAGNOSIS REPORT =====\n');
    
    // Get top 5 orders with full details
    const orders = await prisma.order.findMany({
      where: { companyId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { 
            id: true,
            firstName: true, 
            lastName: true,
            phone: true,
            email: true
          }
        }
      }
    });

    orders.forEach((order, index) => {
      console.log(`\n📦 Order #${index + 1}: ${order.orderNumber}`);
      console.log('─'.repeat(60));
      
      // Order.customerName field
      console.log(`📝 order.customerName: "${order.customerName || 'NULL'}"`);
      
      // Customer relation
      if (order.customer) {
        console.log(`👤 Customer ID: ${order.customer.id}`);
        console.log(`   firstName: "${order.customer.firstName || 'NULL'}"`);
        console.log(`   lastName: "${order.customer.lastName || 'NULL'}"`);
        console.log(`   Combined: "${order.customer.firstName} ${order.customer.lastName}"`);
      } else {
        console.log(`👤 Customer: NO RELATION (customerId: ${order.customerId})`);
      }
      
      // What should be displayed
      let finalName = '';
      if (order.customer && (order.customer.firstName || order.customer.lastName)) {
        finalName = `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim();
      } else if (order.customerName) {
        finalName = order.customerName;
      }
      
      console.log(`\n✅ SHOULD DISPLAY: "${finalName}"`);
      console.log('─'.repeat(60));
    });
    
    console.log('\n\n🎯 ===== RECOMMENDATION =====\n');
    console.log('Based on the data above, the correct priority should be:');
    console.log('1. Use order.customerName (from WooCommerce) if available');
    console.log('2. Fallback to Customer.firstName + Customer.lastName if customerName is empty');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

diagnoseNames();
