// API Configuration & Backend Communication Check
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000/api'
    : 'https://api.jugaadubhai.shop/api';

async function checkBackendConnection() {
    try {
        const response = await fetch(API_BASE_URL.replace('/api', '/'));
        if(response.ok) {
            console.log('Backend connection verified:', await response.text());
        }
    } catch(err) {
        console.warn('Backend currently unreachable', err);
    }
}
// Verify backend communication immediately
checkBackendConnection();

// Local Storage DB
let usersDB = JSON.parse(localStorage.getItem('trivenUsers')) || [];
const sessionDB = JSON.parse(localStorage.getItem('trivenSession')) || null;

// Global Settings (Fee & Cashback)
const settings = JSON.parse(localStorage.getItem('trivenSettings')) || {
    platformFee: 0,
    cashbackRate: 0
};

// State variables
const state = {
    user: sessionDB, 
    activeTab: 'home',
    listings: JSON.parse(localStorage.getItem('trivenListings')) || [],
    requests: JSON.parse(localStorage.getItem('trivenRequests')) || [],
    orders: JSON.parse(localStorage.getItem('trivenOrders')) || [],
    notifications: JSON.parse(localStorage.getItem('trivenNotifications')) || [],
    adminSettings: settings
};

// Elements
const root = document.getElementById('root');
const bottomNav = document.getElementById('bottom-nav');
const notifyContainer = document.getElementById('notification-container');

// ---------------------------------------------
// UI Utilities (Toasts & Modals)
// ---------------------------------------------

function showNotification(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'ri-checkbox-circle-fill' : (type === 'error' ? 'ri-error-warning-fill' : 'ri-information-fill');
    
    toast.innerHTML = `
        <i class="${icon}"></i>
        <div>
            <h4 style="font-size: 14px; color: #fff; margin-bottom: 2px;">${title}</h4>
            <p style="font-size: 12px; margin: 0;">${message}</p>
        </div>
    `;
    
    notifyContainer.appendChild(toast);
    
    // Auto remove after 4s
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px) scale(0.95)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function confirmAction(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    overlay.innerHTML = `
        <div class="modal-content">
            <h3 style="margin-bottom: 12px;">${title}</h3>
            <p style="margin-bottom: 24px;">${message}</p>
            <div class="flex-center gap-4">
                <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
                <button class="btn" id="confirm-ok" style="background: var(--primary-gradient)">Confirm</button>
            </div>
        </div>
    `;
    
    document.getElementById('app-container').appendChild(overlay);
    
    overlay.querySelector('#confirm-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#confirm-ok').onclick = () => {
        onConfirm();
        overlay.remove();
    };
}

// ---------------------------------------------
// Data Migration & Default Admin
// ---------------------------------------------

function runMigrations() {
    let usersUpdated = false;
    
    // 1. Inject Default Admin if missing
    const adminPhone = '9820539961';
    if (!usersDB.find(u => u.phone === adminPhone)) {
        usersDB.push({
            name: 'Admin',
            phone: adminPhone,
            password: 'Chiru@3739',
            role: 'admin',
            roleStatus: 'active',
            trustScore: 100,
            rating: 5.0,
            completedOrders: 0,
            balance: 0,
            holdBalance: 0,
            cashbackBalance: 0,
            earnings: 0,
            deposits: 0,
            strikes: 0,
            scamCount: 0,
            frozenWallet: false,
            inviteCodes: ['ADMIN-GOD-MODE'],
            invitedBy: null,
            invitedUsers: []
        });
        usersUpdated = true;
    }
    
    // 2. Ensure all users have new fields (Migration)
    usersDB.forEach(u => {
        if (u.cashbackBalance === undefined) { u.cashbackBalance = 0; usersUpdated = true; }
        if (u.scamCount === undefined) { u.scamCount = 0; usersUpdated = true; }
        if (u.inviteeScamCount === undefined) { u.inviteeScamCount = 0; usersUpdated = true; }
        if (u.lockedEscrow === undefined) { u.lockedEscrow = []; usersUpdated = true; }
    });
    
    if (usersUpdated) {
        localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
    }
}

// Init
function init() {
    runMigrations();
    setupNavListeners();
    render();
}

function render() {
    try {
        if (!state.user) {
            bottomNav.classList.add('hidden');
            renderAuth();
        } else {
            // Role-based Bottom Nav visibility
            // Only hide navigation if explicitly in the Admin panel
            if (state.user.role === 'admin' && state.activeTab === 'admin') {
                bottomNav.classList.add('hidden');
            } else {
                bottomNav.classList.remove('hidden');
            }
            renderMainApp();
        }
    } catch (err) {
        console.error('Render error:', err);
        root.innerHTML = `<div class="screen flex-center"><p style="color:var(--danger-color)">Critical Error: ${err.message}</p></div>`;
    }
}

// ---------------------------------------------
// Auth Views
// ---------------------------------------------
let authMode = 'login'; // 'login' or 'register'

function renderAuth() {
    root.innerHTML = '';
    
    const screen = document.createElement('div');
    screen.className = 'screen flex-center';
    screen.style.padding = '24px';
    
    const container = document.createElement('div');
    container.style.width = '100%';
    
    // Header
    const header = document.createElement('div');
    header.className = 'auth-header';
    header.innerHTML = `
        <div class="auth-logo"><i class="ri-store-3-fill"></i></div>
        <h1>${authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
        <p>${authMode === 'login' ? 'Sign in to Triven Hub' : 'Join the premier digital marketplace'}</p>
    `;
    
    const errorBox = document.createElement('div');
    errorBox.id = 'auth-error';
    errorBox.style.display = 'none';
    errorBox.style.padding = '12px';
    errorBox.style.marginBottom = '16px';
    errorBox.style.borderRadius = 'var(--radius-sm)';
    errorBox.style.fontSize = '14px';
    errorBox.style.textAlign = 'center';
    errorBox.style.fontWeight = '500';

    // Form
    const form = document.createElement('form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const phone = formData.get('phone');
        const password = formData.get('password');
        
        errorBox.style.display = 'none';
        
        if (authMode === 'register') {
            // Register Validation
            if (usersDB.some(u => u.phone === phone)) {
                errorBox.textContent = 'User already exists';
                errorBox.style.display = 'block';
                errorBox.style.background = 'rgba(239, 68, 68, 0.1)';
                errorBox.style.color = 'var(--danger-color)';
                errorBox.style.border = '1px solid var(--danger-color)';
                return;
            }
            
            const role = formData.get('role');
            let inviterData = null;
            if (role === 'reseller') {
                const inviteCode = formData.get('inviteCode');
                const inviter = usersDB.find(u => u.inviteCodes && u.inviteCodes.includes(inviteCode));
                if (!inviter) {
                    errorBox.textContent = 'Invalid Invite Code';
                    errorBox.style.display = 'block';
                    errorBox.style.background = 'rgba(239, 68, 68, 0.1)';
                    errorBox.style.color = 'var(--danger-color)';
                    errorBox.style.border = '1px solid var(--danger-color)';
                    return;
                }
                inviterData = inviter;
            }
            
            const newUser = {
                name: formData.get('name'),
                phone: phone,
                password: password,
                role: role,
                trustScore: role === 'reseller' ? 100 : 100, // Default 100
                rating: 5.0,
                completedOrders: 0,
                isOnline: false,
                roleStatus: role === 'reseller' ? 'pending' : 'active',
                
                balance: role === 'customer' ? localStorage.getItem('mockBalanceTriggered') ? 0 : 500 : 0, 
                holdBalance: 0,
                cashbackBalance: 0,
                earnings: 0,
                deposits: role === 'customer' ? 500 : 0,
                strikes: 0,
                scamCount: 0,
                frozenWallet: false,
                lockedEscrow: [],
                
                inviteCodes: [],
                invitedBy: inviterData ? inviterData.phone : null,
                invitedUsers: []
            };
            if(role === 'customer') localStorage.setItem('mockBalanceTriggered', 'true'); 
            
            if (inviterData) {
                const uIndex = usersDB.findIndex(u => u.phone === inviterData.phone);
                const codeUsed = formData.get('inviteCode');
                if (codeUsed !== 'ADMIN-GOD-MODE') {
                    usersDB[uIndex].inviteCodes = usersDB[uIndex].inviteCodes.filter(c => c !== codeUsed);
                }
                usersDB[uIndex].invitedUsers.push(phone);
                localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
            }
            
            usersDB.push(newUser);
            localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
            
            // Set session
            const sessionUser = { ...newUser };
            delete sessionUser.password;
            state.user = sessionUser;
            localStorage.setItem('trivenSession', JSON.stringify(sessionUser));
            
            showNotification('Success', `Account created as ${role}.`, 'success');
            
        } else {
            // Unified Login Validation
            const existingUser = usersDB.find(u => u.phone === phone && u.password === password);
            if (!existingUser) {
                errorBox.textContent = 'Invalid phone or password';
                errorBox.style.display = 'block';
                errorBox.style.background = 'rgba(239, 68, 68, 0.1)';
                errorBox.style.color = 'var(--danger-color)';
                errorBox.style.border = '1px solid var(--danger-color)';
                return;
            }
            
            if (existingUser.frozenWallet) {
                errorBox.textContent = 'Account Banned / Frozen';
                errorBox.style.display = 'block';
                return;
            }

            // Set session
            const sessionUser = { ...existingUser };
            delete sessionUser.password;
            state.user = sessionUser;
            localStorage.setItem('trivenSession', JSON.stringify(sessionUser));

            // Role-based Redirection
            if (sessionUser.role === 'admin') {
                state.activeTab = 'admin';
            } else if (sessionUser.role === 'reseller' || sessionUser.role === 'vendor') {
                state.activeTab = 'orders'; // Go to seller dashboard
            } else {
                state.activeTab = 'home';
            }
            
            showNotification('Welcome back', sessionUser.name, 'success');
        }
        
        render(); 
    });
    
    if (authMode === 'register') {
        form.innerHTML += `
            <div class="input-group">
                <label>Full Name <span class="required-asterisk">*</span></label>
                <div class="input-wrapper">
                    <i class="ri-user-line"></i>
                    <input type="text" name="name" placeholder="John Doe" required>
                </div>
            </div>
            <div class="input-group">
                <label>Account Role <span class="required-asterisk">*</span></label>
                <div class="input-wrapper">
                    <i class="ri-user-settings-line"></i>
                    <select id="role-select" name="role" required style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: #fff; padding: 16px 16px 16px 48px; border-radius: var(--radius-md); font-size: 16px; outline: none; appearance: none; -webkit-appearance: none;">
                        <option value="customer" selected>Customer</option>
                        <option value="reseller">Reseller</option>
                    </select>
                </div>
            </div>
            <div class="input-group" id="invite-code-group" style="display:none;">
                <label>Invite Code <span class="required-asterisk">*</span></label>
                <div class="input-wrapper">
                    <i class="ri-key-line"></i>
                    <input type="text" id="invite-code" name="inviteCode" placeholder="Enter 6-char code">
                </div>
                <p style="font-size:11px; color:var(--warning-color); margin-top:4px;">Reseller access is invite-only.</p>
            </div>
        `;
        
        // Dynamically toggle invite code required
        setTimeout(() => {
            const roleSelect = document.getElementById('role-select');
            const inviteGroup = document.getElementById('invite-code-group');
            const inviteInput = document.getElementById('invite-code');
            if(roleSelect && inviteGroup) {
                roleSelect.addEventListener('change', (e) => {
                    if(e.target.value === 'reseller') {
                        inviteGroup.style.display = 'block';
                        inviteInput.required = true;
                    } else {
                        inviteGroup.style.display = 'none';
                        inviteInput.required = false;
                        inviteInput.value = '';
                    }
                });
            }
        }, 0);
    }
    
    // Phone Number (Required)
    form.innerHTML += `
        <div class="input-group">
            <label>Phone Number <span class="required-asterisk">*</span></label>
            <div class="input-wrapper">
                <i class="ri-phone-line"></i>
                <input type="tel" name="phone" placeholder="+1 (555) 000-0000" required>
            </div>
        </div>
    `;
    
    if (authMode === 'register') {
        form.innerHTML += `
            <div class="input-group">
                <label>Email <span class="optional-text">(Optional)</span></label>
                <div class="input-wrapper">
                    <i class="ri-mail-line"></i>
                    <input type="email" name="email" placeholder="john@example.com">
                </div>
            </div>
        `;
    }
    
    // Password
    form.innerHTML += `
        <div class="input-group">
            <label>Password <span class="required-asterisk">*</span></label>
            <div class="input-wrapper">
                <i class="ri-lock-line"></i>
                <input type="password" name="password" placeholder="••••••••" required>
            </div>
        </div>
        
        <button type="submit" class="btn mt-4">
            ${authMode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
    `;
    
    // Switch Mode Button
    const switchDiv = document.createElement('div');
    switchDiv.className = 'auth-switch';
    switchDiv.innerHTML = authMode === 'login' 
        ? `Don't have an account? <a href="#" id="switch-auth">Register</a>`
        : `Already have an account? <a href="#" id="switch-auth">Sign In</a>`;
        
    container.appendChild(header);
    container.appendChild(errorBox);
    container.appendChild(form);
    container.appendChild(switchDiv);
    screen.appendChild(container);
    root.appendChild(screen);
    
    document.getElementById('switch-auth').addEventListener('click', (e) => {
        e.preventDefault();
        authMode = authMode === 'login' ? 'register' : 'login';
        renderAuth();
    });
}

