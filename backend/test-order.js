const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrder() {
  try {
    const order = await prisma.order.findFirst({
      where: {
        wooCommerceId: '25305'
      },
      select: {
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        customerAddress: true,
        city: true,
        notes: true,
        total: true,
        status: true,
        createdAt: true
      }
    });

    if (order) {
      console.log('\n=== Order Data in Database ===');
      console.log(JSON.stringify(order, null, 2));
      console.log('\n=== Field Analysis ===');
      console.log(`customerName: ${order.customerName ? '✅ EXISTS' : '❌ MISSING'} - "${order.customerName}"`);
      console.log(`customerPhone: ${order.customerPhone ? '✅ EXISTS' : '❌ MISSING'} - "${order.customerPhone}"`);
      console.log(`customerEmail: ${order.customerEmail ? '✅ EXISTS' : '❌ MISSING'} - "${order.customerEmail}"`);
      console.log(`customerAddress: ${order.customerAddress ? '✅ EXISTS' : '❌ MISSING'} - "${order.customerAddress}"`);
      console.log(`city: ${order.city ? '✅ EXISTS' : '❌ MISSING'} - "${order.city}"`);
      console.log(`notes: ${order.notes ? '✅ EXISTS' : '❌ MISSING'} - "${order.notes}"`);
    } else {
      console.log('❌ Order not found in database');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrder();
