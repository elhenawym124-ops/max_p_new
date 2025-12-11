# 🔑 رفع SSH Key إلى السيرفر

## الطريقة 1: استخدام ssh-copy-id (الأسهل)

```powershell
# تثبيت OpenSSH إذا لم يكن مثبت
# ثم استخدم:
ssh-copy-id root@153.92.223.119
```

---

## الطريقة 2: استخدام PowerShell (الأفضل)

افتح **PowerShell** واكتب:

```powershell
# قراءة المفتاح العام
$pubkey = Get-Content C:\Users\pc\.ssh\id_ed25519.pub

# رفعه للسيرفر
ssh root@153.92.223.119 "mkdir -p ~/.ssh && echo '$pubkey' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh"
```

---

## الطريقة 3: يدوياً (إذا فشلت الطرق السابقة)

### أ) انسخ المفتاح:
```powershell
type C:\Users\pc\.ssh\id_ed25519.pub
```

### ب) اتصل بالسيرفر:
```powershell
ssh root@153.92.223.119
```

### ج) على السيرفر:
```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
# الصق المفتاح هنا واحفظ (Ctrl+X ثم Y ثم Enter)
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

---

## الطريقة 4: استخدام scp (بديل)

```powershell
# نسخ الملف أولاً
scp C:\Users\pc\.ssh\id_ed25519.pub root@153.92.223.119:/tmp/

# ثم على السيرفر
ssh root@153.92.223.119
mkdir -p ~/.ssh
cat /tmp/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
rm /tmp/id_ed25519.pub
```

---

## ✅ التحقق من نجاح العملية:

```powershell
# جرب الاتصال بدون كلمة مرور
ssh root@153.92.223.119
# إذا دخل بدون كلمة مرور = نجح ✅
```

---

## 🎯 أنصح بالطريقة 2 (PowerShell) - الأسهل والأسرع!

