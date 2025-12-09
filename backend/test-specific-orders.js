const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function testSpecificOrders() {
  try {
    const prisma = getSharedPrismaClient();
    
    const orderNumbers = ['WOO-25306', 'WOO-25307', 'WOO-25305'];
    
    console.log('\n🔍 ===== TESTING SPECIFIC ORDERS =====\n');
    
    for (const orderNumber of orderNumbers) {
      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      });
      
      if (!order) {
        console.log(`❌ Order ${orderNumber} not found!\n`);
        continue;
      }
      
      // Apply the same logic as API
      let finalCustomerName = '';
      
      if (order.customerName && order.customerName.trim()) {
        finalCustomerName = order.customerName.trim();
      } else if (order.customer) {
        const firstName = order.customer.firstName || '';
        const lastName = order.customer.lastName || '';
        finalCustomerName = `${firstName} ${lastName}`.trim();
      } else {
        finalCustomerName = '';
      }
      
      console.log(`📦 ${orderNumber}:`);
      console.log(`   DB customerName: "${order.customerName}"`);
      console.log(`   Customer: ${order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'N/A'}`);
      console.log(`   ✅ API will return: "${finalCustomerName}"`);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testSpecificOrders();