// ---------------------------------------------
// Main App Shell
// ---------------------------------------------
function renderMainApp() {
    // Admin bypass — render God Mode directly
    if (state.user?.role === 'admin' && state.activeTab === 'admin') {
        window.renderAdmin();
        return;
    }
    updateNavUI();
    if (state.activeTab === 'home') renderHome();
    else if (state.activeTab === 'orders') renderOrders();
    else if (state.activeTab === 'sell') renderSell();
    else if (state.activeTab === 'wallet') renderWallet();
    else if (state.activeTab === 'profile') renderProfile();
    else if (state.activeTab === 'request') renderRequestProduct();
    else if (state.activeTab === 'order-flow') renderOrderFlow();
    else renderHome();
}

function setupNavListeners() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.getAttribute('data-tab');
            if (state.activeTab !== tab) {
                state.activeTab = tab;
                renderMainApp();
            }
        });
    });
}

function updateNavUI() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.getAttribute('data-tab') === state.activeTab) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const sellTab = document.getElementById('nav-sell-tab');
    if (sellTab) {
        if (state.user && (state.user.role === 'reseller' || state.user.role === 'vendor' || state.user.role === 'admin')) {
            sellTab.classList.remove('hidden');
            sellTab.style.display = 'flex';
        } else {
            sellTab.classList.add('hidden');
            sellTab.style.display = 'none';
        }
    }
}

// ---------------------------------------------
// Core Screens
// ---------------------------------------------
window.searchQuery = window.searchQuery || '';

function renderHome() {
    root.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'screen';
    
    // Header
    const header = document.createElement('div');
    header.className = 'flex-between mb-4 mt-2';
    header.innerHTML = `
        <h2>Marketplace</h2>
        <div class="user-badge flex-center gap-2">
            <span class="badge badge-primary">${state.user.trustScore} ★</span>
            <button onclick="logout()" style="background:none; border:none; color:var(--text-muted); cursor:pointer;"><i class="ri-logout-box-r-line"></i></button>
        </div>
    `;
    
    // Search Bar
    const searchControls = document.createElement('div');
    searchControls.className = 'search-bar mb-4';
    searchControls.innerHTML = `
        <i class="ri-search-line"></i>
        <input type="text" id="home-search" placeholder="Search products (Netflix, Prime, etc.)" value="${window.searchQuery}">
    `;
    
    // Feed
    const feed = document.createElement('div');
    feed.className = 'product-feed';
    
    screen.appendChild(header);
    screen.appendChild(searchControls);
    screen.appendChild(feed);
    root.appendChild(screen);
    
    const searchInput = document.getElementById('home-search');
    searchInput.addEventListener('input', (e) => {
        window.searchQuery = e.target.value.toLowerCase();
        renderFeed(feed);
    });
    
    renderFeed(feed);
    
    // Refocus if returning
    if (window.searchQuery !== '') {
        const len = searchInput.value.length;
        searchInput.focus();
        searchInput.setSelectionRange(len, len);
    }
}

window.notifySeller = function(productId) {
    const p = state.listings.find(x => x.id === productId);
    if(p) {
        // Prevent duplicate spam
        const exists = state.notifications.find(n => n.productId === p.id && n.buyerPhone === state.user.phone && n.status === 'pending');
        if (!exists) {
            state.notifications.push({
                id: Date.now(),
                buyerPhone: state.user.phone,
                sellerPhone: p.sellerPhone,
                productId: p.id,
                status: 'pending'
            });
            localStorage.setItem('trivenNotifications', JSON.stringify(state.notifications));
        }
        alert('You will be notified when the seller is online.');
        
        const feed = document.querySelector('.product-feed');
        if(feed) renderFeed(feed);
    }
};

window.clearMyNotifications = function() {
    state.notifications.forEach(n => {
        if (n.buyerPhone === state.user.phone) {
            n.status = 'resolved';
        }
    });
    localStorage.setItem('trivenNotifications', JSON.stringify(state.notifications));
    const feed = document.querySelector('.product-feed');
    if(feed) renderFeed(feed);
};

function renderFeed(feed) {
    feed.innerHTML = '';
    
    // 1. Render Notification Banners
    if (state.user && state.user.role === 'customer') {
        const myPending = state.notifications.filter(n => n.buyerPhone === state.user.phone && n.status === 'pending');
        const nowOnlineSellers = myPending.filter(n => {
            const s = usersDB.find(u => u.phone === n.sellerPhone);
            return s && s.isOnline;
        });
        
        if (nowOnlineSellers.length > 0) {
            const names = [...new Set(nowOnlineSellers.map(n => usersDB.find(u => u.phone === n.sellerPhone).name))];
            const banner = document.createElement('div');
            banner.className = 'card mb-4';
            banner.style.background = 'rgba(99, 102, 241, 0.1)';
            banner.style.borderColor = 'var(--primary-color)';
            banner.innerHTML = `
                <div class="flex-center gap-2" style="justify-content:flex-start; margin-bottom:4px;">
                    <i class="ri-notification-3-fill" style="color:var(--primary-color); font-size:18px;"></i>
                    <h3 style="color:var(--primary-color); font-size:14px; margin:0;">Seller is now online!</h3>
                </div>
                <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">${names.join(', ')} is available. You can place your order now.</p>
                <button class="btn btn-secondary" style="padding:8px 16px; font-size:12px; width: auto;" onclick="clearMyNotifications()">Dismiss</button>
            `;
            feed.appendChild(banner);
        }
    }
    
    // 2. Filter & Sort Listings
    let filtered = state.listings.filter(p => p.name.toLowerCase().includes(window.searchQuery));
    
    // Tiered Visibility Rules
    if (state.user.role === 'customer') {
        // Customers ONLY see Resellers
        filtered = filtered.filter(p => p.sellerRole === 'reseller' || !p.sellerRole); // fallback for old data
    } else if (state.user.role === 'reseller') {
        // Resellers see Vendors + other Resellers
        filtered = filtered.filter(p => p.sellerRole === 'vendor' || p.sellerRole === 'reseller');
    }
    // Admin sees everything

    // Priority Ranking: Auto Send > Manual
    filtered.sort((a, b) => {
        if (a.mode === 'auto' && b.mode !== 'auto') return -1;
        if (a.mode !== 'auto' && b.mode === 'auto') return 1;
        return 0;
    });

    const activeProducts = [];
    const offlineProducts = [];

    filtered.forEach(p => {
        let isOnline = false;
        if (p.mode === 'auto') {
            isOnline = p.stock > 0;
        } else {
            const sellerData = usersDB.find(u => u.phone === p.sellerPhone);
            isOnline = sellerData ? sellerData.isOnline : false;
        }
        
        if (isOnline) activeProducts.push(p);
        else offlineProducts.push(p);
    });
    
    if (activeProducts.length === 0 && offlineProducts.length === 0) {
        feed.innerHTML += `
            <div class="card p-6 mt-6" style="text-align: center; border-style: dashed;">
                <i class="ri-search-2-line" style="font-size: 40px; color: var(--text-muted); margin-bottom: 16px; display: block;"></i>
                <p style="margin-bottom: 16px;">No listings found matching your criteria.</p>
                <button class="btn btn-secondary" style="width:auto" onclick="state.activeTab='request'; renderMainApp();">Request a Product</button>
            </div>
        `;
        return;
    }
    
    // 3. Render Sections
    const renderList = (list, isOffline = false) => {
        list.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card card mb-4';
            if (isOffline) {
                card.style.opacity = '0.6';
                card.style.filter = 'grayscale(0.4)';
            }
            
            const hasNotified = state.notifications.find(n => n.productId === p.id && n.buyerPhone === state.user?.phone && n.status === 'pending');
            const sellerData = usersDB.find(u => u.phone === p.sellerPhone);

            card.innerHTML = `
                <div class="product-card-body">
                    ${p.photo ? `<img src="${p.photo}" class="product-img">` : `<div class="product-img flex-center"><i class="ri-image-circle-line" style="font-size:32px; color:var(--text-muted)"></i></div>`}
                    <div style="flex:1;">
                        <div class="flex-between mb-1">
                            <h3 style="margin:0;">${p.name}</h3>
                            <span style="font-size: 18px; font-weight: 800; color: var(--success-color);">$${p.price.toFixed(2)}</span>
                        </div>
                        <div class="flex-between mb-3">
                            <span style="font-size:12px; color:var(--text-muted);">
                                <i class="ri-shield-user-line" style="vertical-align:middle"></i> ${p.seller} 
                                <span class="badge" style="padding:2px 6px; font-size:9px; margin-left:4px;">${p.sellerRole || 'Member'}</span>
                            </span>
                            <span style="font-size:12px; color:var(--warning-color); font-weight:700;"><i class="ri-star-fill"></i> ${p.rating || '5.0'}</span>
                        </div>
                        
                        <div class="flex-between mt-2">
                             ${p.mode === 'auto' 
                                ? `<span class="badge badge-success"><i class="ri-flashlight-fill"></i> Auto Send</span>` 
                                : `<span class="badge ${isOffline ? '' : 'badge-primary'}"><i class="ri-user-received-2-line"></i> Manual Delivery</span>`
                             }
                             
                             ${!isOffline 
                                ? `<button class="btn" style="padding: 8px 16px; font-size: 13px; width: auto; height: 36px;" onclick="buyProduct(${p.id})">Buy Now</button>`
                                : (hasNotified 
                                    ? `<button class="btn btn-secondary" style="padding: 8px 16px; font-size: 13px; width: auto; height: 36px;" disabled>Notified</button>`
                                    : `<button class="btn btn-secondary" style="padding: 8px 16px; font-size: 13px; width: auto; height: 36px; color: var(--warning-color); border-color: var(--warning-color);" onclick="notifySeller(${p.id})">Notify Me</button>`
                                  )
                             }
                        </div>
                    </div>
                </div>
            `;
            feed.appendChild(card);
        });
    };

    if (activeProducts.length > 0) {
        const h = document.createElement('h4');
        h.style.cssText = 'font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin: 12px 0; font-weight:800;';
        h.innerHTML = 'Available Now';
        feed.appendChild(h);
        renderList(activeProducts);
    }

    if (offlineProducts.length > 0) {
        const h = document.createElement('h4');
        h.style.cssText = 'font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin: 24px 0 12px; font-weight:800;';
        h.innerHTML = 'Currently Offline';
        feed.appendChild(h);
        renderList(offlineProducts, true);
    }
}

