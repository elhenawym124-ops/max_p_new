# 🔧 إصلاح مشكلة Notifications API (500 Error)

## 🔍 المشكلة
```
❌ /api/v1/notifications/recent: 500 Internal Server Error
```

## 🎯 الحل

### الخطوة 1: التأكد من وجود Notification Table

افتح terminal في مجلد `backend` وشغّل:

```bash
cd backend
npx prisma db push
```

أو:

```bash
cd backend
npx prisma migrate dev --name add_notifications
```

### الخطوة 2: التحقق من الـ Schema

تأكد من وجود `model Notification` في `backend/prisma/schema.prisma`:

```prisma
model Notification {
  id         String   @id @default(cuid())
  title      String
  message    String
  type       String?
  data       Json?
  isRead     Boolean  @default(false)
  readAt     DateTime?
  userId     String?
  companyId  String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user       User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  company    Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([companyId])
  @@index([isRead])
  @@index([createdAt])
}
```

### الخطوة 3: إعادة توليد Prisma Client

```bash
cd backend
npx prisma generate
```

### الخطوة 4: إعادة تشغيل الـ Backend

```bash
cd backend
npm run dev
```

---

## 🔧 الحلول البديلة

### إذا استمرت المشكلة:

#### الحل 1: تعطيل Notifications مؤقتاً

في `frontend/src/components/layout/NotificationDropdown.tsx`:

```typescript
// أضف في بداية الـ useEffect:
if (process.env.NODE_ENV === 'development') {
  console.log('⚠️ Notifications disabled in development');
  return;
}
```

#### الحل 2: إضافة Error Handling أفضل

في `backend/routes/notifications-simple.js`:

```javascript
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    
    // تحقق من وجود الـ table
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Notification'
      );
    `;
    
    if (!tableExists) {
      return res.json({
        success: true,
        notifications: [],
        unreadCount: 0,
        message: 'Notifications table not initialized'
      });
    }
    
    // ... باقي الكود
  } catch (error) {
    console.error('❌ [NOTIFICATIONS-API] Error:', error);
    // Return empty array instead of 500
    res.json({
      success: true,
      notifications: [],
      unreadCount: 0,
      error: error.message
    });
  }
});
```

---

## 🎯 الحل السريع (Temporary Fix)

إذا كنت تريد تشغيل النظام بسرعة بدون إصلاح الـ notifications:

### في Frontend:

```typescript
// frontend/src/components/layout/NotificationDropdown.tsx
// غيّر الـ API call:

const fetchNotifications = async () => {
  try {
    const response = await api.get('/notifications/recent', {
      params: { limit: 20 }
    });
    // ... handle response
  } catch (error) {
    console.warn('⚠️ Notifications not available:', error);
    // Don't show error to user, just skip
    setNotifications([]);
    setUnreadCount(0);
  }
};
```

---

## ✅ التحقق من الإصلاح

بعد تطبيق الحل، افتح Console وتأكد من:

```javascript
✅ No 500 error for /notifications/recent
✅ Notifications loaded successfully
✅ No errors in console
```

---

## 📝 ملاحظات

- المشكلة **غير حرجة** - النظام يعمل بدون الـ notifications
- الـ WhatsApp page **تعمل بشكل ممتاز** مع جميع التحسينات
- Socket.IO **متصل بنجاح**
- Authentication **يعمل 100%**
