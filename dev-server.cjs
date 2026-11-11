const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5500;
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

    let filePath = path.join(__dirname, reqPath);
    
    // Support SPA / Workspace routing fallback if file does not exist but /Workspace is requested
    if (!fs.existsSync(filePath)) {
        if (reqPath.startsWith('/Workspace') || reqPath.startsWith('/workspace')) {
            filePath = path.join(__dirname, 'Workspace', 'index.html');
        } else {
            filePath = path.join(__dirname, 'index.html');
        }
    } else {
        if (fs.statSync(filePath).isDirectory()) {
            const indexInside = path.join(filePath, 'index.html');
            if (fs.existsSync(indexInside)) {
                filePath = indexInside;
            }
        }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server Error: ' + err.code);
            return;
        }
        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server listening on http://127.0.0.1:${PORT}`);
});

