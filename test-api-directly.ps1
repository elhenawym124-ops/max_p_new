# اختبار API مباشرة لشركة التسويق
# تأكد من أن Backend يعمل على Port 3007

$baseUrl = "http://localhost:3007/api/v1"
$token = "YOUR_TOKEN_HERE"  # ضع التوكن من localStorage

Write-Host "🧪 Testing Facebook Pixel API..." -ForegroundColor Cyan
Write-Host ""

# 1. GET current settings
Write-Host "📥 1. Getting current settings..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri "$baseUrl/storefront-settings" -Method GET -Headers $headers
    Write-Host "✅ Current settings:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 3)
    
    $currentPixelId = $response.data.facebookPixelId
    $currentEnabled = $response.data.facebookPixelEnabled
    
    Write-Host ""
    Write-Host "📊 Current Pixel ID: $currentPixelId" -ForegroundColor Cyan
    Write-Host "📊 Current Enabled: $currentEnabled" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Failed to get settings: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# 2. UPDATE settings
Write-Host "💾 2. Updating settings with Pixel ID..." -ForegroundColor Yellow
$testPixelId = "252061987690295"

$body = @{
    facebookPixelEnabled = $true
    facebookPixelId = $testPixelId
    pixelTrackPageView = $true
    pixelTrackViewContent = $true
    pixelTrackAddToCart = $true
    pixelTrackInitiateCheckout = $true
    pixelTrackPurchase = $true
    pixelTrackSearch = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/storefront-settings" -Method PUT -Headers $headers -Body $body
    Write-Host "✅ Settings updated successfully!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "❌ Failed to update settings: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# 3. VERIFY by getting again
Write-Host "🔍 3. Verifying save..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/storefront-settings" -Method GET -Headers $headers
    
    $verifiedPixelId = $response.data.facebookPixelId
    $verifiedEnabled = $response.data.facebookPixelEnabled
    
    Write-Host ""
    Write-Host "📊 Verified Pixel ID: $verifiedPixelId" -ForegroundColor Cyan
    Write-Host "📊 Verified Enabled: $verifiedEnabled" -ForegroundColor Cyan
    Write-Host ""
    
    if ($verifiedPixelId -eq $testPixelId -and $verifiedEnabled -eq $true) {
        Write-Host "🎉 SUCCESS! Data saved and verified!" -ForegroundColor Green
        Write-Host ""
        Write-Host "✅ Pixel ID: $verifiedPixelId" -ForegroundColor Green
        Write-Host "✅ Enabled: $verifiedEnabled" -ForegroundColor Green
    } else {
        Write-Host "❌ FAILED! Data not saved correctly" -ForegroundColor Red
        Write-Host "Expected: $testPixelId" -ForegroundColor Yellow
        Write-Host "Got: $verifiedPixelId" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Failed to verify: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Test completed!" -ForegroundColor Green
