const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const net = require('net');
const dns = require('dns');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);

// ============ PROTECCIÓN ANTI-DDOS ============

// Headers de seguridad
app.use(helmet({
    contentSecurityPolicy: false, // Desactivado para permitir inline scripts
    crossOriginEmbedderPolicy: false
}));

// Obtener IP real del cliente
const getClientIP = (req) => {
    let ip = req.headers['x-forwarded-for'] ||
             req.headers['x-real-ip'] ||
             req.headers['cf-connecting-ip'] ||
             req.socket?.remoteAddress ||
             'unknown';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    return ip.replace('::ffff:', '').replace('::1', '127.0.0.1');
};

// Sistema de bloqueo de IPs
const blockedIPs = new Map(); // IP -> timestamp cuando se desbloquea
const ipRequestCount = new Map(); // IP -> { count, firstRequest }
const suspiciousIPs = new Set();

// Limpiar IPs bloqueadas expiradas cada minuto
setInterval(() => {
    const now = Date.now();
    for (const [ip, unblockTime] of blockedIPs.entries()) {
        if (now >= unblockTime) {
            blockedIPs.delete(ip);
            console.log(`IP desbloqueada: ${ip}`);
        }
    }
    // Limpiar contadores viejos
    for (const [ip, data] of ipRequestCount.entries()) {
        if (now - data.firstRequest > 60000) {
            ipRequestCount.delete(ip);
        }
    }
}, 60000);

// Middleware para bloquear IPs
const ipBlocker = (req, res, next) => {
    const ip = getClientIP(req);
    
    // Verificar si está bloqueada
    if (blockedIPs.has(ip)) {
        const remaining = Math.ceil((blockedIPs.get(ip) - Date.now()) / 1000);
        return res.status(429).json({ 
            error: 'IP bloqueada temporalmente', 
            retryAfter: remaining 
        });
    }
    
    // Contar requests
    const now = Date.now();
    if (!ipRequestCount.has(ip)) {
        ipRequestCount.set(ip, { count: 1, firstRequest: now });
    } else {
        const data = ipRequestCount.get(ip);
        if (now - data.firstRequest > 60000) {
            ipRequestCount.set(ip, { count: 1, firstRequest: now });
        } else {
            data.count++;
            // Si hace más de 200 requests en 1 minuto, bloquear por 15 minutos
            if (data.count > 200) {
                blockedIPs.set(ip, now + 15 * 60 * 1000);
                console.log(`IP bloqueada por exceso de requests: ${ip}`);
                return res.status(429).json({ 
                    error: 'Demasiadas solicitudes. IP bloqueada por 15 minutos.' 
                });
            }
        }
    }
    
    next();
};

// Rate limiter general - 100 requests por minuto
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Demasiadas solicitudes, intenta más tarde' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIP
});

// Rate limiter estricto para login/registro - 10 intentos por 15 minutos
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiados intentos de autenticación. Espera 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIP,
    handler: (req, res) => {
        const ip = getClientIP(req);
        suspiciousIPs.add(ip);
        res.status(429).json({ error: 'Demasiados intentos. IP marcada como sospechosa.' });
    }
});

// Rate limiter para API - 60 requests por minuto
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Límite de API alcanzado' },
    keyGenerator: getClientIP
});

// Slow down - ralentiza respuestas después de muchos requests
const speedLimiter = slowDown({
    windowMs: 60 * 1000,
    delayAfter: 50,
    delayMs: (hits) => hits * 100, // Cada request extra añade 100ms de delay
    keyGenerator: getClientIP
});

// Aplicar protecciones globales
app.use(ipBlocker);
app.use(speedLimiter);
app.use(generalLimiter);

// Limitar tamaño de body
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Servir archivos estáticos con cache
app.use(express.static(__dirname, {
    maxAge: '1h',
    etag: true
}));

// ============ FIN PROTECCIÓN ANTI-DDOS ============


// Socket.io con protección
const io = new Server(server, {
    connectionStateRecovery: {},
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB max
    perMessageDeflate: false
});

// Protección de conexiones Socket.io
const socketConnections = new Map(); // IP -> count
const MAX_SOCKETS_PER_IP = 5;

