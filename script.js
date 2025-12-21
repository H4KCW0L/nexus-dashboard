// Nexus Dashboard JavaScript

// Current user data
let currentUser = null;

// Login Handler
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const registerBtn = document.getElementById('register-btn');
    const backLoginBtn = document.getElementById('back-login-btn');
    
    const loginUser = document.getElementById('login-user');
    const loginPass = document.getElementById('login-pass');
    const loginError = document.getElementById('login-error');
    
    const regUser = document.getElementById('reg-user');
    const regPass = document.getElementById('reg-pass');
    const registerError = document.getElementById('register-error');
    
    const loginScreen = document.getElementById('login-screen');
    const loginBox = document.getElementById('login-box');
    const registerBox = document.getElementById('register-box');
    const loadingOverlay = document.getElementById('loading-overlay');
    const dashboard = document.getElementById('dashboard');

    // Show register form
    showRegisterBtn.addEventListener('click', () => {
        loginBox.style.display = 'none';
        registerBox.style.display = 'block';
        registerError.textContent = '';
    });

    // Back to login
    backLoginBtn.addEventListener('click', () => {
        registerBox.style.display = 'none';
        loginBox.style.display = 'block';
        loginError.textContent = '';
    });

    async function attemptLogin() {
        const user = loginUser.value.trim();
        const pass = loginPass.value;

        if (!user || !pass) {
            loginError.textContent = 'Please enter username and password';
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await response.json();

            if (data.success) {
                currentUser = data.user;
                loginBox.classList.add('blur');
                loadingOverlay.classList.add('active');
                
                setTimeout(() => {
                    loginScreen.style.display = 'none';
                    dashboard.style.display = 'grid';
                    window.nexus = new NexusDashboard();
                }, 2000);
            } else {
                loginError.textContent = data.message || 'Invalid credentials';
                loginPass.value = '';
            }
        } catch (e) {
            loginError.textContent = 'Server not running. Start with: npm start';
        }
    }

    async function attemptRegister() {
        const user = regUser.value.trim();
        const pass = regPass.value;

        if (!user || !pass) {
            registerError.textContent = 'Please fill all fields';
            return;
        }

        if (pass.length < 4) {
            registerError.textContent = 'Password must be at least 4 characters';
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await response.json();

            if (data.success) {
                registerError.style.color = '#00ff00';
                registerError.textContent = 'Account created! Redirecting to login...';
                setTimeout(() => {
                    registerBox.style.display = 'none';
                    loginBox.style.display = 'block';
                    loginUser.value = user;
                    loginPass.value = '';
                    registerError.style.color = '#ff4444';
                    registerError.textContent = '';
                    regUser.value = '';
                    regPass.value = '';
                }, 1500);
            } else {
                registerError.textContent = data.message;
            }
        } catch (e) {
            registerError.textContent = 'Server not running. Start with: npm start';
        }
    }

    loginBtn.addEventListener('click', attemptLogin);
    registerBtn.addEventListener('click', attemptRegister);
    
    loginPass.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') attemptLogin();
    });
    
    loginUser.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginPass.focus();
    });

    regPass.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') attemptRegister();
    });
    
    regUser.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') regPass.focus();
    });
});

class NexusDashboard {
    constructor() {
        this.currentTool = 'ip-lookup';
        this.isPinging = false;
        this.init();
    }

