# 🚀 دليل النشر السريع (Quick Start Guide)

## 📋 ملخص المتطلبات

### على GitHub:
1. اذهب إلى: **Settings → Secrets and variables → Actions**
2. أضف هذه Secrets:
   - `SERVER_HOST`: عنوان السيرفر (مثال: `192.168.1.100`)
   - `SERVER_USER`: اسم المستخدم (مثال: `root`)
   - `SERVER_SSH_KEY`: المفتاح الخاص للـ SSH
   - `SERVER_PORT`: منفذ SSH (افتراضي: `22`)

### على السيرفر:
```bash
# 1. تثبيت Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. إنشاء مجلدات النشر
sudo mkdir -p /var/www/backend2 /var/www/frontend2
sudo chown -R $USER:$USER /var/www

# 3. إعداد SSH Key (على جهازك المحلي)
ssh-keygen -t ed25519 -C "github-actions"
ssh-copy-id user@your-server-ip
# ثم انسخ المفتاح الخاص إلى GitHub Secrets
```

---

## ✅ بعد الإعداد

عندما ترفع (push) أي تعديل على branch `main`:
- ✅ GitHub Actions سيبني Frontend تلقائياً
- ✅ سينسخ الملفات للسيرفر
- ✅ سيثبت Dependencies
- ✅ سيعيد تشغيل الخدمات

---

## 🔧 النشر اليدوي (بدون GitHub Actions)

```bash
# استخدم السكريبت المرفق
chmod +x deploy.sh
./deploy.sh user@your-server-ip
```

أو يدوياً:
```bash
# 1. بناء Frontend
cd frontend && npm ci && npm run build && cd ..

# 2. نسخ للسيرفر
scp -r frontend/dist user@server:/var/www/frontend2/
scp -r backend user@server:/var/www/backend2/

# 3. على السيرفر
ssh user@server
cd /var/www/backend2
npm ci --only=production
pm2 restart 0  # أو docker-compose up -d
```

---

## 🐳 النشر باستخدام Docker

```bash
# على السيرفر
cd /var/www
docker-compose up -d --build
```

---

## 📞 للمزيد من التفاصيل

راجع ملف `DEPLOYMENT_REQUIREMENTS.md` للتفاصيل الكاملة.

