const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkOrder() {
  try {
    const prisma = getSharedPrismaClient();
    
    const order = await prisma.order.findUnique({
      where: { orderNumber: 'WOO-25374' },
      include: {
        customer: true
      }
    });
    
    if (!order) {
      console.log('❌ Order not found!');
      process.exit(1);
    }
    
    console.log('\n🔍 ===== ORDER WOO-25374 DATA =====\n');
    
    console.log('📝 Order Fields:');
    console.log(`   customerName: "${order.customerName}"`);
    console.log(`   customerPhone: "${order.customerPhone}"`);
    console.log(`   customerEmail: "${order.customerEmail}"`);
    console.log(`   customerAddress: "${order.customerAddress}"`);
    console.log(`   city: "${order.city}"`);
    
    console.log('\n📦 Shipping Address (JSON):');
    console.log(`   Raw: ${order.shippingAddress}`);
    
    if (order.shippingAddress) {
      try {
        const parsed = typeof order.shippingAddress === 'string' 
          ? JSON.parse(order.shippingAddress) 
          : order.shippingAddress;
        console.log(`   Parsed:`, JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log(`   Parse error: ${e.message}`);
      }
    }
    
    console.log('\n📦 Billing Address (JSON):');
    console.log(`   Raw: ${order.billingAddress}`);
    
    if (order.billingAddress) {
      try {
        const parsed = typeof order.billingAddress === 'string' 
          ? JSON.parse(order.billingAddress) 
          : order.billingAddress;
        console.log(`   Parsed:`, JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log(`   Parse error: ${e.message}`);
      }
    }
    
    console.log('\n👤 Customer Data:');
    if (order.customer) {
      console.log(`   ID: ${order.customer.id}`);
      console.log(`   Name: ${order.customer.firstName} ${order.customer.lastName}`);
      console.log(`   Phone: ${order.customer.phone}`);
      console.log(`   Email: ${order.customer.email}`);
    } else {
      console.log('   No customer relation');
    }
    
    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkOrder();