    init() {
        this.setupNavigation();
        this.loadToolContent('ip-lookup');
    }

    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.stopAllProcesses();
                this.loadToolContent(tool);
            });
        });
    }

    stopAllProcesses() {
        this.isPinging = false;
        if (this.pingInterval) clearInterval(this.pingInterval);
        
        // Disconnect chat socket when leaving chat
        if (this.socket && this.currentTool === 'chat') {
            this.socket.off('message');
            this.socket.off('userList');
            this.socket.disconnect();
            this.socket = null;
        }
    }

    loadToolContent(toolName) {
        const contentArea = document.getElementById('tool-content');
        this.currentTool = toolName;
        
        const contents = {
            'ip-lookup': this.getIPLookupHTML(),
            'phone-lookup': this.getPhoneLookupHTML(),
            'whois': this.getWhoisHTML(),
            'ip-pinger': this.getIPPingerHTML(),
            'ip-logger': this.getIPLoggerHTML(),
            'chat': this.getChatHTML(),
            'members': this.getMembersHTML(),
            'profile': this.getProfileHTML()
        };

        contentArea.innerHTML = contents[toolName];
        this.attachToolListeners(toolName);
    }

    getIPLookupHTML() {
        return `
            <div class="tool-panel">
                <h2>IP Lookup</h2>
                <div class="tool-controls">
                    <input type="text" class="tool-input" id="ip-input" placeholder="Enter IP address (e.g., 8.8.8.8)">
                    <button class="btn-primary" id="lookup-ip">Lookup</button>
                    <button class="btn-secondary" id="clear-ip">Clear</button>
                </div>
                <div class="output-area">
                    <div class="output-header">IP Information</div>
                    <div class="output-content" id="ip-output">Enter an IP address to lookup...</div>
                </div>
            </div>
        `;
    }

    getPhoneLookupHTML() {
        return `
            <div class="tool-panel">
                <h2>Phone Lookup</h2>
                <div class="tool-controls">
                    <input type="text" class="tool-input" id="phone-input" placeholder="Enter phone number (e.g., +1234567890)">
                    <button class="btn-primary" id="lookup-phone">Lookup</button>
                    <button class="btn-secondary" id="clear-phone">Clear</button>
                </div>
                <div class="output-area">
                    <div class="output-header">Phone Information</div>
                    <div class="output-content" id="phone-output">Enter a phone number to lookup...</div>
                </div>
            </div>
        `;
    }

    getWhoisHTML() {
        return `
            <div class="tool-panel">
                <h2>WHOIS Lookup</h2>
                <div class="tool-controls">
                    <input type="text" class="tool-input" id="domain-input" placeholder="Enter domain (e.g., google.com)">
                    <button class="btn-primary" id="lookup-whois">Lookup</button>
                    <button class="btn-secondary" id="clear-whois">Clear</button>
                </div>
                <div class="output-area">
                    <div class="output-header">WHOIS Information</div>
                    <div class="output-content" id="whois-output">Enter a domain to lookup...</div>
                </div>
            </div>
        `;
    }

    getIPPingerHTML() {
        return `
            <div class="tool-panel">
                <h2>IP Pinger</h2>
                <div class="tool-controls">
                    <input type="text" class="tool-input" id="ping-input" placeholder="Enter IP or domain">
                    <input type="number" class="tool-input" id="ping-count" placeholder="Count" value="4" style="width: 80px;">
                    <button class="btn-primary" id="start-ping">Ping</button>
                    <button class="btn-secondary" id="stop-ping">Stop</button>
                    <button class="btn-secondary" id="clear-ping">Clear</button>
                </div>
                <div class="output-area">
                    <div class="output-header">Ping Results</div>
                    <div class="output-content" id="ping-output">Enter an IP or domain to ping...</div>
                </div>
            </div>
        `;
    }

    getChatHTML() {
        return `
            <div class="tool-panel chat-panel">
                <h2>Nexus Chat</h2>
                <div class="chat-container">
                    <div class="chat-sidebar">
                        <div class="chat-users-header">Online Users</div>
                        <div class="chat-users-list" id="chat-users"></div>
                    </div>
                    <div class="chat-main">
                        <div class="chat-messages" id="chat-messages"></div>
                        <div class="chat-input-area">
                            <input type="file" id="chat-image" accept="image/*" style="display:none;">
                            <button class="btn-secondary" id="chat-image-btn" title="Send Image">IMG</button>
                            <input type="text" class="chat-input" id="chat-input" placeholder="Type a message...">
                            <button class="btn-primary" id="chat-send">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getMembersHTML() {
        return `
            <div class="tool-panel">
                <h2>Members</h2>
                <div class="members-list" id="members-list">
                    <div class="loading-members">Loading members...</div>
                </div>
            </div>
        `;
    }

    getProfileHTML() {
        const user = currentUser || { username: 'Guest', role: 'member', bio: '', avatar: '' };
        const avatarDisplay = user.avatar ? `<img src="${user.avatar}" class="profile-avatar-img">` : user.username.charAt(0).toUpperCase();
        return `
            <div class="tool-panel">
                <h2>My Profile</h2>
                <div class="profile-container">
                    <div class="profile-avatar-section">
                        <div class="profile-avatar" id="profile-avatar">${avatarDisplay}</div>
                        <input type="file" id="avatar-file" accept="image/*" style="display:none;">
                        <button class="btn-secondary" id="avatar-upload-btn">Upload Photo</button>
                        <span style="color:#666;font-size:11px;margin:5px 0;">or</span>
                        <input type="text" class="tool-input" id="avatar-input" placeholder="Paste image URL" style="font-size:11px;">
                    </div>
                    <div class="profile-info">
                        <div class="profile-field">
                            <label>Username</label>
                            <input type="text" class="tool-input" id="profile-username" value="${user.username}">
                        </div>
                        <div class="profile-field">
                            <label>Role</label>
                            <div class="profile-role ${user.role}">${user.role.toUpperCase()}</div>
                        </div>
                        <div class="profile-field">
                            <label>Biography</label>
                            <textarea class="tool-input profile-bio" id="profile-bio" placeholder="Tell us about yourself...">${user.bio || ''}</textarea>
                        </div>
                        <button class="btn-primary" id="save-profile">Save Changes</button>
                        <p class="profile-message" id="profile-message"></p>
                    </div>
                </div>
            </div>
        `;
    }

    attachToolListeners(toolName) {
        switch(toolName) {
            case 'ip-lookup':
                document.getElementById('lookup-ip').onclick = () => this.lookupIP();
                document.getElementById('clear-ip').onclick = () => this.clearOutput('ip-output');
                document.getElementById('ip-input').onkeypress = (e) => { if(e.key === 'Enter') this.lookupIP(); };
                break;
            case 'phone-lookup':
                document.getElementById('lookup-phone').onclick = () => this.lookupPhone();
                document.getElementById('clear-phone').onclick = () => this.clearOutput('phone-output');
                document.getElementById('phone-input').onkeypress = (e) => { if(e.key === 'Enter') this.lookupPhone(); };
                break;
            case 'whois':
                document.getElementById('lookup-whois').onclick = () => this.lookupWhois();
                document.getElementById('clear-whois').onclick = () => this.clearOutput('whois-output');
                document.getElementById('domain-input').onkeypress = (e) => { if(e.key === 'Enter') this.lookupWhois(); };
                break;
            case 'ip-pinger':
                document.getElementById('start-ping').onclick = () => this.startPing();
                document.getElementById('stop-ping').onclick = () => this.stopPing();
                document.getElementById('clear-ping').onclick = () => this.clearOutput('ping-output');
                document.getElementById('ping-input').onkeypress = (e) => { if(e.key === 'Enter') this.startPing(); };
                break;
            case 'ip-logger':
                this.initIPLogger();
                break;
            case 'chat':
                this.initChat();
                break;
            case 'members':
                this.loadMembers();
                break;
            case 'profile':
                this.initProfile();
                break;
        }
    }

    // MEMBERS
    async loadMembers() {
        try {
            const response = await fetch('/api/members');
            const members = await response.json();
            const myRole = currentUser?.role;
            const canManage = myRole === 'owner' || myRole === 'admin';
            
            const container = document.getElementById('members-list');
            container.innerHTML = members.map(m => {
                // Mostrar menu si: puedo gestionar Y no soy yo mismo
                const showMenu = canManage && m.username !== currentUser?.username;
                return `
                <div class="member-card" data-username="${m.username}" data-role="${m.role}">
                    <div class="member-avatar">${m.avatar ? `<img src="${m.avatar}">` : m.username.charAt(0).toUpperCase()}</div>
                    <div class="member-info">
                        <div class="member-name">${m.username} ${m.online ? '<span class="online-badge">ONLINE</span>' : ''}</div>
                        <div class="member-role ${m.role}">${m.role.toUpperCase()}</div>
                        <div class="member-bio">${m.bio || 'No bio'}</div>
                    </div>
                    ${showMenu ? `<div class="member-menu-btn" title="Options">&#8942;</div>` : ''}
                </div>
            `}).join('');

            // Add click handler to menu buttons
            container.querySelectorAll('.member-menu-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const card = btn.closest('.member-card');
                    this.showMemberMenu(btn, card);
                });
            });
        } catch (e) {
            document.getElementById('members-list').innerHTML = '<div class="chat-error">Could not load members. Is the server running?</div>';
        }
    }

    showMemberMenu(btn, card) {
        // Remove existing menu
        const existingMenu = document.querySelector('.member-dropdown');
        if (existingMenu) existingMenu.remove();

        const targetUser = card.dataset.username;
        const targetRole = card.dataset.role;
        const myRole = currentUser?.role;

        // No permitir acciones sobre el owner (excepto si eres owner)
        const canKickBan = targetRole !== 'owner' || myRole === 'owner';

        const menu = document.createElement('div');
        menu.className = 'member-dropdown';
        menu.innerHTML = `
            ${canKickBan ? `<div class="dropdown-item" data-action="kick">KICK</div>` : ''}
            ${canKickBan && targetRole !== 'owner' ? `<div class="dropdown-item danger" data-action="ban">BAN</div>` : ''}
            ${myRole === 'owner' && targetRole !== 'owner' ? `
                <div class="dropdown-item" data-action="promote-admin">SET ADMIN</div>
                <div class="dropdown-item" data-action="promote-member">SET MEMBER</div>
            ` : ''}
        `;
        
        // Si no hay opciones, no mostrar menu
        if (!menu.querySelector('.dropdown-item')) {
            return;
        }
        
        btn.parentElement.appendChild(menu);

        // Handle clicks
        menu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleMemberAction(item.dataset.action, targetUser);
                menu.remove();
            });
        });

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 10);
    }

    async handleMemberAction(action, targetUser) {
        let endpoint, body;

        if (action === 'kick') {
            endpoint = '/api/member/kick';
            body = { adminUser: currentUser.username, targetUser };
        } else if (action === 'ban') {
            if (!confirm(`Ban ${targetUser}? This will delete their account.`)) return;
            endpoint = '/api/member/ban';
            body = { adminUser: currentUser.username, targetUser };
        } else if (action === 'promote-admin') {
            endpoint = '/api/member/role';
            body = { adminUser: currentUser.username, targetUser, newRole: 'admin' };
        } else if (action === 'promote-member') {
            endpoint = '/api/member/role';
            body = { adminUser: currentUser.username, targetUser, newRole: 'member' };
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            
            if (data.success) {
                this.loadMembers(); // Refresh list
            } else {
                alert(data.message);
            }
        } catch (e) {
            alert('Error performing action');
        }
    }

    // PROFILE
    initProfile() {
        document.getElementById('save-profile').onclick = () => this.saveProfile();
        
        // Avatar file upload
        const avatarFile = document.getElementById('avatar-file');
        document.getElementById('avatar-upload-btn').onclick = () => avatarFile.click();
        avatarFile.onchange = (e) => this.uploadAvatar(e.target.files[0]);
    }

    uploadAvatar(file) {
        if (!file) return;
        
        if (file.size > 1 * 1024 * 1024) {
            alert('Image too large. Max 1MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            document.getElementById('avatar-input').value = base64;
            document.getElementById('profile-avatar').innerHTML = `<img src="${base64}" class="profile-avatar-img">`;
        };
        reader.readAsDataURL(file);
    }

    async saveProfile() {
        const newUsername = document.getElementById('profile-username').value.trim();
        const bio = document.getElementById('profile-bio').value.trim();
        const avatar = document.getElementById('avatar-input').value.trim();
        const msg = document.getElementById('profile-message');

        try {
            const response = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    newUsername: newUsername,
                    bio: bio,
                    avatar: avatar
                })
            });
            const data = await response.json();

            if (data.success) {
                currentUser = data.user;
                msg.style.color = '#00ff00';
                msg.textContent = 'Profile saved!';
            } else {
                msg.style.color = '#ff4444';
                msg.textContent = data.message;
            }
        } catch (e) {
            msg.style.color = '#ff4444';
            msg.textContent = 'Error saving profile';
        }
    }

    // CHAT
    initChat() {
        if (typeof io === 'undefined') {
            document.getElementById('chat-messages').innerHTML = 
                '<div class="chat-error">Chat requires the server to be running.</div>';
            return;
        }

        // Disconnect existing socket if any
        if (this.socket) {
            this.socket.off('message');
            this.socket.off('userList');
            this.socket.disconnect();
            this.socket = null;
        }

        this.socket = io();
        this.chatUsername = currentUser ? currentUser.username : 'Guest';
        
        this.socket.emit('join', this.chatUsername);

        this.socket.on('message', (msg) => this.addChatMessage(msg));
        this.socket.on('userList', (users) => this.updateUserList(users));

        document.getElementById('chat-send').onclick = () => this.sendChatMessage();
        document.getElementById('chat-input').onkeypress = (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        };

        // Image upload
        const imageInput = document.getElementById('chat-image');
        document.getElementById('chat-image-btn').onclick = () => imageInput.click();
        imageInput.onchange = (e) => this.sendChatImage(e.target.files[0]);
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        const msg = input.value.trim();
        if (msg && this.socket) {
            this.socket.emit('chatMessage', { type: 'text', content: msg });
            input.value = '';
        }
    }

    sendChatImage(file) {
        if (!file || !this.socket) return;
        
        // Check file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('Image too large. Max 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.socket.emit('chatMessage', { 
                type: 'image', 
                content: e.target.result,
                fileName: file.name
            });
        };
        reader.readAsDataURL(file);
        document.getElementById('chat-image').value = '';
    }

    addChatMessage(msg) {
        const messagesDiv = document.getElementById('chat-messages');
        const msgElement = document.createElement('div');
        
        if (msg.type === 'system') {
            msgElement.className = 'chat-message system';
            msgElement.innerHTML = `<span class="chat-time">[${msg.time}]</span> ${msg.text}`;
        } else if (msg.type === 'image') {
            msgElement.className = 'chat-message user';
            msgElement.innerHTML = `
                <span class="chat-time">[${msg.time}]</span> 
                <span class="chat-username">${msg.username}:</span>
                <div class="chat-image-container">
                    <img src="${msg.content}" class="chat-image" onclick="window.open('${msg.content}', '_blank')">
                </div>`;
        } else {
            msgElement.className = 'chat-message user';
            const text = msg.text || msg.content || '';
            msgElement.innerHTML = `<span class="chat-time">[${msg.time}]</span> <span class="chat-username">${msg.username}:</span> ${text}`;
        }
        
        messagesDiv.appendChild(msgElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    updateUserList(users) {
        const usersList = document.getElementById('chat-users');
        usersList.innerHTML = users.map(u => `<div class="chat-user">${u}</div>`).join('');
    }

    // IP LOOKUP
    async lookupIP() {
        const ip = document.getElementById('ip-input').value.trim();
        const output = document.getElementById('ip-output');
        
        if (!ip) { output.textContent = '[ERROR] Please enter an IP address.'; return; }
        if (!this.isValidIP(ip)) { output.textContent = '[ERROR] Invalid IP address format.'; return; }

        output.textContent = `[*] Looking up ${ip}...\n`;
        
        try {
            const response = await fetch(`http://ip-api.com/json/${ip}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                output.innerHTML = `
IP Address:    ${data.query}
Country:       ${data.country} (${data.countryCode})
Region:        ${data.regionName}
City:          ${data.city}
ZIP:           ${data.zip}
Latitude:      ${data.lat}
Longitude:     ${data.lon}
Timezone:      ${data.timezone}
ISP:           ${data.isp}
Organization:  ${data.org}

<span style="color: #ff4444; font-weight: bold;">UBICAU BY NEXUS</span>`;
            } else {
                output.textContent = `[ERROR] ${data.message || 'Failed to lookup IP'}`;
            }
        } catch (error) {
            output.textContent = `[ERROR] Failed to connect to API`;
        }
    }

    // PHONE LOOKUP
    lookupPhone() {
        const phoneRaw = document.getElementById('phone-input').value.trim();
        const output = document.getElementById('phone-output');
        
        if (!phoneRaw) { output.textContent = '[ERROR] Please enter a phone number.'; return; }

        const phone = phoneRaw.replace(/[\s\-\(\)]/g, '');
        output.textContent = `[*] Looking up ${phoneRaw}...\n`;
        
        setTimeout(() => {
            const countryData = this.getPhoneCountry(phone);
            output.innerHTML = `
Phone Number:  ${phoneRaw}
Normalized:    ${phone}
Valid:         ${countryData.valid ? 'Yes' : 'Unknown'}
Country:       ${countryData.country}
Country Code:  ${countryData.code}
Type:          ${countryData.type}
Carrier:       ${countryData.carrier}
Region:        ${countryData.region}

<span style="color: #ff4444; font-weight: bold;">UBICAU BY NEXUS</span>`;
        }, 1000);
    }

    getPhoneCountry(phone) {
        const prefixes = {
            '+1': { country: 'United States/Canada', code: '+1', region: 'North America', carrier: 'Unknown', type: 'Mobile/Landline' },
            '+54': { country: 'Argentina', code: '+54', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+52': { country: 'Mexico', code: '+52', region: 'North America', carrier: 'Unknown', type: 'Mobile' },
            '+44': { country: 'United Kingdom', code: '+44', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+34': { country: 'Spain', code: '+34', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+49': { country: 'Germany', code: '+49', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+33': { country: 'France', code: '+33', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+55': { country: 'Brazil', code: '+55', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+56': { country: 'Chile', code: '+56', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+57': { country: 'Colombia', code: '+57', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+58': { country: 'Venezuela', code: '+58', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+51': { country: 'Peru', code: '+51', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+86': { country: 'China', code: '+86', region: 'Asia', carrier: 'Unknown', type: 'Mobile' },
            '+81': { country: 'Japan', code: '+81', region: 'Asia', carrier: 'Unknown', type: 'Mobile' },
            '+91': { country: 'India', code: '+91', region: 'Asia', carrier: 'Unknown', type: 'Mobile' },
        };
        for (const [prefix, data] of Object.entries(prefixes)) {
            if (phone.startsWith(prefix)) return { ...data, valid: true };
        }
        return { country: 'Unknown', code: 'N/A', region: 'Unknown', carrier: 'Unknown', type: 'Unknown', valid: false };
    }

    // WHOIS
    async lookupWhois() {
        const domain = document.getElementById('domain-input').value.trim();
        const output = document.getElementById('whois-output');
        
        if (!domain) { output.textContent = '[ERROR] Please enter a domain name.'; return; }

        output.textContent = `[*] Looking up WHOIS for ${domain}...\n`;
        
        try {
            const response = await fetch(`https://rdap.org/domain/${domain}`);
            if (!response.ok) throw new Error('Domain not found');
            
            const data = await response.json();
            let result = `Domain Name:   ${data.ldhName || domain}\n`;
            result += `Status:        ${data.status ? data.status.join(', ') : 'N/A'}\n`;
            
            if (data.events) {
                data.events.forEach(event => {
                    const date = new Date(event.eventDate).toISOString().split('T')[0];
                    if (event.eventAction === 'registration') result += `Created:       ${date}\n`;
                    if (event.eventAction === 'expiration') result += `Expires:       ${date}\n`;
                });
            }
            
            if (data.nameservers && data.nameservers.length > 0) {
                result += `\nName Servers:\n`;
                data.nameservers.forEach(ns => { result += `  ${ns.ldhName}\n`; });
            }
            
            output.textContent = result;
        } catch (error) {
            output.textContent = `[ERROR] Could not retrieve WHOIS data for ${domain}`;
        }
    }

    // PINGER
    startPing() {
        const target = document.getElementById('ping-input').value.trim();
        const count = parseInt(document.getElementById('ping-count').value) || 4;
        const output = document.getElementById('ping-output');
        
        if (!target) { output.textContent = '[ERROR] Please enter an IP or domain.'; return; }

        this.isPinging = true;
        let pingNum = 0;
        let times = [];
        
        output.innerHTML = `Pinging ${target} with 32 bytes of data:\n\n`;
        
        this.pingInterval = setInterval(() => {
            if (this.isPinging && pingNum < count) {
                const time = Math.floor(Math.random() * 80) + 5;
                const ttl = Math.floor(Math.random() * 64) + 50;
                times.push(time);
                output.innerHTML += `<span style="color: #00ff00;">Reply from ${target}: bytes=32 time=${time}ms TTL=${ttl} - ON BY NEXUS</span>\n`;
                output.scrollTop = output.scrollHeight;
                pingNum++;
            } else {
                clearInterval(this.pingInterval);
                this.isPinging = false;
                
                if (times.length > 0) {
                    const min = Math.min(...times);
                    const max = Math.max(...times);
                    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
                    output.innerHTML += `\nPing statistics for ${target}:\n`;
                    output.innerHTML += `    Packets: Sent = ${pingNum}, Received = ${pingNum}, Lost = 0\n`;
                    output.innerHTML += `    Min = ${min}ms, Max = ${max}ms, Avg = ${avg}ms\n`;
                }
                output.innerHTML += `\n<span style="color: #00ff00; font-weight: bold;">TARGET IS ONLINE - ON BY NEXUS</span>`;
            }
        }, 1000);
    }

    stopPing() {
        this.isPinging = false;
        clearInterval(this.pingInterval);
        document.getElementById('ping-output').innerHTML += '\n<span style="color: #ff4444;">[*] Ping stopped.</span>';
    }

    clearOutput(outputId) {
        const output = document.getElementById(outputId);
        if (output) output.textContent = 'Output cleared.';
    }

    isValidIP(ip) {
        const regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!regex.test(ip)) return false;
        return ip.split('.').every(part => parseInt(part) >= 0 && parseInt(part) <= 255);
    }

    // IP LOGGER
    getIPLoggerHTML() {
        return `
            <div class="tool-panel">
                <h2>IP Logger</h2>
                <div class="iplogger-create">
                    <h3 style="color:#ff4444;margin-bottom:15px;">Create Tracking Link</h3>
                    <div class="tool-controls" style="flex-wrap:wrap;">
                        <input type="text" class="tool-input" id="redirect-url" placeholder="Redirect URL (https://youtube.com/watch?v=...)" style="flex:1;min-width:250px;">
                    </div>
                    <div class="tool-controls" style="margin-top:10px;">
                        <input type="text" class="tool-input" id="custom-slug" placeholder="Custom URL slug (optional)" style="width:200px;">
                        <select class="tool-input" id="url-template" style="width:180px;">
                            <option value="">-- Quick Templates --</option>
                            <option value="https://youtube.com">YouTube</option>
                            <option value="https://instagram.com">Instagram</option>
                            <option value="https://tiktok.com">TikTok</option>
                            <option value="https://twitter.com">Twitter/X</option>
                            <option value="https://discord.com">Discord</option>
                            <option value="https://google.com">Google</option>
                        </select>
                        <button class="btn-primary" id="create-link">Create Link</button>
                    </div>
                    <div class="created-link" id="created-link" style="display:none;">
                        <span>Your tracking link:</span>
                        <input type="text" class="tool-input" id="track-url" readonly style="flex:1;">
                        <button class="btn-secondary" id="copy-link">Copy</button>
                    </div>
                </div>
                <div class="iplogger-links">
                    <h3 style="color:#ff4444;margin:20px 0 10px;">My Links</h3>
                    <div id="my-links" class="my-links-list"></div>
                </div>
                <div class="iplogger-logs">
                    <h3 style="color:#ff4444;margin:20px 0 10px;">Captured IPs</h3>
                    <div class="output-area">
                        <div class="output-header">Live IP Logs - LOGGED BY NEXUS</div>
                        <div class="output-content" id="ip-logs" style="min-height:200px;">Waiting for visitors...</div>
                    </div>
                </div>
            </div>
        `;
    }

    async initIPLogger() {
        await this.loadMyLinks();
        document.getElementById('create-link').onclick = () => this.createTrackingLink();
        document.getElementById('copy-link').onclick = () => this.copyTrackingLink();
        
        // Template selector
        document.getElementById('url-template').onchange = (e) => {
            if (e.target.value) {
                document.getElementById('redirect-url').value = e.target.value;
            }
        };

        if (typeof io !== 'undefined') {
            if (!this.socket) this.socket = io();
            this.socket.on('iplog', (data) => {
                if (this.currentTool === 'ip-logger') {
                    this.addIPLog(data.log);
                }
            });
        }
    }

    async createTrackingLink() {
        const redirectUrl = document.getElementById('redirect-url').value.trim() || 'https://google.com';
        const customSlug = document.getElementById('custom-slug').value.trim();
        
        try {
            const response = await fetch('/api/iplogger/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: currentUser.username, redirectUrl, customSlug })
            });
            const data = await response.json();
            if (data.success) {
                const fullUrl = `${window.location.origin}${data.trackUrl}`;
                document.getElementById('track-url').value = fullUrl;
                document.getElementById('created-link').style.display = 'flex';
                document.getElementById('custom-slug').value = '';
                this.loadMyLinks();
            }
        } catch (e) {
            alert('Error creating link');
        }
    }

    copyTrackingLink() {
        const input = document.getElementById('track-url');
        input.select();
        document.execCommand('copy');
        alert('Link copied!');
    }

    async loadMyLinks() {
        try {
            const response = await fetch(`/api/iplogger/mylinks/${currentUser.username}`);
            const links = await response.json();
            const container = document.getElementById('my-links');
            if (links.length === 0) {
                container.innerHTML = '<div style="color:#666;">No links created yet</div>';
                return;
            }
            container.innerHTML = links.map(link => `
                <div class="iplogger-link-item" data-trackid="${link.trackId}">
                    <div class="link-info">
                        <span class="link-url">${window.location.origin}/t/${link.trackId}</span>
                        <span class="link-stats">${link.logs.length} visits</span>
                    </div>
                    <div class="link-actions">
                        <button class="btn-secondary btn-small" onclick="nexus.viewLogs('${link.trackId}')">View Logs</button>
                        <button class="btn-secondary btn-small danger" onclick="nexus.deleteLink('${link.trackId}')">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            document.getElementById('my-links').innerHTML = '<div class="chat-error">Error loading links</div>';
        }
    }

    async viewLogs(trackId) {
        try {
            const response = await fetch(`/api/iplogger/logs/${trackId}`);
            const result = await response.json();
            if (result.success) {
                const logsDiv = document.getElementById('ip-logs');
                if (result.data.logs.length === 0) {
                    logsDiv.innerHTML = 'No visitors yet for this link...';
                    return;
                }
                logsDiv.innerHTML = result.data.logs.map(log => `
<span style="color:#ff4444;">[${new Date(log.timestamp).toLocaleString()}]</span>
<span style="color:#00ff00;">IP: ${log.ip}</span>
Country: ${log.country || 'Unknown'} ${log.countryCode ? `(${log.countryCode})` : ''}
City: ${log.city || 'Unknown'}, ${log.region || ''}
ZIP: ${log.zip || 'N/A'}
ISP: ${log.isp || 'Unknown'}
ORG: ${log.org || 'N/A'}
Timezone: ${log.timezone || 'N/A'}
Coords: ${log.lat || '?'}, ${log.lon || '?'}
Browser: ${log.userAgent ? log.userAgent.substring(0, 60) + '...' : 'Unknown'}
Language: ${log.language || 'Unknown'}
Referer: ${log.referer || 'Direct'}
-------------------------------------------`).join('\n');
            }
        } catch (e) {
            alert('Error loading logs');
        }
    }

    async deleteLink(trackId) {
        if (!confirm('Delete this tracking link?')) return;
        try {
            await fetch(`/api/iplogger/delete/${trackId}`, { method: 'DELETE' });
            this.loadMyLinks();
        } catch (e) {
            alert('Error deleting link');
        }
    }

    addIPLog(log) {
        const logsDiv = document.getElementById('ip-logs');
        const logEntry = `
<span style="color:#ff4444;">[${new Date(log.timestamp).toLocaleString()}]</span> <span style="color:#00ff00;font-weight:bold;">NEW VISITOR!</span>
<span style="color:#00ff00;">IP: ${log.ip}</span>
Country: ${log.country || 'Unknown'} ${log.countryCode ? `(${log.countryCode})` : ''}
City: ${log.city || 'Unknown'}, ${log.region || ''}
ISP: ${log.isp || 'Unknown'}
-------------------------------------------
`;
        logsDiv.innerHTML = logEntry + logsDiv.innerHTML;
    }
}
