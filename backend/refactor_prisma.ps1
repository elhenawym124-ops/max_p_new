$files = Get-ChildItem -Path "c:\Users\38asfasf\Downloads\max_p_new\backend" -Recurse -Filter "*.js" | Where-Object { $_.FullName -notmatch "node_modules" }
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match "const prisma = getSharedPrismaClient\(\);") {
        $content = $content -replace "const prisma = getSharedPrismaClient\(\);", "// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues"
        $content = $content -replace "prisma\.", "getSharedPrismaClient()."
        Set-Content -Path $file.FullName -Value $content
        Write-Host "Updated $($file.Name)"
    }
}
