# Script لتحديث Facebook Business SDK
Write-Host "🔄 تحديث facebook-nodejs-business-sdk..." -ForegroundColor Yellow

# الانتقال إلى مجلد backend
Set-Location $PSScriptRoot

# تحديث المكتبة
npm install facebook-nodejs-business-sdk@^22.0.0

Write-Host "✅ تم تحديث المكتبة بنجاح!" -ForegroundColor Green

# عرض الإصدار المثبت
Write-Host "`n📦 الإصدار المثبت:" -ForegroundColor Cyan
npm list facebook-nodejs-business-sdk






