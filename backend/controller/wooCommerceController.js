const { getSharedPrismaClient, executeWithRetry } = require('../services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
const axios = require('axios');

/**
 * جلب متغيرات منتج من WooCommerce
 * @param {string} cleanUrl - رابط المتجر
 * @param {object} auth - بيانات المصادقة
 * @param {number} productId - معرف المنتج
 * @returns {Promise<Array>} - قائمة المتغيرات
 */
const fetchProductVariations = async (cleanUrl, auth, productId) => {
  try {
    const variationsUrl = `${cleanUrl}/wp-json/wc/v3/products/${productId}/variations`;
    const response = await axios.get(variationsUrl, {
      auth,
      params: { per_page: 100 },
      timeout: 30000
    });
    return response.data || [];
  } catch (error) {
    console.warn(`⚠️ [WOOCOMMERCE] Failed to fetch variations for product ${productId}:`, error.message);
    return [];
  }
};

/**
 * جلب جميع المنتجات من WooCommerce مع دعم الصفحات
 * @param {string} apiUrl - رابط API
 * @param {object} auth - بيانات المصادقة
 * @param {object} params - معاملات إضافية
 * @returns {Promise<Array>} - جميع المنتجات
 */
const fetchAllProducts = async (apiUrl, auth, params = {}) => {
  let allProducts = [];
  let page = 1;
  let hasMore = true;
  const perPage = 100;

  console.log(`📡 [WOOCOMMERCE] Starting paginated fetch from: ${apiUrl}`);

  while (hasMore) {
    try {
      const response = await axios.get(apiUrl, {
        auth,
        params: {
          per_page: perPage,
          page: page,
          ...params
        },
        timeout: 30000
      });

      const products = response.data;
      
      if (!Array.isArray(products) || products.length === 0) {
        hasMore = false;
      } else {
        allProducts = allProducts.concat(products);
        console.log(`   📄 Page ${page}: ${products.length} products (Total: ${allProducts.length})`);
        
        // التحقق من وجود صفحات إضافية
        const totalPages = parseInt(response.headers['x-wp-totalpages']) || 1;
        if (page >= totalPages) {
          hasMore = false;
        } else {
          page++;
        }
      }
    } catch (error) {
      console.error(`❌ [WOOCOMMERCE] Error fetching page ${page}:`, error.message);
      hasMore = false;
    }
  }

  return allProducts;
};

/**
 * جلب المنتجات من WooCommerce API
 * POST /api/v1/woocommerce/fetch-products
 */
const fetchProductsFromWooCommerce = async (req, res) => {
  try {
    console.log('🔍 [WOOCOMMERCE] Fetching products from WooCommerce...');
    
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { 
      storeUrl, 
      consumerKey, 
      consumerSecret, 
      includeVariations = true,
      fetchAllPages = true,  // ✨ جلب جميع الصفحات
      status = 'publish'     // ✨ حالة المنتجات
    } = req.body;

    // جلب إعدادات WooCommerce المحفوظة إذا لم يتم إرسال المفاتيح
    let settings = null;
    if (!consumerKey || consumerKey === 'from_settings') {
      settings = await getSharedPrismaClient().wooCommerceSettings.findUnique({
        where: { companyId }
      });
    }

    // استخدام الإعدادات المحفوظة أو المرسلة
    const finalStoreUrl = storeUrl || settings?.storeUrl;
    const finalConsumerKey = (consumerKey && consumerKey !== 'from_settings') ? consumerKey : settings?.consumerKey;
    const finalConsumerSecret = (consumerSecret && consumerSecret !== 'from_settings') ? consumerSecret : settings?.consumerSecret;

    if (!finalStoreUrl || !finalConsumerKey || !finalConsumerSecret) {
      return res.status(400).json({
        success: false,
        message: 'رابط المتجر ومفاتيح API مطلوبة. يرجى إعداد بيانات الاتصال أولاً.'
      });
    }

    // تنظيف الرابط
    let cleanUrl = finalStoreUrl.trim();
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    // إزالة الـ trailing slash
    cleanUrl = cleanUrl.replace(/\/$/, '');

    console.log(`🔗 [WOOCOMMERCE] Store URL: ${cleanUrl}`);

    try {
      // WooCommerce API endpoint
      const apiUrl = `${cleanUrl}/wp-json/wc/v3/products`;
      
      // WooCommerce يستخدم Basic Auth
      const auth = {
        username: finalConsumerKey.trim(),
        password: finalConsumerSecret.trim()
      };

      // ✨ جلب جميع المنتجات مع دعم الصفحات
      let products;
      if (fetchAllPages) {
        products = await fetchAllProducts(apiUrl, auth, { status });
      } else {
        const response = await axios.get(apiUrl, {
          auth,
          params: { per_page: 100, status },
          timeout: 30000
        });
        products = response.data;
      }

      if (!Array.isArray(products)) {
        return res.status(400).json({
          success: false,
          message: 'تنسيق البيانات غير صحيح من WooCommerce'
        });
      }

      console.log(`✅ [WOOCOMMERCE] Found ${products.length} products`);

      // تحويل المنتجات لصيغة موحدة مع دعم المتغيرات
      const formattedProducts = [];
      
      for (const product of products) {
        // استخراج الصور (الرئيسية + المعرض)
        const images = product.images?.map(img => img.src) || [];
        
        // ✨ استخراج جميع الفئات
        const categories = product.categories?.map(cat => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug
        })) || [];
        const firstCategory = categories[0]?.name || null;
        
        // ✨ استخراج الوصف والوصف المختصر
        const description = product.description ? 
          product.description.replace(/<[^>]*>/g, '').trim() : '';
        const shortDescription = product.short_description ? 
          product.short_description.replace(/<[^>]*>/g, '').trim() : '';

        // تحديد نوع المنتج
        const isVariableProduct = product.type === 'variable';
        
        // جلب المتغيرات إذا كان المنتج متغير
        let variations = [];
        if (isVariableProduct && includeVariations) {
          console.log(`🔄 [WOOCOMMERCE] Fetching variations for variable product: ${product.name} (ID: ${product.id})`);
          const rawVariations = await fetchProductVariations(cleanUrl, auth, product.id);
          
          // تحويل المتغيرات لصيغة موحدة
          variations = rawVariations.map(variation => {
            // استخراج اسم المتغير من الـ attributes
            const attributeNames = variation.attributes?.map(attr => attr.option).join(' - ') || '';
            const variationImages = variation.image?.src ? [variation.image.src] : [];
            
            // تحديد نوع المتغير (لون/مقاس/إلخ)
            let variantType = 'other';
            const firstAttr = variation.attributes?.[0];
            if (firstAttr) {
              const attrName = firstAttr.name?.toLowerCase() || '';
              if (attrName.includes('color') || attrName.includes('لون') || attrName.includes('colour')) {
                variantType = 'color';
              } else if (attrName.includes('size') || attrName.includes('مقاس') || attrName.includes('حجم')) {
                variantType = 'size';
              }
            }

            return {
              wooCommerceVariationId: variation.id?.toString(),
              name: attributeNames || `متغير ${variation.id}`,
              type: variantType,
              sku: variation.sku || null,
              price: parseFloat(variation.price || variation.regular_price || 0),
              comparePrice: variation.regular_price && variation.sale_price ? 
                parseFloat(variation.regular_price) : null,
              salePrice: variation.sale_price ? parseFloat(variation.sale_price) : null,
              stock: variation.stock_quantity || 0,
              trackInventory: variation.manage_stock === true,
              images: variationImages,
              isActive: variation.status === 'publish',
              weight: variation.weight ? parseFloat(variation.weight) : null,
              dimensions: variation.dimensions || null,
              attributes: variation.attributes || []
            };
          });
          
          console.log(`   ✅ Found ${variations.length} variations`);
        }

        // استخراج الـ attributes للمنتجات المتغيرة
        const attributes = product.attributes?.map(attr => ({
          id: attr.id,
          name: attr.name,
          options: attr.options || [],
          visible: attr.visible,
          variation: attr.variation
        })) || [];

        // ✨ استخراج تواريخ التخفيض
        const saleStartDate = product.date_on_sale_from_gmt || null;
        const saleEndDate = product.date_on_sale_to_gmt || null;

        formattedProducts.push({
          // البيانات الأساسية
          name: product.name,
          slug: product.slug,
          description: description,
          shortDescription: shortDescription,
          
          // الأسعار
          price: parseFloat(product.price || product.regular_price || 0),
          regularPrice: product.regular_price ? parseFloat(product.regular_price) : null,
          salePrice: product.sale_price ? parseFloat(product.sale_price) : null,
          comparePrice: product.regular_price && product.sale_price ? 
            parseFloat(product.regular_price) : null,
          
          // ✨ تواريخ التخفيض
          saleStartDate: saleStartDate,
          saleEndDate: saleEndDate,
          onSale: product.on_sale || false,
          
          // المخزون
          sku: product.sku || null,
          barcode: null,
          stock: product.stock_quantity || 0,
          stockStatus: product.stock_status || 'instock', // instock, outofstock, onbackorder
          trackInventory: product.manage_stock === true,
          backordersAllowed: product.backorders !== 'no',
          
          // الصور والوسائط
          images: images,
          
          // التصنيف
          category: firstCategory,
          categories: categories, // ✨ جميع الفئات
          tags: product.tags?.map(tag => tag.name) || [],
          
          // الشحن
          weight: product.weight ? parseFloat(product.weight) : null,
          dimensions: product.dimensions?.length || product.dimensions?.width || product.dimensions?.height ? 
            product.dimensions : null,
          shippingClass: product.shipping_class || null,
          
          // معلومات WooCommerce
          wooCommerceId: product.id?.toString() || null,
          wooCommerceUrl: product.permalink || null,
          
          // الحالة
          isActive: product.status === 'publish',
          status: product.status, // publish, draft, pending, private
          isFeatured: product.featured || false, // ✨ منتج مميز
          catalogVisibility: product.catalog_visibility || 'visible', // visible, catalog, search, hidden
          
          // ✨ نوع المنتج
          type: product.type || 'simple', // simple, variable, grouped, external
          isVariable: isVariableProduct,
          isVirtual: product.virtual || false,
          isDownloadable: product.downloadable || false,
          
          // المتغيرات
          variations: variations,
          variationsCount: variations.length,
          attributes: attributes,
          
          // ✨ المنتجات المرتبطة
          relatedIds: product.related_ids || [],
          upsellIds: product.upsell_ids || [],
          crossSellIds: product.cross_sell_ids || [],
          
          // ✨ التقييمات
          averageRating: product.average_rating ? parseFloat(product.average_rating) : 0,
          ratingCount: product.rating_count || 0,
          reviewsAllowed: product.reviews_allowed || true,
          
          // ✨ الضرائب
          taxStatus: product.tax_status || 'taxable', // taxable, shipping, none
          taxClass: product.tax_class || '',
          
          // ✨ معلومات إضافية
          purchaseNote: product.purchase_note || null,
          menuOrder: product.menu_order || 0,
          
          // التواريخ
          dateCreated: product.date_created_gmt || null,
          dateModified: product.date_modified_gmt || null,
          
          // البيانات الوصفية
          metadata: product.meta_data || []
        });
      }

      // إحصائيات
      const variableProductsCount = formattedProducts.filter(p => p.isVariable).length;
      const totalVariationsCount = formattedProducts.reduce((sum, p) => sum + (p.variationsCount || 0), 0);
      const featuredProductsCount = formattedProducts.filter(p => p.isFeatured).length;
      const onSaleProductsCount = formattedProducts.filter(p => p.onSale).length;

      console.log(`📊 [WOOCOMMERCE] Summary:`);
      console.log(`   - Total Products: ${formattedProducts.length}`);
      console.log(`   - Variable Products: ${variableProductsCount}`);
      console.log(`   - Total Variations: ${totalVariationsCount}`);
      console.log(`   - Featured Products: ${featuredProductsCount}`);
      console.log(`   - On Sale Products: ${onSaleProductsCount}`);

      res.json({
        success: true,
        message: `تم جلب ${formattedProducts.length} منتج من WooCommerce (${variableProductsCount} منتج متغير مع ${totalVariationsCount} متغير)`,
        data: {
          products: formattedProducts,
          count: formattedProducts.length,
          variableProductsCount,
          totalVariationsCount,
          featuredProductsCount,
          onSaleProductsCount,
          storeUrl: cleanUrl
        }
      });

    } catch (apiError) {
      console.error('❌ [WOOCOMMERCE] API Error:', apiError.message);
      
      // رسالة خطأ مفصلة
      let errorMessage = 'فشل الاتصال بـ WooCommerce';
      if (apiError.response?.status === 401) {
        errorMessage = 'مفاتيح API غير صحيحة';
      } else if (apiError.response?.status === 404) {
        errorMessage = 'رابط المتجر غير صحيح أو WooCommerce غير مفعل';
      }
      
      return res.status(400).json({
        success: false,
        message: errorMessage,
        error: apiError.response?.data?.message || apiError.message,
        hint: 'تأكد من صحة رابط المتجر ومفاتيح API'
      });
    }

  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب المنتجات',
      error: error.message
    });
  }
};

