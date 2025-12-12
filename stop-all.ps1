# Stop All Servers Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Stopping All Servers" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop Docker containers
Write-Host "Step 1: Checking Docker containers..." -ForegroundColor Yellow
try {
    $dockerContainers = docker ps -q 2>$null
    if ($dockerContainers) {
        Write-Host "Stopping Docker containers..." -ForegroundColor Yellow
        docker-compose down 2>$null
        Write-Host "Docker containers stopped." -ForegroundColor Green
    } else {
        Write-Host "No Docker containers running." -ForegroundColor Gray
    }
} catch {
    Write-Host "Docker not available or no containers running." -ForegroundColor Gray
}
Write-Host ""

# Step 2: Stop processes on server ports
Write-Host "Step 2: Stopping processes on ports 3000, 3001, 5000..." -ForegroundColor Yellow
$ports = @(3000, 3001, 5000)
$stopped = $false

foreach ($port in $ports) {
    try {
        $connections = netstat -ano | Select-String ":$port.*LISTENING"
        if ($connections) {
            foreach ($conn in $connections) {
                $parts = $conn.ToString() -split '\s+'
                $processId = $parts[-1]
                
                if ($processId -match '^\d+$') {
                    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                    if ($process) {
                        $processPath = $process.Path
                        # Don't stop Cursor IDE processes
                        if ($processPath -notlike "*cursor*" -and $processPath -notlike "*Cursor*") {
                            Write-Host "Stopping process on port $port (PID: $processId, Path: $processPath)..." -ForegroundColor Yellow
                            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                            $stopped = $true
                        }
                    }
                }
            }
        }
    } catch {
        # Port not in use or no process found
    }
}

if (-not $stopped) {
    Write-Host "No server processes found on ports 3000, 3001, or 5000." -ForegroundColor Gray
}
Write-Host ""

# Step 3: Stop Node.js processes (excluding Cursor)
Write-Host "Step 3: Stopping Node.js server processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
$stoppedNode = $false

foreach ($proc in $nodeProcesses) {
    $processPath = $proc.Path
    # Only stop Node.js processes that are not from Cursor IDE
    if ($processPath -notlike "*cursor*" -and $processPath -notlike "*Cursor*") {
        Write-Host "Stopping Node.js process (PID: $($proc.Id), Path: $processPath)..." -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        $stoppedNode = $true
    }
}

if (-not $stoppedNode) {
    Write-Host "No Node.js server processes found (excluding Cursor IDE)." -ForegroundColor Gray
}
Write-Host ""

# Step 4: Stop npm processes
Write-Host "Step 4: Stopping npm processes..." -ForegroundColor Yellow
$npmProcesses = Get-Process -Name npm -ErrorAction SilentlyContinue
if ($npmProcesses) {
    foreach ($proc in $npmProcesses) {
        Write-Host "Stopping npm process (PID: $($proc.Id))..." -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "npm processes stopped." -ForegroundColor Green
} else {
    Write-Host "No npm processes found." -ForegroundColor Gray
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All servers stopped!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""