window.buyProduct = function(id) {
    const productIndex = state.listings.findIndex(p => p.id === id);
    const product = state.listings[productIndex];
    if (!product) return;

    // --- Auto: needs stock available ---
    if (product.mode === 'auto' && (!product.stockPairs || product.stockPairs.length === 0)) {
        showNotification('Out of Stock', 'This product is currently unavailable.', 'error');
        return;
    }

    // Escrow Check (Include Cashback Balance in purchasing power)
    const totalPurchasingPower = (state.user.balance || 0) + (state.user.cashbackBalance || 0);
    if (totalPurchasingPower < product.price) {
        showNotification('Insufficient Funds', 'Please add more money to your wallet.', 'error');
        return;
    }

    // Deduction Logic (Spend cashback first)
    let amountToDeduct = product.price;
    if (state.user.cashbackBalance > 0) {
        const cashbackSpent = Math.min(state.user.cashbackBalance, amountToDeduct);
        state.user.cashbackBalance -= cashbackSpent;
        amountToDeduct -= cashbackSpent;
    }
    state.user.balance    -= amountToDeduct;
    state.user.holdBalance += product.price;

    // Sync buyer to DB
    const uIndex = usersDB.findIndex(u => u.phone === state.user.phone);
    if (uIndex > -1) {
        usersDB[uIndex].cashbackBalance = state.user.cashbackBalance;
        usersDB[uIndex].balance         = state.user.balance;
        usersDB[uIndex].holdBalance     = state.user.holdBalance;
    }

    // Revenue & Rewards
    const feeAmount       = product.price * (settings.platformFee  / 100);
    const cashbackEarned  = product.price * (settings.cashbackRate / 100);
    const payoutAmount    = product.price - feeAmount;

    // --- BUG FIX #1 & #2: Pop credentials and reduce stock for Auto listings ---
    let deliveredCredentials = null;
    if (product.mode === 'auto') {
        deliveredCredentials = product.stockPairs.shift(); // pop first credential pair
        product.stock = product.stockPairs.length;          // update numeric count
        // If stock hits 0, mark listing as inactive
        if (product.stock === 0) product.isActive = false;
        localStorage.setItem('trivenListings', JSON.stringify(state.listings));
    }

    const newOrder = {
        id:                  Date.now(),
        name:                product.name,
        buyer:               state.user.name,
        buyerPhone:          state.user.phone,
        seller:              product.seller,
        primarySellerPhone:  product.sellerPhone,
        currentSellerPhone:  product.sellerPhone,
        sellerRole:          product.sellerRole || 'reseller',
        price:               product.price,
        feeAmount:           feeAmount,
        cashbackAmount:      cashbackEarned,
        mode:                product.mode,
        status:              product.mode === 'auto' ? 'delivered' : 'pending',
        credentials:         deliveredCredentials,   // BUG FIX #1
        createdAt:           Date.now(),
        deliveredAt:         product.mode === 'auto' ? Date.now() : null,
        accumulatedPauseMs:  0,
        pausedAt:            null,
        otpRequests:         0,
        chat:                product.mode !== 'auto'
            ? [{ sys: true, text: 'Order placed securely. Payment moved to Escrow. 2-min Seller Accept window started.' }]
            : [{ sys: true, text: 'System: Instant delivery complete. Credentials delivered automatically.' }]
    };

    state.orders.unshift(newOrder);

    // --- BUG FIX #3: Instant payout for Auto orders ---
    if (product.mode === 'auto') {
        // Release buyer hold
        if (uIndex > -1) {
            usersDB[uIndex].holdBalance = Math.max(0, (usersDB[uIndex].holdBalance || 0) - product.price);
            usersDB[uIndex].cashbackBalance = (usersDB[uIndex].cashbackBalance || 0) + cashbackEarned;
        }
        state.user.holdBalance     = Math.max(0, state.user.holdBalance - product.price);
        state.user.cashbackBalance = (state.user.cashbackBalance || 0) + cashbackEarned;

        // Credit seller into 24h escrow lock
        const sIndex = usersDB.findIndex(u => u.phone === product.sellerPhone);
        if (sIndex > -1) {
            usersDB[sIndex].completedOrders = (usersDB[sIndex].completedOrders || 0) + 1;
            if (!usersDB[sIndex].lockedEscrow) usersDB[sIndex].lockedEscrow = [];
            usersDB[sIndex].lockedEscrow.push({ amount: payoutAmount, unlockAt: Date.now() + 86400000 });
        }

        showNotification('Instant Delivery!', `${product.name} credentials delivered. Check Order Details.`, 'success');
    } else {
        showNotification('Order Placed', `${product.name} is being processed. Awaiting seller.`, 'success');
    }

    localStorage.setItem('trivenUsers',  JSON.stringify(usersDB));
    localStorage.setItem('trivenOrders', JSON.stringify(state.orders));
    localStorage.setItem('trivenSession', JSON.stringify(state.user));

    state.activeTab  = 'order-flow';
    window.activeOrder = newOrder;
    updateNavUI();
    renderOrderFlow();
};

window.sellState = window.sellState || { mode: 'auto', stock: [{email: '', pass: ''}], photo: null };

window.setSellMode = function(mode) {
    window.sellState.mode = mode;
    renderSell(true);
};

window.addStockPair = function() {
    window.sellState.stock.push({email: '', pass: ''});
    renderSell(true);
};

window.updateStock = function(index, field, value) {
    window.sellState.stock[index][field] = value;
};

