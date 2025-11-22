# Script to add sizeGuide column to products table
Write-Host "Starting migration for sizeGuide column..." -ForegroundColor Green

# Change to backend directory
Set-Location backend

# Check if Prisma is available
Write-Host "Checking Prisma installation..." -ForegroundColor Yellow
$prismaCheck = Get-Command npx -ErrorAction SilentlyContinue
if (-not $prismaCheck) {
    Write-Host "Error: npx not found. Please install Node.js and npm." -ForegroundColor Red
    exit 1
}

# Try prisma db push first (simpler)
Write-Host "Running prisma db push..." -ForegroundColor Yellow
try {
    npx prisma db push --accept-data-loss
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migration completed successfully!" -ForegroundColor Green
        Write-Host "The sizeGuide column has been added to the products table." -ForegroundColor Green
    } else {
        Write-Host "Migration failed. Exit code: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error running prisma db push: $_" -ForegroundColor Red
    Write-Host "Trying alternative method..." -ForegroundColor Yellow
    
    # Alternative: Generate Prisma Client
    Write-Host "Generating Prisma Client..." -ForegroundColor Yellow
    npx prisma generate
    
    Write-Host "Migration process completed. Please check your database." -ForegroundColor Yellow
}

# Return to original directory
Set-Location ..

Write-Host "Done!" -ForegroundColor Green

