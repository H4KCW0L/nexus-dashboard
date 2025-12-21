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
        this.pingSessionId = null;
        this.socket = null;
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
        // Stop pinger
        if (this.isPinging && this.pingSessionId) {
            fetch('/api/ping/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.pingSessionId })
            });
            this.isPinging = false;
        }
        
        // Disconnect chat socket when leaving chat
        if (this.socket && this.currentTool === 'chat') {
            this.socket.off('message');
            this.socket.off('userList');
            this.socket.off('pinnedMessage');
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
            'port-scanner': this.getPortScannerHTML(),
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
                    <button class="btn-primary" id="start-ping">Start Ping</button>
                    <button class="btn-secondary" id="stop-ping">Stop</button>
                    <button class="btn-secondary" id="clear-ping">Clear</button>
                </div>
                <div class="ping-status" id="ping-status">
                    <div class="ping-indicator offline" id="ping-indicator"></div>
                    <span id="ping-status-text">Not pinging</span>
                </div>
                <div class="output-area">
                    <div class="output-header">Ping Results (Infinite Mode)</div>
                    <div class="output-content" id="ping-output">Enter an IP or domain to start pinging...</div>
                </div>
                <div class="ping-stats" id="ping-stats" style="display:none;">
                    <div class="stat-item"><span>Sent:</span><span id="stat-sent">0</span></div>
                    <div class="stat-item"><span>Received:</span><span id="stat-recv">0</span></div>
                    <div class="stat-item"><span>Lost:</span><span id="stat-lost">0</span></div>
                    <div class="stat-item"><span>Avg:</span><span id="stat-avg">0ms</span></div>
                </div>
            </div>
        `;
    }

    getPortScannerHTML() {
        return `
            <div class="tool-panel">
                <h2>Port Scanner</h2>
                <div class="tool-controls">
                    <input type="text" class="tool-input" id="scan-target" placeholder="Enter IP or domain">
                    <button class="btn-primary" id="start-scan">Scan</button>
                    <button class="btn-secondary" id="clear-scan">Clear</button>
                </div>
                <div class="scan-progress" id="scan-progress" style="display:none;">
                    <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
                    <span id="progress-text">Scanning...</span>
                </div>
                <div class="output-area">
                    <div class="output-header">Scan Results</div>
                    <div class="output-content" id="scan-output">Enter a target to scan...</div>
                </div>
            </div>
        `;
    }

    getChatHTML() {
        const isAdmin = currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin');
        return `
            <div class="tool-panel chat-panel">
                <h2>Nexus Chat</h2>
                <div class="chat-container">
                    <div class="chat-sidebar">
                        <div class="chat-users-header">Online Users</div>
                        <div class="chat-users-list" id="chat-users"></div>
                    </div>
                    <div class="chat-main">
                        <div class="chat-pinned" id="chat-pinned" style="display:none;">
                            <div class="pinned-icon">PIN</div>
                            <div class="pinned-content" id="pinned-content"></div>
                            ${isAdmin ? '<button class="pinned-close" id="unpin-btn">X</button>' : ''}
                        </div>
                        <div class="chat-messages" id="chat-messages"></div>
                        <div class="chat-input-area">
                            <input type="file" id="chat-image" accept="image/*" style="display:none;">
                            <button class="btn-icon" id="chat-image-btn" title="Send Image">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21 15 16 10 5 21"></polyline>
                                </svg>
                            </button>
                            <button class="btn-icon" id="emoji-btn" title="Emojis">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                                </svg>
                            </button>
                            <div class="emoji-picker" id="emoji-picker" style="display:none;"></div>
                            <input type="text" class="chat-input" id="chat-input" placeholder="Type a message...">
                            <button class="btn-primary" id="chat-send">Send</button>
                            ${isAdmin ? '<button class="btn-secondary" id="pin-msg-btn" title="Pin Message">PIN</button>' : ''}
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
                this.initPinger();
                break;
            case 'port-scanner':
                this.initPortScanner();
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
            <div class="dropdown-item" data-action="credentials">VIEW CREDENTIALS</div>
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

        if (action === 'credentials') {
            // Show credentials in a popup
            try {
                const response = await fetch('/api/member/credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminUser: currentUser.username, targetUser })
                });
                const data = await response.json();
                
                if (data.success) {
                    this.showCredentialsPopup(data);
                } else {
                    alert(data.message);
                }
            } catch (e) {
                alert('Error getting credentials');
            }
            return;
        }

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

    showCredentialsPopup(data) {
        // Remove existing popup
        const existing = document.querySelector('.credentials-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.className = 'credentials-popup';
        popup.innerHTML = `
            <div class="credentials-box">
                <h3>ACCOUNT RECOVERY</h3>
                <div class="credentials-info">
                    <div class="cred-field">
                        <label>Username:</label>
                        <span>${data.username}</span>
                    </div>
                    <div class="cred-field">
                        <label>Password:</label>
                        <span>${data.password}</span>
                    </div>
                    <div class="cred-field">
                        <label>Role:</label>
                        <span class="role-badge ${data.role}">${data.role.toUpperCase()}</span>
                    </div>
                </div>
                <button class="btn-primary" id="close-creds">CLOSE</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        document.getElementById('close-creds').onclick = () => popup.remove();
        popup.onclick = (e) => { if (e.target === popup) popup.remove(); };
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
            this.socket.off('pinnedMessage');
            this.socket.disconnect();
            this.socket = null;
        }

        this.socket = io();
        this.chatUsername = currentUser ? currentUser.username : 'Guest';
        
        this.socket.emit('join', this.chatUsername);

        this.socket.on('message', (msg) => this.addChatMessage(msg));
        this.socket.on('userList', (users) => this.updateUserList(users));
        this.socket.on('pinnedMessage', (pinned) => this.updatePinnedMessage(pinned));

        document.getElementById('chat-send').onclick = () => this.sendChatMessage();
        document.getElementById('chat-input').onkeypress = (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        };

        // Image upload
        const imageInput = document.getElementById('chat-image');
        document.getElementById('chat-image-btn').onclick = () => imageInput.click();
        imageInput.onchange = (e) => this.sendChatImage(e.target.files[0]);

        // Emoji picker
        this.initEmojiPicker();

        // Pin message (admin only)
        const pinBtn = document.getElementById('pin-msg-btn');
        if (pinBtn) {
            pinBtn.onclick = () => this.showPinDialog();
        }

        // Unpin button
        const unpinBtn = document.getElementById('unpin-btn');
        if (unpinBtn) {
            unpinBtn.onclick = () => this.unpinMessage();
        }

        // Load current pinned message
        this.loadPinnedMessage();
    }

    initEmojiPicker() {
        const emojiBtn = document.getElementById('emoji-btn');
        const emojiPicker = document.getElementById('emoji-picker');
        
        const emojis = [
            '😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '🤯', '🥳',
            '👍', '👎', '👏', '🙌', '🤝', '💪', '🔥', '💯', '❤️', '💔',
            '⭐', '✨', '🎉', '🎊', '🏆', '💰', '💎', '🚀', '💻', '🎮',
            '☠️', '💀', '👻', '🤖', '👽', '🔒', '🔓', '⚠️', '🚫', '✅'
        ];
        
        emojiPicker.innerHTML = emojis.map(e => `<span class="emoji-item">${e}</span>`).join('');
        
        emojiBtn.onclick = (e) => {
            e.stopPropagation();
            emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'grid' : 'none';
        };
        
        emojiPicker.querySelectorAll('.emoji-item').forEach(item => {
            item.onclick = () => {
                const input = document.getElementById('chat-input');
                input.value += item.textContent;
                input.focus();
                emojiPicker.style.display = 'none';
            };
        });
        
        document.addEventListener('click', () => {
            emojiPicker.style.display = 'none';
        });
    }

    async loadPinnedMessage() {
        try {
            const response = await fetch('/api/chat/pinned');
            const pinned = await response.json();
            this.updatePinnedMessage(pinned);
        } catch (e) {}
    }

    updatePinnedMessage(pinned) {
        const pinnedDiv = document.getElementById('chat-pinned');
        const pinnedContent = document.getElementById('pinned-content');
        
        if (pinned && pinned.text) {
            pinnedContent.textContent = pinned.text;
            pinnedDiv.style.display = 'flex';
        } else {
            pinnedDiv.style.display = 'none';
        }
    }

    showPinDialog() {
        const existing = document.querySelector('.pin-dialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.className = 'pin-dialog';
        dialog.innerHTML = `
            <div class="pin-dialog-box">
                <h3>PIN MESSAGE</h3>
                <textarea id="pin-message-text" placeholder="Enter message to pin..." rows="3"></textarea>
                <div class="pin-duration">
                    <label>Duration:</label>
                    <select id="pin-duration">
                        <option value="5">5 minutes</option>
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="1440">24 hours</option>
                        <option value="0">Permanent</option>
                    </select>
                </div>
                <div class="pin-buttons">
                    <button class="btn-primary" id="confirm-pin">Pin</button>
                    <button class="btn-secondary" id="cancel-pin">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        document.getElementById('confirm-pin').onclick = () => this.pinMessage(dialog);
        document.getElementById('cancel-pin').onclick = () => dialog.remove();
        dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
    }

    async pinMessage(dialog) {
        const message = document.getElementById('pin-message-text').value.trim();
        const duration = parseInt(document.getElementById('pin-duration').value);
        
        if (!message) {
            alert('Please enter a message');
            return;
        }

        try {
            const response = await fetch('/api/chat/pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    message,
                    duration
                })
            });
            const data = await response.json();
            
            if (data.success) {
                dialog.remove();
            } else {
                alert(data.message);
            }
        } catch (e) {
            alert('Error pinning message');
        }
    }

    async unpinMessage() {
        try {
            await fetch('/api/chat/unpin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username })
            });
        } catch (e) {}
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
    initPinger() {
        document.getElementById('start-ping').onclick = () => this.startRealPing();
        document.getElementById('stop-ping').onclick = () => this.stopRealPing();
        document.getElementById('clear-ping').onclick = () => {
            document.getElementById('ping-output').textContent = 'Enter an IP or domain to start pinging...';
            document.getElementById('ping-stats').style.display = 'none';
        };
        document.getElementById('ping-input').onkeypress = (e) => { 
            if(e.key === 'Enter') this.startRealPing(); 
        };
    }

    async startRealPing() {
        const target = document.getElementById('ping-input').value.trim();
        const output = document.getElementById('ping-output');
        const indicator = document.getElementById('ping-indicator');
        const statusText = document.getElementById('ping-status-text');
        const statsDiv = document.getElementById('ping-stats');
        
        if (!target) { 
            output.textContent = '[ERROR] Please enter an IP or domain.'; 
            return; 
        }

        if (this.isPinging) {
            await this.stopRealPing();
        }

        this.pingSessionId = 'ping_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.isPinging = true;
        this.pingStats = { sent: 0, recv: 0, lost: 0, times: [] };
        
        output.innerHTML = `Pinging ${target} (infinite mode)...\n\n`;
        statsDiv.style.display = 'flex';
        statusText.textContent = 'Connecting...';

        // Connect socket for ping results
        if (!this.socket) {
            this.socket = io();
        }
        
        this.socket.emit('joinPingSession', this.pingSessionId);
        
        this.socket.on('pingResult', (result) => {
            if (!this.isPinging) return;
            
            this.pingStats.sent++;
            
            if (result.online) {
                this.pingStats.recv++;
                this.pingStats.times.push(result.time);
                indicator.className = 'ping-indicator online';
                statusText.textContent = `${target} is ONLINE`;
                output.innerHTML += `<span class="ping-online">Reply from ${target}: time=${result.time}ms TTL=${result.ttl || '?'}</span>\n`;
            } else {
                this.pingStats.lost++;
                indicator.className = 'ping-indicator offline';
                statusText.textContent = `${target} is OFFLINE`;
                output.innerHTML += `<span class="ping-offline">Request timed out.</span>\n`;
            }
            
            // Update stats
            document.getElementById('stat-sent').textContent = this.pingStats.sent;
            document.getElementById('stat-recv').textContent = this.pingStats.recv;
            document.getElementById('stat-lost').textContent = this.pingStats.lost;
            if (this.pingStats.times.length > 0) {
                const avg = Math.round(this.pingStats.times.reduce((a,b) => a+b, 0) / this.pingStats.times.length);
                document.getElementById('stat-avg').textContent = avg + 'ms';
            }
            
            output.scrollTop = output.scrollHeight;
        });

        // Start ping on server
        try {
            await fetch('/api/ping/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target, sessionId: this.pingSessionId })
            });
        } catch (e) {
            output.textContent = '[ERROR] Could not start ping. Is the server running?';
            this.isPinging = false;
        }
    }

    async stopRealPing() {
        if (!this.isPinging) return;
        
        this.isPinging = false;
        document.getElementById('ping-indicator').className = 'ping-indicator offline';
        document.getElementById('ping-status-text').textContent = 'Stopped';
        document.getElementById('ping-output').innerHTML += '\n<span class="ping-stopped">[Ping stopped]</span>';
        
        if (this.pingSessionId) {
            if (this.socket) {
                this.socket.off('pingResult');
                this.socket.emit('leavePingSession', this.pingSessionId);
            }
            
            await fetch('/api/ping/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.pingSessionId })
            });
            this.pingSessionId = null;
        }
    }

    // PORT SCANNER
    initPortScanner() {
        document.getElementById('start-scan').onclick = () => this.startPortScan();
        document.getElementById('clear-scan').onclick = () => {
            document.getElementById('scan-output').textContent = 'Enter a target to scan...';
            document.getElementById('scan-progress').style.display = 'none';
        };
        document.getElementById('scan-target').onkeypress = (e) => {
            if(e.key === 'Enter') this.startPortScan();
        };
    }

    async startPortScan() {
        const target = document.getElementById('scan-target').value.trim();
        const output = document.getElementById('scan-output');
        const progressDiv = document.getElementById('scan-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (!target) {
            output.textContent = '[ERROR] Please enter a target IP or domain.';
            return;
        }

        // Common ports to scan
        const ports = [21, 22, 23, 25, 53, 80, 110, 119, 123, 143, 161, 194, 443, 445, 465, 587, 993, 995, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 27017];

        output.innerHTML = `Scanning ${target}...\n\n`;
        progressDiv.style.display = 'block';
        progressFill.style.width = '0%';
        progressText.textContent = 'Scanning...';

        try {
            const response = await fetch('/api/portscan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target, ports })
            });
            
            const data = await response.json();
            
            if (data.success) {
                progressFill.style.width = '100%';
                progressText.textContent = 'Complete';
                
                const openPorts = data.results.filter(r => r.status === 'open');
                
                output.innerHTML = `Scan results for ${data.target}:\n`;
                output.innerHTML += `═══════════════════════════════════════\n\n`;
                
                if (openPorts.length > 0) {
                    output.innerHTML += `<span class="port-open">OPEN PORTS (${openPorts.length}):</span>\n`;
                    openPorts.forEach(p => {
                        output.innerHTML += `<span class="port-open">  ${p.port}/tcp    open    ${p.service}</span>\n`;
                    });
                } else {
                    output.innerHTML += `<span class="port-closed">No open ports found.</span>\n`;
                }
                
                output.innerHTML += `\n<span style="color: #ff4444; font-weight: bold;">SCANNED BY NEXUS</span>`;
            } else {
                output.textContent = `[ERROR] ${data.message}`;
                progressDiv.style.display = 'none';
            }
        } catch (e) {
            output.textContent = '[ERROR] Could not connect to server.';
            progressDiv.style.display = 'none';
        }
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