function renderSell(isRerender = false) {
    if (!isRerender) {
        window.sellState = { mode: 'auto', stock: [{email: '', pass: ''}], photo: null };
    }
    
    const canListProducts = state.user && (state.user.role === 'reseller' || state.user.role === 'vendor' || state.user.role === 'admin');
    if (!canListProducts) {
        root.innerHTML = '';
        const screen = document.createElement('div');
        screen.className = 'screen flex-center';
        screen.style.flexDirection = 'column';
        screen.style.padding = '32px';
        screen.innerHTML = `
            <i class="ri-error-warning-fill" style="font-size: 64px; color: var(--danger-color); margin-bottom: 16px;"></i>
            <h2 style="color: var(--danger-color); margin-bottom: 8px;">Access Denied</h2>
            <p style="color: var(--text-secondary); text-align: center; margin-bottom: 24px;">Only Resellers and Vendors can create listings.</p>
            <button class="btn btn-secondary" onclick="state.activeTab='home'; renderMainApp()">Go Back</button>
        `;
        root.appendChild(screen);
        return;
    }

    root.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'screen';
    
    // Build stock HTML
    let stockHtml = '';
    if (window.sellState.mode === 'auto') {
        stockHtml = `
            <div class="input-group">
                <label>Stock Credentials <span class="required-asterisk">*</span></label>
                <div id="stock-list" style="display:flex; flex-direction:column; gap:8px;">
                    ${window.sellState.stock.map((p, i) => `
                        <div class="flex-between gap-2">
                            <input type="text" placeholder="Email / ID" value="${p.email}" onchange="updateStock(${i}, 'email', this.value)" style="flex:1; padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: #fff; border-radius: var(--radius-sm); font-size:14px; outline:none;">
                            <input type="text" placeholder="Password" value="${p.pass}" onchange="updateStock(${i}, 'pass', this.value)" style="flex:1; padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: #fff; border-radius: var(--radius-sm); font-size:14px; outline:none;">
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-secondary mt-2" onclick="addStockPair()" style="padding: 10px; font-size: 13px;">+ Add Stock Pair</button>
                <p style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Each pair creates 1 unit of instantly deliverable stock.</p>
            </div>
        `;
    } else {
        stockHtml = `
            <div class="input-group" style="background: rgba(245, 158, 11, 0.1); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid var(--warning-color);">
                <p style="font-size: 13px; color: var(--warning-color);"><strong>Manual Activation:</strong> You must be ONLINE via your Profile toggle for this listing to be visible on the Marketplace.</p>
            </div>
        `;
    }
    
    screen.innerHTML = `
        <div class="flex-between mb-4 mt-2">
            <h2>Create Listing</h2>
        </div>
        <form id="create-listing-form">
            <div class="card p-4">
            
                <div class="input-group">
                    <label>Product Photo <span class="optional-text">(Auto-compressed)</span></label>
                    <input type="file" id="product-photo" accept="image/*" style="padding: 10px; font-size: 12px;">
                    <img id="photo-preview" src="${window.sellState.photo || ''}" style="display: ${window.sellState.photo ? 'block' : 'none'}; width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-sm); margin-top: 8px; border: 1px solid var(--border-color);">
                    <canvas id="photo-canvas" style="display:none;"></canvas>
                </div>
            
                <div class="input-group">
                    <label>Product Name <span class="required-asterisk">*</span></label>
                    <input type="text" name="name" placeholder="Netflix Premium 1 Month" required style="padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: #fff; width: 100%; border-radius: var(--radius-sm); outline: none;">
                </div>
                
                <div class="input-group">
                    <label style="margin-bottom: 8px;">Delivery Mode <span class="required-asterisk">*</span></label>
                    <div class="flex-center gap-2">
                        <button type="button" class="btn ${window.sellState.mode === 'auto' ? '' : 'btn-secondary'}" onclick="setSellMode('auto')" style="flex:1; padding: 10px; font-size: 13px;">Auto Send</button>
                        <button type="button" class="btn ${window.sellState.mode === 'manual' ? '' : 'btn-secondary'}" onclick="setSellMode('manual')" style="flex:1; padding: 10px; font-size: 13px;">Manual Act.</button>
                    </div>
                </div>
                
                ${stockHtml}

                <div class="input-group">
                    <label>Price ($) <span class="required-asterisk">*</span></label>
                    <input type="number" step="0.01" name="price" placeholder="0.00" required style="padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: #fff; width: 100%; border-radius: var(--radius-sm); outline: none;">
                </div>
                
                <div class="input-group">
                    <label>Description (Optional)</label>
                    <textarea name="description" rows="3" placeholder="Additional details..." style="padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: #fff; width: 100%; border-radius: var(--radius-sm); outline: none; font-family: inherit; font-size: 14px;"></textarea>
                </div>
                
                <button type="submit" class="btn mt-4">Publish Listing</button>
            </div>
        </form>
    `;
    
    root.appendChild(screen);
    
    // Handle Image compression
    const photoInput = document.getElementById('product-photo');
    if (photoInput) {
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.getElementById('photo-canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Max dimension 200px to ensure tiny base64 size for local storage limits
                    const MAX_WIDTH = 200;
                    const MAX_HEIGHT = 200;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6); // 60% quality JPG
                    window.sellState.photo = compressedBase64;
                    
                    const preview = document.getElementById('photo-preview');
                    preview.src = compressedBase64;
                    preview.style.display = 'block';
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    
    document.getElementById('create-listing-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Final stock check for auto mode
        let finalStock = [];
        if (window.sellState.mode === 'auto') {
            finalStock = window.sellState.stock.filter(s => s.email.trim() !== '' && s.pass.trim() !== '');
            if (finalStock.length === 0) {
                return alert('You must add at least one stock credential pair for Auto mode.');
            }
        }
        
        const fd = new FormData(e.target);
        
        const newProduct = {
            id: Date.now(),
            name: fd.get('name'),
            seller: state.user.name,
            sellerPhone: state.user.phone,
            sellerRole: state.user.role, // Critical for tiered marketplace visibility
            price: parseFloat(fd.get('price')),
            rating: state.user.rating || state.user.trustScore,
            desc: fd.get('description'),
            mode: window.sellState.mode,
            stockPairs: finalStock,
            stock: finalStock.length,
            photo: window.sellState.photo
        };
        
        // Push and persist
        state.listings.unshift(newProduct);
        localStorage.setItem('trivenListings', JSON.stringify(state.listings));
        
        state.activeTab = 'home';
        renderMainApp();
    });
}

function renderRequestProduct() {
    root.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'screen';
    
    screen.innerHTML = `
        <div class="flex-between mb-4 mt-2">
            <div class="flex-center gap-2">
                <button class="btn btn-secondary" style="padding: 8px; border-radius: 50%; width: 40px; height: 40px;" onclick="state.activeTab='home'; renderMainApp()">
                    <i class="ri-arrow-left-line"></i>
                </button>
                <h2 style="margin: 0; padding-left:8px;">Request Product</h2>
            </div>
        </div>
        <form id="request-product-form">
            <div class="card p-4">
                <div class="input-group">
                    <label>What do you need? <span class="required-asterisk">*</span></label>
                    <input type="text" name="name" placeholder="e.g. AWS Credits $100" required style="padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: #fff; width: 100%; border-radius: var(--radius-sm); outline: none;">
                </div>
                <div class="input-group">
                    <label>Duration/Quantity <span class="required-asterisk">*</span></label>
                    <input type="text" name="duration" placeholder="e.g. Limited or 1 Month" required style="padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: #fff; width: 100%; border-radius: var(--radius-sm); outline: none;">
                </div>
                <div class="input-group">
                    <label>Your Budget ($) <span class="required-asterisk">*</span></label>
                    <input type="number" step="0.01" name="budget" placeholder="0.00" required style="padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); color: #fff; width: 100%; border-radius: var(--radius-sm); outline: none;">
                </div>
                <button type="submit" class="btn mt-4">Post Request to Market</button>
            </div>
        </form>
    `;
    
    root.appendChild(screen);
    
    document.getElementById('request-product-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        
        state.requests.unshift({
            id: Date.now(),
            name: fd.get('name'),
            duration: fd.get('duration'),
            budget: parseFloat(fd.get('budget')),
            requester: state.user.name,
            status: 'Waiting'
        });
        
        state.activeTab = 'home';
        renderMainApp();
    });
}

let currentMode = 'auto'; // Tracks active execution flow simply

// Handled by the primary buyProduct function at line 552


window.renderOrderFlow = function() {
    root.innerHTML = '';
    const o = window.activeOrder;
    if (!o) {
        state.activeTab = 'home';
        return renderMainApp(); 
    }

    const screen = document.createElement('div');
    screen.className = 'screen';
    screen.style.paddingTop = '16px';
    
    // Header
    const header = document.createElement('div');
    header.className = 'flex-between mb-4 mt-2';
    header.innerHTML = `
        <div class="flex-center gap-2">
            <button class="btn btn-secondary" style="padding: 8px; border-radius: 50%; width: 40px; height: 40px;" onclick="cancelOrder()">
                <i class="ri-arrow-left-line"></i>
            </button>
            <h2 style="margin: 0; padding-left: 8px;">Order Details</h2>
        </div>
        <span class="badge ${o.status === 'Delivered' ? 'badge-success' : 'badge-warning'}">${o.status}</span>
    `;
    
    // Product Overview
    const prodBox = document.createElement('div');
    prodBox.className = 'card mb-6';
    prodBox.innerHTML = `
        <h3 style="font-size: 16px; margin-bottom: 12px; color: #fff;">${o.name}</h3>
        <div class="flex-between">
            <p>Seller: <span style="color: var(--primary-color)">${o.seller}</span></p>
            <h2 style="color: var(--success-color); margin: 0; font-size: 18px;">$${o.price.toFixed(2)}</h2>
        </div>
    `;
    
    screen.appendChild(header);
    screen.appendChild(prodBox);
    
    if (o.mode === 'auto') {
        const vault = document.createElement('div');
        vault.innerHTML = `
            <div class="card p-4" style="border: 1px solid var(--success-color); background: rgba(34, 197, 94, 0.05);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <i class="ri-safe-2-line" style="font-size: 48px; color: var(--success-color);"></i>
                    <h3 style="margin-top: 12px; color: var(--success-color);">Instant Delivery Complete</h3>
                    <p style="font-size: 13px; margin-top: 8px;">Your credentials have been securely delivered by the automated system.</p>
                </div>
                <div class="input-group">
                    <label>Email / ID</label>
                    <input type="text" value="${o.credentials.email}" readonly style="background:#000; letter-spacing:1px; text-align:center;">
                </div>
                <div class="input-group mb-0">
                    <label>Password</label>
                    <input type="text" value="${o.credentials.pass}" readonly style="background:#000; letter-spacing:1px; text-align:center;">
                </div>
            </div>
            <div style="margin-top:16px;">
                <p style="text-align:center; font-size:12px; color:var(--text-secondary);"><i class="ri-shield-check-fill" style="color:var(--success-color);"></i> Escrow payment released to seller.</p>
            </div>
        `;
        screen.appendChild(vault);
    } else {
        // Escrow Alert
        const escrowStatus = document.createElement('div');
        if (o.status === 'failed') {
             escrowStatus.innerHTML = `<div class="card mb-4" style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid var(--danger-color); padding: 12px;"><p style="font-size:12px; margin:0; color:var(--danger-color);"><i class="ri-error-warning-fill"></i> Order Failed / Cancelled. Funds refunded to buyer.</p></div>`;
        } else if (o.status === 'completed' || o.status === 'delivered') {
             escrowStatus.innerHTML = `<div class="card mb-4" style="background: rgba(34, 197, 94, 0.1); border-left: 3px solid var(--success-color); padding: 12px;"><p style="font-size:12px; margin:0; color:var(--success-color);"><i class="ri-shield-check-fill"></i> Order Complete. Funds moved to 24h Escrow Lock.</p></div>`;
        } else {
             escrowStatus.innerHTML = `<div class="card mb-4" style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; padding: 12px;"><p style="font-size:12px; margin:0; color:#3b82f6;"><i class="ri-lock-2-fill"></i> Funds are secured in Escrow during this transaction.</p></div>`;
        }
        screen.appendChild(escrowStatus);
        
        // SLA Timer visual
        if (o.status === 'pending' || o.status === 'accepted') {
            const up = Date.now() - o.createdAt - o.accumulatedPauseMs;
            const upMinutes = Math.floor(up / 60000);
            const timerHtml = o.pausedAt ? `<span style="color:var(--warning-color); font-weight:bold;">TIMER PAUSED (Waiting for OTP)</span>` : `<span style="color:#fff;">Active Uptime: ${upMinutes} mins</span>`;
            
            const timer = document.createElement('div');
            timer.innerHTML = `<div class="flex-between mb-2"><span style="font-size:12px; color:var(--text-secondary);">SLA Status:</span><span style="font-size:12px;">${timerHtml}</span></div>`;
            screen.appendChild(timer);
        }

        // OTP Controls
        if ((o.status === 'pending' || o.status === 'accepted') && state.user.phone === o.currentSellerPhone) {
            // Seller view
            if (!o.pausedAt) {
                 const otpBox = document.createElement('div');
                 otpBox.innerHTML = `
                     <div class="card mb-4" style="border:1px dashed var(--warning-color); padding:12px;">
                         <p style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Need buyer to provide OTP to pause timer?</p>
                         <button class="btn btn-secondary" style="width:100%; font-size:13px; padding:8px; border-color:var(--warning-color); color:var(--warning-color);" onclick="requestOTP()" ${o.otpRequests >= 3 ? 'disabled' : ''}>Request OTP (Used ${o.otpRequests}/3)</button>
                     </div>
                 `;
                 screen.appendChild(otpBox);
            }
        } else if ((o.status === 'pending' || o.status === 'accepted') && state.user.phone === o.buyerPhone) {
            // Buyer view
            if (o.pausedAt) {
                 const otpBox = document.createElement('div');
                 otpBox.innerHTML = `
                     <div class="card mb-4" style="border:1px dashed var(--warning-color); padding:12px; background:rgba(245, 158, 11, 0.1);">
                         <p style="font-size:12px; color:var(--warning-color); margin-bottom:8px;"><i class="ri-alert-fill"></i> Seller requested OTP to verify account.</p>
                         <div class="flex-between gap-2">
                             <input type="text" id="buyer-otp-input" placeholder="Enter OTP" style="flex:1; padding:8px; background:rgba(0,0,0,0.5); border:1px solid var(--border-color); color:#fff; border-radius:var(--radius-sm); outline:none;">
                             <button class="btn" style="padding:8px 16px; font-size:13px;" onclick="submitOTP()">Submit</button>
                         </div>
                     </div>
                 `;
                 screen.appendChild(otpBox);
            }
        }

        // Chat Flow
        const chatContainer = document.createElement('div');
        chatContainer.className = 'chat-container';
        chatContainer.style.height = '300px'; // Shorter since we added panels
        
        o.chat.forEach(msg => {
            const b = document.createElement('div');
            if (msg.sys) {
                b.className = 'chat-bubble chat-sys';
            } else if (msg.author === state.user.name) {
                b.className = 'chat-bubble chat-user';
            } else {
                b.className = 'chat-bubble chat-seller';
            }
            b.textContent = msg.text;
            chatContainer.appendChild(b);
        });
        
        const inputBar = document.createElement('div');
        inputBar.className = 'chat-input-bar';
        if (o.status === 'completed' || o.status === 'delivered' || o.status === 'failed') {
            inputBar.innerHTML = `<input type="text" placeholder="Chat is closed." disabled style="opacity:0.5;"><button disabled style="opacity:0.5;"><i class="ri-send-plane-fill"></i></button>`;
        } else {
            inputBar.innerHTML = `
                <input type="text" id="chat-compose" placeholder="Message...">
                <button onclick="sendChatMessage()"><i class="ri-send-plane-fill"></i></button>
            `;
        }
        
        // Accept/Complete Action Buttons for Seller
        if (state.user.phone === o.currentSellerPhone) {
             const actionBox = document.createElement('div');
             actionBox.className = 'flex-center gap-2 mt-4';
             if (o.status === 'pending') {
                 actionBox.innerHTML = `<button class="btn" style="width:100%;" onclick="sellerAcceptOrder()">Accept Order</button>`;
             } else if (o.status === 'accepted') {
                 actionBox.innerHTML = `<button class="btn" style="width:100%; background:var(--success-color);" onclick="sellerCompleteOrder()">Mark Completed & Deliver</button>`;
             }
             screen.appendChild(actionBox);
        }
        
        screen.appendChild(chatContainer);
        screen.appendChild(inputBar);
        
        setTimeout(() => chatContainer.scrollTop = chatContainer.scrollHeight, 10);
    }
    
    root.appendChild(screen);
};

window.requestOTP = function() {
    const o = window.activeOrder;
    if(o && o.otpRequests < 3) {
        o.pausedAt = Date.now();
        o.otpRequests++;
        o.chat.push({sys:true, text:`System: Seller requested an OTP. SLA timer paused. (${o.otpRequests}/3 requests used)`});
        localStorage.setItem('trivenOrders', JSON.stringify(state.orders));
        renderOrderFlow();
    }
};

window.submitOTP = function() {
    const o = window.activeOrder;
    const val = document.getElementById('buyer-otp-input').value;
    if(o && val && o.pausedAt) {
        const pauseDuration = Date.now() - o.pausedAt;
        o.accumulatedPauseMs += pauseDuration;
        o.pausedAt = null;
        o.chat.push({sys:false, author: state.user.name, text:`Provided OTP: ${val}`});
        o.chat.push({sys:true, text:`System: Buyer provided OTP. SLA timer unpaused.`});
        localStorage.setItem('trivenOrders', JSON.stringify(state.orders));
        renderOrderFlow();
    }
};

window.sellerAcceptOrder = function() {
    const o = window.activeOrder;
    if(o) {
        o.status = 'accepted';
        o.chat.push({sys:true, text:`System: Seller accepted the order. (30 Min Delivery limit started)`});
        localStorage.setItem('trivenOrders', JSON.stringify(state.orders));
        renderOrderFlow();
    }
};

