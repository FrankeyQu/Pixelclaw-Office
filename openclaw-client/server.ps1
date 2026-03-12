# Pixelclaw Office 前端开发服务器
# 使用 PowerShell 启动本地 HTTP 服务器

param(
    [int]$Port = 8088
)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Pixelclaw Office Development Server" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if port is available
$listener = $null
try {
    $listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Any, $Port)
    $listener.Start()
    $listener.Stop()
    Write-Host "Port $Port is available" -ForegroundColor Green
} catch {
    Write-Host "Error: Port $Port is already in use" -ForegroundColor Red
    Write-Host "Please try another port: .\server.ps1 -Port 8089" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Starting HTTP server..." -ForegroundColor Yellow
Write-Host "Access address: http://localhost:$Port" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Create simple HTTP server
try {
    $http = [System.Net.HttpListener]::new()
    $http.Prefixes.Add("http://localhost:$Port/")
    $http.Start()
    
    Write-Host "Server started successfully!" -ForegroundColor Green
    
    while ($http.IsListening) {
        $context = $http.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath
        if ($path -eq "/") { $path = "/index.html" }
        
        $filePath = Join-Path $PSScriptRoot $path
        
        if (Test-Path $filePath -PathType Leaf) {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $content.Length
            
            # Set MIME type
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mimeTypes = @{
                ".html" = "text/html"
                ".js" = "application/javascript"
                ".css" = "text/css"
                ".png" = "image/png"
                ".jpg" = "image/jpeg"
                ".jpeg" = "image/jpeg"
                ".gif" = "image/gif"
                ".svg" = "image/svg+xml"
                ".ico" = "image/x-icon"
            }
            $response.ContentType = $mimeTypes[$ext]
            if (-not $response.ContentType) { $response.ContentType = "application/octet-stream" }
            
            $response.OutputStream.Write($content, 0, $content.Length)
            Write-Host "200 $path" -ForegroundColor Green
        } else {
            $response.StatusCode = 404
            $message = [System.Text.Encoding]::UTF8.GetBytes("404 - Not Found")
            $response.ContentLength64 = $message.Length
            $response.OutputStream.Write($message, 0, $message.Length)
            Write-Host "404 $path" -ForegroundColor Red
        }
        
        $response.Close()
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($http) {
        try {
            $http.Stop()
            $http.Close()
        } catch {
            Write-Host "Error stopping server: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    Write-Host "`nServer stopped" -ForegroundColor Yellow
}
