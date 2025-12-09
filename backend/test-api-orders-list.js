const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function testAPIOrdersList() {
  try {
    const prisma = getSharedPrismaClient();
    const companyId = 'cmem8ayyr004cufakqkcsyn97';
    
    // Simulate the exact API query
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

    console.log('\n=== API Response Simulation ===\n');
    
    regularOrders.slice(0, 5).forEach(order => {
      const formattedOrder = {
        orderNumber: order.orderNumber,
        customerName: order.customerName || (order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : ''),
        customerPhone: order.customerPhone || order.customer?.phone || '',
      };
      
      console.log(`Order: ${formattedOrder.orderNumber}`);
      console.log(`  API customerName: "${formattedOrder.customerName}"`);
      console.log(`  DB customerName: "${order.customerName}"`);
      console.log(`  Customer table: "${order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'N/A'}"\n`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testAPIOrdersList();
