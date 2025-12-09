const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkCustomerNames() {
  try {
    const prisma = getSharedPrismaClient();
    const companyId = 'cmem8ayyr004cufakqkcsyn97';
    
    const orders = await prisma.order.findMany({
      where: { companyId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        orderNumber: true,
        customerName: true,
        wooCommerceId: true,
        customer: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    console.log('\n=== Customer Names Analysis ===\n');
    
    orders.forEach(order => {
      const dbName = order.customerName;
      const customerName = order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : '';
      const match = dbName === customerName ? '✅' : '❌';
      
      console.log(`Order: ${order.orderNumber} (WooCommerce ID: ${order.wooCommerceId})`);
      console.log(`  DB customerName: "${dbName}"`);
      console.log(`  Customer table: "${customerName}"`);
      console.log(`  Match: ${match}\n`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkCustomerNames();