io.use((socket, next) => {
    const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0] || 
               socket.handshake.address?.replace('::ffff:', '') || 'unknown';
    
    // Verificar si IP está bloqueada
    if (blockedIPs.has(ip)) {
        return next(new Error('IP bloqueada'));
    }
    
    // Limitar conexiones por IP
    const currentCount = socketConnections.get(ip) || 0;
    if (currentCount >= MAX_SOCKETS_PER_IP) {
        return next(new Error('Demasiadas conexiones desde esta IP'));
    }
    
    socketConnections.set(ip, currentCount + 1);
    socket.clientIP = ip;
    next();
});

// Store active ping sessions
const activePings = new Map();

// Database file
const DB_FILE = 'users.json';
const SOUNDS_FILE = 'voicesounds.json';
const NOTES_FILE = 'notes.json';
const STICKERS_FILE = 'stickers.json';

// Load or create users database
function loadUsers() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('Creating new database...');
    }
    const defaultUsers = {
        'admin': {
            username: 'admin',
            password: 'nexus',
            role: 'owner',
            bio: 'System Administrator',
            avatar: '',
            joinDate: new Date().toISOString()
        }
    };
    saveUsers(defaultUsers);
    return defaultUsers;
}

function saveUsers(users) {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

function loadVoiceSounds() {
    try {
        if (fs.existsSync(SOUNDS_FILE)) {
            return JSON.parse(fs.readFileSync(SOUNDS_FILE, 'utf8'));
        }
    } catch (e) {}
    return { system: { join: null, leave: null }, soundboard: [] };
}

function saveVoiceSounds(sounds) {
    fs.writeFileSync(SOUNDS_FILE, JSON.stringify(sounds, null, 2));
}

// Notes system
function loadNotes() {
    try {
        if (fs.existsSync(NOTES_FILE)) {
            return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function saveNotes(notes) {
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
}

// Stickers system
function loadStickers() {
    try {
        if (fs.existsSync(STICKERS_FILE)) {
            return JSON.parse(fs.readFileSync(STICKERS_FILE, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function saveStickers(stickers) {
    fs.writeFileSync(STICKERS_FILE, JSON.stringify(stickers, null, 2));
}

let voiceSounds = loadVoiceSounds();
let registeredUsers = loadUsers();
let notes = loadNotes();
let stickers = loadStickers();
const onlineUsers = new Map();

// ============ API ROUTES CON PROTECCIÓN ============

// Login con rate limit estricto
app.post('/api/login', authLimiter, (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, message: 'Missing credentials' });
    }
    
    const user = registeredUsers[username];
    
    if (user && user.password === password) {
        res.json({ success: true, user: { ...user, password: undefined } });
    } else {
        res.json({ success: false, message: 'Invalid credentials' });
    }
});

// Registro con rate limit estricto
app.post('/api/register', authLimiter, (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, message: 'Missing credentials' });
    }
    
    if (username.length > 20 || password.length > 50) {
        return res.json({ success: false, message: 'Input too long' });
    }
    
    if (registeredUsers[username]) {
        return res.json({ success: false, message: 'Username already exists' });
    }
    
    registeredUsers[username] = {
        username,
        password,
        role: 'member',
        bio: '',
        avatar: '',
        joinDate: new Date().toISOString()
    };
    saveUsers(registeredUsers);
    res.json({ success: true });
});

app.get('/api/members', apiLimiter, (req, res) => {
    const members = Object.values(registeredUsers).map(u => ({
        username: u.username,
        role: u.role,
        bio: u.bio,
        avatar: u.avatar,
        joinDate: u.joinDate,
        online: Array.from(onlineUsers.values()).includes(u.username)
    }));
    res.json(members);
});

app.post('/api/profile/update', apiLimiter, (req, res) => {
    const { username, bio, avatar, newUsername } = req.body;
    
    if (!registeredUsers[username]) {
        return res.json({ success: false, message: 'User not found' });
    }
    
    // Validar tamaños
    if (bio && bio.length > 500) {
        return res.json({ success: false, message: 'Bio too long' });
    }
    if (avatar && avatar.length > 500) {
        return res.json({ success: false, message: 'Avatar URL too long' });
    }
    
    const user = registeredUsers[username];
    
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    
    if (newUsername && newUsername !== username) {
        if (newUsername.length > 20) {
            return res.json({ success: false, message: 'Username too long' });
        }
        if (registeredUsers[newUsername]) {
            return res.json({ success: false, message: 'Username already taken' });
        }
        user.username = newUsername;
        registeredUsers[newUsername] = user;
        delete registeredUsers[username];
    }
    
    saveUsers(registeredUsers);
    res.json({ success: true, user: { ...user, password: undefined } });
});


// Kick user
app.post('/api/member/kick', apiLimiter, (req, res) => {
    const { adminUser, targetUser } = req.body;
    const admin = registeredUsers[adminUser];
    
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }
    
    for (const [id, name] of onlineUsers.entries()) {
        if (name === targetUser) {
            io.to(id).emit('kicked', 'You have been kicked');
            onlineUsers.delete(id);
        }
    }
    io.emit('userList', Array.from(new Set(onlineUsers.values())));
    res.json({ success: true });
});

// Ban user
app.post('/api/member/ban', apiLimiter, (req, res) => {
    const { adminUser, targetUser } = req.body;
    const admin = registeredUsers[adminUser];
    const target = registeredUsers[targetUser];
    
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }
    
    if (!target) {
        return res.json({ success: false, message: 'User not found' });
    }
    
    if (target.role === 'owner') {
        return res.json({ success: false, message: 'Cannot ban owner' });
    }
    
    for (const [id, name] of onlineUsers.entries()) {
        if (name === targetUser) {
            io.to(id).emit('banned', 'You have been banned');
            onlineUsers.delete(id);
        }
    }
    
    delete registeredUsers[targetUser];
    saveUsers(registeredUsers);
    io.emit('userList', Array.from(new Set(onlineUsers.values())));
    res.json({ success: true });
});

// Change role
app.post('/api/member/role', apiLimiter, (req, res) => {
    const { adminUser, targetUser, newRole } = req.body;
    const admin = registeredUsers[adminUser];
    const target = registeredUsers[targetUser];
    
    if (!admin || admin.role !== 'owner') {
        return res.json({ success: false, message: 'Only owner can change roles' });
    }
    
    if (!target) {
        return res.json({ success: false, message: 'User not found' });
    }
    
    if (target.role === 'owner') {
        return res.json({ success: false, message: 'Cannot change owner role' });
    }
    
    target.role = newRole;
    saveUsers(registeredUsers);
    res.json({ success: true });
});

// Get credentials
app.post('/api/member/credentials', apiLimiter, (req, res) => {
    const { adminUser, targetUser } = req.body;
    const admin = registeredUsers[adminUser];
    const target = registeredUsers[targetUser];
    
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }
    
    if (!target) {
        return res.json({ success: false, message: 'User not found' });
    }
    
    res.json({ 
        success: true, 
        username: target.username,
        password: target.password,
        role: target.role
    });
});

