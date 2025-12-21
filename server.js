const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const net = require('net');
const dns = require('dns');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store active ping sessions
const activePings = new Map();

// Middleware
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));

// Database file
const DB_FILE = 'users.json';
const SOUNDS_FILE = 'voicesounds.json';

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

// Voice sounds system
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

let voiceSounds = loadVoiceSounds();
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

    // Resolve hostname first
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
                // Timeout on port 80, try port 443
                tryPort443();
            }
        });

        socket.on('error', (err) => {
            if (!responded) {
                responded = true;
                socket.destroy();
                // Connection refused means host is online but port closed
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

// ============ VOICE SOUNDS / SOUNDBOARD ============
app.get('/api/voice/sounds', (req, res) => {
    res.json(voiceSounds);
});

// Add sound to soundboard
app.post('/api/voice/soundboard/add', (req, res) => {
    const { username, soundData, soundName } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        res.json({ success: false, message: 'No permission' });
        return;
    }
    
    if (!voiceSounds.soundboard) voiceSounds.soundboard = [];
    
    if (voiceSounds.soundboard.length >= 20) {
        res.json({ success: false, message: 'Max 20 sounds allowed' });
        return;
    }
    
    const id = Date.now().toString(36);
    voiceSounds.soundboard.push({ id, name: soundName, data: soundData });
    saveVoiceSounds(voiceSounds);
    
    res.json({ success: true, id });
});

// Remove sound from soundboard
app.delete('/api/voice/soundboard/:id', (req, res) => {
    const { id } = req.params;
    const { username } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        res.json({ success: false, message: 'No permission' });
        return;
    }
    
    if (!voiceSounds.soundboard) voiceSounds.soundboard = [];
    voiceSounds.soundboard = voiceSounds.soundboard.filter(s => s.id !== id);
    saveVoiceSounds(voiceSounds);
    
    res.json({ success: true });
});

// Set system sounds (join/leave)
app.post('/api/voice/sounds/system', (req, res) => {
    const { username, soundType, soundData, soundName } = req.body;
    const user = registeredUsers[username];
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        res.json({ success: false, message: 'No permission' });
        return;
    }
    
    if (!['join', 'leave'].includes(soundType)) {
        res.json({ success: false, message: 'Invalid sound type' });
        return;
    }
    
    if (!voiceSounds.system) voiceSounds.system = {};
    voiceSounds.system[soundType] = soundData ? { data: soundData, name: soundName } : null;
    saveVoiceSounds(voiceSounds);
    
    res.json({ success: true });
});

// Socket.io for chat
const voiceRooms = new Map(); // Store voice chat participants

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

    // ============ VOICE CHAT SIGNALING ============
    socket.on('voiceJoin', (data) => {
        const username = typeof data === 'string' ? data : data.username;
        const avatar = typeof data === 'object' ? data.avatar : '';
        
        socket.voiceUsername = username;
        socket.join('voice-room');
        
        // Get current participants
        const participants = [];
        for (const [id, pdata] of voiceRooms.entries()) {
            if (id !== socket.id) {
                participants.push({ id, username: pdata.username, avatar: pdata.avatar });
            }
        }
        
        voiceRooms.set(socket.id, { username, avatar, muted: false, speaking: false });
        
        // Notify others with sound event
        socket.to('voice-room').emit('voiceUserJoined', { id: socket.id, username, avatar });
        socket.to('voice-room').emit('voicePlaySound', 'join');
        
        // Send current participants to new user
        socket.emit('voiceParticipants', participants);
        
        // Broadcast updated list
        io.to('voice-room').emit('voiceUserList', Array.from(voiceRooms.entries()).map(([id, d]) => ({
            id, username: d.username, avatar: d.avatar, muted: d.muted, speaking: d.speaking
        })));
    });

    socket.on('voiceLeave', () => {
        const userData = voiceRooms.get(socket.id);
        socket.leave('voice-room');
        voiceRooms.delete(socket.id);
        io.to('voice-room').emit('voiceUserLeft', socket.id);
        io.to('voice-room').emit('voicePlaySound', 'leave');
        io.to('voice-room').emit('voiceUserList', Array.from(voiceRooms.entries()).map(([id, data]) => ({
            id, username: data.username, avatar: data.avatar, muted: data.muted, speaking: data.speaking
        })));
    });

    socket.on('voiceOffer', ({ to, offer }) => {
        io.to(to).emit('voiceOffer', { from: socket.id, offer });
    });

    socket.on('voiceAnswer', ({ to, answer }) => {
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

    // Soundboard - play sound to all in voice
    socket.on('voicePlaySoundboard', (soundId) => {
        const sound = voiceSounds.soundboard?.find(s => s.id === soundId);
        if (sound) {
            io.to('voice-room').emit('voiceSoundboardPlay', { id: soundId, data: sound.data });
        }
    });
    // ============ END VOICE CHAT ============

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
        
        // Clean up voice chat
        if (voiceRooms.has(socket.id)) {
            voiceRooms.delete(socket.id);
            io.to('voice-room').emit('voiceUserLeft', socket.id);
            io.to('voice-room').emit('voiceUserList', Array.from(voiceRooms.entries()).map(([id, data]) => ({
                id, username: data.username, muted: data.muted
            })));
        }
        
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Nexus Server running on port ${PORT}`);
});
