const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkEmptyNames() {
  try {
    const prisma = getSharedPrismaClient();
    const companyId = 'cmem8ayyr004cufakqkcsyn97';
    
    const orders = await prisma.order.findMany({
      where: { 
        companyId,
        OR: [
          { customerName: null },
          { customerName: '' }
        ]
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        orderNumber: true,
        customerName: true,
        customer: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    console.log(`\n❌ Found ${orders.length} orders with empty customerName:\n`);
    
    orders.forEach(order => {
      console.log(`Order: ${order.orderNumber}`);
      console.log(`  customerName: "${order.customerName}"`);
      console.log(`  Customer: ${order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'N/A'}\n`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkEmptyNames();
