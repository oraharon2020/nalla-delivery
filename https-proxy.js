const https = require('https');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');

const proxy = httpProxy.createProxyServer({
  target: 'http://localhost:3001',
  ws: true,
});

const server = https.createServer(
  {
    key: fs.readFileSync(path.join(__dirname, 'certs/local-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs/local.pem')),
  },
  (req, res) => {
    proxy.web(req, res);
  }
);

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

proxy.on('error', (err, req, res) => {
  if (res.writeHead) {
    res.writeHead(502);
    res.end('Bad Gateway');
  }
});

const PORT = 3443;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTPS proxy running on https://0.0.0.0:${PORT}`);
  console.log(`Open: https://192.168.1.206:${PORT}`);
});