window.sellerCompleteOrder = function() {
    const o = window.activeOrder;
    if(o) {
        o.status = 'completed';
        o.deliveredAt = Date.now();
        o.chat.push({sys:true, text:`System: Order completed. Escrow funds releasing in 24h.`});
        
        // 1. Process Seller Payout (Original Price - Platform Fee)
        const payoutAmount = o.price - (o.feeAmount || 0);
        const sIndex = usersDB.findIndex(u => u.phone === o.currentSellerPhone);
        if (sIndex > -1) {
            usersDB[sIndex].completedOrders += 1;
            if(!usersDB[sIndex].lockedEscrow) usersDB[sIndex].lockedEscrow = [];
            usersDB[sIndex].lockedEscrow.push({
                amount: payoutAmount,
                unlockAt: Date.now() + 86400000 
            });
            
            if (state.user.phone === usersDB[sIndex].phone) {
                state.user.completedOrders += 1;
                state.user.lockedEscrow = usersDB[sIndex].lockedEscrow;
                localStorage.setItem('trivenSession', JSON.stringify(state.user));
            }
        }

        // 2. Process Buyer Release & Cashback
        const bIndex = usersDB.findIndex(u => u.phone === o.buyerPhone);
        if (bIndex > -1) {
            usersDB[bIndex].holdBalance -= o.price;
            usersDB[bIndex].cashbackBalance = (usersDB[bIndex].cashbackBalance || 0) + (o.cashbackAmount || 0);
            
            if (state.user.phone === usersDB[bIndex].phone) {
                state.user.holdBalance -= o.price;
                state.user.cashbackBalance = usersDB[bIndex].cashbackBalance;
                localStorage.setItem('trivenSession', JSON.stringify(state.user));
            }
        }
        
        localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
        localStorage.setItem('trivenOrders', JSON.stringify(state.orders));
        
        showNotification('Order Completed', `Payout of $${payoutAmount.toFixed(2)} scheduled.`, 'success');
        renderOrderFlow();
    }
};

window.sendChatMessage = function() {
    const input = document.getElementById('chat-compose');
    const text = input.value.trim();
    if(text === '') return;
    
    window.activeOrder.chat.push({
        sys: false,
        author: state.user.name,
        text: text
    });
    
    localStorage.setItem('trivenOrders', JSON.stringify(state.orders));
    renderOrderFlow();
};

window.cancelOrder = function() {
    window.activeOrder = null;
    state.activeTab = 'home';
    updateNavUI();
    renderMainApp();
};
window.openOrder = function(id) {
    const o = state.orders.find(o => o.id === id);
    if(o) {
        window.activeOrder = o;
        state.activeTab = 'order-flow';
        updateNavUI();
        renderOrderFlow();
    }
};

function renderOrders() {
    root.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'screen';
    
    const canSell = state.user && (state.user.role === 'reseller' || state.user.role === 'admin');
    if (canSell) {
        // Seller Dashboard
        const activeSellerOrders = state.orders.filter(o => o.seller === state.user.name).slice(0, 3);
        
        let ordersHtml = activeSellerOrders.length === 0 ? '<p class="text-center mt-4 mb-4" style="color:var(--text-secondary)">No incoming orders.</p>' : activeSellerOrders.map(o => `
            <div class="card mb-4" style="border: 1px solid var(--primary-color); cursor:pointer;" onclick="openOrder(${o.id})">
                <div class="flex-between mb-2">
                    <span style="font-size: 14px; font-weight: 600; color: #fff;">${o.name}</span>
                    <span style="font-size: 15px; font-weight: 700; color: var(--success-color);">$${o.price.toFixed(2)}</span>
                </div>
                <p style="font-size: 13px; margin-bottom: 0;">Buyer: <span style="color: var(--primary-color);">${o.buyer}</span></p>
                <div class="flex-center gap-4 mt-2" style="border-top: 1px solid var(--border-color); padding-top: 12px; justify-content:space-between;">
                    <span class="badge ${o.status === 'delivered' || o.status === 'completed' ? 'badge-success' : 'badge-warning'}">${o.status}</span>
                    <span style="font-size: 13px; color: var(--primary-color);">Open Thread <i class="ri-arrow-right-line"></i></span>
                </div>
            </div>
        `).join('');
        
        const globalPoolOrders = state.orders.filter(o => o.status === 'in_global_pool');
        const globalHtml = globalPoolOrders.length === 0 ? '' : `
            <div class="card mb-6" style="border: 1px solid var(--warning-color); background: rgba(245, 158, 11, 0.05);">
                <h3 style="color:var(--warning-color); font-size:14px; margin-bottom:12px;"><i class="ri-global-line"></i> Global Pool (Unclaimed Orders)</h3>
                ${globalPoolOrders.map(o => `
                    <div class="flex-between mb-2 pb-2" style="border-bottom: 1px solid rgba(245, 158, 11, 0.2);">
                        <div>
                            <span style="font-size: 14px; font-weight: 600; color: #fff;">${o.name}</span>
                            <p style="font-size: 11px; color: var(--text-secondary); margin:0;">Buyer: ${o.buyer}</p>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size: 15px; font-weight: 700; color: var(--success-color); display:block;">$${o.price.toFixed(2)}</span>
                            <button class="btn btn-secondary" style="padding: 4px 12px; font-size:11px; margin-top:4px; border-color:var(--warning-color); color:var(--warning-color);" onclick="claimGlobalOrder(${o.id})">Claim Order</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        let requestsHtml = state.requests.length === 0 ? '<p class="text-center mt-4" style="color:var(--text-secondary)">No active requests.</p>' : state.requests.map(r => `
            <div class="card mb-4" style="border-left: 3px solid var(--warning-color);">
                <div class="flex-between mb-2">
                    <h3 style="font-size: 14px; color: #fff;">${r.name} (${r.duration})<br><span style="font-size: 12px; color: var(--success-color)">$${r.budget.toFixed(2)} Goal</span></h3>
                    <span class="badge badge-warning">${r.status}</span>
                </div>
                <p style="font-size: 12px; margin-bottom: 12px; color: var(--text-secondary);">Requested by: ${r.requester}</p>
                <div class="input-group" style="margin-bottom:0; display:flex; flex-direction:row; gap:8px;">
                    <input type="number" placeholder="Offer $" style="flex:1; padding:10px; height: 42px; border-radius: var(--radius-sm); font-size: 14px;">
                    <button class="btn btn-primary" style="flex:1; padding:10px; height: 42px; border-radius: var(--radius-sm);" onclick="alert('Offer submitted directly to buyer!')">Fulfill</button>
                </div>
            </div>
        `).join('');

        screen.innerHTML = `
            <div class="flex-between mb-4 mt-2">
                <h2>Seller Dashboard</h2>
                <span class="badge badge-success">Active</span>
            </div>
            
            <h3 style="font-size: 15px; margin-bottom: 12px; color: var(--text-secondary);">Incoming Orders (Max 3 visible)</h3>
            <div class="product-feed">
                ${ordersHtml}
            </div>
            
            ${globalHtml}
            
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 24px 0;">
            
            <div class="flex-between mb-4">
                <h2>Global Request Market</h2>
            </div>
            ${requestsHtml}
        `;
    } else {
        // Normal User Orders
        const myOrders = state.orders.filter(o => o.buyer === state.user.name);
        
        screen.innerHTML = `
            <div class="flex-between mb-4 mt-2">
                <h2>My Orders</h2>
            </div>
            ${myOrders.length === 0 ? `
            <div class="card p-6" style="text-align: center; padding: 40px 20px;">
                <i class="ri-shopping-basket-line" style="font-size: 48px; color: var(--border-color); margin-bottom: 16px; display: block;"></i>
                <p>No recent orders found.</p>
                <button class="btn btn-secondary mt-4" onclick="state.activeTab='home'; renderMainApp(); return false;">Browse Marketplace</button>
            </div>
            ` : myOrders.map(o => `
                <div class="card mb-4" style="border: 1px solid var(--primary-color); cursor:pointer;" onclick="openOrder(${o.id})">
                    <div class="flex-between mb-2">
                        <span style="font-size: 14px; font-weight: 600; color: #fff;">${o.name}</span>
                        <span style="font-size: 15px; font-weight: 700; color: var(--success-color);">$${o.price.toFixed(2)}</span>
                    </div>
                    <p style="font-size: 13px; margin-bottom: 8px;">Seller: <span style="color: var(--primary-color);">${o.seller}</span></p>
                    <span class="badge ${o.status === 'delivered' || o.status === 'completed' ? 'badge-success' : 'badge-warning'}">${o.status}</span>
                </div>
            `).join('')}
        `;
    }
    
    root.appendChild(screen);
}

window.claimGlobalOrder = function(id) {
    const oIndex = state.orders.findIndex(o => o.id === id);
    if(oIndex > -1) {
        const now = Date.now();
        state.orders[oIndex].status = 'accepted';
        state.orders[oIndex].currentSellerPhone = state.user.phone;
        state.orders[oIndex].seller = state.user.name;
        
        // Reset SLA logic for the new seller
        state.orders[oIndex].claimedAt = now;
        state.orders[oIndex].accumulatedPauseMs = now - state.orders[oIndex].createdAt; // "Freeze" the time spent in pool
        
        state.orders[oIndex].chat.push({sys:true, text:`System: ${state.user.name} has claimed this order from the Global Pool. Secure Chat resumed.`});
        localStorage.setItem('trivenOrders', JSON.stringify(state.orders));
        renderOrders();
    }
};

function renderWallet() {
    root.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'screen';
    
    const balance = state.user.balance || 0;
    const cashback = state.user.cashbackBalance || 0;
    const hold = state.user.holdBalance || 0;
    const earnings = state.user.earnings || 0;
    const deposits = state.user.deposits || 0;
    const lockedItems = state.user.lockedEscrow || [];

    screen.innerHTML = `
        <div class="flex-between mb-4 mt-2">
            <h2>My Wallet</h2>
            <i class="ri-history-line" style="font-size: 20px; color: var(--text-muted); cursor:pointer;"></i>
        </div>
        
        <div class="card mb-6" style="padding: 24px; background: var(--surface-color); position: relative; overflow: hidden;">
            <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: var(--primary-color); opacity: 0.05; border-radius: 50%;"></div>
            
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 4px;">Main Balance (Withdrawable)</p>
            <h1 style="font-size: 36px; color: #fff; margin-bottom: 16px;">$${balance.toFixed(2)}</h1>
            
            <div style="padding: 12px; background: rgba(99, 102, 241, 0.1); border-radius: var(--radius-md); border: 1px solid rgba(99, 102, 241, 0.2); margin-bottom: 20px;">
                <div class="flex-between">
                    <div>
                        <p style="color: var(--primary-color); font-size: 11px; font-weight: 700; text-transform: uppercase;">Cashback Asset</p>
                        <h3 style="color: #fff; margin: 0;">$${cashback.toFixed(2)}</h3>
                    </div>
                    <i class="ri-gift-2-line" style="font-size: 24px; color: var(--primary-color); opacity: 0.5;"></i>
                </div>
                <p style="font-size: 10px; color: var(--text-muted); margin-top: 6px;">* Non-withdrawable. Internal use only.</p>
            </div>

            <div class="flex-center gap-3">
                <button class="btn" style="flex: 1;" onclick="openDepositModal()"><i class="ri-add-line"></i> Deposit</button>
                <button class="btn btn-secondary" style="flex: 1;" onclick="openWithdrawModal()"><i class="ri-external-link-line"></i> Withdraw</button>
            </div>
        </div>

        <div class="grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:24px;">
            <div class="card" style="padding:16px;">
                <p style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">Revenue</p>
                <h4 style="color:var(--success-color);">$${earnings.toFixed(2)}</h4>
            </div>
            <div class="card" style="padding:16px;">
                <p style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">Deposits</p>
                <h4 style="color:#fff;">$${deposits.toFixed(2)}</h4>
            </div>
        </div>

        ${lockedItems.length > 0 ? `
            <h3 style="font-size: 15px; margin-bottom: 12px; color: #fff;">Pending Releases (24h)</h3>
            ${lockedItems.map(item => {
                const remaining = Math.max(0, Math.ceil((item.unlockAt - Date.now()) / 3600000));
                return `
                    <div class="escrow-item">
                        <span>Release in ~${remaining}h</span>
                        <span>+$${item.amount.toFixed(2)}</span>
                    </div>
                `;
            }).join('')}
        ` : ''}
    `;
    root.appendChild(screen);
}