// ============ IP LOGGER ============
const IPLOG_FILE = 'iplogs.json';

function loadIPLogs() {
    try {
        if (fs.existsSync(IPLOG_FILE)) {
            return JSON.parse(fs.readFileSync(IPLOG_FILE, 'utf8'));
        }
    } catch (e) {}
    return {};
}

function saveIPLogs(logs) {
    fs.writeFileSync(IPLOG_FILE, JSON.stringify(logs, null, 2));
}

let ipLogs = loadIPLogs();

app.post('/api/iplogger/create', apiLimiter, (req, res) => {
    const { owner, redirectUrl, customSlug } = req.body;
    
    let trackId = customSlug ? customSlug.toLowerCase().replace(/[^a-z0-9-]/g, '') : '';
    if (!trackId || ipLogs[trackId]) {
        trackId = Math.random().toString(36).substring(2, 10);
    }
    
    ipLogs[trackId] = {
        owner,
        redirectUrl: redirectUrl || 'https://google.com',
        created: new Date().toISOString(),
        logs: []
    };
    saveIPLogs(ipLogs);
    
    res.json({ success: true, trackId, trackUrl: `/t/${trackId}` });
});

app.get('/api/iplogger/logs/:trackId', apiLimiter, (req, res) => {
    const { trackId } = req.params;
    const log = ipLogs[trackId];
    
    if (!log) {
        return res.json({ success: false, message: 'Link not found' });
    }
    
    res.json({ success: true, data: log });
});

