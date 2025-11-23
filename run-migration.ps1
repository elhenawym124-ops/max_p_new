# PowerShell script to run Prisma migration
Write-Host "🚀 Starting migration for new features..." -ForegroundColor Green
Write-Host ""

Set-Location -Path "backend"

Write-Host "📦 Running prisma db push..." -ForegroundColor Yellow
& npx prisma db push --accept-data-loss

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🔧 Running prisma generate..." -ForegroundColor Yellow
    & npx prisma generate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 New features added:" -ForegroundColor Cyan
        Write-Host "   - Estimated Delivery Time" -ForegroundColor White
        Write-Host "   - Pre-order Product" -ForegroundColor White
        Write-Host "   - FOMO Popup" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ prisma generate failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "❌ prisma db push failed!" -ForegroundColor Red
    exit 1
}

Set-Location -Path ".."
