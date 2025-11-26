const { getSharedPrismaClient, safeQuery } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();

const createPOSOrder = async (req, res) => {
  try {
    const { cart, customer, paymentMethod = 'CASH' } = req.body;
    const companyId = req.user.companyId;
    const userId = req.user.id;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ success: false, message: 'السلة فارغة' });
    }

    // 1. Verify Products & Calculate Totals (Security Check)
    let calculatedTotal = 0;
    let calculatedSubtotal = 0;
    const orderItemsData = [];

    // Fetch real product data to avoid frontend manipulation
    const productIds = cart.map(item => item.id);
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        companyId: companyId
      },
      include: {
        inventory: true // Include inventory to check stock
      }
    });

    // Validate stock and prices
    for (const cartItem of cart) {
      const dbProduct = dbProducts.find(p => p.id === cartItem.id);
      
      if (!dbProduct) {
        return res.status(400).json({ 
          success: false, 
          message: `المنتج ${cartItem.name} غير موجود أو تم حذفه` 
        });
      }

      if (dbProduct.stock < cartItem.qty) {
        return res.status(400).json({ 
          success: false, 
          message: `الكمية المطلوبة للمنتج ${dbProduct.name} غير متوفرة. المتاح: ${dbProduct.stock}` 
        });
      }

      const itemTotal = Number(dbProduct.price) * cartItem.qty;
      calculatedSubtotal += itemTotal;

      orderItemsData.push({
        productId: dbProduct.id,
        productName: dbProduct.name,
        quantity: cartItem.qty,
        price: dbProduct.price,
        total: itemTotal,
        productSku: dbProduct.sku,
        extractionSource: 'pos'
      });
    }

    const tax = calculatedSubtotal * 0.14; // 14% VAT
    calculatedTotal = calculatedSubtotal + tax;

    // 2. Handle Customer
    let customerId = customer?.id;
    
    // If new customer or guest
    if (!customerId || customerId === 'new') {
      if (customer?.name && customer?.phone) {
        // Create new customer
        const newCustomer = await prisma.customer.create({
          data: {
            firstName: customer.name.split(' ')[0] || 'عميل',
            lastName: customer.name.split(' ').slice(1).join(' ') || 'كاشير',
            phone: customer.phone,
            companyId: companyId,
            status: 'CUSTOMER',
            metadata: JSON.stringify({ source: 'pos' })
          }
        });
        customerId = newCustomer.id;
      } else {
        // Find or create generic "Walk-in Customer"
        let walkIn = await prisma.customer.findFirst({
          where: { 
            companyId,
            metadata: { contains: '"isWalkIn":true' }
          }
        });

        if (!walkIn) {
            walkIn = await prisma.customer.create({
                data: {
                    firstName: 'عميل',
                    lastName: 'كاشير',
                    companyId,
                    status: 'CUSTOMER',
                    metadata: JSON.stringify({ isWalkIn: true, source: 'pos' })
                }
            });
        }
        customerId = walkIn.id;
      }
    }

    // 3. Generate Order Number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = Date.now().toString().slice(-6);
    const orderNumber = `POS-${dateStr}-${timestamp}`;

    // 4. Execute Transaction (Order + Inventory Update)
    const result = await prisma.$transaction(async (tx) => {
      // A. Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          companyId,
          status: 'COMPLETED', // Immediate completion
          paymentStatus: 'PAID', // Immediate payment
          paymentMethod: paymentMethod,
          subtotal: calculatedSubtotal,
          tax: tax,
          shipping: 0, // No shipping in POS
          total: calculatedTotal,
          currency: 'EGP',
          sourceType: 'pos',
          items: {
            create: orderItemsData
          },
          metadata: JSON.stringify({
              cashierId: userId,
              source: 'pos_terminal'
          })
        },
        include: {
            items: true
        }
      });

      // B. Update Product Stock (Global Stock)
      for (const item of orderItemsData) {
        await tx.product.update({
            where: { id: item.productId },
            data: {
                stock: {
                    decrement: item.quantity
                }
            }
        });
        
        // C. Update Warehouse Inventory (Optional: Update default warehouse)
        // Find the first warehouse for this product to deduct from
        const inventoryItem = await tx.inventory.findFirst({
            where: { 
                productId: item.productId,
                warehouse: { companyId: companyId }
            }
        });

        if (inventoryItem) {
            await tx.inventory.update({
                where: { id: inventoryItem.id },
                data: {
                    quantity: { decrement: item.quantity },
                    available: { decrement: item.quantity }
                }
            });
        }
      }

      return order;
    });

    res.json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      data: result
    });

  } catch (error) {
    console.error('POS Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء معالجة الطلب',
      error: error.message
    });
  }
};

module.exports = {
  createPOSOrder
};