app.get('/api/iplogger/mylinks/:username', apiLimiter, (req, res) => {
    const { username } = req.params;
    const userLinks = [];
    
    for (const [trackId, data] of Object.entries(ipLogs)) {
        if (data.owner === username) {
            userLinks.push({ trackId, ...data });
        }
    }
    
    res.json(userLinks);
});

app.delete('/api/iplogger/delete/:trackId', apiLimiter, (req, res) => {
    const { trackId } = req.params;
    
    if (ipLogs[trackId]) {
        delete ipLogs[trackId];
        saveIPLogs(ipLogs);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Link not found' });
    }
});

app.get('/t/:trackId', async (req, res) => {
    const { trackId } = req.params;
    const log = ipLogs[trackId];
    
    if (!log) {
        return res.status(404).send('Not found');
    }
    
    let ip = getClientIP(req);
    
    let ipInfo = { ip };
    try {
        if (ip !== '127.0.0.1' && ip !== 'localhost' && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
            const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
            const data = await response.json();
            if (data.status === 'success') {
                ipInfo = {
                    ip: data.query || ip,
                    country: data.country,
                    countryCode: data.countryCode,
                    region: data.regionName,
                    city: data.city,
                    zip: data.zip,
                    lat: data.lat,
                    lon: data.lon,
                    timezone: data.timezone,
                    isp: data.isp,
                    org: data.org,
                    as: data.as
                };
            }
        } else {
            ipInfo = { ip, country: 'Localhost', city: 'Local', isp: 'Local Network' };
        }
    } catch (e) {
        console.log('IP API error:', e.message);
    }
    
    log.logs.push({
        ...ipInfo,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'] || 'Direct',
        language: req.headers['accept-language']?.split(',')[0] || 'Unknown',
        timestamp: new Date().toISOString()
    });
    saveIPLogs(ipLogs);
    
    io.emit('iplog', { trackId, log: log.logs[log.logs.length - 1] });
    res.redirect(log.redirectUrl);
});


// ============ PORT SCANNER ============
app.post('/api/portscan', apiLimiter, async (req, res) => {
    const { target, ports } = req.body;
    
    if (!target || !ports || !Array.isArray(ports)) {
        return res.json({ success: false, message: 'Invalid parameters' });
    }
    
    // Limitar cantidad de puertos
    if (ports.length > 100) {
        return res.json({ success: false, message: 'Max 100 ports allowed' });
    }

    let ip = target;
    try {
        if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(target)) {
            ip = await new Promise((resolve, reject) => {
                dns.lookup(target, (err, address) => {
                    if (err) reject(err);
                    else resolve(address);
                });
            });
        }
    } catch (e) {
        return res.json({ success: false, message: 'Could not resolve hostname' });
    }

    const results = [];
    const scanPromises = ports.map(port => {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(2000);

            socket.on('connect', () => {
                results.push({ port, status: 'open', service: getServiceName(port) });
                socket.destroy();
                resolve();
            });

            socket.on('timeout', () => {
                results.push({ port, status: 'filtered', service: getServiceName(port) });
                socket.destroy();
                resolve();
            });

            socket.on('error', () => {
                results.push({ port, status: 'closed', service: getServiceName(port) });
                socket.destroy();
                resolve();
            });

            socket.connect(port, ip);
        });
    });

    await Promise.all(scanPromises);
    results.sort((a, b) => a.port - b.port);
    res.json({ success: true, target: ip, results });
});

function getServiceName(port) {
    const services = {
        20: 'FTP-DATA', 21: 'FTP', 22: 'SSH', 23: 'TELNET', 25: 'SMTP',
        53: 'DNS', 80: 'HTTP', 110: 'POP3', 119: 'NNTP', 123: 'NTP',
        143: 'IMAP', 161: 'SNMP', 194: 'IRC', 443: 'HTTPS', 445: 'SMB',
        465: 'SMTPS', 587: 'SMTP', 993: 'IMAPS', 995: 'POP3S',
        1433: 'MSSQL', 1521: 'ORACLE', 3306: 'MYSQL', 3389: 'RDP',
        5432: 'POSTGRESQL', 5900: 'VNC', 6379: 'REDIS', 8080: 'HTTP-PROXY',
        8443: 'HTTPS-ALT', 27017: 'MONGODB'
    };
    return services[port] || 'UNKNOWN';
}

