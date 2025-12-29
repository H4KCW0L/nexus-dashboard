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
        this.initCoinsSystem();
    }

    async initCoinsSystem() {
        // Load user coins
        if (currentUser) {
            try {
                const response = await fetch(`/api/coins/${currentUser.username}`);
                const data = await response.json();
                if (data.success) {
                    currentUser.coins = data.coins;
                    currentUser.inventory = data.inventory;
                    currentUser.activeTag = data.activeTag;
                    document.getElementById('coins-amount').textContent = data.coins;
                }
            } catch (e) {}
        }
        
        // Claim button
        const claimBtn = document.getElementById('coins-claim');
        if (claimBtn) {
            claimBtn.onclick = () => this.claimCoins();
        }
        
        // Auto-claim reminder every 10 minutes
        setInterval(() => {
            const claimBtn = document.getElementById('coins-claim');
            if (claimBtn) claimBtn.classList.add('pulse');
        }, 10 * 60 * 1000);
    }

    async claimCoins() {
        try {
            const response = await fetch('/api/coins/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username })
            });
            const data = await response.json();
            
            if (data.success) {
                currentUser.coins = data.totalCoins;
                document.getElementById('coins-amount').textContent = data.totalCoins;
                document.getElementById('coins-claim').classList.remove('pulse');
                this.showCoinAnimation(data.coinsEarned);
            } else {
                alert(data.message);
            }
        } catch (e) {
            alert('Error claiming coins');
        }
    }

    showCoinAnimation(amount) {
        const display = document.getElementById('coins-display');
        const popup = document.createElement('div');
        popup.className = 'coin-popup';
        popup.textContent = `+${amount}`;
        display.appendChild(popup);
        setTimeout(() => popup.remove(), 1500);
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

        // Leave voice chat
        if (this.currentTool === 'voice-chat') {
            this.leaveVoiceChat();
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
            'voice-chat': this.getVoiceChatHTML(),
            'members': this.getMembersHTML(),
            'shop': this.getShopHTML(),
            'notes': this.getNotesHTML(),
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
                            <button class="btn-icon" id="sticker-btn" title="Stickers">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"></path>
                                    <path d="M12 12l6-6"></path>
                                    <path d="M12 12v10"></path>
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
                            <div class="sticker-picker" id="sticker-picker" style="display:none;">
                                <div class="sticker-tabs">
                                    <button class="sticker-tab active" data-tab="default">Default</button>
                                    <button class="sticker-tab" data-tab="custom">Custom</button>
                                </div>
                                <div class="sticker-content" id="sticker-content"></div>
                                ${isAdmin ? '<div class="sticker-upload"><input type="file" id="sticker-file" accept="image/*" style="display:none;"><button class="btn-secondary btn-small" id="add-sticker-btn">+ Add Sticker</button></div>' : ''}
                            </div>
                            <input type="text" class="chat-input" id="chat-input" placeholder="Type a message...">
                            <button class="btn-primary" id="chat-send">Send</button>
                            ${isAdmin ? '<button class="btn-secondary" id="pin-msg-btn" title="Pin Message">PIN</button>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getVoiceChatHTML() {
        return `
            <div class="tool-panel voice-panel">
                <h2>Voice Chat</h2>
                <div class="voice-preview">
                    <div class="voice-preview-status">
                        <div class="voice-indicator disconnected" id="voice-indicator"></div>
                        <span id="voice-status-text">Not connected</span>
                    </div>
                    <div class="voice-preview-users" id="voice-preview-users">
                        <span class="voice-empty">No one in voice</span>
                    </div>
                    <button class="btn-primary btn-join-voice" id="voice-join">Join Voice Channel</button>
                </div>
                <div class="voice-settings">
                    <h3>Audio Settings</h3>
                    <div class="voice-setting">
                        <label>Input Device (Microphone)</label>
                        <select id="voice-input-device" class="tool-select"></select>
                    </div>
                    <div class="voice-setting">
                        <label>Output Device (Speakers)</label>
                        <select id="voice-output-device" class="tool-select"></select>
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

    getShopHTML() {
        return `
            <div class="tool-panel shop-panel">
                <h2>🪙 Nexus Shop</h2>
                <div class="shop-balance">
                    <span>Tu Balance:</span>
                    <span class="shop-coins" id="shop-coins">${currentUser?.coins || 0} coins</span>
                </div>
                <div class="shop-tabs">
                    <button class="shop-tab active" data-tab="tags">Etiquetas</button>
                    <button class="shop-tab" data-tab="perms">Permisos</button>
                    <button class="shop-tab" data-tab="premium">Premium</button>
                    <button class="shop-tab" data-tab="inventory">Mis Items</button>
                </div>
                <div class="shop-items" id="shop-items">
                    <div class="loading-members">Cargando tienda...</div>
                </div>
            </div>
        `;
    }

    async loadShop() {
        try {
            const response = await fetch('/api/shop');
            this.shopItems = await response.json();
            
            // Load user data
            const userResponse = await fetch(`/api/coins/${currentUser.username}`);
            const userData = await userResponse.json();
            if (userData.success) {
                currentUser.coins = userData.coins;
                currentUser.inventory = userData.inventory;
                currentUser.activeTag = userData.activeTag;
                document.getElementById('shop-coins').textContent = `${userData.coins} coins`;
                document.getElementById('coins-amount').textContent = userData.coins;
            }
            
            this.renderShopItems('tags');
            
            // Tab switching
            document.querySelectorAll('.shop-tab').forEach(tab => {
                tab.onclick = () => {
                    document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.renderShopItems(tab.dataset.tab);
                };
            });
        } catch (e) {
            document.getElementById('shop-items').innerHTML = '<div class="chat-error">Could not load shop</div>';
        }
    }

    renderShopItems(tab) {
        const container = document.getElementById('shop-items');
        
        if (tab === 'inventory') {
            this.renderInventory();
            return;
        }
        
        const typeMap = { tags: 'tag', perms: 'permission', premium: 'premium' };
        const type = typeMap[tab];
        
        const items = Object.entries(this.shopItems).filter(([id, item]) => item.type === type);
        
        if (items.length === 0) {
            container.innerHTML = '<div class="shop-empty">No hay items en esta categoría</div>';
            return;
        }
        
        container.innerHTML = items.map(([id, item]) => {
            const owned = currentUser.inventory?.includes(id);
            const equipped = currentUser.activeTag === id || currentUser.theme === id;
            return `
                <div class="shop-item ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}">
                    <div class="shop-item-info">
                        <div class="shop-item-name">${item.name}</div>
                        <div class="shop-item-desc">${item.description}</div>
                        <div class="shop-item-price">${item.price} 🪙</div>
                    </div>
                    <div class="shop-item-actions">
                        ${owned ? 
                            (item.type === 'tag' || item.type === 'theme' ? 
                                `<button class="btn-secondary btn-small" onclick="nexus.equipItem('${id}')">${equipped ? 'Quitar' : 'Equipar'}</button>` 
                                : '<span class="owned-badge">COMPRADO</span>') 
                            : `<button class="btn-primary btn-small" onclick="nexus.buyItem('${id}')">Comprar</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    renderInventory() {
        const container = document.getElementById('shop-items');
        const inventory = currentUser.inventory || [];
        
        if (inventory.length === 0) {
            container.innerHTML = '<div class="shop-empty">No tienes items aún. ¡Compra algo!</div>';
            return;
        }
        
        container.innerHTML = inventory.map(id => {
            const item = this.shopItems[id];
            if (!item) return '';
            const equipped = currentUser.activeTag === id || currentUser.theme === id;
            return `
                <div class="shop-item owned ${equipped ? 'equipped' : ''}">
                    <div class="shop-item-info">
                        <div class="shop-item-name">${item.name}</div>
                        <div class="shop-item-desc">${item.description}</div>
                    </div>
                    <div class="shop-item-actions">
                        ${item.type === 'tag' || item.type === 'theme' ? 
                            `<button class="btn-secondary btn-small" onclick="nexus.equipItem('${id}')">${equipped ? 'Quitar' : 'Equipar'}</button>` 
                            : '<span class="owned-badge">COMPRADO</span>'
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    async buyItem(itemId) {
        try {
            const response = await fetch('/api/shop/buy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username, itemId })
            });
            const data = await response.json();
            
            if (data.success) {
                currentUser.coins = data.coins;
                currentUser.inventory = data.inventory;
                document.getElementById('shop-coins').textContent = `${data.coins} coins`;
                document.getElementById('coins-amount').textContent = data.coins;
                this.renderShopItems(document.querySelector('.shop-tab.active').dataset.tab);
                alert(data.message);
            } else {
                alert(data.message);
            }
        } catch (e) {
            alert('Error buying item');
        }
    }

    async equipItem(itemId) {
        const isEquipped = currentUser.activeTag === itemId || currentUser.theme === itemId;
        
        try {
            const response = await fetch('/api/shop/equip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: currentUser.username, 
                    itemId: isEquipped ? null : itemId 
                })
            });
            const data = await response.json();
            
            if (data.success) {
                currentUser.activeTag = data.activeTag;
                currentUser.theme = data.theme;
                this.renderShopItems(document.querySelector('.shop-tab.active').dataset.tab);
            } else {
                alert(data.message);
            }
        } catch (e) {
            alert('Error equipping item');
        }
    }

    getNotesHTML() {
        const canWrite = currentUser?.role === 'owner' || currentUser?.role === 'admin';
        return `
            <div class="tool-panel notes-panel">
                <h2>Notes</h2>
                ${canWrite ? `
                <div class="notes-create">
                    <input type="text" class="tool-input" id="note-title" placeholder="Note title..." maxlength="100">
                    <textarea class="tool-input notes-content" id="note-content" placeholder="Write your note here..." maxlength="5000"></textarea>
                    <button class="btn-primary" id="create-note-btn">Create Note</button>
                </div>
                ` : ''}
                <div class="notes-list" id="notes-list">
                    <div class="loading-members">Loading notes...</div>
                </div>
            </div>
        `;
    }

    async loadNotes() {
        try {
            const response = await fetch('/api/notes');
            const notesList = await response.json();
            const canDelete = currentUser?.role === 'owner' || currentUser?.role === 'admin';
            
            const container = document.getElementById('notes-list');
            
            if (notesList.length === 0) {
                container.innerHTML = '<div class="notes-empty">No notes yet.</div>';
                return;
            }
            
            container.innerHTML = notesList.map(note => `
                <div class="note-card" data-id="${note.id}">
                    <div class="note-header">
                        <span class="note-title">${this.escapeHtml(note.title)}</span>
                        ${canDelete ? `<button class="note-delete" data-id="${note.id}">✕</button>` : ''}
                    </div>
                    <div class="note-content">${this.escapeHtml(note.content).replace(/\n/g, '<br>')}</div>
                    <div class="note-footer">
                        <span class="note-author">By ${note.author}</span>
                        <span class="note-date">${new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                </div>
            `).join('');
            
            // Attach delete listeners
            if (canDelete) {
                document.querySelectorAll('.note-delete').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.target.dataset.id;
                        if (confirm('Delete this note?')) {
                            await this.deleteNote(id);
                        }
                    });
                });
            }
            
            // Attach create listener
            const createBtn = document.getElementById('create-note-btn');
            if (createBtn) {
                createBtn.addEventListener('click', () => this.createNote());
            }
        } catch (e) {
            document.getElementById('notes-list').innerHTML = '<div class="chat-error">Could not load notes.</div>';
        }
    }

    async createNote() {
        const title = document.getElementById('note-title').value.trim();
        const content = document.getElementById('note-content').value.trim();
        
        if (!title || !content) {
            alert('Please fill in title and content');
            return;
        }
        
        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    title,
                    content
                })
            });
            
            const data = await response.json();
            if (data.success) {
                document.getElementById('note-title').value = '';
                document.getElementById('note-content').value = '';
                this.loadNotes();
            } else {
                alert(data.message);
            }
        } catch (e) {
            alert('Error creating note');
        }
    }

    async deleteNote(id) {
        try {
            const response = await fetch(`/api/notes/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username })
            });
            
            const data = await response.json();
            if (data.success) {
                this.loadNotes();
            } else {
                alert(data.message);
            }
        } catch (e) {
            alert('Error deleting note');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            case 'voice-chat':
                this.initVoiceChat();
                break;
            case 'members':
                this.loadMembers();
                break;
            case 'shop':
                this.loadShop();
                break;
            case 'notes':
                this.loadNotes();
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
        
        // Sticker picker
        this.initStickerPicker();

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
        const stickerPicker = document.getElementById('sticker-picker');
        
        const emojis = [
            '😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '🤯', '🥳',
            '👍', '👎', '👏', '🙌', '🤝', '💪', '🔥', '💯', '❤️', '💔',
            '⭐', '✨', '🎉', '🎊', '🏆', '💰', '💎', '🚀', '💻', '🎮',
            '☠️', '💀', '👻', '🤖', '👽', '🔒', '🔓', '⚠️', '🚫', '✅'
        ];
        
        emojiPicker.innerHTML = emojis.map(e => `<span class="emoji-item">${e}</span>`).join('');
        
        emojiBtn.onclick = (e) => {
            e.stopPropagation();
            stickerPicker.style.display = 'none';
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
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.emoji-picker') && !e.target.closest('#emoji-btn')) {
                emojiPicker.style.display = 'none';
            }
            if (!e.target.closest('.sticker-picker') && !e.target.closest('#sticker-btn')) {
                stickerPicker.style.display = 'none';
            }
        });
    }

    async initStickerPicker() {
        const stickerBtn = document.getElementById('sticker-btn');
        const stickerPicker = document.getElementById('sticker-picker');
        const emojiPicker = document.getElementById('emoji-picker');
        const stickerContent = document.getElementById('sticker-content');
        
        // Default stickers (URLs de stickers gratuitos)
        this.defaultStickers = [
            'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
            'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
            'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
            'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
            'https://media.giphy.com/media/l41lGvinEgARjB2HC/giphy.gif',
            'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
            'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
            'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif'
        ];
        
        // Load custom stickers from server
        await this.loadCustomStickers();
        
        stickerBtn.onclick = (e) => {
            e.stopPropagation();
            emojiPicker.style.display = 'none';
            stickerPicker.style.display = stickerPicker.style.display === 'none' ? 'block' : 'none';
            this.renderStickers('default');
        };
        
        // Tab switching
        stickerPicker.querySelectorAll('.sticker-tab').forEach(tab => {
            tab.onclick = (e) => {
                e.stopPropagation();
                stickerPicker.querySelectorAll('.sticker-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderStickers(tab.dataset.tab);
            };
        });
        
        // Add sticker button (admin only)
        const addStickerBtn = document.getElementById('add-sticker-btn');
        const stickerFile = document.getElementById('sticker-file');
        if (addStickerBtn && stickerFile) {
            addStickerBtn.onclick = (e) => {
                e.stopPropagation();
                stickerFile.click();
            };
            stickerFile.onchange = (e) => this.uploadCustomSticker(e.target.files[0]);
        }
    }

    async loadCustomStickers() {
        try {
            const response = await fetch('/api/stickers');
            this.customStickers = await response.json();
        } catch (e) {
            this.customStickers = [];
        }
    }

    renderStickers(tab) {
        const stickerContent = document.getElementById('sticker-content');
        const stickers = tab === 'default' ? this.defaultStickers : this.customStickers;
        const isAdmin = currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin');
        
        if (stickers.length === 0) {
            stickerContent.innerHTML = '<div class="sticker-empty">No stickers yet</div>';
            return;
        }
        
        stickerContent.innerHTML = stickers.map((url, i) => `
            <div class="sticker-item" data-url="${typeof url === 'string' ? url : url.url}">
                <img src="${typeof url === 'string' ? url : url.url}" alt="sticker">
                ${tab === 'custom' && isAdmin ? `<button class="sticker-delete" data-id="${url.id || i}">×</button>` : ''}
            </div>
        `).join('');
        
        // Click to send sticker
        stickerContent.querySelectorAll('.sticker-item').forEach(item => {
            item.onclick = (e) => {
                if (e.target.classList.contains('sticker-delete')) return;
                this.sendSticker(item.dataset.url);
                document.getElementById('sticker-picker').style.display = 'none';
            };
        });
        
        // Delete sticker (admin only)
        stickerContent.querySelectorAll('.sticker-delete').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                await this.deleteCustomSticker(btn.dataset.id);
            };
        });
    }

    sendSticker(url) {
        if (this.socket) {
            this.socket.emit('chatMessage', { type: 'sticker', content: url });
        }
    }

    async uploadCustomSticker(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const response = await fetch('/api/stickers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: currentUser.username,
                        data: e.target.result
                    })
                });
                const result = await response.json();
                if (result.success) {
                    await this.loadCustomStickers();
                    this.renderStickers('custom');
                } else {
                    alert(result.message);
                }
            } catch (err) {
                alert('Error uploading sticker');
            }
        };
        reader.readAsDataURL(file);
    }

    async deleteCustomSticker(id) {
        try {
            const response = await fetch(`/api/stickers/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username })
            });
            const result = await response.json();
            if (result.success) {
                await this.loadCustomStickers();
                this.renderStickers('custom');
            }
        } catch (e) {}
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
        } else if (msg.type === 'sticker') {
            msgElement.className = 'chat-message user';
            msgElement.innerHTML = `
                <span class="chat-time">[${msg.time}]</span> 
                <span class="chat-username">${msg.username}:</span>
                <div class="chat-sticker-container">
                    <img src="${msg.content}" class="chat-sticker">
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
            // Usar nuestro servidor como proxy para evitar CORS
            const response = await fetch(`/api/iplookup/${ip}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                output.innerHTML = `
<span style="color: #00ff00;">═══════════════════════════════════════</span>
<span style="color: #ff4444;">           IP INFORMATION</span>
<span style="color: #00ff00;">═══════════════════════════════════════</span>

IP Address:    ${data.query}

<span style="color: #ffaa00;">── LOCATION ──</span>
Country:       ${data.country} (${data.countryCode})
Region:        ${data.regionName}
City:          ${data.city}
ZIP:           ${data.zip || 'N/A'}
Latitude:      ${data.lat}
Longitude:     ${data.lon}

<span style="color: #ffaa00;">── TIMEZONE ──</span>
Timezone:      ${data.timezone || 'N/A'}

<span style="color: #ffaa00;">── NETWORK ──</span>
ISP:           ${data.isp || 'N/A'}
Organization:  ${data.org || 'N/A'}
AS:            ${data.as || 'N/A'}

<span style="color: #00ff00;">═══════════════════════════════════════</span>
<span style="color: #ff4444; font-weight: bold;">         TRACKED BY NEXUS</span>
<span style="color: #00ff00;">═══════════════════════════════════════</span>`;
            } else {
                output.textContent = `[ERROR] ${data.message || 'Failed to lookup IP'}`;
            }
        } catch (error) {
            output.textContent = `[ERROR] Failed to connect. Is the server running?`;
        }
    }

    // PHONE LOOKUP
    async lookupPhone() {
        const phoneRaw = document.getElementById('phone-input').value.trim();
        const output = document.getElementById('phone-output');
        
        if (!phoneRaw) { output.textContent = '[ERROR] Please enter a phone number.'; return; }

        const phone = phoneRaw.replace(/[\s\-\(\)]/g, '');
        output.textContent = `[*] Looking up ${phoneRaw}...\n`;
        
        // Obtener datos del país basado en el prefijo
        const countryData = this.getPhoneCountry(phone);
        
        // Si tenemos país, buscar coordenadas
        let coords = { lat: 'N/A', lon: 'N/A', capital: 'N/A', timezone: 'N/A' };
        
        if (countryData.valid && countryData.countryCode2) {
            try {
                const response = await fetch(`/api/phonelookup/${countryData.countryCode2}`);
                const data = await response.json();
                if (data[0]) {
                    coords = {
                        lat: data[0].latlng?.[0] || 'N/A',
                        lon: data[0].latlng?.[1] || 'N/A',
                        capital: data[0].capital?.[0] || 'N/A',
                        timezone: data[0].timezones?.[0] || 'N/A',
                        population: data[0].population?.toLocaleString() || 'N/A',
                        languages: Object.values(data[0].languages || {}).join(', ') || 'N/A',
                        currency: Object.keys(data[0].currencies || {})[0] || 'N/A'
                    };
                }
            } catch (e) {}
        }
        
        output.innerHTML = `
<span style="color: #00ff00;">═══════════════════════════════════════</span>
<span style="color: #ff4444;">         PHONE INFORMATION</span>
<span style="color: #00ff00;">═══════════════════════════════════════</span>

Phone Number:  ${phoneRaw}
Normalized:    ${phone}
Valid Format:  ${countryData.valid ? 'Yes' : 'Unknown'}

<span style="color: #ffaa00;">── LOCATION ──</span>
Country:       ${countryData.country}
Country Code:  ${countryData.code}
ISO Code:      ${countryData.countryCode2 || 'N/A'}
Region:        ${countryData.region}
Capital:       ${coords.capital}

<span style="color: #ffaa00;">── COORDINATES ──</span>
Latitude:      ${coords.lat}
Longitude:     ${coords.lon}
Timezone:      ${coords.timezone}

<span style="color: #ffaa00;">── CARRIER INFO ──</span>
Type:          ${countryData.type}
Carrier:       ${countryData.carrier}

<span style="color: #ffaa00;">── COUNTRY INFO ──</span>
Population:    ${coords.population || 'N/A'}
Languages:     ${coords.languages || 'N/A'}
Currency:      ${coords.currency || 'N/A'}

<span style="color: #00ff00;">═══════════════════════════════════════</span>
<span style="color: #ff4444; font-weight: bold;">         TRACKED BY NEXUS</span>
<span style="color: #00ff00;">═══════════════════════════════════════</span>`;
    }

    getPhoneCountry(phone) {
        const prefixes = {
            '+1': { country: 'United States/Canada', code: '+1', countryCode2: 'US', region: 'North America', carrier: 'Unknown', type: 'Mobile/Landline' },
            '+54': { country: 'Argentina', code: '+54', countryCode2: 'AR', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+52': { country: 'Mexico', code: '+52', countryCode2: 'MX', region: 'North America', carrier: 'Unknown', type: 'Mobile' },
            '+44': { country: 'United Kingdom', code: '+44', countryCode2: 'GB', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+34': { country: 'Spain', code: '+34', countryCode2: 'ES', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+49': { country: 'Germany', code: '+49', countryCode2: 'DE', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+33': { country: 'France', code: '+33', countryCode2: 'FR', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+55': { country: 'Brazil', code: '+55', countryCode2: 'BR', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+56': { country: 'Chile', code: '+56', countryCode2: 'CL', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+57': { country: 'Colombia', code: '+57', countryCode2: 'CO', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+58': { country: 'Venezuela', code: '+58', countryCode2: 'VE', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+51': { country: 'Peru', code: '+51', countryCode2: 'PE', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+86': { country: 'China', code: '+86', countryCode2: 'CN', region: 'Asia', carrier: 'Unknown', type: 'Mobile' },
            '+81': { country: 'Japan', code: '+81', countryCode2: 'JP', region: 'Asia', carrier: 'Unknown', type: 'Mobile' },
            '+91': { country: 'India', code: '+91', countryCode2: 'IN', region: 'Asia', carrier: 'Unknown', type: 'Mobile' },
            '+7': { country: 'Russia', code: '+7', countryCode2: 'RU', region: 'Europe/Asia', carrier: 'Unknown', type: 'Mobile' },
            '+39': { country: 'Italy', code: '+39', countryCode2: 'IT', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+61': { country: 'Australia', code: '+61', countryCode2: 'AU', region: 'Oceania', carrier: 'Unknown', type: 'Mobile' },
            '+82': { country: 'South Korea', code: '+82', countryCode2: 'KR', region: 'Asia', carrier: 'Unknown', type: 'Mobile' },
            '+31': { country: 'Netherlands', code: '+31', countryCode2: 'NL', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+48': { country: 'Poland', code: '+48', countryCode2: 'PL', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+46': { country: 'Sweden', code: '+46', countryCode2: 'SE', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+41': { country: 'Switzerland', code: '+41', countryCode2: 'CH', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+32': { country: 'Belgium', code: '+32', countryCode2: 'BE', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+351': { country: 'Portugal', code: '+351', countryCode2: 'PT', region: 'Europe', carrier: 'Unknown', type: 'Mobile' },
            '+593': { country: 'Ecuador', code: '+593', countryCode2: 'EC', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+591': { country: 'Bolivia', code: '+591', countryCode2: 'BO', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+595': { country: 'Paraguay', code: '+595', countryCode2: 'PY', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
            '+598': { country: 'Uruguay', code: '+598', countryCode2: 'UY', region: 'South America', carrier: 'Unknown', type: 'Mobile' },
        };
        // Ordenar por longitud de prefijo (más largo primero) para matchear correctamente
        const sortedPrefixes = Object.entries(prefixes).sort((a, b) => b[0].length - a[0].length);
        for (const [prefix, data] of sortedPrefixes) {
            if (phone.startsWith(prefix)) return { ...data, valid: true };
        }
        return { country: 'Unknown', code: 'N/A', countryCode2: null, region: 'Unknown', carrier: 'Unknown', type: 'Unknown', valid: false };
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

    // ============ VOICE CHAT ============
    initVoiceChat() {
        this.voiceConnections = new Map();
        this.localStream = null;
        this.voiceMuted = false;
        this.voiceSounds = { system: {}, soundboard: [] };
        this.selectedInputDevice = null;
        this.selectedOutputDevice = null;
        this.audioContext = null;
        this.analyser = null;

        // Load audio devices
        this.loadAudioDevices();
        
        // Load custom sounds
        this.loadVoiceSounds();

        document.getElementById('voice-join').onclick = () => this.openVoiceModal();

        // Device selection
        document.getElementById('voice-input-device').onchange = (e) => {
            this.selectedInputDevice = e.target.value;
        };
        document.getElementById('voice-output-device').onchange = (e) => {
            this.selectedOutputDevice = e.target.value;
            this.updateOutputDevices();
        };

        // Connect socket for voice signaling
        if (!this.socket) {
            this.socket = io();
        }

        this.setupVoiceSocketListeners();
    }

    setupVoiceSocketListeners() {
        this.socket.on('voiceParticipants', (participants) => {
            participants.forEach(p => this.createPeerConnection(p.id, true));
            this.updateVoicePreview();
        });

        this.socket.on('voiceUserJoined', (user) => {
            this.createPeerConnection(user.id, false);
        });

        this.socket.on('voiceUserLeft', (id) => {
            if (this.voiceConnections.has(id)) {
                this.voiceConnections.get(id).close();
                this.voiceConnections.delete(id);
            }
            const audioEl = document.getElementById(`audio-${id}`);
            if (audioEl) audioEl.remove();
        });

        this.socket.on('voiceUserList', (users) => {
            this.updateVoicePreview(users);
            if (this.voiceModalOpen) {
                this.updateVoiceModalUsers(users);
            }
        });

        this.socket.on('voicePlaySound', (soundType) => {
            this.playVoiceSound(soundType);
        });

        this.socket.on('voiceOffer', async ({ from, offer }) => {
            let pc = this.voiceConnections.get(from);
            if (!pc) {
                pc = this.createPeerConnection(from, false);
            }
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.socket.emit('voiceAnswer', { to: from, answer });
        });

        this.socket.on('voiceAnswer', async ({ from, answer }) => {
            const pc = this.voiceConnections.get(from);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
        });

        this.socket.on('voiceIceCandidate', async ({ from, candidate }) => {
            const pc = this.voiceConnections.get(from);
            if (pc && candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });
    }

    async loadAudioDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const inputSelect = document.getElementById('voice-input-device');
            const outputSelect = document.getElementById('voice-output-device');
            
            inputSelect.innerHTML = '';
            outputSelect.innerHTML = '';
            
            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`;
                
                if (device.kind === 'audioinput') {
                    inputSelect.appendChild(option);
                } else if (device.kind === 'audiooutput') {
                    outputSelect.appendChild(option);
                }
            });
        } catch (e) {
            console.error('Error loading audio devices:', e);
        }
    }

    async loadVoiceSounds() {
        try {
            const response = await fetch('/api/voice/sounds');
            this.voiceSounds = await response.json();
            if (!this.voiceSounds.soundboard) this.voiceSounds.soundboard = [];
            if (!this.voiceSounds.system) this.voiceSounds.system = {};
        } catch (e) {
            this.voiceSounds = { system: {}, soundboard: [] };
        }
    }

    openVoiceModal() {
        this.voiceModalOpen = true;
        const isAdmin = currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin');
        
        const modal = document.createElement('div');
        modal.className = 'voice-modal';
        modal.id = 'voice-modal';
        modal.innerHTML = `
            <div class="voice-modal-content">
                <div class="voice-modal-header">
                    <h2>Voice Channel</h2>
                    <div class="voice-modal-tabs">
                        <button class="voice-tab active" data-tab="users">Users</button>
                        <button class="voice-tab" data-tab="soundboard">Soundboard</button>
                    </div>
                    <button class="voice-modal-close" id="voice-modal-close">X</button>
                </div>
                <div class="voice-modal-body">
                    <div class="voice-tab-content active" id="tab-users">
                        <div class="voice-modal-users" id="voice-modal-users">
                            <div class="voice-empty-modal">Connecting...</div>
                        </div>
                    </div>
                    <div class="voice-tab-content" id="tab-soundboard">
                        <div class="soundboard-container">
                            ${isAdmin ? `
                            <div class="soundboard-upload">
                                <input type="file" id="soundboard-file" accept="audio/mp3,audio/mpeg" style="display:none;">
                                <button class="btn-secondary" id="soundboard-add-btn">+ Add Sound</button>
                            </div>
                            ` : ''}
                            <div class="soundboard-grid" id="soundboard-grid"></div>
                        </div>
                    </div>
                </div>
                <div class="voice-modal-controls">
                    <button class="voice-control-btn ${this.voiceMuted ? 'muted' : ''}" id="modal-mute" title="Mute">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            <line x1="12" y1="19" x2="12" y2="23"></line>
                            <line x1="8" y1="23" x2="16" y2="23"></line>
                        </svg>
                    </button>
                    <button class="voice-control-btn leave" id="modal-leave" title="Leave">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Tab switching
        modal.querySelectorAll('.voice-tab').forEach(tab => {
            tab.onclick = () => {
                modal.querySelectorAll('.voice-tab').forEach(t => t.classList.remove('active'));
                modal.querySelectorAll('.voice-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
            };
        });
        
        document.getElementById('voice-modal-close').onclick = () => this.closeVoiceModal();
        document.getElementById('modal-mute').onclick = () => this.toggleVoiceMute();
        document.getElementById('modal-leave').onclick = () => {
            this.leaveVoiceChat();
            this.closeVoiceModal();
        };
        
        // Soundboard
        this.renderSoundboard();
        if (isAdmin) {
            document.getElementById('soundboard-add-btn').onclick = () => document.getElementById('soundboard-file').click();
            document.getElementById('soundboard-file').onchange = (e) => this.uploadSoundboardSound(e.target.files[0]);
        }
        
        // Listen for soundboard plays
        this.socket.on('voiceSoundboardPlay', ({ data }) => {
            const audio = new Audio(data);
            audio.volume = 0.5;
            audio.play().catch(() => {});
        });
        
        this.joinVoiceChat();
    }

    renderSoundboard() {
        const grid = document.getElementById('soundboard-grid');
        if (!grid) return;
        const isAdmin = currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin');
        const sounds = this.voiceSounds.soundboard || [];
        
        if (sounds.length === 0) {
            grid.innerHTML = '<div class="soundboard-empty">No sounds yet</div>';
            return;
        }
        
        grid.innerHTML = sounds.map(s => `
            <div class="soundboard-btn" data-id="${s.id}">
                <span>${s.name.replace('.mp3', '').substring(0, 10)}</span>
                ${isAdmin ? `<button class="soundboard-del" data-id="${s.id}">X</button>` : ''}
            </div>
        `).join('');
        
        grid.querySelectorAll('.soundboard-btn').forEach(btn => {
            btn.onclick = (e) => {
                if (e.target.classList.contains('soundboard-del')) return;
                this.socket.emit('voicePlaySoundboard', btn.dataset.id);
            };
        });
        
        grid.querySelectorAll('.soundboard-del').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.deleteSoundboardSound(btn.dataset.id);
            };
        });
    }

    async uploadSoundboardSound(file) {
        if (!file || !file.type.includes('audio')) return;
        if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const res = await fetch('/api/voice/soundboard/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username, soundData: e.target.result, soundName: file.name })
            });
            const data = await res.json();
            if (data.success) {
                if (!this.voiceSounds.soundboard) this.voiceSounds.soundboard = [];
                this.voiceSounds.soundboard.push({ id: data.id, name: file.name, data: e.target.result });
                this.renderSoundboard();
            }
        };
        reader.readAsDataURL(file);
    }

    async deleteSoundboardSound(id) {
        await fetch(`/api/voice/soundboard/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username })
        });
        this.voiceSounds.soundboard = (this.voiceSounds.soundboard || []).filter(s => s.id !== id);
        this.renderSoundboard();
    }

    closeVoiceModal() {
        this.voiceModalOpen = false;
        const modal = document.getElementById('voice-modal');
        if (modal) modal.remove();
    }

    async joinVoiceChat() {
        try {
            const constraints = {
                audio: this.selectedInputDevice ? { deviceId: { exact: this.selectedInputDevice } } : true,
                video: false
            };
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Setup audio analysis for speaking detection
            this.setupSpeakingDetection();
            
            document.getElementById('voice-indicator').className = 'voice-indicator connected';
            document.getElementById('voice-status-text').textContent = 'Connected';

            this.socket.emit('voiceJoin', {
                username: currentUser.username,
                avatar: currentUser.avatar || ''
            });
        } catch (e) {
            alert('Could not access microphone. Please allow microphone permission.');
            console.error('Microphone error:', e);
            this.closeVoiceModal();
        }
    }

    setupSpeakingDetection() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(this.localStream);
        source.connect(this.analyser);
        
        this.analyser.fftSize = 512;
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        let speaking = false;
        const checkSpeaking = () => {
            if (!this.localStream || this.voiceMuted) {
                if (speaking) {
                    speaking = false;
                    this.socket.emit('voiceSpeaking', false);
                }
                return;
            }
            
            this.analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            const isSpeaking = average > 20;
            if (isSpeaking !== speaking) {
                speaking = isSpeaking;
                this.socket.emit('voiceSpeaking', speaking);
            }
            
            if (this.localStream) {
                requestAnimationFrame(checkSpeaking);
            }
        };
        checkSpeaking();
    }

    leaveVoiceChat() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.voiceConnections.forEach(pc => pc.close());
        this.voiceConnections.clear();

        document.querySelectorAll('audio[id^="audio-"]').forEach(el => el.remove());

        if (this.socket) {
            this.socket.emit('voiceLeave');
        }

        document.getElementById('voice-indicator').className = 'voice-indicator disconnected';
        document.getElementById('voice-status-text').textContent = 'Not connected';
        this.updateVoicePreview([]);
    }

    toggleVoiceMute() {
        if (!this.localStream) return;

        this.voiceMuted = !this.voiceMuted;
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = !this.voiceMuted;
        });

        const modalMuteBtn = document.getElementById('modal-mute');
        if (modalMuteBtn) {
            modalMuteBtn.classList.toggle('muted', this.voiceMuted);
        }

        this.socket.emit('voiceMuteToggle', this.voiceMuted);
    }

    updateOutputDevices() {
        document.querySelectorAll('audio[id^="audio-"]').forEach(el => {
            if (el.setSinkId && this.selectedOutputDevice) {
                el.setSinkId(this.selectedOutputDevice);
            }
        });
    }

    createPeerConnection(peerId, initiator) {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(config);
        this.voiceConnections.set(peerId, pc);

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.socket.emit('voiceIceCandidate', { to: peerId, candidate: e.candidate });
            }
        };

        pc.ontrack = (e) => {
            let audioEl = document.getElementById(`audio-${peerId}`);
            if (!audioEl) {
                audioEl = document.createElement('audio');
                audioEl.id = `audio-${peerId}`;
                audioEl.autoplay = true;
                if (this.selectedOutputDevice && audioEl.setSinkId) {
                    audioEl.setSinkId(this.selectedOutputDevice);
                }
                document.body.appendChild(audioEl);
            }
            audioEl.srcObject = e.streams[0];
        };

        if (initiator) {
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                this.socket.emit('voiceOffer', { to: peerId, offer });
            });
        }

        return pc;
    }

    updateVoicePreview(users = []) {
        const preview = document.getElementById('voice-preview-users');
        if (!preview) return;
        
        if (users.length === 0) {
            preview.innerHTML = '<span class="voice-empty">No one in voice</span>';
        } else {
            preview.innerHTML = users.map(u => `
                <div class="voice-preview-user ${u.speaking ? 'speaking' : ''} ${u.muted ? 'muted' : ''}">
                    <div class="voice-preview-avatar">
                        ${u.avatar ? `<img src="${u.avatar}">` : u.username.charAt(0).toUpperCase()}
                    </div>
                    <span>${u.username}</span>
                </div>
            `).join('');
        }
    }

    updateVoiceModalUsers(users) {
        const container = document.getElementById('voice-modal-users');
        if (!container) return;
        
        if (users.length === 0) {
            container.innerHTML = '<div class="voice-empty-modal">No one else here</div>';
            return;
        }
        
        container.innerHTML = users.map(u => `
            <div class="voice-user-card ${u.speaking ? 'speaking' : ''} ${u.muted ? 'muted' : ''}">
                <div class="voice-user-avatar ${u.speaking ? 'speaking-ring' : ''}">
                    ${u.avatar ? `<img src="${u.avatar}">` : u.username.charAt(0).toUpperCase()}
                </div>
                <div class="voice-user-name">${u.username}</div>
                ${u.muted ? '<div class="voice-user-muted">MUTED</div>' : ''}
            </div>
        `).join('');
    }
}