window.openDepositModal = function() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'deposit-modal';
    overlay.innerHTML = `
        <div class="modal-sheet">
            <h3>Add Money to Wallet</h3>
            <div class="input-group">
                <label>Amount ($)</label>
                <input type="number" id="deposit-amount" placeholder="0.00" style="padding:16px; background:rgba(0,0,0,0.5); border:1px solid var(--border-color); color:#fff; border-radius:var(--radius-md); font-size:18px;">
            </div>
            <div class="flex-center gap-2 mt-4">
                <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('deposit-modal').remove()">Cancel</button>
                <button class="btn" style="flex:1;" onclick="processDeposit()">Confirm</button>
            </div>
            <p style="text-align:center; font-size:11px; color:var(--text-secondary); margin-top:20px;">Support for UPI, Crypto and Cards active.</p>
        </div>
    `;
    document.getElementById('app-container').appendChild(overlay);
};

window.processDeposit = function() {
    const amt = parseFloat(document.getElementById('deposit-amount').value);
    if (!amt || amt <= 0) return alert('Enter a valid amount');
    
    state.user.balance += amt;
    state.user.deposits += amt;
    localStorage.setItem('trivenSession', JSON.stringify(state.user));
    
    const uIndex = usersDB.findIndex(u => u.phone === state.user.phone);
    if (uIndex > -1) {
        usersDB[uIndex].balance += amt;
        usersDB[uIndex].deposits += amt;
        localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
    }
    
    document.getElementById('deposit-modal').remove();
    showNotification('Deposit Successful', `$${amt.toFixed(2)} added to your wallet.`, 'success');
    renderWallet();
};

