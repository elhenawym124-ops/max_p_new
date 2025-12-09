# 🔧 حل مشكلة npm مع TE Data

## ❌ المشكلة:
```
npm error 406 Not Acceptable - GET http://megaplusredirection.tedata.net/VDSL-Redirection_100.html
```

هذه مشكلة شائعة مع شبكة TE Data في مصر.

---

## ✅ الحلول (جرب بالترتيب):

### 🎯 الحل 1: تغيير DNS

#### Windows:
1. افتح **Control Panel** → **Network and Internet** → **Network Connections**
2. كليك يمين على اتصالك → **Properties**
3. اختر **Internet Protocol Version 4 (TCP/IPv4)** → **Properties**
4. اختر **Use the following DNS server addresses:**
   - **Preferred DNS:** `8.8.8.8` (Google DNS)
   - **Alternate DNS:** `8.8.4.4`
5. اضغط **OK**

**أو استخدم Cloudflare DNS:**
- **Preferred DNS:** `1.1.1.1`
- **Alternate DNS:** `1.0.0.1`

---

### 🎯 الحل 2: استخدام Registry مختلف

#### في Command Prompt:
```cmd
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
npm config set registry https://registry.npmjs.org/
npm install date-fns recharts --legacy-peer-deps
```

---

### 🎯 الحل 3: تنظيف Cache

```cmd
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
npm cache clean --force
npm config set registry https://registry.npmjs.org/
npm install date-fns recharts --legacy-peer-deps
```

---

### 🎯 الحل 4: استخدام VPN

1. شغل أي VPN (مثل: Proton VPN, Windscribe, أو أي VPN مجاني)
2. بعد الاتصال، جرب:
```cmd
npm install date-fns recharts --legacy-peer-deps
```

---

### 🎯 الحل 5: استخدام Yarn بدلاً من npm

#### تثبيت Yarn:
```cmd
npm install -g yarn
```

#### ثم استخدم Yarn:
```cmd
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
yarn add date-fns recharts
```

---

### 🎯 الحل 6: تحديث package.json يدوياً

#### 1. افتح ملف `frontend/package.json`

#### 2. أضف في قسم `dependencies`:
```json
{
  "dependencies": {
    "date-fns": "^2.30.0",
    "recharts": "^2.10.3"
  }
}
```

#### 3. احفظ الملف

#### 4. جرب التثبيت مرة أخرى:
```cmd
npm install --legacy-peer-deps
```

---

### 🎯 الحل 7: استخدام Mobile Hotspot

إذا كان لديك باقة إنترنت على الموبايل:
1. شغل Mobile Hotspot
2. اتصل من الكمبيوتر
3. جرب التثبيت:
```cmd
npm install date-fns recharts --legacy-peer-deps
```

---

## 🔍 التحقق من DNS الحالي:

```cmd
ipconfig /all
```

ابحث عن **DNS Servers** وتأكد أنها `8.8.8.8` أو `1.1.1.1`

---

## 📝 الأوامر الكاملة (بعد تغيير DNS):

```cmd
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
npm cache clean --force
npm config set registry https://registry.npmjs.org/
npm install date-fns@2.30.0 recharts@2.10.3 --legacy-peer-deps
```

---

## ⚡ الحل السريع (موصى به):

### 1. غير DNS إلى Google DNS (8.8.8.8)
### 2. نفذ:
```cmd
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
npm cache clean --force
npm install date-fns recharts --legacy-peer-deps
```

---

## 🎯 إذا نجح التثبيت:

ستشاهد:
```
added 2 packages in 10s
```

ثم شغل Frontend:
```cmd
npm start
```

---

## 📞 بدائل أخرى:

### استخدام CDN (حل مؤقت):
يمكنك استخدام CDN بدلاً من npm، لكن هذا غير موصى به للإنتاج.

---

## ✅ الحل الأفضل:

**تغيير DNS إلى Google DNS (8.8.8.8) هو الحل الأكثر فعالية مع TE Data**

---

**🎉 بالتوفيق!**