// ============ PINGER ============
app.post('/api/ping/start', apiLimiter, (req, res) => {
    const { target, sessionId } = req.body;
    
    if (!target || !sessionId) {
        return res.json({ success: false, message: 'Invalid parameters' });
    }

    if (activePings.has(sessionId)) {
        clearInterval(activePings.get(sessionId));
    }

    const resolveTarget = (host) => {
        return new Promise((resolve) => {
            if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
                resolve(host);
            } else {
                dns.lookup(host, (err, address) => {
                    resolve(err ? null : address);
                });
            }
        });
    };

    const pingInterval = setInterval(async () => {
        const ip = await resolveTarget(target);
        if (!ip) {
            io.to(sessionId).emit('pingResult', { target, online: false, time: null, ttl: null, error: 'DNS failed' });
            return;
        }

        const startTime = Date.now();
        const socket = new net.Socket();
        socket.setTimeout(2000);
        let responded = false;

        socket.on('connect', () => {
            if (!responded) {
                responded = true;
                const time = Date.now() - startTime;
                socket.destroy();
                io.to(sessionId).emit('pingResult', { target, online: true, time, ttl: 64 });
            }
        });

        socket.on('timeout', () => {
            if (!responded) {
                responded = true;
                socket.destroy();
                tryPort443();
            }
        });

        socket.on('error', (err) => {
            if (!responded) {
                responded = true;
                socket.destroy();
                if (err.code === 'ECONNREFUSED') {
                    const time = Date.now() - startTime;
                    io.to(sessionId).emit('pingResult', { target, online: true, time, ttl: 64 });
                } else {
                    tryPort443();
                }
            }
        });

        const tryPort443 = () => {
            const socket2 = new net.Socket();
            socket2.setTimeout(2000);
            let responded2 = false;

            socket2.on('connect', () => {
                if (!responded2) {
                    responded2 = true;
                    const time = Date.now() - startTime;
                    socket2.destroy();
                    io.to(sessionId).emit('pingResult', { target, online: true, time, ttl: 64 });
                }
            });

            socket2.on('timeout', () => {
                if (!responded2) {
                    responded2 = true;
                    socket2.destroy();
                    io.to(sessionId).emit('pingResult', { target, online: false, time: null, ttl: null });
                }
            });

            socket2.on('error', (err) => {
                if (!responded2) {
                    responded2 = true;
                    socket2.destroy();
                    if (err.code === 'ECONNREFUSED') {
                        const time = Date.now() - startTime;
                        io.to(sessionId).emit('pingResult', { target, online: true, time, ttl: 64 });
                    } else {
                        io.to(sessionId).emit('pingResult', { target, online: false, time: null, ttl: null });
                    }
                }
            });

            socket2.connect(443, ip);
        };

        socket.connect(80, ip);
    }, 1000);

    activePings.set(sessionId, pingInterval);
    res.json({ success: true });
});

app.post('/api/ping/stop', apiLimiter, (req, res) => {
    const { sessionId } = req.body;
    
    if (activePings.has(sessionId)) {
        clearInterval(activePings.get(sessionId));
        activePings.delete(sessionId);
    }
    
    res.json({ success: true });
});


// ============ CHAT PINNED MESSAGES ============
let pinnedMessage = null;
let pinnedTimeout = null;

app.post('/api/chat/pin', apiLimiter, (req, res) => {
    const { username, message, duration } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }

    if (pinnedTimeout) clearTimeout(pinnedTimeout);

    pinnedMessage = {
        text: message,
        pinnedBy: username,
        pinnedAt: new Date().toISOString(),
        duration
    };

    if (duration > 0) {
        pinnedTimeout = setTimeout(() => {
            pinnedMessage = null;
            io.emit('pinnedMessage', null);
        }, duration * 60 * 1000);
    }

    io.emit('pinnedMessage', pinnedMessage);
    res.json({ success: true });
});

