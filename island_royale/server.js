const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(ROOT, '.' + requested);

  if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, 'index.html')) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, {'Content-Type':'text/plain; charset=utf-8'});
      return res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

const wss = new WebSocket.Server({server});
const players = new Map();
const MAX_PLAYERS = 20;

function snapshot() {
  return [...players.values()].map(({id,name,x,z,mode}) => ({id,name,x,z,mode}));
}
function broadcast(data, except = null) {
  const payload = JSON.stringify(data);
  for (const [id, p] of players) {
    if (id !== except && p.ws.readyState === WebSocket.OPEN) p.ws.send(payload);
  }
}

wss.on('connection', ws => {
  const id = Math.random().toString(36).slice(2, 10);
  ws.send(JSON.stringify({type:'welcome', id, players:snapshot()}));

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'join') {
      if (players.size >= MAX_PLAYERS) {
        ws.send(JSON.stringify({type:'full', message:'Match full'}));
        return ws.close(1008, 'Match full');
      }
      const p = {
        id,
        name: String(msg.name || 'Player').slice(0, 16),
        x: 0, z: 0,
        mode: ['both','build','zero'].includes(msg.mode) ? msg.mode : 'both',
        ws
      };
      players.set(id, p);
      broadcast({type:'joined', name:p.name, players:snapshot()});
      ws.send(JSON.stringify({type:'state', players:snapshot()}));
    }

    if (msg.type === 'move' && players.has(id)) {
      const p = players.get(id);
      const x = Number(msg.x), z = Number(msg.z);
      if (Number.isFinite(x) && Number.isFinite(z)) {
        p.x = Math.max(-105, Math.min(105, x));
        p.z = Math.max(-105, Math.min(105, z));
        broadcast({type:'players', players:snapshot()}, id);
      }
    }
  });

  ws.on('close', () => {
    if (players.has(id)) {
      players.delete(id);
      broadcast({type:'left', id, players:snapshot()});
    }
  });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Island Royale listening on port ${PORT}`);
});
