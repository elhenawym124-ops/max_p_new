const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function testOrdersList() {
  try {
    const prisma = getSharedPrismaClient();
    const companyId = 'cmem8ayyr004cufakqkcsyn97';
    
    const orders = await prisma.order.findMany({
      where: { companyId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true }
        },
        items: {
          include: {
            product: { select: { id: true, name: true, images: true } }
          }
        }
      }
    });

    console.log('\n=== Testing Orders List API Response ===\n');
    
    orders.forEach(order => {
      let shippingAddress = order.shippingAddress || '';
      try {
        if (typeof shippingAddress === 'string' && shippingAddress.startsWith('{')) {
          shippingAddress = JSON.parse(shippingAddress);
        }
      } catch (e) { }

      const formattedOrder = {
        id: order.orderNumber,
        orderNumber: order.orderNumber,
        customerName: order.customerName || (order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : ''),
        customerPhone: order.customerPhone || order.customer?.phone || '',
        customerEmail: order.customerEmail || order.customer?.email || '',
        customerAddress: order.customerAddress || '',
        city: order.city || '',
        country: order.country || '',
        total: order.total,
        status: order.status.toLowerCase()
      };

      console.log(`\n📦 Order: ${formattedOrder.orderNumber}`);
      console.log(`   Name: ${formattedOrder.customerName}`);
      console.log(`   Phone: ${formattedOrder.customerPhone}`);
      console.log(`   Address: ${formattedOrder.customerAddress}`);
      console.log(`   City: ${formattedOrder.city}`);
      console.log(`   Total: ${formattedOrder.total}`);
      console.log(`   Status: ${formattedOrder.status}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testOrdersList();