/**
 * استيراد المنتجات المحددة من WooCommerce
 * POST /api/v1/woocommerce/import-selected
 */
const importSelectedProducts = async (req, res) => {
  try {
    console.log('📦 [WOOCOMMERCE] Importing selected products...');
    
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { products, updateExisting = false } = req.body; // ✨ خيار تحديث المنتجات الموجودة

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'قائمة المنتجات مطلوبة'
      });
    }

    console.log(`📦 [WOOCOMMERCE] Importing ${products.length} products... (updateExisting: ${updateExisting})`);

    const results = {
      created: [],
      updated: [],
      failed: [],
      skipped: [],
      variationsCreated: 0,
      variationsUpdated: 0
    };

    for (const productData of products) {
      try {
        const { name, price, wooCommerceId } = productData;

        if (!name || price === undefined || price === null) {
          results.failed.push({
            product: productData,
            reason: 'اسم المنتج والسعر مطلوبان'
          });
          continue;
        }

        // معالجة الفئة
        let categoryId = null;
        if (productData.category && productData.category.trim() !== '') {
          let categoryRecord = await getSharedPrismaClient().category.findFirst({
            where: {
              name: productData.category.trim(),
              companyId
            }
          });

          if (!categoryRecord) {
            categoryRecord = await getSharedPrismaClient().category.create({
              data: {
                name: productData.category.trim(),
                companyId
              }
            });
            console.log(`✅ [WOOCOMMERCE] Created category: ${productData.category}`);
          }

          categoryId = categoryRecord.id;
        }

        // معالجة الصور
        let processedImages = [];
        if (productData.images && Array.isArray(productData.images)) {
          processedImages = productData.images.filter(img => {
            if (!img) return false;
            try {
              new URL(img);
              return true;
            } catch {
              return false;
            }
          });
        }

        // ✨ التحقق من وجود المنتج مسبقاً
        let existingProduct = null;
        if (wooCommerceId) {
          existingProduct = await getSharedPrismaClient().product.findFirst({
            where: {
              wooCommerceId: wooCommerceId.toString(),
              companyId
            },
            include: { variants: true }
          });
        }

        let product;
        let isUpdate = false;

        if (existingProduct) {
          if (!updateExisting) {
            results.skipped.push({
              product: productData,
              reason: 'المنتج موجود بالفعل',
              existingProduct
            });
            continue;
          }

          // ✨ تحديث المنتج الموجود
          console.log(`🔄 [WOOCOMMERCE] Updating existing product: ${existingProduct.name}`);
          
          product = await getSharedPrismaClient().product.update({
            where: { id: existingProduct.id },
            data: {
              name: productData.name.trim(),
              description: productData.description || existingProduct.description,
              price: parseFloat(productData.price),
              comparePrice: productData.comparePrice ? parseFloat(productData.comparePrice) : existingProduct.comparePrice,
              stock: productData.stock !== undefined ? parseInt(productData.stock) : existingProduct.stock,
              trackInventory: productData.trackInventory !== undefined ? Boolean(productData.trackInventory) : existingProduct.trackInventory,
              categoryId: categoryId || existingProduct.categoryId,
              images: processedImages.length > 0 ? JSON.stringify(processedImages) : existingProduct.images,
              tags: productData.tags && Array.isArray(productData.tags) ? JSON.stringify(productData.tags) : existingProduct.tags,
              weight: productData.weight ? parseFloat(productData.weight) : existingProduct.weight,
              dimensions: productData.dimensions ? JSON.stringify(productData.dimensions) : existingProduct.dimensions,
              wooCommerceUrl: productData.wooCommerceUrl || existingProduct.wooCommerceUrl,
              isFeatured: productData.isFeatured !== undefined ? Boolean(productData.isFeatured) : existingProduct.isFeatured,
              isActive: productData.isActive !== undefined ? Boolean(productData.isActive) : existingProduct.isActive,
              // ✨ تواريخ التخفيض
              saleStartDate: productData.saleStartDate ? new Date(productData.saleStartDate) : existingProduct.saleStartDate,
              saleEndDate: productData.saleEndDate ? new Date(productData.saleEndDate) : existingProduct.saleEndDate
            }
          });
          
          isUpdate = true;
        } else {
          // إنشاء منتج جديد
          product = await getSharedPrismaClient().product.create({
            data: {
              name: productData.name.trim(),
              description: productData.description || '',
              price: parseFloat(productData.price),
              comparePrice: productData.comparePrice ? parseFloat(productData.comparePrice) : null,
              cost: productData.cost ? parseFloat(productData.cost) : null,
              sku: productData.sku || null,
              barcode: productData.barcode || null,
              stock: productData.stock !== undefined ? parseInt(productData.stock) : 0,
              trackInventory: productData.trackInventory !== undefined ? Boolean(productData.trackInventory) : true,
              companyId,
              categoryId,
              images: processedImages.length > 0 ? JSON.stringify(processedImages) : null,
              tags: productData.tags && Array.isArray(productData.tags) ? JSON.stringify(productData.tags) : null,
              weight: productData.weight ? parseFloat(productData.weight) : null,
              dimensions: productData.dimensions ? JSON.stringify(productData.dimensions) : null,
              wooCommerceId: productData.wooCommerceId?.toString() || null,
              wooCommerceUrl: productData.wooCommerceUrl || null,
              source: 'woocommerce',
              isFeatured: productData.isFeatured || false,
              isActive: productData.isActive !== undefined ? Boolean(productData.isActive) : true,
              // ✨ تواريخ التخفيض
              saleStartDate: productData.saleStartDate ? new Date(productData.saleStartDate) : null,
              saleEndDate: productData.saleEndDate ? new Date(productData.saleEndDate) : null
            }
          });
        }

        // ✨ معالجة المتغيرات
        let createdVariations = [];
        let updatedVariations = [];
        
        if (productData.isVariable && productData.variations && Array.isArray(productData.variations) && productData.variations.length > 0) {
          console.log(`🔄 [WOOCOMMERCE] Processing ${productData.variations.length} variations for product: ${product.name}`);
          
          for (let i = 0; i < productData.variations.length; i++) {
            const variation = productData.variations[i];
            
            try {
              // معالجة صور المتغير
              let variantImages = [];
              if (variation.images && Array.isArray(variation.images)) {
                variantImages = variation.images.filter(img => {
                  if (!img) return false;
                  try {
                    new URL(img);
                    return true;
                  } catch {
                    return false;
                  }
                });
              }

              // تحديد السعر
              const variantPrice = variation.price && variation.price > 0 ? 
                parseFloat(variation.price) : parseFloat(productData.price);

              // ✨ البحث عن متغير موجود بنفس WooCommerce ID
              let existingVariant = null;
              if (variation.wooCommerceVariationId && existingProduct) {
                existingVariant = existingProduct.variants?.find(v => {
                  try {
                    const meta = v.metadata ? JSON.parse(v.metadata) : {};
                    return meta.wooCommerceVariationId === variation.wooCommerceVariationId;
                  } catch {
                    return false;
                  }
                });
              }

              if (existingVariant && updateExisting) {
                // تحديث المتغير الموجود
                const updatedVariant = await getSharedPrismaClient().productVariant.update({
                  where: { id: existingVariant.id },
                  data: {
                    name: variation.name || existingVariant.name,
                    type: variation.type || existingVariant.type,
                    price: variantPrice,
                    comparePrice: variation.comparePrice ? parseFloat(variation.comparePrice) : existingVariant.comparePrice,
                    stock: variation.stock !== undefined ? parseInt(variation.stock) : existingVariant.stock,
                    trackInventory: variation.trackInventory !== undefined ? Boolean(variation.trackInventory) : existingVariant.trackInventory,
                    images: variantImages.length > 0 ? JSON.stringify(variantImages) : existingVariant.images,
                    isActive: variation.isActive !== undefined ? Boolean(variation.isActive) : existingVariant.isActive
                  }
                });
                updatedVariations.push(updatedVariant);
                results.variationsUpdated++;
              } else {
                // إنشاء متغير جديد
                let variantSku = variation.sku;
                if (!variantSku) {
                  variantSku = `${product.id}-VAR-${i + 1}`;
                } else {
                  const existingSku = await getSharedPrismaClient().productVariant.findFirst({
                    where: { sku: variantSku }
                  });
                  if (existingSku) {
                    variantSku = `${variantSku}-${Date.now()}`;
                  }
                }

                const createdVariant = await getSharedPrismaClient().productVariant.create({
                  data: {
                    productId: product.id,
                    name: variation.name || `متغير ${i + 1}`,
                    type: variation.type || 'other',
                    sku: variantSku,
                    price: variantPrice,
                    comparePrice: variation.comparePrice ? parseFloat(variation.comparePrice) : null,
                    stock: variation.stock !== undefined ? parseInt(variation.stock) : 0,
                    trackInventory: variation.trackInventory !== undefined ? Boolean(variation.trackInventory) : true,
                    images: variantImages.length > 0 ? JSON.stringify(variantImages) : null,
                    isActive: variation.isActive !== undefined ? Boolean(variation.isActive) : true,
                    sortOrder: i,
                    metadata: JSON.stringify({
                      wooCommerceVariationId: variation.wooCommerceVariationId,
                      attributes: variation.attributes || []
                    })
                  }
                });

                createdVariations.push(createdVariant);
                results.variationsCreated++;
              }
              
            } catch (varError) {
              console.warn(`⚠️ [WOOCOMMERCE] Error processing variation for ${product.name}:`, varError.message);
            }
          }
          
          console.log(`   ✅ Created: ${createdVariations.length}, Updated: ${updatedVariations.length}`);
        }

        const resultProduct = {
          ...product,
          variationsCreated: createdVariations.length,
          variationsUpdated: updatedVariations.length,
          variations: [...createdVariations, ...updatedVariations]
        };

        if (isUpdate) {
          results.updated.push(resultProduct);
        } else {
          results.created.push(resultProduct);
        }

      } catch (error) {
        console.error(`❌ [WOOCOMMERCE] Error importing product ${productData.name}:`, error);
        results.failed.push({
          product: productData,
          reason: error.message
        });
      }
    }

    console.log(`✅ [WOOCOMMERCE] Import completed:`);
    console.log(`   - Products Created: ${results.created.length}`);
    console.log(`   - Products Updated: ${results.updated.length}`);
    console.log(`   - Products Failed: ${results.failed.length}`);
    console.log(`   - Products Skipped: ${results.skipped.length}`);
    console.log(`   - Variations Created: ${results.variationsCreated}`);
    console.log(`   - Variations Updated: ${results.variationsUpdated}`);

    res.status(200).json({
      success: true,
      message: `تم استيراد ${results.created.length} منتج جديد، وتحديث ${results.updated.length} منتج، مع ${results.variationsCreated} متغير جديد و ${results.variationsUpdated} متغير محدث`,
      data: {
        created: results.created.length,
        updated: results.updated.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        variationsCreated: results.variationsCreated,
        variationsUpdated: results.variationsUpdated,
        details: results
      }
    });

  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Error importing products:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استيراد المنتجات',
      error: error.message
    });
  }
};

module.exports = {
  fetchProductsFromWooCommerce,
  importSelectedProducts
};

