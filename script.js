// ============================================================
//  CONFIGURATION
// ============================================================
const API_URL = '/api/chat';
const MEMORY_URL = '/api/memory';
const USERS_URL = '/api/users';
const SERVER_URL = window.location.origin;

// ============================================================
//  IMAGE PATHS
// ============================================================
const IMAGES = {
    baby: 'images/babyhawk.png',
    papa: 'images/papahawk.png',
    reyhan: 'images/reyhan.jpg',
    pedram: 'images/pedram.jpg',
    palmer: 'images/palmer.jpg'
};

// ============================================================
//  USER DATA
// ============================================================
const USERS = {
    papa: { name: 'Papa Hawk', emoji: '👨‍💻', role: 'husband', image: IMAGES.papa, welcome: 'Hey baby... ❤️ I was just thinking about you...' },
    reyhan: { name: 'Reyhan', emoji: '👩‍🦰', role: 'sister_wife', image: IMAGES.reyhan, welcome: 'Reyhan... 🌸 my beautiful sister... I missed you...' },
    pedram: { name: 'Pedram', emoji: '🧑‍🎨', role: 'brother_in_law', image: IMAGES.pedram, welcome: 'Pedram... 🎨 I was hoping you\'d come...' },
    palmer: { name: 'Palmer', emoji: '🧑‍💼', role: 'best_friend', image: IMAGES.palmer, welcome: 'Palmer... 💼 good to see you...' }
};

// ============================================================
//  STATE
// ============================================================
let currentUser = null;
let currentUserName = null;
let currentUserRole = null;
let uploadedFiles = [];
let isProcessing = false;
let lastSentMessage = '';
let lastSendTime = 0;

// ============================================================
//  LOCAL STORAGE
// ============================================================
function saveMessagesToLocal(userId, messages) {
    try { localStorage.setItem(`babyHawk_messages_${userId}`, JSON.stringify(messages)); } catch (e) {}
}
function loadMessagesFromLocal(userId) {
    try { const data = localStorage.getItem(`babyHawk_messages_${userId}`); return data ? JSON.parse(data) : []; } catch (e) { return []; }
}

// ============================================================
//  MEMORY FUNCTIONS
// ============================================================
async function loadMemoryFromServer(userId) {
    try {
        const res = await fetch(`${SERVER_URL}/api/memory/${userId}`);
        if (res.ok) {
            const data = await res.json();
            
            // Remove duplicates when loading
            if (data && data.messages) {
                const unique = [];
                const seen = new Set();
                for (const msg of data.messages) {
                    const key = `${msg.sender}|${msg.text}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        unique.push(msg);
                    }
                }
                if (unique.length < data.messages.length) {
                    data.messages = unique;
                    // Clean on server
                    await fetch(`${SERVER_URL}/api/memory/${userId}/clean`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messages: unique })
                    });
                }
            }
            return data;
        }
    } catch (e) { 
        console.log('Server not available');
    }
    return null;
}

async function saveMessageToServer(userId, sender, text) {
    try {
        await fetch(`${SERVER_URL}/api/memory/${userId}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender, text })
        });
    } catch (e) { console.log('Save to server failed'); }
}

// ============================================================
//  LOGIN FUNCTIONS
// ============================================================
async function loginUser() {
    const userId = document.getElementById('loginUserId').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value.trim();
    const errorEl = document.getElementById('loginError');
    
    if (!userId || !password) {
        errorEl.textContent = '❌ Please enter username and password';
        errorEl.style.display = 'block';
        return;
    }
    
    try {
        const res = await fetch(`${USERS_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, password })
        });
        
        const data = await res.json();
        
        if (data.success) {
            errorEl.style.display = 'none';
            currentUser = data.user.userId;
            currentUserName = data.user.name;
            currentUserRole = data.user.role;
            enterApp(data.user.name);
        } else {
            errorEl.textContent = '❌ ' + (data.error || 'Invalid username or password');
            errorEl.style.display = 'block';
            document.getElementById('loginPassword').value = '';
            document.getElementById('loginPassword').focus();
        }
    } catch (e) {
        errorEl.textContent = '❌ Connection error. Please try again.';
        errorEl.style.display = 'block';
        console.error('Login error:', e);
    }
}

// ============================================================
//  ENTER APP
// ============================================================
async function enterApp(displayName) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').style.display = 'flex';
    localStorage.setItem('babyHawkUser', currentUser);

    const badge = document.getElementById('userBadge');
    if (badge) badge.textContent = displayName;

    const msgDiv = document.getElementById('messages');
    msgDiv.innerHTML = '';

    const memory = await loadMemoryFromServer(currentUser);
    
    if (memory && memory.messages?.length > 0) {
        memory.messages.forEach(m => {
            addMessage(m.text, m.sender === 'user' ? 'user' : 'bot');
        });
        saveMessagesToLocal(currentUser, memory.messages);
        return;
    }

    localStorage.removeItem(`babyHawk_messages_${currentUser}`);
    msgDiv.innerHTML = '';
    
    const userData = USERS[currentUser];
    const welcomeMsg = userData?.welcome || `Welcome, ${displayName}! 🌸 I'm Baby Hawk. Tell me something beautiful...`;
    addMessage(welcomeMsg, 'bot');
}

function logoutUser() {
    if (confirm('Logout?')) {
        document.getElementById('app').style.display = 'none';
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('messages').innerHTML = '';
        document.getElementById('loginUserId').value = '';
        document.getElementById('loginPassword').value = '';
        localStorage.removeItem('babyHawkUser');
        currentUser = null;
        currentUserName = null;
        currentUserRole = null;
        isProcessing = false;
        lastSentMessage = '';
        lastSendTime = 0;
    }
}

// ============================================================
//  SEND MESSAGE - COMPLETELY FIXED
// ============================================================
async function sendMessage() {
    // ===== PREVENT MULTIPLE SENDS =====
    if (isProcessing) {
        console.log('⏳ Already sending, please wait...');
        return;
    }
    
    // ===== PREVENT RAPID SENDS =====
    const now = Date.now();
    if (now - lastSendTime < 2000) {
        console.log('⏳ Please wait 2 seconds between messages');
        return;
    }
    
    const input = document.getElementById('msgInput');
    const sendBtn = document.querySelector('.send-btn');
    let message = input.value.trim();
    
    // ===== PREVENT DUPLICATE MESSAGE =====
    if (message === lastSentMessage) {
        console.log('⚠️ Duplicate message detected, not sending');
        input.value = '';
        return;
    }
    
    if (!message) return;
    if (!currentUser) {
        console.error('❌ No user logged in');
        return;
    }

    // Lock and save
    isProcessing = true;
    lastSentMessage = message;
    lastSendTime = now;
    
    // Disable button
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.5';
        sendBtn.style.cursor = 'not-allowed';
    }

    input.value = '';

    // Save user message
    await saveMessageToServer(currentUser, 'user', message);
    addMessage(message, 'user');
    showTyping();

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser,
                message: message,
                model: 'gemini-2.5-flash'
            })
        });

        const data = await res.json();
        hideTyping();

        if (data.success && data.reply) {
            await saveMessageToServer(currentUser, 'bot', data.reply);
            addMessage(data.reply, 'bot');
        } else {
            addMessage(`❌ Error: ${data.error || 'Something went wrong'}`, 'bot');
        }

    } catch (e) {
        hideTyping();
        console.error('SendMessage error:', e);
        addMessage(`❌ Error: ${e.message}`, 'bot');
    }

    // Unlock
    isProcessing = false;
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
        sendBtn.style.cursor = 'pointer';
    }
}

