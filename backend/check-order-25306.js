const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkOrder() {
  try {
    const prisma = getSharedPrismaClient();
    
    const order = await prisma.order.findFirst({
      where: { orderNumber: 'WOO-25306' },
      include: { customer: true }
    });

    console.log('\n=== Order WOO-25306 Raw Data ===');
    console.log(JSON.stringify(order, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkOrder();
