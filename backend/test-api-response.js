const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function testAPIResponse() {
  try {
    const prisma = getSharedPrismaClient();
    
    const order = await prisma.order.findFirst({
      where: {
        orderNumber: 'WOO-25305'
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      console.log('❌ Order not found');
      return;
    }

    // Simulate API response format
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
      status: order.status,
      items: order.items
    };

    console.log('\n=== Formatted API Response ===');
    console.log(JSON.stringify(formattedOrder, null, 2));
    
    console.log('\n=== Field Check ===');
    console.log(`customerName: ${formattedOrder.customerName ? '✅' : '❌'} - "${formattedOrder.customerName}"`);
    console.log(`customerPhone: ${formattedOrder.customerPhone ? '✅' : '❌'} - "${formattedOrder.customerPhone}"`);
    console.log(`customerEmail: ${formattedOrder.customerEmail ? '✅' : '❌'} - "${formattedOrder.customerEmail}"`);
    console.log(`customerAddress: ${formattedOrder.customerAddress ? '✅' : '❌'} - "${formattedOrder.customerAddress}"`);
    console.log(`city: ${formattedOrder.city ? '✅' : '❌'} - "${formattedOrder.city}"`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testAPIResponse();
