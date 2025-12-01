-- إصلاح جدول text_gallery - إضافة الحقول المفقودة
-- Run this SQL directly on your database

-- إضافة عمود imageUrls إذا لم يكن موجوداً
ALTER TABLE `text_gallery` 
ADD COLUMN IF NOT EXISTS `imageUrls` JSON NULL AFTER `content`;

-- إضافة عمود isPinned إذا لم يكن موجوداً
ALTER TABLE `text_gallery` 
ADD COLUMN IF NOT EXISTS `isPinned` BOOLEAN NOT NULL DEFAULT FALSE AFTER `imageUrls`;

-- إضافة index على isPinned
CREATE INDEX IF NOT EXISTS `text_gallery_isPinned_idx` ON `text_gallery`(`isPinned`);

