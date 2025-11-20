const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

/**
 * Public Orders Routes
 * No authentication required - for guest users
 * Company isolation through subdomain middleware
 */

// Log all requests to this router
router.use((req, res, next) => {
  console.log(`🌐 [PUBLIC-ORDERS] ${req.method} ${req.path}`);
  next();
});

// Helper function to get Prisma client
function getPrisma() {
  return getSharedPrismaClient();
}

// Create new order
router.post('/orders', async (req, res) => {
  try {
    console.log('📝 [CREATE-ORDER] ===== Create Order Request =====');
    console.log('📝 [CREATE-ORDER] Body:', JSON.stringify(req.body, null, 2));
    
    const { company } = req;
    const cartId = req.headers['x-cart-id'] || req.cookies?.cart_id;
    
    console.log('🏢 [CREATE-ORDER] Company:', company?.id);
    console.log('🛒 [CREATE-ORDER] Cart ID:', cartId);
    
    const {
      guestEmail,
      guestPhone,
      guestName,
      shippingAddress,
      paymentMethod,
      couponCode,
      notes,
      items // ✅ Support direct items array (for testing or direct checkout)
    } = req.body;

    if (!guestPhone || !guestName || !shippingAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'جميع الحقول المطلوبة يجب ملؤها (الاسم، الهاتف، العنوان)' 
      });
    }

    const prisma = getPrisma();
    
    let cartItems = [];
    let cartTotal = 0;
    let shouldDeleteCart = false;
    
    // ✅ Support two modes: cart-based or direct items
    if (items && Array.isArray(items) && items.length > 0) {
      // Direct items mode (for testing or quick checkout)
      console.log('📦 [PUBLIC-ORDER] Using direct items mode');
      cartItems = items;
      cartTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    } else if (cartId) {
      // Cart-based mode (normal flow)
      console.log('🛒 [PUBLIC-ORDER] Using cart mode');
      const cart = await prisma.guestCart.findUnique({
        where: { cartId }
      });

      if (!cart || !cart.items || cart.items.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'السلة فارغة' 
        });
      }
      
      cartItems = cart.items;
      cartTotal = cart.total || 0;
      shouldDeleteCart = true;
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'يجب توفير سلة أو عناصر للطلب' 
      });
    }

    // Verify stock again
    for (const item of cartItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true }
      });

      if (!product || product.stock < item.quantity) {
        return res.status(400).json({ 
          success: false, 
          error: `المخزون غير كافي للمنتج: ${item.name || product?.name || 'Unknown'}` 
        });
      }
    }

    // Calculate shipping
    let shippingCost = 0;
    if (shippingAddress?.governorate) {
      const shippingZones = await prisma.shippingZone.findMany({
        where: {
          companyId: company.id,
          isActive: true
        }
      });

      // Find matching zone (governorates is JSON array)
      const matchingZone = shippingZones.find(zone => {
        const govs = Array.isArray(zone.governorates) ? zone.governorates : [];
        return govs.some(gov => 
          gov.toLowerCase().includes(shippingAddress.governorate.toLowerCase()) ||
          shippingAddress.governorate.toLowerCase().includes(gov.toLowerCase())
        );
      });

      if (matchingZone) {
        shippingCost = parseFloat(matchingZone.price);
      }
    }

    // Apply coupon
    let discountAmount = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findFirst({
        where: {
          code: couponCode.toUpperCase(),
          companyId: company.id,
          isActive: true,
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: new Date() } }
          ]
        }
      });

      if (coupon) {
        if (coupon.type === 'PERCENTAGE') {
          discountAmount = (cartTotal * coupon.value) / 100;
        } else {
          discountAmount = coupon.value;
        }
      }
    }

    const finalTotal = cartTotal + shippingCost - discountAmount;

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order
    const order = await prisma.guestOrder.create({
      data: {
        orderNumber,
        guestEmail,
        guestPhone,
        guestName,
        items: cartItems,
        total: cartTotal,
        shippingCost,
        discountAmount,
        finalTotal,
        shippingAddress,
        paymentMethod,
        notes,
        companyId: company.id
      }
    });

    // Update stock
    for (const item of cartItems) {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity
          }
        }
      });
    }

    // Delete cart (only if using cart mode)
    if (shouldDeleteCart && cartId) {
      await prisma.guestCart.delete({
        where: { cartId }
      });
      // Clear cookie
      res.clearCookie('cart_id');
    }

    res.json({ 
      success: true, 
      data: order,
      message: 'تم إنشاء الطلب بنجاح'
    });
  } catch (error) {
    console.error('❌ [CREATE-ORDER] Error creating order:', error);
    console.error('❌ [CREATE-ORDER] Error stack:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track order by order number and phone (query params)
router.get('/orders/track', async (req, res) => {
  try {
    console.log('🔍 [TRACK-ORDER] ===== Track Order Request =====');
    const { company } = req;
    const { orderNumber, phone } = req.query;

    console.log('🏢 [TRACK-ORDER] Company ID:', company?.id);
    console.log('📋 [TRACK-ORDER] Order Number:', orderNumber);
    console.log('📞 [TRACK-ORDER] Phone:', phone);

    if (!orderNumber || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'رقم الطلب ورقم الهاتف مطلوبان' 
      });
    }

    const prisma = getPrisma();
    const order = await prisma.guestOrder.findFirst({
      where: {
        orderNumber: orderNumber ,
        guestPhone: phone,
        companyId: company.id
      }
    });

    console.log('🔍 [TRACK-ORDER] Order found:', !!order);

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        error: 'الطلب غير موجود أو رقم الهاتف غير صحيح' 
      });
    }

    // إعادة حساب الشحن بناءً على المحافظة إذا لم يكن محسوباً
    let updatedOrder = { ...order };
    
    // إعادة حساب المجموع الفرعي من المنتجات
    let calculatedSubtotal = 0;
    if (order.items && Array.isArray(order.items)) {
      calculatedSubtotal = order.items.reduce((sum, item) => {
        const itemPrice = parseFloat(item.price || 0);
        const itemQuantity = parseInt(item.quantity || 0);
        const itemTotal = itemPrice * itemQuantity;
        
        console.log('🧮 [ITEM-CALC]', {
          name: item.name,
          price: item.price,
          priceAsNumber: itemPrice,
          quantity: item.quantity,
          quantityAsNumber: itemQuantity,
          itemTotal: itemTotal
        });
        
        return sum + itemTotal;
      }, 0);
      
      console.log('🧮 [TRACK-ORDER] Calculated subtotal from items:', calculatedSubtotal);
      console.log('🧮 [TRACK-ORDER] Original total in DB:', order.total);
      
      // استخدام المجموع المحسوب إذا كان مختلف عن المحفوظ
      if (Math.abs(calculatedSubtotal - (order.total || 0)) > 1) {
        console.log('⚠️ [TRACK-ORDER] Total mismatch, using calculated subtotal');
        updatedOrder.total = calculatedSubtotal;
      }
    }
    
    if (order.shippingCost === 0 && order.shippingAddress) {
      try {
        let governorate = '';
        
        // استخراج المحافظة من العنوان
        if (typeof order.shippingAddress === 'string') {
          // إذا كان العنوان string، حاول استخراج المحافظة
          governorate = order.shippingAddress.split(',')[0]?.trim();
        } else if (order.shippingAddress && typeof order.shippingAddress === 'object') {
          governorate = order.shippingAddress.governorate;
        }

        console.log('🏛️ [TRACK-ORDER] Governorate for shipping:', governorate);

        if (governorate) {
          // البحث عن تكلفة الشحن للمحافظة
          const shippingZone = await prisma.shippingZone.findFirst({
            where: {
              companyId: company.id,
              governorate: governorate
            }
          });

          if (shippingZone) {
            console.log('📦 [TRACK-ORDER] Shipping cost found:', shippingZone.cost);
            updatedOrder.shippingCost = parseFloat(shippingZone.cost || 0);
          }
        }
      } catch (shippingError) {
        console.error('❌ [TRACK-ORDER] Error calculating shipping:', shippingError);
      }
    }
    
    // إعادة حساب الإجمالي النهائي في جميع الحالات
    const subtotal = parseFloat(updatedOrder.total || 0);
    const shipping = parseFloat(updatedOrder.shippingCost || 0);
    const discount = parseFloat(updatedOrder.discountAmount || 0);
    
    updatedOrder.finalTotal = subtotal + shipping - discount;
    
    console.log('🧮 [TRACK-ORDER] Final calculation:', {
      subtotal: updatedOrder.total,
      shipping: updatedOrder.shippingCost,
      discount: updatedOrder.discountAmount,
      finalTotal: updatedOrder.finalTotal
    });

    console.log('✅ [TRACK-ORDER] Order details:', {
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      total: updatedOrder.total,
      shippingCost: updatedOrder.shippingCost,
      discountAmount: updatedOrder.discountAmount,
      finalTotal: updatedOrder.finalTotal,
      items: updatedOrder.items?.length || 0,
      shippingAddress: typeof updatedOrder.shippingAddress === 'object' 
        ? updatedOrder.shippingAddress?.governorate 
        : 'string format'
    });

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('❌ [TRACK-ORDER] Error tracking order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track order by order number (legacy route)
router.get('/orders/:orderNumber/track', async (req, res) => {
  try {
    const { company } = req;
    const { orderNumber } = req.params;

    const prisma = getPrisma();
    const order = await prisma.guestOrder.findFirst({
      where: {
        orderNumber,
        companyId: company.id
      }
    });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        error: 'الطلب غير موجود' 
      });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search orders by email
router.get('/orders/search', async (req, res) => {
  try {
    const { company } = req;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'البريد الإلكتروني مطلوب' 
      });
    }

    const prisma = getPrisma();
    const orders = await prisma.guestOrder.findMany({
      where: {
        guestEmail: email,
        companyId: company.id
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error searching orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get order details by ID or order number
router.get('/orders/:id', async (req, res) => {
  console.log('🎯 [GET-ORDER-ROUTE] Route handler called!', req.params);
  try {
    const { company } = req;
    const { id } = req.params;

    console.log('📦 [GET-ORDER] Fetching order:', { id, companyId: company?.id });

    const prisma = getPrisma();
    
    // Try to find by ID first, then by order number
    let order = await prisma.guestOrder.findFirst({
      where: {
        id,
        companyId: company.id
      }
    });
    
    console.log('🔍 [GET-ORDER] Search by ID result:', order ? 'Found' : 'Not found');
    
    // If not found by ID, try by order number
    if (!order) {
      console.log('🔍 [GET-ORDER] Trying by order number...');
      order = await prisma.guestOrder.findFirst({
        where: {
          orderNumber: id,
          companyId: company.id
        }
      });
      console.log('🔍 [GET-ORDER] Search by orderNumber result:', order ? 'Found' : 'Not found');
    }

    if (!order) {
      console.log('❌ [GET-ORDER] Order not found');
      return res.status(404).json({ 
        success: false, 
        error: 'الطلب غير موجود' 
      });
    }

    console.log('✅ [GET-ORDER] Order found:', order.orderNumber);
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('❌ [GET-ORDER] Error fetching order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update guest order status
router.patch('/orders/:orderNumber/status', async (req, res) => {
  console.log('🔄 [UPDATE-GUEST-ORDER-STATUS] Route handler called!', req.params);
  try {
    const { company } = req;
    const { orderNumber } = req.params;
    const { status, notes } = req.body;

    console.log('📦 [UPDATE-GUEST-ORDER-STATUS] Updating order:', { 
      orderNumber, 
      status, 
      companyId: company?.id 
    });

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'حالة الطلب مطلوبة'
      });
    }

    const prisma = getPrisma();
    
    // Find the guest order
    const existingOrder = await prisma.guestOrder.findFirst({
      where: {
        orderNumber,
        companyId: company.id
      }
    });

    if (!existingOrder) {
      console.log('❌ [UPDATE-GUEST-ORDER-STATUS] Order not found');
      return res.status(404).json({ 
        success: false, 
        error: 'الطلب غير موجود' 
      });
    }

    // Update the order status
    const updatedOrder = await prisma.guestOrder.update({
      where: {
        id: existingOrder.id
      },
      data: {
        status: status.toUpperCase(),
        notes: notes ? `${existingOrder.notes || ''}\n${notes}` : existingOrder.notes,
        updatedAt: new Date()
      }
    });

    console.log('✅ [UPDATE-GUEST-ORDER-STATUS] Order status updated:', updatedOrder.orderNumber);
    res.json({ 
      success: true, 
      data: updatedOrder,
      message: 'تم تحديث حالة الطلب بنجاح'
    });
  } catch (error) {
    console.error('❌ [UPDATE-GUEST-ORDER-STATUS] Error updating order status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update guest order payment status
router.patch('/orders/:orderNumber/payment-status', async (req, res) => {
  console.log('💳 [UPDATE-GUEST-ORDER-PAYMENT] Route handler called!', req.params);
  try {
    const { company } = req;
    const { orderNumber } = req.params;
    const { paymentStatus, notes } = req.body;

    console.log('📦 [UPDATE-GUEST-ORDER-PAYMENT] Updating order:', { 
      orderNumber, 
      paymentStatus, 
      companyId: company?.id 
    });

    if (!paymentStatus) {
      return res.status(400).json({
        success: false,
        error: 'حالة الدفع مطلوبة'
      });
    }

    const prisma = getPrisma();
    
    // Find the guest order
    const existingOrder = await prisma.guestOrder.findFirst({
      where: {
        orderNumber,
        companyId: company.id
      }
    });

    if (!existingOrder) {
      console.log('❌ [UPDATE-GUEST-ORDER-PAYMENT] Order not found');
      return res.status(404).json({ 
        success: false, 
        error: 'الطلب غير موجود' 
      });
    }

    // Update the order payment status
    const updatedOrder = await prisma.guestOrder.update({
      where: {
        id: existingOrder.id
      },
      data: {
        paymentStatus: paymentStatus.toUpperCase(),
        notes: notes ? `${existingOrder.notes || ''}\n${notes}` : existingOrder.notes,
        updatedAt: new Date()
      }
    });

    console.log('✅ [UPDATE-GUEST-ORDER-PAYMENT] Order payment status updated:', updatedOrder.orderNumber);
    res.json({ 
      success: true, 
      data: updatedOrder,
      message: 'تم تحديث حالة الدفع بنجاح'
    });
  } catch (error) {
    console.error('❌ [UPDATE-GUEST-ORDER-PAYMENT] Error updating payment status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
