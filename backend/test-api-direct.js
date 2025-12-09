const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function testAPIDirect() {
  try {
    const prisma = getSharedPrismaClient();
    const companyId = 'cmem8ayyr004cufakqkcsyn97';
    
    // Simulate exact API query
    const page = 1;
    const limit = 20;
    const fetchLimit = page * limit;
    const whereClause = { companyId };
    
    const regularOrders = await prisma.order.findMany({
      where: whereClause,
      take: fetchLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true }
        },
        items: {
          include: {
            product: { select: { id: true, name: true, images: true } }
          }
        },
        conversation: { select: { id: true, channel: true } }
      }
    });

    console.log('\n🔍 ===== SIMULATING API LOGIC =====\n');
    
    // Simulate the exact mapping logic from routes/orders.js
    const formattedOrders = regularOrders.slice(0, 5).map(order => {
      // PRIORITY: Use order.customerName from WooCommerce first
      let finalCustomerName = '';
      
      // First: Try order.customerName (from WooCommerce)
      if (order.customerName && order.customerName.trim()) {
        finalCustomerName = order.customerName.trim();
      }
      // Second: Fallback to Customer relation if customerName is empty
      else if (order.customer) {
        const firstName = order.customer.firstName || '';
        const lastName = order.customer.lastName || '';
        finalCustomerName = `${firstName} ${lastName}`.trim();
      }
      // Final fallback: empty string
      else {
        finalCustomerName = '';
      }
      
      return {
        orderNumber: order.orderNumber,
        customerName: finalCustomerName,
        dbCustomerName: order.customerName,
        customerRelation: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'N/A'
      };
    });

    formattedOrders.forEach((order, index) => {
      console.log(`Order #${index + 1}: ${order.orderNumber}`);
      console.log(`  DB customerName: "${order.dbCustomerName}"`);
      console.log(`  Customer relation: "${order.customerRelation}"`);
      console.log(`  ✅ FINAL (API returns): "${order.customerName}"`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testAPIDirect();
