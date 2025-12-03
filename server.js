const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const API_LIST = 'https://admin.aztv.az/api/program/list';
const API_CREATE = 'https://admin.aztv.az/api/program/create';

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

// Proxy function to forward requests to AZTV API
function proxyRequest(targetPath, method, body, res) {
    // Use different URLs for list vs create
    let fullUrl;
    if (targetPath === '/list') {
        fullUrl = API_LIST;
    } else if (targetPath === '/create') {
        fullUrl = API_CREATE;
    } else {
        fullUrl = 'https://admin.aztv.az/api/program' + targetPath;
    }
    const url = new URL(fullUrl);
    
    console.log('\n📤 API Request:');
    console.log('   URL:', fullUrl);
    console.log('   Method:', method);
    console.log('   Body:', body ? body.substring(0, 500) + '...' : 'empty');
    
    const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': body ? Buffer.byteLength(body) : 0
        }
    };
    
    const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        
        // Handle redirects (301, 302, 303, 307, 308)
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
            console.log('\n🔄 Redirect detected:', proxyRes.statusCode);
            console.log('   Location:', proxyRes.headers.location);
            
            // Follow redirect
            const redirectUrl = new URL(proxyRes.headers.location);
            const redirectOptions = {
                hostname: redirectUrl.hostname,
                port: redirectUrl.port || 443,
                path: redirectUrl.pathname + redirectUrl.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Content-Length': body ? Buffer.byteLength(body) : 0
                }
            };
            
            const redirectReq = https.request(redirectOptions, (redirectRes) => {
                let redirectData = '';
                redirectRes.on('data', chunk => {
                    redirectData += chunk;
                });
                redirectRes.on('end', () => {
                    console.log('\n📥 Redirect Response:');
                    console.log('   Status:', redirectRes.statusCode);
                    console.log('   Data:', redirectData.substring(0, 500));
                    
                    res.writeHead(redirectRes.statusCode, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type'
                    });
                    res.end(redirectData);
                });
            });
            
            redirectReq.on('error', (error) => {
                console.error('❌ Redirect error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            });
            
            if (body) {
                redirectReq.write(body);
            }
            redirectReq.end();
            return;
        }
        
        proxyRes.on('data', chunk => {
            data += chunk;
        });
        
        proxyRes.on('end', () => {
            console.log('\n📥 API Response:');
            console.log('   Status:', proxyRes.statusCode);
            console.log('   Data:', data.substring(0, 500));
            
            res.writeHead(proxyRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(data);
        });
    });
    
    proxyReq.on('error', (error) => {
        console.error('❌ Proxy error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    });
    
    if (body) {
        proxyReq.write(body);
    }
    proxyReq.end();
}

// Serve static files
function serveStatic(filePath, res) {
    const ext = path.extname(filePath);
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
}

// Create server
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    
    // API proxy routes
    if (url.pathname.startsWith('/api/')) {
        const apiPath = url.pathname.replace('/api', '');
        
        let body = '';
        req.on('data', chunk => {
            body += chunk;
        });
        
        req.on('end', () => {
            proxyRequest(apiPath, req.method, body, res);
        });
        return;
    }
    
    // Static files
    let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
    serveStatic(filePath, res);
});

server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎬 AZTV Proqram İdarəetmə Paneli                        ║
║                                                           ║
║   Server işləyir: http://localhost:${PORT}                  ║
║                                                           ║
║   Dayandırmaq üçün: Ctrl+C                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});