app.post('/api/chat/unpin', apiLimiter, (req, res) => {
    const { username } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }

    if (pinnedTimeout) clearTimeout(pinnedTimeout);
    pinnedMessage = null;
    io.emit('pinnedMessage', null);
    res.json({ success: true });
});

app.get('/api/chat/pinned', apiLimiter, (req, res) => {
    res.json(pinnedMessage);
});

// ============ VOICE SOUNDS ============
app.get('/api/voice/sounds', apiLimiter, (req, res) => {
    res.json(voiceSounds);
});

app.post('/api/voice/soundboard/add', apiLimiter, (req, res) => {
    const { username, soundData, soundName } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }
    
    if (!voiceSounds.soundboard) voiceSounds.soundboard = [];
    
    if (voiceSounds.soundboard.length >= 20) {
        return res.json({ success: false, message: 'Max 20 sounds allowed' });
    }
    
    const id = Date.now().toString(36);
    voiceSounds.soundboard.push({ id, name: soundName, data: soundData });
    saveVoiceSounds(voiceSounds);
    
    res.json({ success: true, id });
});

app.delete('/api/voice/soundboard/:id', apiLimiter, (req, res) => {
    const { id } = req.params;
    const { username } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }
    
    if (!voiceSounds.soundboard) voiceSounds.soundboard = [];
    voiceSounds.soundboard = voiceSounds.soundboard.filter(s => s.id !== id);
    saveVoiceSounds(voiceSounds);
    
    res.json({ success: true });
});

app.post('/api/voice/sounds/system', apiLimiter, (req, res) => {
    const { username, soundType, soundData, soundName } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }
    
    if (!['join', 'leave'].includes(soundType)) {
        return res.json({ success: false, message: 'Invalid sound type' });
    }
    
    if (!voiceSounds.system) voiceSounds.system = {};
    voiceSounds.system[soundType] = soundData ? { data: soundData, name: soundName } : null;
    saveVoiceSounds(voiceSounds);
    
    res.json({ success: true });
});

// ============ NOTES SYSTEM ============

// Get all notes (everyone can read)
app.get('/api/notes', apiLimiter, (req, res) => {
    res.json(notes);
});

// Create note (admin/owner only)
app.post('/api/notes', apiLimiter, (req, res) => {
    const { username, title, content } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }
    
    if (!title || !content) {
        return res.json({ success: false, message: 'Title and content required' });
    }
    
    if (title.length > 100 || content.length > 5000) {
        return res.json({ success: false, message: 'Title or content too long' });
    }
    
    const note = {
        id: Date.now().toString(36),
        title,
        content,
        author: username,
        createdAt: new Date().toISOString()
    };
    
    notes.unshift(note);
    saveNotes(notes);
    
    res.json({ success: true, note });
});

// Delete note (admin/owner only)
app.delete('/api/notes/:id', apiLimiter, (req, res) => {
    const { id } = req.params;
    const { username } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }
    
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) {
        return res.json({ success: false, message: 'Note not found' });
    }
    
    notes.splice(index, 1);
    saveNotes(notes);
    
    res.json({ success: true });
});

// ============ STICKERS SYSTEM ============

// Get all stickers (everyone can use)
app.get('/api/stickers', apiLimiter, (req, res) => {
    res.json(stickers);
});

// Add sticker (admin/owner only)
app.post('/api/stickers', apiLimiter, (req, res) => {
    const { username, data } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }
    
    if (!data) {
        return res.json({ success: false, message: 'Image required' });
    }
    
    if (data.length > 500000) {
        return res.json({ success: false, message: 'Image too large (max 500KB)' });
    }
    
    if (stickers.length >= 50) {
        return res.json({ success: false, message: 'Max 50 stickers allowed' });
    }
    
    const sticker = {
        id: Date.now().toString(36),
        url: data,
        addedBy: username,
        createdAt: new Date().toISOString()
    };
    
    stickers.push(sticker);
    saveStickers(stickers);
    
    res.json({ success: true, sticker });
});