window.openWithdrawModal = function() {
    const withdrawable = state.user.balance || 0;
    if (withdrawable <= 0) {
        showNotification('No Balance', 'You have no withdrawable balance.', 'error');
        return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'withdraw-modal';
    overlay.innerHTML = `
        <div class="modal-content">
            <i class="ri-external-link-line" style="font-size:40px; color:var(--primary-color); margin-bottom:12px;"></i>
            <h3 style="margin-bottom:8px;">Withdraw Funds</h3>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:20px;">Available: <b style="color:#fff;">$${withdrawable.toFixed(2)}</b><br>Cashback is not withdrawable.</p>
            <div class="input-group" style="text-align:left;">
                <label>Amount ($)</label>
                <input type="number" id="withdraw-amount" placeholder="0.00" max="${withdrawable}" step="0.01"
                    style="padding:14px; background:rgba(0,0,0,0.5); border:1px solid var(--border-color); color:#fff; border-radius:var(--radius-md); font-size:18px; outline:none; width:100%;">
            </div>
            <div class="flex-center gap-2 mt-4">
                <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('withdraw-modal').remove()">Cancel</button>
                <button class="btn" style="flex:1;" onclick="processWithdraw()">Request</button>
            </div>
            <p style="text-align:center; font-size:11px; color:var(--text-muted); margin-top:16px;">Admin will process within 24h.</p>
        </div>
    `;
    document.getElementById('app-container').appendChild(overlay);
};

window.processWithdraw = function() {
    const amt = parseFloat(document.getElementById('withdraw-amount').value);
    if (!amt || amt <= 0) return showNotification('Error', 'Enter a valid amount.', 'error');
    if (amt > (state.user.balance || 0)) return showNotification('Error', 'Amount exceeds withdrawable balance.', 'error');

    // Deduct and log the request (in a real system this would hit a backend)
    state.user.balance -= amt;
    localStorage.setItem('trivenSession', JSON.stringify(state.user));
    const uIndex = usersDB.findIndex(u => u.phone === state.user.phone);
    if (uIndex > -1) {
        usersDB[uIndex].balance -= amt;
        localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
    }
    document.getElementById('withdraw-modal').remove();
    showNotification('Withdrawal Requested', `$${amt.toFixed(2)} withdrawal submitted for admin review.`, 'success');
    renderWallet();
};

// Admin: change user role
window.adminSetRole = function(phone, newRole) {
    confirmAction(`Set Role: ${newRole}`, `Change role to "${newRole}" for this user?`, () => {
        const i = usersDB.findIndex(u => u.phone === phone);
        if (i > -1) {
            usersDB[i].role = newRole;
            usersDB[i].roleStatus = 'active';
            if (newRole === 'reseller' && (!usersDB[i].inviteCodes || usersDB[i].inviteCodes.length === 0)) {
                usersDB[i].inviteCodes = [
                    Math.random().toString(36).substring(2,8).toUpperCase(),
                    Math.random().toString(36).substring(2,8).toUpperCase(),
                    Math.random().toString(36).substring(2,8).toUpperCase()
                ];
            }
            localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
            showNotification('Role Updated', `User is now a ${newRole}.`, 'success');
            window.renderAdmin();
        }
    });
};


function renderProfile() {
    root.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'screen';
    
    const adminButtonHtml = state.user.role === 'admin' ? `
        <div class="card mb-4" style="padding: 4px; border: 1px solid var(--danger-color); background: rgba(239, 68, 68, 0.05);">
            <div class="flex-between" style="padding: 16px; cursor: pointer;" onclick="renderAdmin()">
                <div class="flex-center gap-2">
                    <i class="ri-admin-line" style="font-size: 20px; color: var(--danger-color);"></i>
                    <span style="font-size: 15px; font-weight: 500; color: #fff;">Admin Panel</span>
                </div>
                <i class="ri-arrow-right-s-line" style="color: var(--text-secondary); font-size: 20px;"></i>
            </div>
        </div>
    ` : '';

    const roleColors = { 'admin': 'var(--danger-color)', 'reseller': 'var(--primary-color)', 'customer': 'var(--success-color)' };
    const roleColor = roleColors[state.user.role] || 'var(--text-secondary)';
    
    let badgeHtml = '';
    const orders = state.user.completedOrders;
    if (orders >= 500) badgeHtml = '<span class="badge" style="margin-bottom: 24px; display: inline-block; background: rgba(234, 179, 8, 0.2); color: #eab308; border: 1px solid #eab308;"><i class="ri-medal-fill"></i> Gold Seller</span>';
    else if (orders >= 100) badgeHtml = '<span class="badge" style="margin-bottom: 24px; display: inline-block; background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid #94a3b8;"><i class="ri-medal-line"></i> Silver Seller</span>';
    else if (orders >= 10) badgeHtml = '<span class="badge" style="margin-bottom: 24px; display: inline-block; background: rgba(180, 83, 9, 0.2); color: #b45309; border: 1px solid #b45309;"><i class="ri-medal-line"></i> Bronze Seller</span>';
    else badgeHtml = `<span class="badge" style="margin-bottom: 24px; display: inline-block; background: transparent; border: 1px solid ${roleColor}; color: ${roleColor}; text-transform: uppercase; letter-spacing: 1px;">Role: ${state.user.role}</span>`;

    screen.innerHTML = `
        <div class="flex-between mb-6 mt-2">
            <h2>Profile</h2>
            <button class="btn btn-secondary" style="padding: 6px 12px; width: auto; font-size: 13px; border:none; color:var(--danger-color);" onclick="logout()">Logout</button>
        </div>
        
        <div class="card text-center mb-6" style="padding: 24px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-color), #a855f7); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #fff;">
                <i class="ri-user-smile-fill"></i>
            </div>
            <h2 style="margin-bottom: 4px;">${state.user.name}</h2>
            <p style="margin-bottom: 8px; font-family: monospace; color: var(--text-secondary);">${state.user.phone}</p>
            ${badgeHtml}
            
            <div class="flex-center gap-4" style="background: rgba(255,255,255,0.05); padding: 16px 12px; border-radius: var(--radius-md);">
                <div>
                    <h3 style="color: var(--warning-color); font-size: 18px;">${state.user.rating || '5.0'}★</h3>
                    <p style="font-size: 11px; margin-top:4px;">Rating</p>
                </div>
                <div style="width: 1px; height: 30px; background: var(--border-color);"></div>
                <div>
                    <h3 style="color: ${state.user.trustScore < 50 ? 'var(--danger-color)' : '#fff'}; font-size: 18px;">${state.user.trustScore ?? 100}%</h3>
                    <p style="font-size: 11px; margin-top:4px;">Trust Score</p>
                </div>
                <div style="width: 1px; height: 30px; background: var(--border-color);"></div>
                <div>
                    <h3 style="color: #fff; font-size: 18px;">${state.user.completedOrders}</h3>
                    <p style="font-size: 11px; margin-top:4px;">Orders</p>
                </div>
            </div>
            
            ${state.user.role === 'reseller' && state.user.inviteCodes && state.user.inviteCodes.length > 0 ? `
            <div style="margin-top:20px; text-align:left; background: rgba(0,0,0,0.3); padding: 12px; border-radius: var(--radius-sm);">
                <p style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Your Invite Codes (Share to grow the network):</p>
                <div class="flex-center gap-2" style="justify-content:flex-start;">
                    ${state.user.inviteCodes.map(c => `<span style="background:var(--primary-color); padding:4px 8px; border-radius:4px; font-family:monospace; font-size:13px;">${c}</span>`).join('')}
                </div>
            </div>
            ` : ''}
        </div>
        
        ${(state.user.role === 'reseller' || state.user.role === 'admin') ? `
        <div class="card mb-4" style="padding: 4px;">
            <div class="flex-between" style="padding: 16px;">
                <div class="flex-center gap-2">
                    <i class="ri-broadcast-line" style="font-size: 20px; color: ${state.user.isOnline ? 'var(--success-color)' : 'var(--text-secondary)'};"></i>
                    <span style="font-size: 15px; font-weight: 500; color: #fff;">Online Status (Receive Orders)</span>
                </div>
                <label style="position: relative; display: inline-block; width: 50px; height: 28px;">
                    <input type="checkbox" ${state.user.isOnline ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;" onchange="toggleOnlineStatus(this.checked)">
                    <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${state.user.isOnline ? 'var(--success-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 34px;">
                        <span style="position: absolute; content: ''; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; transform: ${state.user.isOnline ? 'translateX(22px)' : 'translateX(0)'};"></span>
                    </span>
                </label>
            </div>
        </div>
        ` : ''}
        
        ${adminButtonHtml}
    `;
    
    root.appendChild(screen);
}

window.toggleOnlineStatus = function(checked) {
    state.user.isOnline = checked;
    localStorage.setItem('trivenSession', JSON.stringify(state.user));
    
    const uIndex = usersDB.findIndex(u => u.phone === state.user.phone);
    if(uIndex > -1) {
        usersDB[uIndex].isOnline = checked;
        localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
    }
    
    if (checked) {
        const myPending = state.notifications.filter(n => n.sellerPhone === state.user.phone && n.status === 'pending');
        if (myPending.length > 0) {
            showNotification('Buyer Alert', `${myPending.length} buyer(s) are waiting for you to come online!`, 'info');
        }
    }
    
    renderProfile();
};

window.logout = function() {
    state.user = null;
    state.activeTab = 'home';
    localStorage.removeItem('trivenSession');
    init();
};

// =============================================
// GOD MODE — ADMIN PANEL
// =============================================

window.adminTab = window.adminTab || 'analytics';

window.renderAdmin = function() {
    if (state.user?.role !== 'admin') {
        root.innerHTML = '';
        const screen = document.createElement('div');
        screen.className = 'screen flex-center';
        screen.style.flexDirection = 'column';
        screen.style.padding = '32px';
        screen.innerHTML = `
            <i class="ri-error-warning-fill" style="font-size:64px; color:var(--danger-color); margin-bottom:16px;"></i>
            <h2 style="color:var(--danger-color); margin-bottom:8px;">Access Denied</h2>
            <p style="color:var(--text-secondary); text-align:center; margin-bottom:24px;">God Mode requires Administrator credentials.</p>
            <button class="btn btn-secondary" onclick="state.activeTab='profile'; renderMainApp()">Go Back</button>
        `;
        root.appendChild(screen);
        return;
    }

    root.innerHTML = '';
    bottomNav.classList.add('hidden');

    const screen = document.createElement('div');
    screen.className = 'screen';
    screen.style.paddingBottom = '40px';

    // --- Header ---
    const header = document.createElement('div');
    header.className = 'flex-between mb-6 mt-4';
    header.innerHTML = `
        <div class="flex-center gap-3">
            <button class="btn btn-secondary" style="width:38px;height:38px;padding:0;border-radius:50%;" onclick="closeAdmin()">
                <i class="ri-arrow-left-line"></i>
            </button>
            <div>
                <h2 style="margin:0;font-size:20px;">God Mode</h2>
                <p style="margin:0;font-size:11px;color:var(--text-muted);">Triven Hub Control Center</p>
            </div>
        </div>
        <span class="badge" style="background:rgba(239,68,68,0.15);color:var(--danger-color);border:1px solid var(--danger-color);font-size:10px;letter-spacing:1px;">ROOT ACCESS</span>
    `;

    // --- Tab Bar ---
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:4px;background:var(--surface-color);padding:4px;border-radius:var(--radius-md);border:1px solid var(--border-color);margin-bottom:24px;';
    const tabs = [
        { key: 'analytics', label: 'Stats', icon: 'ri-bar-chart-line' },
        { key: 'users',     label: 'Users', icon: 'ri-team-line' },
        { key: 'orders',    label: 'Orders', icon: 'ri-list-check' },
        { key: 'settings',  label: 'Rules', icon: 'ri-settings-3-line' }
    ];
    tabs.forEach(t => {
        const btn = document.createElement('button');
        btn.style.cssText = 'flex:1;padding:8px 4px;font-size:11px;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;';
        btn.className = t.key === window.adminTab ? 'btn' : 'btn btn-secondary';
        btn.style.background = t.key === window.adminTab ? 'var(--primary-gradient)' : 'transparent';
        btn.style.color = t.key === window.adminTab ? '#fff' : 'var(--text-muted)';
        btn.innerHTML = `<i class="${t.icon}" style="font-size:13px;"></i>${t.label}`;
        btn.onclick = () => { window.adminTab = t.key; window.renderAdmin(); };
        tabBar.appendChild(btn);
    });

    // --- Tab Content ---
    const content = document.createElement('div');

    if (window.adminTab === 'analytics') {
        const totalRev   = state.orders.reduce((a, o) => a + (o.status === 'completed' ? o.price : 0), 0);
        const totalFees  = state.orders.reduce((a, o) => a + (o.status === 'completed' ? (o.feeAmount || 0) : 0), 0);
        const pending    = usersDB.filter(u => u.roleStatus === 'pending').length;

        content.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
                <div class="card" style="padding:16px;border-left:3px solid var(--primary-color);">
                    <p style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Users</p>
                    <h2 style="margin:4px 0;color:#fff;">${usersDB.length}</h2>
                </div>
                <div class="card" style="padding:16px;border-left:3px solid var(--success-color);">
                    <p style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Online Now</p>
                    <h2 style="margin:4px 0;color:#fff;">${usersDB.filter(u => u.isOnline).length}</h2>
                </div>
                <div class="card" style="padding:16px;border-left:3px solid var(--warning-color);">
                    <p style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Platform Fees</p>
                    <h2 style="margin:4px 0;color:var(--warning-color);">$${totalFees.toFixed(2)}</h2>
                </div>
                <div class="card" style="padding:16px;border-left:3px solid #a855f7;">
                    <p style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">GMV</p>
                    <h2 style="margin:4px 0;color:#a855f7;">$${totalRev.toFixed(0)}</h2>
                </div>
            </div>

            <h3 style="font-size:13px;color:var(--warning-color);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <i class="ri-user-follow-line"></i> Pending Reseller Approvals ${pending > 0 ? `<span class="badge badge-danger" style="padding:2px 7px;">${pending}</span>` : ''}
            </h3>
            <div class="card mb-6">
                ${usersDB.filter(u => u.roleStatus === 'pending').length === 0
                    ? '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px 0;">No pending approvals.</p>'
                    : usersDB.filter(u => u.roleStatus === 'pending').map(u => `
                        <div class="flex-between mb-3 pb-3" style="border-bottom:1px solid var(--border-color);">
                            <div>
                                <h4 style="margin:0;font-size:14px;">${u.name}</h4>
                                <p style="margin:0;font-size:11px;color:var(--text-muted);">${u.phone}</p>
                            </div>
                            <div class="flex-center gap-2">
                                <button class="btn" style="padding:6px 12px;width:auto;font-size:12px;" onclick="approveReseller('${u.phone}')">
                                    <i class="ri-check-line"></i> Approve
                                </button>
                                <button class="btn btn-secondary" style="padding:6px 12px;width:auto;font-size:12px;border-color:var(--danger-color);color:var(--danger-color);" onclick="rejectReseller('${u.phone}')">
                                    Reject
                                </button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>

            <h3 style="font-size:13px;color:#fff;margin-bottom:12px;">Live Activity</h3>
            <div class="card">
                ${state.orders.slice(0,5).map(o => `
                    <div class="flex-between py-2" style="border-bottom:1px solid var(--border-color);">
                        <span style="font-size:12px;color:#fff;">${o.name}</span>
                        <span class="badge" style="font-size:9px;">${o.status.replace(/_/g,' ')}</span>
                    </div>
                `).join('')}
                ${state.orders.length === 0 ? '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px 0;">No orders yet.</p>' : ''}
            </div>
        `;

    } else if (window.adminTab === 'users') {
        window.adminUserSearch = window.adminUserSearch || '';
        const term = window.adminUserSearch.toLowerCase();
        const filtered = usersDB.filter(u =>
            u.phone.includes(term) || u.name.toLowerCase().includes(term)
        ).slice(0, 12);

        content.innerHTML = `
            <div class="search-bar mb-4" style="margin-bottom:16px;">
                <i class="ri-search-line"></i>
                <input type="text" placeholder="Search name or phone..." value="${window.adminUserSearch}" 
                    oninput="window.adminUserSearch=this.value; window.renderAdmin();" style="font-size:13px;">
            </div>

            ${filtered.map(u => {
                const roleColor = u.role === 'admin' ? 'var(--danger-color)' : u.role === 'vendor' ? '#a855f7' : u.role === 'reseller' ? 'var(--primary-color)' : 'var(--success-color)';
                return `
                <div class="card mb-3" style="padding:16px; border-left:3px solid ${u.frozenWallet ? 'var(--danger-color)' : roleColor};">
                    <div class="flex-between mb-2">
                        <div>
                            <h4 style="margin:0;font-size:14px;">${u.name} ${u.frozenWallet ? '<i class="ri-lock-fill" style="color:var(--danger-color);font-size:12px;"></i>' : ''}</h4>
                            <p style="margin:0;font-size:11px;color:var(--text-muted);">${u.phone} &bull; <span style="color:${roleColor};text-transform:capitalize;">${u.role}</span></p>
                        </div>
                        <div style="text-align:right;">
                            <span class="badge" style="font-size:9px;background:${u.frozenWallet ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.1)'};color:${u.frozenWallet ? 'var(--danger-color)' : 'var(--success-color)'};">${u.frozenWallet ? 'FROZEN' : 'ACTIVE'}</span>
                        </div>
                    </div>
                    <div class="flex-between mb-3" style="font-size:11px;color:var(--text-muted);">
                        <span>Trust: <b style="color:#fff;">${u.trustScore}%</b></span>
                        <span>Balance: <b style="color:#fff;">$${(u.balance||0).toFixed(2)}</b></span>
                        <span>Orders: <b style="color:#fff;">${u.completedOrders}</b></span>
                    </div>
                    <div class="flex-center gap-2">
                        ${u.role !== 'admin' ? `
                            ${u.frozenWallet 
                                ? `<button class="btn btn-secondary" style="flex:1;padding:6px;font-size:10px;border-color:var(--success-color);color:var(--success-color);" 
                                    onclick="confirmAction('Unfreeze Wallet', 'Restore wallet access for ${u.name}?', () => { 
                                        const i=usersDB.findIndex(x=>x.phone==='${u.phone}'); 
                                        usersDB[i].frozenWallet=false; 
                                        localStorage.setItem('trivenUsers',JSON.stringify(usersDB)); 
                                        window.renderAdmin(); 
                                    })"><i class="ri-lock-unlock-line"></i> Unfreeze</button>`
                                : `<button class="btn btn-secondary" style="flex:1;padding:6px;font-size:10px;border-color:var(--danger-color);color:var(--danger-color);" 
                                    onclick="confirmAction('Freeze Wallet', 'Freeze wallet and restrict access for ${u.name}?', () => { 
                                        const i=usersDB.findIndex(x=>x.phone==='${u.phone}'); 
                                        usersDB[i].frozenWallet=true; 
                                        localStorage.setItem('trivenUsers',JSON.stringify(usersDB)); 
                                        window.renderAdmin(); 
                                    })"><i class="ri-lock-line"></i> Freeze</button>`
                            }
                            <button class="btn btn-secondary" style="flex:1;padding:6px;font-size:10px;" 
                                onclick="confirmAction('Adjust Balance', 'Add $100 bonus to ${u.name}\\'s wallet?', () => { 
                                    const i=usersDB.findIndex(x=>x.phone==='${u.phone}'); 
                                    usersDB[i].balance+=100; 
                                    localStorage.setItem('trivenUsers',JSON.stringify(usersDB)); 
                                    window.renderAdmin(); 
                                    showNotification('Done','$100 added successfully.','success'); 
                                })"><i class="ri-money-dollar-circle-line"></i> +$100</button>
                            <button class="btn btn-secondary" style="flex:1;padding:6px;font-size:10px;border-color:var(--danger-color);color:var(--danger-color);" 
                                onclick="confirmAction('Ban & Penalize', 'Ban ${u.name} as scammer? This freezes their wallet and penalizes their inviter.', () => adminBanUser('${u.phone}'))">
                                <i class="ri-user-forbid-line"></i> Ban</button>
                        ` : '<span style="font-size:11px;color:var(--text-muted);">System Admin — Protected</span>'}
                    </div>
                </div>
                `;
            }).join('')}
            ${filtered.length === 0 ? '<p style="text-align:center;color:var(--text-muted);padding:24px 0;">No users found.</p>' : ''}
        `;

    } else if (window.adminTab === 'orders') {
        const allOrders = state.orders.slice(0, 20);
        content.innerHTML = `
            <h3 style="font-size:13px;color:#fff;margin-bottom:12px;">Global Order Feed (Last 20)</h3>
            ${allOrders.map(o => `
                <div class="card mb-3" style="padding:14px;">
                    <div class="flex-between mb-2">
                        <span style="font-size:13px;font-weight:600;color:#fff;">${o.name}</span>
                        <span class="badge" style="font-size:9px;${o.status==='completed'?'background:rgba(34,197,94,0.1);color:var(--success-color);':o.status==='failed'?'background:rgba(239,68,68,0.1);color:var(--danger-color);':'background:rgba(245,158,11,0.1);color:var(--warning-color);'}">${o.status.replace(/_/g,' ')}</span>
                    </div>
                    <div class="flex-between" style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">
                        <span>Buyer: ${o.buyerPhone}</span>
                        <span>Seller: ${o.currentSellerPhone}</span>
                        <span style="color:var(--success-color);font-weight:700;">$${o.price.toFixed(2)}</span>
                    </div>
                    <div class="flex-center gap-2">
                        <button class="btn btn-secondary" style="flex:1;padding:5px;font-size:10px;border:none;" onclick="openOrder(${o.id});bottomNav.classList.remove('hidden');">
                            <i class="ri-eye-line"></i> View Thread
                        </button>
                        <button class="btn btn-secondary" style="flex:1;padding:5px;font-size:10px;border-color:var(--danger-color);color:var(--danger-color);" 
                            onclick="confirmAction('Force Refund', 'Cancel this order and refund buyer $${o.price.toFixed(2)}?', () => adminForceRefund(${o.id}))">
                            <i class="ri-refund-2-line"></i> Refund
                        </button>
                    </div>
                </div>
            `).join('')}
            ${allOrders.length === 0 ? '<p style="text-align:center;color:var(--text-muted);padding:32px 0;">No orders in system.</p>' : ''}
        `;

    } else if (window.adminTab === 'settings') {
        content.innerHTML = `
            <div class="card" style="padding:20px;margin-bottom:16px;">
                <h3 style="font-size:14px;margin-bottom:4px;">Revenue Configuration</h3>
                <p style="font-size:11px;color:var(--text-muted);margin-bottom:20px;">Changes apply to new orders only. Hidden from buyers and sellers.</p>
                
                <div class="input-group">
                    <label style="font-size:12px;color:var(--text-muted);">Platform Fee <span style="color:var(--warning-color);">(Hidden from order parties)</span></label>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <input type="number" id="fee-input" step="0.5" min="0" max="30" value="${settings.platformFee}" 
                            style="padding:12px;background:rgba(0,0,0,0.4);border:1px solid var(--border-color);color:#fff;border-radius:var(--radius-sm);outline:none;width:100%;font-size:16px;">
                        <span style="color:var(--text-muted);font-size:18px;">%</span>
                    </div>
                </div>

                <div class="input-group">
                    <label style="font-size:12px;color:var(--text-muted);">Buyer Cashback <span style="color:var(--success-color);">(Non-withdrawable reward)</span></label>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <input type="number" id="cashback-input" step="0.1" min="0" max="20" value="${settings.cashbackRate}" 
                            style="padding:12px;background:rgba(0,0,0,0.4);border:1px solid var(--border-color);color:#fff;border-radius:var(--radius-sm);outline:none;width:100%;font-size:16px;">
                        <span style="color:var(--text-muted);font-size:18px;">%</span>
                    </div>
                </div>

                <button class="btn mt-2" onclick="saveAdminSettings()">
                    <i class="ri-save-line"></i> Save Settings
                </button>
            </div>

            <div class="card" style="padding:20px;">
                <h3 style="font-size:14px;margin-bottom:4px;color:var(--danger-color);">Danger Zone</h3>
                <p style="font-size:11px;color:var(--text-muted);margin-bottom:16px;">These actions are irreversible.</p>
                <button class="btn btn-secondary" style="width:100%;border-color:var(--danger-color);color:var(--danger-color);" 
                    onclick="confirmAction('Factory Reset', 'This will permanently erase ALL users, orders, listings, and settings. Are you absolutely sure?', () => { localStorage.clear(); location.reload(); })">
                    <i class="ri-delete-bin-line"></i> Factory Reset Database
                </button>
            </div>
        `;
    }

    screen.appendChild(header);
    screen.appendChild(tabBar);
    screen.appendChild(content);
    root.appendChild(screen);
};

// --- Admin Helper Actions ---
window.approveReseller = function(phone) {
    const i = usersDB.findIndex(u => u.phone === phone);
    if (i > -1) {
        usersDB[i].roleStatus = 'active';
        usersDB[i].inviteCodes = [
            Math.random().toString(36).substring(2,8).toUpperCase(),
            Math.random().toString(36).substring(2,8).toUpperCase(),
            Math.random().toString(36).substring(2,8).toUpperCase()
        ];
        localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
        showNotification('Approved', `${usersDB[i].name} is now an active Reseller with 3 invite codes.`, 'success');
        window.renderAdmin();
    }
};

window.rejectReseller = function(phone) {
    confirmAction('Reject Reseller', 'Remove this reseller application?', () => {
        const i = usersDB.findIndex(u => u.phone === phone);
        if (i > -1) {
            usersDB[i].roleStatus = 'rejected';
            usersDB[i].role = 'customer';
            localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
            showNotification('Rejected', 'Application rejected.', 'warning');
            window.renderAdmin();
        }
    });
};

window.adminBanUser = function(phone) {
    const i = usersDB.findIndex(u => u.phone === phone);
    if (i > -1 && !usersDB[i].frozenWallet) {
        usersDB[i].frozenWallet = true;
        usersDB[i].trustScore = 0;
        usersDB[i].strikes += 5;
        usersDB[i].scamCount = (usersDB[i].scamCount || 0) + 1;

        // Tiered Inviter Penalty
        const inviterPhone = usersDB[i].invitedBy;
        if (inviterPhone) {
            const iIdx = usersDB.findIndex(u => u.phone === inviterPhone);
            if (iIdx > -1) {
                usersDB[iIdx].inviteeScamCount = (usersDB[iIdx].inviteeScamCount || 0) + 1;
                if (usersDB[iIdx].inviteeScamCount === 1) {
                    // First scam: warning + 10% trust penalty
                    usersDB[iIdx].trustScore = Math.max(0, usersDB[iIdx].trustScore - 10);
                    showNotification('Inviter Warning', `First scam by invitee. Inviter trust reduced by 10%.`, 'warning');
                } else {
                    // Repeat scams: 50% trust + balance penalty
                    usersDB[iIdx].trustScore = Math.max(0, usersDB[iIdx].trustScore - 50);
                    const balancePenalty = (usersDB[iIdx].balance || 0) * 0.15;
                    usersDB[iIdx].balance = Math.max(0, usersDB[iIdx].balance - balancePenalty);
                    showNotification('Heavy Penalty', `Repeat invitee scam. 50% trust + 15% balance penalty applied.`, 'error');
                }
            }
        }

        localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
        showNotification('User Banned', `${usersDB[i].name} has been frozen and penalized.`, 'success');
        window.renderAdmin();
    }
};

window.adminForceRefund = function(orderId) {
    const oIndex = state.orders.findIndex(o => o.id === orderId);
    if (oIndex > -1) {
        const o = state.orders[oIndex];
        if (o.status === 'completed' || o.status === 'failed') {
            showNotification('Refund Error', 'Cannot refund an already closed order.', 'error');
            return;
        }
        o.status = 'failed';
        o.chat.push({ sys: true, text: 'System: Admin issued a force refund. Order cancelled.' });

        const bIdx = usersDB.findIndex(u => u.phone === o.buyerPhone);
        if (bIdx > -1) {
            usersDB[bIdx].holdBalance = Math.max(0, (usersDB[bIdx].holdBalance || 0) - o.price);
            usersDB[bIdx].balance += o.price;
        }
        localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
        localStorage.setItem('trivenOrders', JSON.stringify(state.orders));
        showNotification('Refund Issued', `$${o.price.toFixed(2)} returned to buyer.`, 'success');
        window.renderAdmin();
    }
};

window.saveAdminSettings = function() {
    const fee = parseFloat(document.getElementById('fee-input').value);
    const cb  = parseFloat(document.getElementById('cashback-input').value);
    if (isNaN(fee) || isNaN(cb)) return showNotification('Error', 'Invalid values.', 'error');
    settings.platformFee  = Math.min(30, Math.max(0, fee));
    settings.cashbackRate = Math.min(20, Math.max(0, cb));
    localStorage.setItem('trivenSettings', JSON.stringify(settings));
    showNotification('Settings Saved', `Fee: ${settings.platformFee}% | Cashback: ${settings.cashbackRate}%`, 'success');
};

window.scamBan = window.adminBanUser; // Alias used by SLA controller

window.closeAdmin = function() {
    bottomNav.classList.remove('hidden');
    renderProfile();
};

// =============================================
// GLOBAL SLA & ESCROW CONTROLLER
// =============================================
setInterval(() => {
    let changed = false;
    const now = Date.now();

    state.orders.forEach(o => {
        if (o.mode === 'auto') return;
        if (o.status === 'completed' || o.status === 'failed' || o.status === 'delivered') return;

        let activeUptime = now - o.createdAt - (o.accumulatedPauseMs || 0);
        if (o.pausedAt) activeUptime -= (now - o.pausedAt);

        // SLA 1: 2-minute Accept Window → Global Pool
        if (o.status === 'pending' && activeUptime > 120000) {
            o.status = 'in_global_pool';
            o.chat.push({ sys: true, text: 'System: Primary seller did not accept in 2 minutes. Order moved to Global Pool.' });
            changed = true;
        }

        // SLA 2: 30-minute Delivery Window → Global Pool
        const deliveryTime = o.claimedAt ? (now - o.claimedAt) : activeUptime;
        if (o.status === 'accepted' && deliveryTime > 1800000) {
            o.status = 'in_global_pool';
            o.chat.push({ sys: true, text: 'System: Delivery window exceeded. Order re-opened to Global Pool.' });
            changed = true;
        }

        // SLA 3: 60-minute Hard Limit → Auto Refund
        if (activeUptime > 3600000 && o.status !== 'failed') {
            o.status = 'failed';
            o.chat.push({ sys: true, text: 'System: 60-minute SLA breached. Escrow cancelled and buyer refunded.' });

            const bIdx = usersDB.findIndex(u => u.phone === o.buyerPhone);
            if (bIdx > -1) {
                usersDB[bIdx].holdBalance = Math.max(0, (usersDB[bIdx].holdBalance || 0) - o.price);
                usersDB[bIdx].balance += o.price;
                if (state.user?.phone === o.buyerPhone) {
                    state.user.holdBalance = usersDB[bIdx].holdBalance;
                    state.user.balance = usersDB[bIdx].balance;
                }
            }

            const sIdx = usersDB.findIndex(u => u.phone === o.currentSellerPhone);
            if (sIdx > -1) {
                usersDB[sIdx].trustScore = Math.max(0, (usersDB[sIdx].trustScore || 100) - 10);
                usersDB[sIdx].strikes    = (usersDB[sIdx].strikes || 0) + 1;
                if (usersDB[sIdx].strikes >= 5) adminBanUser(usersDB[sIdx].phone);
            }

            localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
            changed = true;
        }
    });

    // Escrow Release (24h lock)
    usersDB.forEach(u => {
        if (!u.lockedEscrow || u.lockedEscrow.length === 0) return;
        const before = u.lockedEscrow.length;
        u.lockedEscrow = u.lockedEscrow.filter(item => {
            if (now >= item.unlockAt) {
                u.earnings = (u.earnings || 0) + item.amount;
                u.balance  = (u.balance  || 0) + item.amount;
                return false;
            }
            return true;
        });
        if (u.lockedEscrow.length !== before) {
            if (state.user?.phone === u.phone) {
                state.user.earnings = u.earnings;
                state.user.balance  = u.balance;
                state.user.lockedEscrow = u.lockedEscrow;
            }
            changed = true;
        }
    });

    if (changed) {
        localStorage.setItem('trivenUsers', JSON.stringify(usersDB));
        localStorage.setItem('trivenOrders', JSON.stringify(state.orders));
        if (state.user) localStorage.setItem('trivenSession', JSON.stringify(state.user));
        render();
    }
}, 5000);

// Boot
init();
