# متطلبات النشر على السيرفر (Deployment Requirements)

## 📋 نظرة عامة

هذا الملف يوضح المتطلبات والإعدادات اللازمة لنشر المشروع على السيرفر بعد رفع التعديلات على GitHub.

---

## 🔑 المتطلبات الأساسية

### 1. على السيرفر (Server Requirements)

#### أ) المتطلبات البرمجية:
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git** (للسحب من GitHub)
- **PM2** (لإدارة عملية Node.js) - اختياري
- **Nginx** (لخدمة Frontend) - اختياري
- **Docker & Docker Compose** (إذا كنت تستخدم Docker) - اختياري

#### ب) الصلاحيات:
- وصول SSH إلى السيرفر
- صلاحيات كتابة في مجلد النشر (`/var/www`)
- صلاحيات تشغيل npm وبناء المشروع

#### ج) متغيرات البيئة (Environment Variables):
يجب إعداد ملفات `.env` على السيرفر:

**Backend** (`/var/www/backend2/.env`):
```env
NODE_ENV=production
PORT=5000
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
# ... باقي المتغيرات المطلوبة
```

**Frontend** (`/var/www/frontend2/.env.production`):
```env
VITE_API_URL=https://your-api-domain.com
# ... باقي المتغيرات المطلوبة
```

---

### 2. على GitHub (GitHub Secrets)

يجب إضافة Secrets التالية في GitHub Repository Settings → Secrets and variables → Actions:

#### أ) معلومات السيرفر:
- `SERVER_HOST`: عنوان IP أو domain للسيرفر (مثال: `192.168.1.100` أو `server.example.com`)
- `SERVER_USER`: اسم المستخدم للـ SSH (مثال: `root` أو `deploy`)
- `SERVER_SSH_KEY`: المفتاح الخاص للـ SSH (Private SSH Key)
- `SERVER_PORT`: منفذ SSH (افتراضي: `22`)

#### ب) Docker (إذا كنت تستخدم Docker):
- `DOCKER_REGISTRY`: عنوان Docker Registry (مثال: `docker.io` أو `ghcr.io`)
- `DOCKER_USERNAME`: اسم المستخدم في Docker Registry
- `DOCKER_PASSWORD`: كلمة مرور Docker Registry

---

## 🚀 طرق النشر

### الطريقة 1: النشر المباشر (Direct Deployment)

#### الخطوات:

1. **إعداد السيرفر:**
   ```bash
   # إنشاء مجلدات النشر
   sudo mkdir -p /var/www/backend2 /var/www/frontend2
   sudo chown -R $USER:$USER /var/www
   
   # تثبيت Node.js (إذا لم يكن مثبت)
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # تثبيت PM2 (اختياري)
   sudo npm install -g pm2
   ```

2. **إعداد SSH Key:**
   ```bash
   # على جهازك المحلي
   ssh-keygen -t ed25519 -C "github-actions"
   
   # نسخ المفتاح العام للسيرفر
   ssh-copy-id user@your-server-ip
   
   # نسخ المفتاح الخاص (Private Key) إلى GitHub Secrets كـ SERVER_SSH_KEY
   cat ~/.ssh/id_ed25519
   ```

3. **إضافة Secrets في GitHub:**
   - اذهب إلى: Repository → Settings → Secrets and variables → Actions
   - أضف:
     - `SERVER_HOST`: عنوان السيرفر
     - `SERVER_USER`: اسم المستخدم
     - `SERVER_SSH_KEY`: محتوى المفتاح الخاص
     - `SERVER_PORT`: 22 (أو المنفذ الخاص بك)

4. **عند الـ Push:**
   - GitHub Actions سيقوم تلقائياً بـ:
     - بناء Frontend
     - نسخ الملفات للسيرفر
     - تثبيت dependencies
     - إعادة تشغيل الخدمات

---

### الطريقة 2: النشر باستخدام Docker

#### الخطوات:

1. **إعداد Docker على السيرفر:**
   ```bash
   # تثبيت Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # تثبيت Docker Compose
   sudo apt-get install docker-compose-plugin
   ```

2. **إنشاء docker-compose.yml على السيرفر:**
   ```yaml
   version: '3.8'
   
   services:
     frontend:
       image: your-registry/max_p_new-frontend:latest
       ports:
         - "3000:3000"
       restart: unless-stopped
       
     backend:
       image: your-registry/max_p_new-backend:latest
       ports:
         - "5000:5000"
       environment:
         - NODE_ENV=production
       restart: unless-stopped
       volumes:
         - ./backend/.env:/app/.env
   ```

3. **تفعيل Job Docker في workflow:**
   - افتح `.github/workflows/deploy.yml`
   - غيّر `if: false` إلى `if: true` في job `deploy-docker`

---

## 📝 خطوات النشر اليدوي (Manual Deployment)

إذا كنت تريد النشر يدوياً بدون GitHub Actions:

```bash
# 1. الاتصال بالسيرفر
ssh user@your-server-ip

# 2. الانتقال لمجلد المشروع
cd /var/www

# 3. سحب آخر التعديلات (إذا كان المشروع في git)
# git pull origin main

# 4. بناء Frontend
cd frontend2
npm ci
npm run build
cd ..

# 5. تثبيت Backend dependencies
cd backend2
npm ci --only=production
cd ..

# 6. إعادة تشغيل الخدمات
# إذا كنت تستخدم PM2:
pm2 restart 0

# إذا كنت تستخدم Docker:
cd /var/www
docker-compose up -d --build
```

---

## 🔧 إعداد Nginx (اختياري)

إذا كنت تستخدم Nginx لخدمة Frontend:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/frontend2/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## ✅ التحقق من النشر

بعد النشر، تحقق من:

1. **Frontend يعمل:**
   ```bash
   curl http://your-server-ip:3000
   ```

2. **Backend يعمل:**
   ```bash
   curl http://your-server-ip:5000/health
   ```

3. **التحقق من Logs:**
   ```bash
   # PM2
   pm2 logs backend
   
   # Docker
   docker-compose logs -f
   ```

---

## 🛠️ استكشاف الأخطاء

### مشكلة: فشل الاتصال بـ SSH
- تأكد من `SERVER_HOST` و `SERVER_PORT` صحيحين
- تأكد من أن المفتاح الخاص (Private Key) صحيح في GitHub Secrets
- تأكد من أن السيرفر يقبل الاتصالات من GitHub Actions IPs

### مشكلة: فشل بناء Frontend
- تأكد من أن Node.js >= 18 مثبت
- تأكد من أن `NODE_OPTIONS` مضبوط بشكل صحيح

### مشكلة: فشل تثبيت Dependencies
- تأكد من أن `package-lock.json` موجود ومحدث
- تأكد من أن السيرفر متصل بالإنترنت

---

## 📞 الدعم

إذا واجهت أي مشاكل، راجع:
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)

---

**آخر تحديث:** 2025-11-20