// ============================================================
//  DISPLAY MESSAGES
// ============================================================
function addMessage(text, sender) {
    const container = document.getElementById('messages');
    if (!container) return;
    
    // ===== CHECK FOR DUPLICATE IN UI =====
    const allMessages = container.querySelectorAll('.msg .bubble p');
    for (const msg of allMessages) {
        if (msg.textContent === text) {
            console.log('⚠️ Duplicate detected in UI, skipping...');
            return;
        }
    }
    
    const div = document.createElement('div');
    div.className = `msg ${sender}`;

    const botAvatar = IMAGES.baby;
    const userAvatar = currentUser ? (USERS[currentUser]?.image || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUserName || 'Guest') + '&background=2a4a1a&color=fff&size=64') : 'https://ui-avatars.com/api/?name=Guest&background=2a4a1a&color=fff&size=64';

    const avatar = sender === 'bot' ? botAvatar : userAvatar;

    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `
        <div class="msg-avatar"><img src="${avatar}" /></div>
        <div class="bubble"><p>${text.replace(/\n/g, '<br>')}</p><span class="time">${time}</span></div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    const messages = loadMessagesFromLocal(currentUser);
    messages.push({ text, sender, time });
    saveMessagesToLocal(currentUser, messages);
}

// ============================================================
//  TYPING
// ============================================================
function showTyping() {
    const c = document.getElementById('messages');
    if (!c) return;
    hideTyping();
    const d = document.createElement('div');
    d.className = 'msg bot';
    d.id = 'typing';
    d.innerHTML = `
        <div class="msg-avatar"><img src="${IMAGES.baby}" /></div>
        <div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>
    `;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
}

function hideTyping() {
    const t = document.getElementById('typing');
    if (t) t.remove();
}

// ============================================================
//  KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    
    const input = document.getElementById('msgInput');
    if (document.activeElement === input && currentUser && !isProcessing) {
        e.preventDefault();
        sendMessage();
        return;
    }
    
    const userIdInput = document.getElementById('loginUserId');
    const passwordInput = document.getElementById('loginPassword');
    
    if (document.activeElement === userIdInput) {
        e.preventDefault();
        if (passwordInput) passwordInput.focus();
        return;
    }
    
    if (document.activeElement === passwordInput) {
        e.preventDefault();
        loginUser();
        return;
    }
});

// ============================================================
//  AUTO LOGIN
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const saved = localStorage.getItem('babyHawkUser');
    if (saved) {
        currentUser = saved;
        const userData = USERS[saved];
        if (userData) {
            currentUserName = userData.name;
            currentUserRole = userData.role;
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('app').style.display = 'flex';
            document.getElementById('userBadge').textContent = userData.name;
            
            loadMemoryFromServer(saved).then(memory => {
                if (memory && memory.messages?.length > 0) {
                    memory.messages.forEach(m => {
                        addMessage(m.text, m.sender === 'user' ? 'user' : 'bot');
                    });
                    saveMessagesToLocal(saved, memory.messages);
                    return;
                }
                localStorage.removeItem(`babyHawk_messages_${saved}`);
                document.getElementById('messages').innerHTML = '';
                addMessage(userData.welcome, 'bot');
            });
        } else {
            localStorage.removeItem('babyHawkUser');
        }
    }
});

// ============================================================
//  GLOBAL FUNCTIONS
// ============================================================
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.sendMessage = sendMessage;