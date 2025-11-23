-- Migration for New Features: Estimated Delivery Time, Pre-order, FOMO Popup
-- Run this SQL file directly on your database

-- 1. Add Pre-order fields to products table
ALTER TABLE `products` 
ADD COLUMN `isPreOrder` BOOLEAN DEFAULT FALSE COMMENT 'تفعيل الطلب المسبق',
ADD COLUMN `preOrderDate` DATETIME NULL COMMENT 'تاريخ توفر المنتج للطلب المسبق',
ADD COLUMN `preOrderMessage` TEXT NULL COMMENT 'رسالة الطلب المسبق';

-- 2. Add Estimated Delivery Time fields to storefront_settings table
ALTER TABLE `storefront_settings`
ADD COLUMN `estimatedDeliveryEnabled` BOOLEAN DEFAULT FALSE COMMENT 'تفعيل عرض وقت التوصيل المتوقع',
ADD COLUMN `estimatedDeliveryShowOnProduct` BOOLEAN DEFAULT TRUE COMMENT 'إظهار في صفحة المنتج',
ADD COLUMN `estimatedDeliveryDefaultText` VARCHAR(255) DEFAULT 'التوصيل خلال {time}' COMMENT 'نص افتراضي';

-- 3. Add FOMO Popup fields to storefront_settings table
ALTER TABLE `storefront_settings`
ADD COLUMN `fomoEnabled` BOOLEAN DEFAULT FALSE COMMENT 'تفعيل نافذة FOMO',
ADD COLUMN `fomoType` VARCHAR(50) DEFAULT 'soldCount' COMMENT 'نوع الرسالة: soldCount, visitors, stock, countdown',
ADD COLUMN `fomoTrigger` VARCHAR(50) DEFAULT 'time' COMMENT 'متى تظهر: time, scroll, exit',
ADD COLUMN `fomoDelay` INT DEFAULT 30 COMMENT 'تأخير الظهور (بالثواني أو نسبة التمرير)',
ADD COLUMN `fomoShowOncePerSession` BOOLEAN DEFAULT TRUE COMMENT 'إظهار مرة واحدة لكل جلسة',
ADD COLUMN `fomoMessage` TEXT NULL COMMENT 'رسالة FOMO مخصصة';

-- Verify the changes
SELECT 
    'Products table' as table_name,
    COUNT(*) as columns_added
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'products' 
    AND COLUMN_NAME IN ('isPreOrder', 'preOrderDate', 'preOrderMessage')
UNION ALL
SELECT 
    'Storefront Settings table' as table_name,
    COUNT(*) as columns_added
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'storefront_settings' 
    AND COLUMN_NAME IN (
        'estimatedDeliveryEnabled', 
        'estimatedDeliveryShowOnProduct', 
        'estimatedDeliveryDefaultText',
        'fomoEnabled',
        'fomoType',
        'fomoTrigger',
        'fomoDelay',
        'fomoShowOncePerSession',
        'fomoMessage'
    );