// Delete sticker (admin/owner only)
app.delete('/api/stickers/:id', apiLimiter, (req, res) => {
    const { id } = req.params;
    const { username } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        return res.json({ success: false, message: 'No permission' });
    }
    
    const index = stickers.findIndex(s => s.id === id);
    if (index === -1) {
        return res.json({ success: false, message: 'Sticker not found' });
    }
    
    stickers.splice(index, 1);
    saveStickers(stickers);
    
    res.json({ success: true });
});

// ============ SOCKET.IO CON PROTECCIÓN ============
const voiceRooms = new Map();

// Rate limiting para mensajes de socket
const socketMessageCount = new Map();
const SOCKET_MSG_LIMIT = 30; // 30 mensajes por minuto

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Inicializar contador de mensajes
    socketMessageCount.set(socket.id, { count: 0, resetTime: Date.now() + 60000 });

    // Función para verificar rate limit de socket
    const checkSocketRateLimit = () => {
        const data = socketMessageCount.get(socket.id);
        if (!data) return true;
        
        const now = Date.now();
        if (now > data.resetTime) {
            data.count = 0;
            data.resetTime = now + 60000;
        }
        
        data.count++;
        if (data.count > SOCKET_MSG_LIMIT) {
            socket.emit('error', 'Demasiados mensajes. Espera un momento.');
            return false;
        }
        return true;
    };

    socket.on('join', (username) => {
        if (!checkSocketRateLimit()) return;
        if (!username || username.length > 20) return;
        
        for (const [id, name] of onlineUsers.entries()) {
            if (name === username && id !== socket.id) {
                onlineUsers.delete(id);
            }
        }
        onlineUsers.set(socket.id, username);
        io.emit('userList', Array.from(new Set(onlineUsers.values())));
        io.emit('message', {
            type: 'system',
            text: `${username} joined the chat`,
            time: new Date().toLocaleTimeString()
        });
        
        if (pinnedMessage) {
            socket.emit('pinnedMessage', pinnedMessage);
        }
    });

    socket.on('joinPingSession', (sessionId) => {
        if (!checkSocketRateLimit()) return;
        socket.join(sessionId);
    });

    socket.on('leavePingSession', (sessionId) => {
        socket.leave(sessionId);
    });


    // ============ VOICE CHAT ============
    socket.on('voiceJoin', (data) => {
        if (!checkSocketRateLimit()) return;
        
        const username = typeof data === 'string' ? data : data.username;
        const avatar = typeof data === 'object' ? data.avatar : '';
        
        socket.voiceUsername = username;
        socket.join('voice-room');
        
        const participants = [];
        for (const [id, pdata] of voiceRooms.entries()) {
            if (id !== socket.id) {
                participants.push({ id, username: pdata.username, avatar: pdata.avatar });
            }
        }
        
        voiceRooms.set(socket.id, { username, avatar, muted: false, speaking: false });
        
        socket.to('voice-room').emit('voiceUserJoined', { id: socket.id, username, avatar });
        socket.to('voice-room').emit('voicePlaySound', 'join');
        socket.emit('voiceParticipants', participants);
        
        io.to('voice-room').emit('voiceUserList', Array.from(voiceRooms.entries()).map(([id, d]) => ({
            id, username: d.username, avatar: d.avatar, muted: d.muted, speaking: d.speaking
        })));
    });

    socket.on('voiceLeave', () => {
        socket.leave('voice-room');
        voiceRooms.delete(socket.id);
        io.to('voice-room').emit('voiceUserLeft', socket.id);
        io.to('voice-room').emit('voicePlaySound', 'leave');
        io.to('voice-room').emit('voiceUserList', Array.from(voiceRooms.entries()).map(([id, data]) => ({
            id, username: data.username, avatar: data.avatar, muted: data.muted, speaking: data.speaking
        })));
    });

    socket.on('voiceOffer', ({ to, offer }) => {
        if (!checkSocketRateLimit()) return;
        io.to(to).emit('voiceOffer', { from: socket.id, offer });
    });

    socket.on('voiceAnswer', ({ to, answer }) => {
        if (!checkSocketRateLimit()) return;
        io.to(to).emit('voiceAnswer', { from: socket.id, answer });
    });

    socket.on('voiceIceCandidate', ({ to, candidate }) => {
        io.to(to).emit('voiceIceCandidate', { from: socket.id, candidate });
    });

    socket.on('voiceMuteToggle', (muted) => {
        const data = voiceRooms.get(socket.id);
        if (data) {
            data.muted = muted;
            io.to('voice-room').emit('voiceUserList', Array.from(voiceRooms.entries()).map(([id, d]) => ({
                id, username: d.username, avatar: d.avatar, muted: d.muted, speaking: d.speaking
            })));
        }
    });

    socket.on('voiceSpeaking', (speaking) => {
        const data = voiceRooms.get(socket.id);
        if (data) {
            data.speaking = speaking;
            io.to('voice-room').emit('voiceUserList', Array.from(voiceRooms.entries()).map(([id, d]) => ({
                id, username: d.username, avatar: d.avatar, muted: d.muted, speaking: d.speaking
            })));
        }
    });

    socket.on('voicePlaySoundboard', (soundId) => {
        if (!checkSocketRateLimit()) return;
        const sound = voiceSounds.soundboard?.find(s => s.id === soundId);
        if (sound) {
            io.to('voice-room').emit('voiceSoundboardPlay', { id: soundId, data: sound.data });
        }
    });

    // ============ CHAT MESSAGES ============
    socket.on('chatMessage', (msg) => {
        if (!checkSocketRateLimit()) return;
        
        const username = onlineUsers.get(socket.id) || 'Anonymous';
        
        // Validar mensaje
        if (msg.type === 'image') {
            if (!msg.content || msg.content.length > 5000000) return; // Max 5MB
            io.emit('message', {
                type: 'image',
                username,
                content: msg.content,
                time: new Date().toLocaleTimeString()
            });
        } else if (msg.type === 'sticker') {
            if (!msg.content || msg.content.length > 1000) return;
            io.emit('message', {
                type: 'sticker',
                username,
                content: msg.content,
                time: new Date().toLocaleTimeString()
            });
        } else {
            const text = msg.content || msg;
            if (!text || text.length > 2000) return; // Max 2000 chars
            io.emit('message', {
                type: 'text',
                username,
                text,
                time: new Date().toLocaleTimeString()
            });
        }
    });

    socket.on('disconnect', () => {
        const username = onlineUsers.get(socket.id);
        if (username) {
            onlineUsers.delete(socket.id);
            const stillOnline = Array.from(onlineUsers.values()).includes(username);
            if (!stillOnline) {
                io.emit('message', {
                    type: 'system',
                    text: `${username} left the chat`,
                    time: new Date().toLocaleTimeString()
                });
            }
            io.emit('userList', Array.from(new Set(onlineUsers.values())));
        }
        
        if (voiceRooms.has(socket.id)) {
            voiceRooms.delete(socket.id);
            io.to('voice-room').emit('voiceUserLeft', socket.id);
            io.to('voice-room').emit('voiceUserList', Array.from(voiceRooms.entries()).map(([id, data]) => ({
                id, username: data.username, muted: data.muted
            })));
        }
        
        // Limpiar contadores
        socketMessageCount.delete(socket.id);
        
        // Reducir contador de conexiones por IP
        if (socket.clientIP) {
            const count = socketConnections.get(socket.clientIP) || 0;
            if (count > 1) {
                socketConnections.set(socket.clientIP, count - 1);
            } else {
                socketConnections.delete(socket.clientIP);
            }
        }
        
        console.log('User disconnected:', socket.id);
    });
});

// ============ ENDPOINT DE ESTADO ============
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        users: onlineUsers.size,
        blockedIPs: blockedIPs.size,
        uptime: process.uptime()
    });
});

// ============ INICIAR SERVIDOR ============
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🛡️ Nexus Server con protección anti-DDoS corriendo en puerto ${PORT}`);
    console.log(`📊 Rate limits activos:`);
    console.log(`   - General: 100 req/min`);
    console.log(`   - Auth: 10 intentos/15min`);
    console.log(`   - API: 60 req/min`);
    console.log(`   - Socket: 30 msg/min`);
    console.log(`   - Max sockets por IP: ${MAX_SOCKETS_PER_IP}`);
});
