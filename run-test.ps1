# PowerShell script to run the test
Write-Host "🧪 Starting Reviews Page Test..." -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
Set-Location backend

# Check if axios is installed
$axiosCheck = npm list axios 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  axios might not be installed. Installing..." -ForegroundColor Yellow
    npm install axios
}

# Run the test
Write-Host "Running test..." -ForegroundColor Green
node test-reviews-page.js

# Return to original directory
Set-Location ..

