// Constants
const FIXED_BRIDGE_URL = "https://applchu.link/lbm/0.4/bridge.html?v=" + new Date().getTime();
const LOCAL_STORAGE_KEY = "LBM_CONFIG_CACHE";
const LOCAL_REACTIONS_KEY = "LBM_USER_REACTIONS";
const SESSION_USER_KEY = "LBM_SESSION_USER";

// Theme Defaults
const DEFAULT_THEME_COLORS = {
    bg: "#010101", text: "#e0f2f1", sidebar: "#0a0a0a", accent: "#ff6b35",
    leaflet: "#0a0a0a", border: "#1f2937", navActive: "#c8ff00",
    like: "#c8ff00", dislike: "#ff3c8e",
    likeBtn: "#010101", dislikeBtn: "#010101",
    queueBg: "#0f171f", toastBg: "#0f171f", overlayBg: "#050505"
};

// Utilities
function unicodeToBase64(str) { return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1))); }
function base64ToUnicode(str) { return decodeURIComponent(atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')); }
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function uuidv4() { return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)); }

// HTML Sanitizer
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Auto-Contrast Helper
function getContrastColor(hexColor) {
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

function downloadFile(content, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    link.download = name;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

window.downloadBackup = async function() { 
    await generateConfigFile('edit'); 
};

function showToast(msg, type='info') {
    const t = document.createElement('div'); t.className=`toast ${type}`; 
    t.innerHTML = type==='loading'?`<div class="toast-spinner"></div><span>${msg}</span>`:`<span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(t);
    if(type==='loading') currentLoadingToast = t;
    else setTimeout(() => { t.style.animation='fadeOut 0.5s forwards'; setTimeout(()=>t.remove(),500); }, 3000);
}

function copyPermalink(id, event) {
    event.stopPropagation();
    const url = window.location.href.split('#')[0] + '#' + id;
    navigator.clipboard.writeText(url).then(() => {
        showToast("Link copied!", "success");
    }).catch(() => {
        showToast("Link: " + url, "info");
    });
}

function insertMarkdown(id, style) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const txt = el.value;
    const sel = txt.substring(start, end);
    let replace = '';
    
    switch(style) {
        case 'b': replace = `**${sel || 'bold'}**`; break;
        case 'i': replace = `*${sel || 'italic'}*`; break;
        case 'q': replace = `\n> ${sel || 'quote'}\n`; break;
        case 'h': replace = `\n### ${sel || 'heading'}\n`; break;
        case 'l': replace = `[${sel || 'link text'}](url)`; break;
        case 'img': replace = `![${sel || 'alt text'}](image_url)`; break;
        case 'c': replace = `\`${sel || 'code'}\``; break;
    }
    
    el.value = txt.substring(0, start) + replace + txt.substring(end);
    el.focus();
    const newCursorPos = start + replace.length;
    el.selectionStart = newCursorPos;
    el.selectionEnd = newCursorPos;
}

function getMdToolbar(id) {
    const btns = [
        {l:'B', a:'b', t:'Bold'}, {l:'I', a:'i', t:'Italic'}, 
        {l:'“ ”', a:'q', t:'Quote'}, {l:'#', a:'h', t:'Heading'},
        {l:'🔗', a:'l', t:'Link'}, {l:'🖼️', a:'img', t:'Image'}, 
        {l:'<>', a:'c', t:'Code'}
    ];
    return `<div class="md-toolbar">${btns.map(b => 
        `<button class="md-btn" type="button" onclick="insertMarkdown('${id}', '${b.a}')" title="${b.t}">${b.l}</button>`
    ).join('')}</div>`;
}

// State Management
let postsCache = []; 
let interactionsCache = { messages: [] }; 
let usersCache = { users: [], types: ['admin', 'member', 'vip'] }; 
let globalAdminHash = null;
let globalAuthToken = null; 
let globalApiKey = null;
let sessionPassword = null;

let isAdminLoggedIn = false;
let currentUser = null; 

let isPosting = false; 

let currentLoadingToast = null;
let pendingPost = null;
let currentLightboxPostId = null; 
let currentMediaList = [];
let currentMediaIndex = 0;

// Upload State
let isBatchUploading = false;
let currentBatchResolve = null;
let currentBatchReject = null;
let currentPostMediaQueue = [];

// Filter State
let activeTagFilter = null;
let activeSearchQuery = "";

// Drawing State
let isDrawing = false;
let isMsgDrawMode = false;
let drawCtx = null;
let drawCanvas = null;
let drawHistory = [];
let drawHistoryStep = -1;
let currentDrawColor = '#000000';
let currentDrawTool = 'brush'; 

let currentConfig = {
    siteName: "LBM // System",
    metaTitle: "LBM System",
    metaDescription: "A personal microblogging archive.",
    tagline: "Personal Archive",
    leafletsName: "Leaflets",
    allowComments: true,
    allowAnonMessages: false, 
    disableSignups: false, 
    copyright: "2025 LBM",
    bgImage: "",
    bannerImage: "",
    pfpImage: "",
    customCss: "",
    reactionsEnabled: true,
    reactionIcon: "face",
    likeLabel: "(＾∇＾)",
    dislikeLabel: "(；へ：)",
    widgetPadding: "1.5rem",
    protectedTags: "",
    usersFile: null, 
    sitePasswordHash: null,
    allowVideoDownloads: true,
    colors: { ...DEFAULT_THEME_COLORS }
};

const MediaController = {
    togglePlay: function(uid) {
        const v = document.getElementById(`media-${uid}`);
        const btn = document.getElementById(`play-btn-${uid}`);
        if(!v) return;
        if(v.paused || v.ended) {
            v.play();
            if(btn) btn.innerHTML = this.getIcon('pause');
            const overlay = document.getElementById(`overlay-play-${uid}`);
            if(overlay) overlay.style.opacity = '0';
        } else {
            v.pause();
            if(btn) btn.innerHTML = this.getIcon('play');
            const overlay = document.getElementById(`overlay-play-${uid}`);
            if(overlay) overlay.style.opacity = '1';
        }
    },
    updateTime: function(uid) {
        const v = document.getElementById(`media-${uid}`);
        const s = document.getElementById(`seek-${uid}`);
        if(v && s) {
            const val = (100 / v.duration) * v.currentTime;
            s.value = val || 0;
            s.style.backgroundSize = `${val}% 100%`;
        }
    },
    seek: function(uid, val) {
        const v = document.getElementById(`media-${uid}`);
        if(v) {
            const t = v.duration * (val / 100);
            v.currentTime = t;
        }
    },
    toggleMute: function(uid) {
        const v = document.getElementById(`media-${uid}`);
        const btn = document.getElementById(`vol-btn-${uid}`);
        if(!v) return;
        v.muted = !v.muted;
        if(btn) btn.innerHTML = v.muted ? this.getIcon('mute') : this.getIcon('vol');
    },
    setVolume: function(uid, val) {
        const v = document.getElementById(`media-${uid}`);
        if(v) { v.volume = val; v.muted = false; }
    },
    toggleFS: function(uid) {
        const w = document.getElementById(`wrapper-${uid}`);
        if(!w) return;
        if (!document.fullscreenElement) {
            w.requestFullscreen().catch(err => console.log(err));
        } else {
            document.exitFullscreen();
        }
    },
    download: function(url) {
        const a = document.createElement('a'); a.href = url; a.download = ''; a.click();
    },
    getIcon: function(type) {
        if(type==='play') return `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
        if(type==='pause') return `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        if(type==='vol') return `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
        if(type==='mute') return `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
        if(type==='fs') return `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
        if(type==='dl') return `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
        return '';
    }
};
window.MediaController = MediaController;

// Initialization
window.onload = async function() {
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }

    const marquee = document.getElementById('marquee-content');
    if(marquee) {
        marquee.innerHTML += marquee.innerHTML;
    }

    loadFromLocalCache();
    window.addEventListener('message', handleBridgeMessage);
    
    if (window.location.protocol !== 'file:') {
        injectBridge(FIXED_BRIDGE_URL);
    }

    const timestamp = new Date().getTime();
    const loadScript = (src) => new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = `${src}?v=${timestamp}`;
        s.onload = resolve;
        s.onerror = () => { console.log(`[LBM] Note: ${src} not found`); resolve(); }; 
        document.body.appendChild(s);
    });

    await Promise.all([loadScript('system.js'), loadScript('interactions.js')]);
    await parseSystemData(loadScript); 
    checkSiteLock();
    initCanvas(); 
};

function loadFromLocalCache() {
    try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
            const localData = JSON.parse(cached);
            currentConfig = { ...currentConfig, ...localData, colors: { ...currentConfig.colors, ...(localData.colors || {}) } };
            applyVisualConfig();
        }
        const session = sessionStorage.getItem(SESSION_USER_KEY);
        if (session) {
            currentUser = JSON.parse(session);
            updateUserUI();
        }
    } catch (e) { console.error("[LBM] LocalStorage Error", e); }
}

function saveToLocalCache() {
    try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentConfig)); } catch(e) {}
}

async function parseSystemData(scriptLoader) {
    if (typeof window.AZUMINT_INTERACTIONS !== 'undefined') {
        try {
            const iJson = base64ToUnicode(window.AZUMINT_INTERACTIONS);
            interactionsCache = JSON.parse(iJson);
            if (!interactionsCache.messages) interactionsCache.messages = [];
        } catch(e) { console.error("Interactions Parse Error", e); }
    }

    if (typeof window.AZUMINT_SYSTEM === 'undefined') {
        console.log("System file missing. Starting Setup.");
        showSetup();
    } else {
        try {
            const jsonStr = base64ToUnicode(window.AZUMINT_SYSTEM);
            const data = JSON.parse(jsonStr);
            
            globalAdminHash = data.adminHash;
            postsCache = data.posts || [];
            
            if (data.authToken) globalAuthToken = data.authToken;
            if (data.apiKey) globalApiKey = data.apiKey;
            
            if (data.siteConfig) {
                currentConfig = { 
                    ...currentConfig, 
                    ...data.siteConfig, 
                    colors: {...currentConfig.colors, ...(data.siteConfig.colors || {})}
                };
                saveToLocalCache();
            }
            
            // Dynamic Users File Load
            if (currentConfig.usersFile && scriptLoader) {
                await scriptLoader(currentConfig.usersFile);
                if (typeof window.AZUMINT_USERS !== 'undefined') {
                    try {
                        const uJson = base64ToUnicode(window.AZUMINT_USERS);
                        usersCache = JSON.parse(uJson);
                    } catch(uErr) { console.error("User Data Parse Error", uErr); }
                }
            }
            
            applyVisualConfig();
            renderLeaflets();
            renderGallery();
            renderTagCloud();
            
            // Permalink Handler
            if(window.location.hash) {
                const id = window.location.hash.substring(1);
                const numericId = parseInt(id);
                if (!isNaN(numericId)) {
                     openLightbox(numericId);
                }
                const el = document.getElementById(id);
                if(el) {
                    setTimeout(() => {
                        el.scrollIntoView({behavior: 'smooth', block: 'center'});
                        el.classList.add('highlight-post');
                    }, 500);
                }
            }
            
            document.getElementById('db-status').innerText = "System Online";
            document.getElementById('db-status').classList.add('online');
        } catch(e) {
            console.error("Config Parse Error", e);
            showToast("Error reading system.js.", "error");
            showSetup();
        }
    }
}

// Site Lock Logic
function checkSiteLock() {
    if (isAdminLoggedIn) {
        document.getElementById('site-lock-overlay').style.display = 'none';
        return;
    }
    if (currentConfig.sitePasswordHash && !sessionStorage.getItem('LBM_SITE_UNLOCKED')) {
        document.getElementById('site-lock-overlay').style.display = 'flex';
    } else {
        document.getElementById('site-lock-overlay').style.display = 'none';
    }
}

async function unlockSite() {
    const input = document.getElementById('site-lock-pass').value;
    if(!input) return;
    
    const hash = await sha256(input);
    if (hash === currentConfig.sitePasswordHash) {
        sessionStorage.setItem('LBM_SITE_UNLOCKED', 'true');
        document.getElementById('site-lock-overlay').style.display = 'none';
        showToast("Archive Unlocked", "success");
    } else {
        showToast("Incorrect Password", "error");
        document.getElementById('site-lock-pass').value = '';
    }
}

// Bridge Communication
let tokenizeResolve = null; 

function handleBridgeMessage(e) {
    if (e.data.type === 'TOKEN_RESULT') {
        if(e.data.success && tokenizeResolve) {
            tokenizeResolve(e.data.token);
        } else if (!e.data.success && tokenizeResolve) {
            showToast("Token Generation Failed: " + e.data.message, "error");
            tokenizeResolve(null);
        }
        tokenizeResolve = null;
    }

    if(e.data.type === 'UPLOAD_RESULT') {
        if (isBatchUploading) {
            if (e.data.success) {
                if (currentBatchResolve) currentBatchResolve(true);
            } else {
                if (currentBatchReject) currentBatchReject(e.data.message);
            }
            return; 
        }

        if (currentLoadingToast && currentLoadingToast.parentNode) currentLoadingToast.remove();
        
        if(e.data.success) {
            hideUploadModal();
            showToast("Sync Successful!", "success");
            updateSyncStatus('synced', 'System Synced');
            
            renderLeaflets();
            renderTagCloud();
            
            if (isPosting) {
                switchTab('leaflets');
                isPosting = false;
            }
        } else {
            if (e.data.message && (e.data.message.includes("Invalid or Corrupted Token") || e.data.message.includes("403") || e.data.message.includes("invalid credentials"))) {
                hideUploadModal();
                document.getElementById('repair-modal').style.display = 'flex';
            } else {
                handleUploadError(e.data.message);
            }
            isPosting = false; 
        }
    }
}

// Token Repair
async function runRepair() {
    const k = document.getElementById('repair-api-key').value;
    if(!k) return alert("Please enter API Key");
    
    showToast("Repairing Connection...", "loading");
    const cleanKey = k.trim();
    const newToken = await requestTokenGeneration(cleanKey, sessionPassword);
    
    if (newToken) {
        globalAuthToken = newToken;
        globalApiKey = null;
        pendingPost = null; 
        currentPostMediaQueue = [];
        
        document.getElementById('repair-modal').style.display = 'none';
        showToast("Repair Successful! Retrying Save...", "success");
        
        setTimeout(() => {
            saveSystem(null, null, newToken); 
        }, 1000);
    } else {
        showToast("Repair Failed. Check Key.", "error");
    }
}

// Data Synchronization
function injectBridge(url) {
    let frame = document.getElementById('bridge-frame');
    if(!frame) {
        frame = document.createElement('iframe');
        frame.id = 'bridge-frame';
        frame.style.display = 'none';
        document.body.appendChild(frame);
    }
    frame.src = url;
}

async function saveSystem(mediaFile = null, explicitMediaPath = null, overrideToken = null) {
    if(isAdminLoggedIn && document.getElementById('admin-dashboard').style.display === 'block') {
        scrapeConfig('edit');
    }
    saveToLocalCache();

    if (!globalAuthToken && !overrideToken && window.location.protocol === 'file:') {
         showToast("Downloading System.js (Local Mode)", "success");
         await generateConfigFile('edit');
         return;
    }

    uploadToBridge('system', mediaFile, explicitMediaPath, overrideToken);

    if(!mediaFile) {
        setTimeout(() => uploadToBridge('rss', null, null, overrideToken), 3000);
    }
}

async function saveInteractions() { 
    if(!globalAuthToken && window.location.protocol === 'file:') return;
    uploadToBridge('interactions'); 
}

async function saveUsers() {
    if(!globalAuthToken) return;
    // Generate Filename if missing
    if (!currentConfig.usersFile) {
        currentConfig.usersFile = 'users_' + uuidv4().substring(0,8) + '.js';
        await uploadToBridge('system'); 
    }
    uploadToBridge('users');
}

function forceSyncAll() { 
    saveToLocalCache();
    uploadToBridge('system'); 
    setTimeout(() => uploadToBridge('interactions'), 2000); 
    setTimeout(() => uploadToBridge('rss'), 4000); 
    setTimeout(() => uploadToBridge('users'), 6000);
}

async function uploadToBridge(target, mediaFile = null, explicitMediaPath = null, overrideToken = null) {
    const tokenToSend = overrideToken || globalAuthToken;

    if(!tokenToSend) {
        showToast("No Auth Token found. Setup required.", "error");
        markUnsynced();
        return;
    }

    let passwordCheck = null;
    
    // Password required for sensitive uploads
    if (target === 'system' || target === 'media_only' || target === 'rss' || target === 'users') {
        if (!sessionPassword) {
             sessionPassword = document.getElementById('login-pass').value;
        }
        if (!sessionPassword && target === 'users') {
            showToast("Admin session required.", "error");
            return;
        }
        passwordCheck = sessionPassword;
    }

    let fileContent = "";
    let fileName = "";
    let mediaName = null;

    if (target === 'system') {
        const data = await prepareSystemData('edit', tokenToSend);
        const encodedStr = unicodeToBase64(JSON.stringify(data));
        fileContent = `window.AZUMINT_SYSTEM = "${encodedStr}";`;
        fileName = "system.js";
    } else if (target === 'interactions') {
        const encodedStr = unicodeToBase64(JSON.stringify(interactionsCache));
        fileContent = `window.AZUMINT_INTERACTIONS = "${encodedStr}";`;
        fileName = "interactions.js";
        showToast("Syncing Interactions...", "loading");
    } else if (target === 'rss') {
        fileContent = generateRSS();
        fileName = "rss.xml";
        showToast("Updating RSS Feed...", "loading");
    } else if (target === 'users') {
        const encodedStr = unicodeToBase64(JSON.stringify(usersCache));
        fileContent = `window.AZUMINT_USERS = "${encodedStr}";`;
        fileName = currentConfig.usersFile;
        showToast("Syncing Users...", "loading");
    }

    if (mediaFile) {
        const rawName = explicitMediaPath || document.getElementById('admin-media').value;
        mediaName = (rawName && rawName.indexOf('/') === -1) ? 'img/' + rawName : rawName;
    }

    if (!isBatchUploading && (target === 'system' || target === 'media_only')) {
        showToast(mediaFile ? "Uploading Media..." : "Saving System...", "loading");
        showUploadModal(mediaFile ? "Uploading Media..." : "Saving System...");
    }

    const frame = document.getElementById('bridge-frame');
    if(frame) {
        frame.contentWindow.postMessage({
            type: 'UPLOAD', 
            authToken: tokenToSend, 
            passwordCheck: passwordCheck, 
            fileContent: fileContent, 
            filename: fileName, 
            mediaFile: mediaFile, 
            mediaName: mediaName
        }, FIXED_BRIDGE_URL); 
    } else {
        showToast("Bridge disconnected.", "error");
    }
}

// Batch Upload Helper
function promisifiedUpload(mediaFile, path) {
    return new Promise((resolve, reject) => {
        currentBatchResolve = resolve;
        currentBatchReject = reject;
        uploadToBridge('media_only', mediaFile, path);
    });
}

// Data Payload Construction
async function prepareSystemData(mode, explicitToken = null) {
    let hashVar, tokenToSave = explicitToken || globalAuthToken;

    if (mode === 'setup') {
        const pass = document.getElementById('setup-password').value;
        const rawKey = document.getElementById('setup-neocities-key').value;
        
        if (!pass || !rawKey) { showToast("Credentials missing.", "error"); return null; }

        showToast("Encrypting Credentials...", "loading");
        tokenToSave = await requestTokenGeneration(rawKey, pass);
        
        if (!tokenToSave) return null; 
        
        scrapeConfig('setup');
        
        const sitePass = document.getElementById('setup-site-password').value;
        if(sitePass) currentConfig.sitePasswordHash = await sha256(sitePass);
        
        hashVar = await sha256(pass);
    } else {
        if(isAdminLoggedIn) {
            if(document.getElementById('admin-dashboard').style.display === 'block') {
                scrapeConfig('edit');
                
                const sitePassInput = document.getElementById('edit-site-password');
                const disableLock = document.getElementById('edit-disable-site-lock');
                if(sitePassInput && sitePassInput.value) {
                    currentConfig.sitePasswordHash = await sha256(sitePassInput.value);
                }
                if(disableLock && disableLock.checked) {
                    currentConfig.sitePasswordHash = null;
                }
            }
        }
        hashVar = globalAdminHash;
        
        const newKeyInput = document.getElementById('edit-neocities-key').value;
        if (newKeyInput && newKeyInput.length > 5) {
            showToast("Rotating Security Token...", "loading");
            const t = await requestTokenGeneration(newKeyInput, sessionPassword);
            if (t) {
                tokenToSave = t;
                globalAuthToken = t;
            }
        }
    }

    if (explicitToken) tokenToSave = explicitToken;

    let keyToSave = (tokenToSave || globalAuthToken) ? null : globalApiKey;

    return {
        adminHash: hashVar,
        siteConfig: currentConfig,
        posts: postsCache,
        authToken: tokenToSave,
        apiKey: keyToSave
    };
}

// Admin Password Update Logic
async function updateAdminCredentials() {
    const p1 = document.getElementById('update-admin-pass').value;
    const p2 = document.getElementById('update-admin-confirm').value;
    const key = document.getElementById('update-admin-api-key').value;
    
    if(!p1 || !p2 || !key) return showToast("All fields required.", "error");
    if(p1 !== p2) return showToast("Passwords do not match.", "error");
    
    showToast("Re-encrypting Access Token...", "loading");
    
    const newToken = await requestTokenGeneration(key, p1);
    
    if(newToken) {
        globalAuthToken = newToken;
        globalAdminHash = await sha256(p1);
        sessionPassword = p1; 
        
        await saveSystem();
        
        document.getElementById('update-admin-pass').value = '';
        document.getElementById('update-admin-confirm').value = '';
        document.getElementById('update-admin-api-key').value = '';
        
        showToast("Admin Credentials Updated!", "success");
    } else {
        showToast("Failed to generate token. Check Key.", "error");
    }
}

function requestTokenGeneration(key, pass) {
    return new Promise((resolve) => {
        tokenizeResolve = resolve;
        const frame = document.getElementById('bridge-frame');
        if(!frame) { resolve(null); return; }
        frame.contentWindow.postMessage({
            type: 'TOKENIZE',
            rawKey: key,
            adminPass: pass
        }, FIXED_BRIDGE_URL);
        
        setTimeout(() => { if(tokenizeResolve) { tokenizeResolve(null); } }, 10000);
    });
}

// UI Configuration Extraction
function scrapeConfig(prefix) {
     const id = (name) => { const el = document.getElementById(prefix + '-' + name); return el ? el.value : ''; };
     const col = (name) => { const el = document.getElementById((prefix === 'edit' ? 'edit-col-' : 'col-') + name); return el ? el.value : '#000000'; };
     
     currentConfig.siteName = id('site-name');
     currentConfig.tagline = id('tagline');
     currentConfig.leafletsName = id('leaflets-name');
     currentConfig.copyright = id('copyright');
     
     if (prefix === 'edit') {
         currentConfig.metaTitle = id('window-title') || currentConfig.siteName;
         currentConfig.metaDescription = id('meta-desc') || "";
         currentConfig.protectedTags = id('protected-tags') || "";
         currentConfig.allowAnonMessages = document.getElementById('edit-allow-anon-msg').checked;
         currentConfig.disableSignups = document.getElementById('edit-disable-signups').checked;
         currentConfig.allowVideoDownloads = document.getElementById('edit-allow-video-dl').checked;
     }
     
     currentConfig.bgImage = id('bg-image');
     currentConfig.pfpImage = id('pfp-image');
     currentConfig.bannerImage = id('banner-image');
     currentConfig.customCss = id('custom-css');
     currentConfig.widgetPadding = id('widget-padding');
     
     const reactionsEnabledEl = document.getElementById((prefix === 'edit' ? 'edit-' : 'setup-') + 'reactions-enabled');
     currentConfig.reactionsEnabled = reactionsEnabledEl ? reactionsEnabledEl.value === 'true' : true;
     
     currentConfig.reactionIcon = id('reaction-icon');
     currentConfig.likeLabel = id('like-label');
     currentConfig.dislikeLabel = id('dislike-label');
     
     const commentsEl = document.getElementById((prefix === 'edit' ? 'edit-' : 'setup-') + 'comments');
     currentConfig.allowComments = commentsEl ? commentsEl.value === 'true' : true;

     currentConfig.colors.bg = col('bg');
     currentConfig.colors.text = col('text');
     currentConfig.colors.sidebar = col('sidebar');
     currentConfig.colors.accent = col('accent');
     currentConfig.colors.leaflet = col('leaflet');
     currentConfig.colors.border = col('border');
     currentConfig.colors.navActive = col('nav-active');
     currentConfig.colors.like = col('like');
     currentConfig.colors.dislike = col('dislike');
     currentConfig.colors.likeBtn = col('like-btn');
     currentConfig.colors.dislikeBtn = col('dislike-btn');
     
     currentConfig.colors.queueBg = col('queue-bg') || '#0f171f';
     currentConfig.colors.toastBg = col('toast-bg') || '#0f171f';
     currentConfig.colors.overlayBg = col('overlay-bg') || '#050505';
}

function applyVisualConfig() {
    if (currentConfig.metaTitle) document.title = currentConfig.metaTitle;
    else document.title = currentConfig.siteName;
    
    const metaDesc = document.getElementById('dynamic-desc');
    if (metaDesc && currentConfig.metaDescription) metaDesc.setAttribute('content', currentConfig.metaDescription);

    const setTxt = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt || ""; };
    setTxt('header-site-name', currentConfig.siteName);
    setTxt('header-tagline', currentConfig.tagline);
    setTxt('nav-leaflets-btn', currentConfig.leafletsName);
    setTxt('header-leaflets-title', "Recent " + currentConfig.leafletsName);
    const foot = document.getElementById('footer-text');
    if (foot) foot.innerHTML = "&copy; " + currentConfig.copyright;

    const r = document.documentElement.style;
    const c = currentConfig.colors;
    
    const setVar = (n, v) => r.setProperty(n, v);
    setVar('--background-color', c.bg); setVar('--text-color', c.text); setVar('--sidebar-bg', c.sidebar);
    setVar('--header-footer-color', c.sidebar); setVar('--accent-color', c.accent); setVar('--leaflet-bg', c.leaflet);
    setVar('--border-color', c.border); setVar('--nav-active-color', c.navActive); setVar('--like-color', c.like);
    setVar('--dislike-color', c.dislike); setVar('--like-btn-color', c.likeBtn); setVar('--dislike-btn-color', c.dislikeBtn);
    setVar('--widget-padding', currentConfig.widgetPadding);
    
    setVar('--queue-bg', c.queueBg || c.sidebar); 
    setVar('--toast-bg', c.toastBg || '#0f171f');
    setVar('--overlay-bg', c.overlayBg || '#000000');
    
    if(currentConfig.bgImage && currentConfig.bgImage.length > 5) setVar('--bg-image', `url('${currentConfig.bgImage}')`);
    else setVar('--bg-image', 'none');

    const pfpEl = document.getElementById('header-pfp');
    if (pfpEl) {
        if (currentConfig.pfpImage && currentConfig.pfpImage.length > 5) { pfpEl.src = currentConfig.pfpImage; pfpEl.style.display = 'block'; } 
        else { pfpEl.style.display = 'none'; }
    }
    const headerEl = document.getElementById('site-header-block');
    if (headerEl) {
        if (currentConfig.bannerImage && currentConfig.bannerImage.length > 5) headerEl.style.backgroundImage = `url('${currentConfig.bannerImage}')`;
        else headerEl.style.backgroundImage = 'none';
    }

    let customStyle = document.getElementById('custom-css-block');
    if (!customStyle) { customStyle = document.createElement('style'); customStyle.id = 'custom-css-block'; document.head.appendChild(customStyle); }
    customStyle.textContent = currentConfig.customCss || '';

    // Dynamic RSS Link Injection
    let rssLink = document.getElementById('dynamic-rss');
    if(!rssLink) {
        rssLink = document.createElement('link');
        rssLink.id = 'dynamic-rss';
        rssLink.rel = 'alternate';
        rssLink.type = 'application/rss+xml';
        rssLink.title = 'RSS Feed';
        rssLink.href = 'rss.xml';
        document.head.appendChild(rssLink);
    }
    
    const msgBtn = document.getElementById('nav-send-msg-btn');
    if(msgBtn) {
        if(currentConfig.allowAnonMessages || currentUser) msgBtn.style.display = 'block';
        else msgBtn.style.display = 'none';
    }

    const regBtn = document.getElementById('nav-register-btn');
    if(regBtn) regBtn.style.display = currentConfig.disableSignups ? 'none' : 'block';
}

function updateSetupPreview() { scrapeConfig('setup'); applyVisualConfig(); }
function updateLivePreview() { scrapeConfig('edit'); applyVisualConfig(); markUnsynced(); }

function resetColors() {
    if(!confirm("Reset all colors to the default theme?")) return;
    currentConfig.colors = { ...DEFAULT_THEME_COLORS }; 
    populateAdminFields(); 
    applyVisualConfig();   
    markUnsynced();
    showToast("Colors reset to default.", "success");
}

// Authentication & User Management
async function adminLogin() {
    const passEl = document.getElementById('login-pass');
    if(!globalAdminHash) return showToast("Config missing.", "error");
    
    const rawPassword = passEl.value;
    const inputHash = await sha256(rawPassword);
    
    if(inputHash === globalAdminHash) {
        isAdminLoggedIn = true;
        sessionPassword = rawPassword; 
        currentUser = { username: "Admin", type: "admin" };
        updateUserUI();
        
        checkSiteLock();
        
        if (globalApiKey && !globalAuthToken) {
            showToast("Upgrading Security to v0.4...", "loading");
            
            const newToken = await requestTokenGeneration(globalApiKey, rawPassword);
            if (newToken) {
                globalAuthToken = newToken;
                globalApiKey = null; 
                await saveSystem();
                showToast("Security Upgrade Complete!", "success");
            } else {
                showToast("Security Upgrade Failed. Check Bridge.", "error");
            }
        }
        
        switchTab('admin');
        document.getElementById('admin-dashboard').style.display = 'block';
        populateAdminFields();
        renderLeaflets(); 
    } else {
        showToast("Incorrect Password", "error");
    }
}

async function memberLogin() {
    const u = document.getElementById('member-user').value;
    const p = document.getElementById('member-pass').value;
    if(!u || !p) return showToast("Enter credentials.", "error");
    
    const user = usersCache.users.find(x => x.username === u);
    if(user) {
        const hash = await sha256(p);
        if(hash === user.hash) {
            currentUser = { username: user.username, type: user.type, id: user.id };
            sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(currentUser));
            updateUserUI();
            showToast("Welcome back, " + u, "success");
            switchTab('leaflets');
            renderLeaflets();
        } else {
            showToast("Invalid password.", "error");
        }
    } else {
        showToast("User not found.", "error");
    }
}

async function registerMember() {
    if (!globalAuthToken) return showToast("System not connected to bridge.", "error");
    if (currentConfig.disableSignups) return showToast("Registration is closed.", "error");
    
    const u = document.getElementById('reg-user').value;
    const p = document.getElementById('reg-pass').value;
    
    if(!u || !p) return showToast("Username and Password required.", "error");
    if(usersCache.users.some(x => x.username === u)) return showToast("Username exists.", "error");
    if(u.toLowerCase() === 'admin') return showToast("Reserved name.", "error");
    
    const hash = await sha256(p);
    // Default to 'member' type
    const newUser = { id: Date.now(), username: u, hash: hash, type: 'member' };
    usersCache.users.push(newUser);
    
    await saveUsers();
    showToast("Account created! Please login.", "success");
    
    document.getElementById('reg-user').value = '';
    document.getElementById('reg-pass').value = '';
    switchTab('member-login');
}

function userLogout() {
    currentUser = null;
    isAdminLoggedIn = false;
    sessionPassword = null;
    sessionStorage.removeItem(SESSION_USER_KEY);
    updateUserUI();
    location.reload();
}

function updateUserUI() {
    const guestNav = document.getElementById('guest-nav');
    const loggedNav = document.getElementById('logged-in-nav');
    
    if(currentUser) {
        guestNav.style.display = 'none';
        loggedNav.style.display = 'block';
        document.getElementById('nav-username').innerText = currentUser.username.toUpperCase();
        document.getElementById('dash-welcome').innerText = `Welcome, ${currentUser.username}`;
        // Show send msg button if logged in (if hidden by default)
        const msgBtn = document.getElementById('nav-send-msg-btn');
        if(msgBtn) msgBtn.style.display = 'block';
    } else {
        guestNav.style.display = 'block';
        loggedNav.style.display = 'none';
    }
    applyVisualConfig(); 
}

async function updateMemberProfile() {
    const p = document.getElementById('update-pass').value;
    if(!p) return showToast("Enter a new password.", "info");
    
    const userIdx = usersCache.users.findIndex(u => u.id === currentUser.id);
    if(userIdx !== -1) {
        const hash = await sha256(p);
        usersCache.users[userIdx].hash = hash;
        await saveUsers();
        showToast("Profile Updated!", "success");
        document.getElementById('update-pass').value = '';
    } else {
        showToast("User record not found.", "error");
    }
}

async function createNewUser() {
    const u = document.getElementById('new-user-name').value;
    const p = document.getElementById('new-user-pass').value;
    const t = document.getElementById('new-user-type').value;
    
    if(!u || !p) return showToast("Username and Password required.", "error");
    if(usersCache.users.some(x => x.username === u)) return showToast("Username exists.", "error");
    
    const hash = await sha256(p);
    usersCache.users.push({ id: Date.now(), username: u, hash: hash, type: t });
    
    await saveUsers();
    renderUsersList();
    showToast("User created!", "success");
    
    // Clear
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-pass').value = '';
}

function renderUsersList() {
    const c = document.getElementById('users-list-container');
    if(!usersCache.users.length) { c.innerHTML = "<p>No users yet.</p>"; return; }
    
    c.innerHTML = usersCache.users.map(u => `
        <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #333; font-family:var(--font-mono); font-size:0.8rem;">
            <span>${escapeHtml(u.username)} <span style="color:var(--accent-color);">[${u.type}]</span></span>
            <button class="delete-btn" onclick="deleteUser(${u.id})">Remove</button>
        </div>
    `).join('');
}

function deleteUser(id) {
    if(!confirm("Delete user?")) return;
    usersCache.users = usersCache.users.filter(u => u.id !== id);
    renderUsersList();
    saveUsers();
}

function populateAdminFields() {
    const id = (n) => document.getElementById('edit-' + n);
    const col = (n) => document.getElementById('edit-col-' + n);
    
    id('site-name').value = currentConfig.siteName;
    id('tagline').value = currentConfig.tagline;
    id('leaflets-name').value = currentConfig.leafletsName;
    id('copyright').value = currentConfig.copyright;
    id('window-title').value = currentConfig.metaTitle || "";
    id('meta-desc').value = currentConfig.metaDescription || "";
    id('protected-tags').value = currentConfig.protectedTags || "";
    
    id('bg-image').value = currentConfig.bgImage;
    id('pfp-image').value = currentConfig.pfpImage;
    id('banner-image').value = currentConfig.bannerImage;
    id('custom-css').value = currentConfig.customCss;
    id('widget-padding').value = currentConfig.widgetPadding;
    
    id('reactions-enabled').value = currentConfig.reactionsEnabled;
    id('reaction-icon').value = currentConfig.reactionIcon;
    id('like-label').value = currentConfig.likeLabel;
    id('dislike-label').value = currentConfig.dislikeLabel;
    id('comments').value = currentConfig.allowComments;
    id('allow-anon-msg').checked = currentConfig.allowAnonMessages || false;
    id('disable-signups').checked = currentConfig.disableSignups || false;
    id('allow-video-dl').checked = currentConfig.allowVideoDownloads !== false;

    col('bg').value = currentConfig.colors.bg; col('text').value = currentConfig.colors.text;
    col('sidebar').value = currentConfig.colors.sidebar; col('accent').value = currentConfig.colors.accent;
    col('leaflet').value = currentConfig.colors.leaflet; col('border').value = currentConfig.colors.border;
    col('nav-active').value = currentConfig.colors.navActive;
    col('like').value = currentConfig.colors.like;
    col('dislike').value = currentConfig.colors.dislike;
    col('like-btn').value = currentConfig.colors.likeBtn;
    col('dislike-btn').value = currentConfig.colors.dislikeBtn;
    
    col('queue-bg').value = currentConfig.colors.queueBg || '#0f171f';
    col('toast-bg').value = currentConfig.colors.toastBg || '#0f171f';
    col('overlay-bg').value = currentConfig.colors.overlayBg || '#050505';
}

function toggleAdminPasswordInput() {
    const vis = document.getElementById('admin-post-visibility').value;
    const pass = document.getElementById('admin-post-password');
    pass.disabled = (vis !== 'password');
    if(pass.disabled) pass.value = '';
}

function toggleEditPasswordInput() {
     const vis = document.getElementById('edit-post-visibility').value;
     const pass = document.getElementById('edit-post-password');
     pass.style.display = (vis === 'password') ? 'block' : 'none';
}

// Messaging System
function openMessageModal() {
    const overlay = document.getElementById('message-overlay');
    overlay.style.display = 'flex';
    
    // Handle Anonymous Toggle Visibility
    const anonCheckbox = document.getElementById('msg-anon');
    if (anonCheckbox) {
        const wrapper = anonCheckbox.closest('div'); 
        
        if (!currentUser) {
            // Guest: Hide option, force true
            if(wrapper) wrapper.style.display = 'none';
            anonCheckbox.checked = true;
        } else {
            // Member: Show option, default false
            if(wrapper) wrapper.style.display = 'block';
            anonCheckbox.checked = false;
        }
    }
}

function toggleMsgMode(mode) {
    isMsgDrawMode = (mode === 'draw');
    document.getElementById('msg-mode-write').style.display = isMsgDrawMode ? 'none' : 'block';
    document.getElementById('msg-mode-draw').style.display = isMsgDrawMode ? 'block' : 'none';
    
    document.getElementById('msg-tab-write').style.background = isMsgDrawMode ? 'transparent' : 'var(--accent-color)';
    document.getElementById('msg-tab-write').style.color = isMsgDrawMode ? '#fff' : '#000';
    document.getElementById('msg-tab-write').style.border = isMsgDrawMode ? '1px solid var(--border-color)' : 'none';
    
    document.getElementById('msg-tab-draw').style.background = isMsgDrawMode ? 'var(--accent-color)' : 'transparent';
    document.getElementById('msg-tab-draw').style.color = isMsgDrawMode ? '#000' : '#fff';
    document.getElementById('msg-tab-draw').style.border = isMsgDrawMode ? 'none' : '1px solid var(--border-color)';
    
    if (isMsgDrawMode) {
        setTimeout(() => { 
            initCanvas(); 
        }, 50);
    }
}

// Drawing Logic
function initCanvas() {
    drawCanvas = document.getElementById('draw-canvas');
    if(!drawCanvas) return;
    drawCtx = drawCanvas.getContext('2d', { willReadFrequently: true });
    
    if(drawHistory.length === 0) {
        drawCtx.fillStyle = '#ffffff';
        drawCtx.fillRect(0, 0, 500, 500);
        saveDrawState();
    }
    
    setupDynamicDrawUI();

    let lastX = 0;
    let lastY = 0;

    const startDraw = (e) => {
        isDrawing = true;
        const coords = getCoordinates(e);
        lastX = coords.x;
        lastY = coords.y;
        draw(e); 
    };

    const moveDraw = (e) => {
        if(!isDrawing) return;
        draw(e, lastX, lastY);
        const coords = getCoordinates(e);
        lastX = coords.x;
        lastY = coords.y;
    };

    const endDraw = () => {
        if(isDrawing) {
            isDrawing = false;
            saveDrawState();
        }
    };
    
    // Pointer events for universal support
    drawCanvas.onpointerdown = startDraw;
    drawCanvas.onpointermove = moveDraw;
    drawCanvas.onpointerup = endDraw;
    drawCanvas.onpointerleave = endDraw;
}

function setupDynamicDrawUI() {
    const container = document.getElementById('msg-mode-draw');
    if(!container) return;

    // 1. Inject Color Picker
    const swatch = container.querySelector('.color-swatch');
    if (swatch) {
        const colorContainer = swatch.parentElement;
        if (colorContainer && !document.getElementById('custom-color-picker')) {
            const picker = document.createElement('input');
            picker.type = 'color';
            picker.id = 'custom-color-picker';
            picker.className = 'color-swatch'; 
            picker.style.cssText = "padding:0; border:none; width:25px; height:25px; cursor:pointer; background:none; vertical-align:middle; margin-left:5px;";
            picker.value = currentDrawColor;
            picker.title = "Custom Color";
            
            picker.addEventListener('input', (e) => {
                currentDrawColor = e.target.value;
                currentDrawTool = 'brush';
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                picker.style.boxShadow = "0 0 0 2px var(--accent-color)";
            });
            
            colorContainer.appendChild(picker);
        }
    }

    // 2. Replace Eraser Icon
    const eraserSVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px;fill:currentColor;"><path d="M11.4096 5.50506C13.0796 3.83502 13.9146 3 14.9522 3C15.9899 3 16.8249 3.83502 18.4949 5.50506C20.165 7.1751 21 8.01013 21 9.04776C21 10.0854 20.165 10.9204 18.4949 12.5904L14.3017 16.7837L7.21634 9.69828L11.4096 5.50506Z" fill="currentColor"></path> <path d="M6.1557 10.759L13.2411 17.8443L12.5904 18.4949C12.2127 18.8727 11.8777 19.2077 11.5734 19.5H21C21.4142 19.5 21.75 19.8358 21.75 20.25C21.75 20.6642 21.4142 21 21 21H9C7.98423 20.9747 7.1494 20.1393 5.50506 18.4949C3.83502 16.8249 3 15.9899 3 14.9522C3 13.9146 3.83502 13.0796 5.50506 11.4096L6.1557 10.759Z" fill="currentColor"></path></svg>`;
    
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if(onclick && onclick.includes("'eraser'")) {
            if(btn.innerHTML.indexOf('<svg') === -1) {
                btn.innerHTML = eraserSVG;
                btn.style.display = 'inline-flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
            }
        }
    });
}

function getCoordinates(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function draw(e, startX, startY) {
    if(!isDrawing) return;
    
    const coords = getCoordinates(e);
    const x = coords.x;
    const y = coords.y;
    
    const size = 4; // Square tip size
    
    if(currentDrawTool === 'eraser') {
        drawCtx.fillStyle = '#ffffff';
    } else {
        drawCtx.fillStyle = currentDrawColor;
    }
    
    // Interpolation to fill gaps
    if (startX !== undefined && startY !== undefined) {
        const dx = Math.abs(x - startX);
        const dy = Math.abs(y - startY);
        const sx = (startX < x) ? 1 : -1;
        const sy = (startY < y) ? 1 : -1;
        let err = dx - dy;
        
        let cx = startX;
        let cy = startY;
        
        while (true) {
            drawCtx.fillRect(Math.floor(cx - size/2), Math.floor(cy - size/2), size, size);
            
            if (Math.abs(cx - x) < 1 && Math.abs(cy - y) < 1) break;
            
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; cx += sx; }
            if (e2 < dx) { err += dx; cy += sy; }
        }
    } else {
        drawCtx.fillRect(Math.floor(x - size/2), Math.floor(y - size/2), size, size);
    }
}

function selectColor(el, color) {
    currentDrawColor = color;
    currentDrawTool = 'brush';
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    
    // Sync picker if exists
    const picker = document.getElementById('custom-color-picker');
    if(picker) picker.value = color;
}

function selectTool(tool) {
    currentDrawTool = tool;
}

function saveDrawState() {
    // Keep max 5 steps
    if(drawHistoryStep < drawHistory.length - 1) {
        drawHistory = drawHistory.slice(0, drawHistoryStep + 1);
    }
    drawHistory.push(drawCtx.getImageData(0,0,500,500));
    if(drawHistory.length > 6) drawHistory.shift(); 
    drawHistoryStep = drawHistory.length - 1;
}

function undoDraw() {
    if(drawHistoryStep > 0) {
        drawHistoryStep--;
        drawCtx.putImageData(drawHistory[drawHistoryStep], 0, 0);
    }
}

function redoDraw() {
    if(drawHistoryStep < drawHistory.length - 1) {
        drawHistoryStep++;
        drawCtx.putImageData(drawHistory[drawHistoryStep], 0, 0);
    }
}

function downloadDrawing() {
    const link = document.createElement('a');
    link.download = 'my-drawing.png';
    link.href = drawCanvas.toDataURL();
    link.click();
}

async function submitMessage() {
    const isAnon = document.getElementById('msg-anon') ? document.getElementById('msg-anon').checked : false;
    let messageBody = null;
    let type = 'text';

    if (isMsgDrawMode) {
        // Handle Drawing
        showToast("Uploading Drawing...", "loading");
        isBatchUploading = true; 
        
        try {
            const blob = await new Promise(resolve => drawCanvas.toBlob(resolve));
            const filename = `ask_${Date.now()}_${uuidv4().substring(0,4)}.png`;
            const file = new File([blob], filename, { type: 'image/png' });
            
            await promisifiedUpload(file, 'img/asks/' + filename);
            
            messageBody = 'img/asks/' + filename;
            type = 'image';
            isBatchUploading = false;
        } catch(err) {
            handleUploadError("Drawing Upload Failed: " + err);
            isBatchUploading = false;
            return;
        }
    } else {
        // Handle Text
        messageBody = document.getElementById('msg-content').value;
        if(!messageBody) return showToast("Message cannot be empty", "error");
    }
    
    if (!interactionsCache.messages) interactionsCache.messages = [];
    
    const sender = (isAnon || !currentUser) ? null : currentUser.username;
    
    interactionsCache.messages.push({
        id: Date.now(),
        sender: sender,
        text: messageBody,
        type: type,
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        reply: null,
        replyDate: null,
        isPrivate: false
    });
    
    saveInteractions();
    document.getElementById('msg-content').value = '';
    // Clear drawing
    if(drawCtx) {
        drawCtx.fillStyle = '#ffffff';
        drawCtx.fillRect(0,0,500,500);
        drawHistory = [];
        saveDrawState();
    }
    
    document.getElementById('message-overlay').style.display = 'none';
    showToast("Message sent!", "success");
    
    if(currentUser) renderMemberDashboard();
}

function renderAdminMessages() {
    const container = document.getElementById('admin-messages-list');
    if(!interactionsCache.messages || interactionsCache.messages.length === 0) {
        container.innerHTML = "<p style='color:var(--gray); font-size:0.8rem; font-style:italic;'>No messages.</p>";
        return;
    }
    
    // Sort by newest
    const msgs = [...interactionsCache.messages].sort((a,b) => b.id - a.id);
    
    container.innerHTML = msgs.map(msg => {
        const senderDisplay = msg.sender ? `<span style="color:var(--accent-color);">${escapeHtml(msg.sender)}</span>` : `<span style="opacity:0.5;">Anonymous</span>`;
        const repliedClass = msg.reply ? 'replied' : '';
        const status = msg.reply ? `<span style="font-size:0.6rem; background:var(--lime); color:black; padding:2px 5px; border-radius:4px;">REPLIED</span>` : `<span style="font-size:0.6rem; background:var(--accent-color); color:black; padding:2px 5px; border-radius:4px;">NEW</span>`;
        
        let contentDisplay = escapeHtml(msg.text);
        if (msg.type === 'image') {
            contentDisplay = `<img src="${msg.text}" style="max-width:100%; border-radius:8px; border:1px solid #333;">`;
        }
        
        return `
        <div class="message-card ${repliedClass}" id="msg-card-${msg.id}">
            <div class="message-header">
                <div>From: ${senderDisplay}</div>
                <div style="font-size:0.7rem; color:var(--gray);">${msg.date} ${status}</div>
            </div>
            <div class="message-body">${contentDisplay}</div>
            ${msg.reply ? `<div class="message-reply"><strong>You:</strong> ${escapeHtml(msg.reply)}</div>` : ''}
            <div class="message-actions">
                <button class="action-btn small" onclick="adminReplyPublic(${msg.id})">Post Reply</button>
                ${msg.sender ? `<button class="action-btn small" onclick="adminReplyPrivate(${msg.id})" style="background:var(--sidebar-bg); border:1px solid var(--border-color);">Private Reply</button>` : ''}
                <button class="delete-btn" onclick="adminDeleteMessage(${msg.id})">Delete</button>
            </div>
        </div>`;
    }).join('');
}

function adminReplyPublic(msgId) {
    const msg = interactionsCache.messages.find(m => m.id === msgId);
    if(!msg) return;
    
    switchAdminSubTab('post');
    let quote = `> **Ask from ${msg.sender || 'Anonymous'}:**\n`;
    
    if (msg.type === 'image') {
        quote += `> ![User Drawing](${msg.text})\n\n`;
    } else {
        // Handle multiline text for blockquotes
        const lines = msg.text.split('\n');
        const quotedLines = lines.map(line => `> ${line}`).join('\n');
        quote += `${quotedLines}\n\n`;
    }
    
    document.getElementById('admin-content').value = quote;
    
    // Mark as replied locally
    msg.reply = "[Replied via Public Post]";
    msg.replyDate = new Date().toISOString().slice(0, 16).replace('T', ' ');
    saveInteractions();
}

function adminReplyPrivate(msgId) {
    const reply = prompt("Enter private reply for user's dashboard:");
    if(reply) {
        const msg = interactionsCache.messages.find(m => m.id === msgId);
        if(msg) {
            msg.reply = reply;
            msg.replyDate = new Date().toISOString().slice(0, 16).replace('T', ' ');
            msg.isPrivate = true;
            saveInteractions();
            renderAdminMessages();
            showToast("Reply sent.", "success");
        }
    }
}

function adminDeleteMessage(msgId) {
    if(!confirm("Delete this message?")) return;
    interactionsCache.messages = interactionsCache.messages.filter(m => m.id !== msgId);
    saveInteractions();
    renderAdminMessages();
}

function renderMemberDashboard() {
    // Render My Messages (Last 3)
    const container = document.getElementById('member-messages-list');
    if(!container || !currentUser) return;
    
    const myMsgs = (interactionsCache.messages || [])
        .filter(m => m.sender === currentUser.username)
        .sort((a,b) => b.id - a.id)
        .slice(0, 3);
        
    if(myMsgs.length === 0) {
        container.innerHTML = "<p style='font-size:0.8rem; color:var(--gray);'>You haven't sent any messages.</p>";
        return;
    }
    
    container.innerHTML = myMsgs.map(m => {
        let content = `"${escapeHtml(m.text)}"`;
        if(m.type === 'image') {
            content = `<img src="${m.text}" style="height:50px; border-radius:4px; border:1px solid #333;"> [Drawing]`;
        }
        
        return `
        <div class="user-message-item">
            <div style="font-size:0.75rem; margin-bottom:5px; color:var(--gray);">${m.date}</div>
            <div style="font-style:italic; margin-bottom:5px;">${content}</div>
            ${m.reply ? `<div class="user-message-reply"><span style="color:var(--accent-color);">Admin:</span> ${escapeHtml(m.reply)}</div>` : ''}
        </div>
    `}).join('');
}

// Post Management
async function addPost() {
    const content = document.getElementById('admin-content').value;
    const tagsInput = document.getElementById('admin-tags').value;
    const pinned = document.getElementById('admin-pin').checked;
    const vis = document.getElementById('admin-post-visibility').value;
    const pass = document.getElementById('admin-post-password').value;
    
    if (!content) return showToast("Content required", "error");
    if (vis === 'password' && !pass) return showToast("Password required for protected post.", "error");

    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const isLocal = window.location.protocol === 'file:' && !globalAuthToken;

    // Media Processing via Queue
    let finalMedia = [];
    const filesToUpload = currentPostMediaQueue.filter(item => item.type === 'file');

    if (filesToUpload.length > 0 && !isLocal) {
        showUploadModal("Initializing Batch Upload...");
        isBatchUploading = true;
        
        try {
            for (let i = 0; i < filesToUpload.length; i++) {
                const file = filesToUpload[i].val;
                const count = i + 1;
                const total = filesToUpload.length;
                
                document.getElementById('upload-status-text').innerText = `Uploading image ${count}/${total}: ${file.name}`;
                
                const path = 'img/' + file.name;
                await promisifiedUpload(file, path);
            }
        } catch(err) {
            handleUploadError("Batch Upload Failed: " + err);
            isBatchUploading = false;
            return; 
        }
        isBatchUploading = false; 
    }

    // Construct Final Media List based on Queue Order
    currentPostMediaQueue.forEach(item => {
        if (item.type === 'file') {
            finalMedia.push('img/' + item.val.name);
        } else if (item.type === 'url') {
            finalMedia.push(item.val);
        }
    });

    let savedMedia = finalMedia.length > 0 ? finalMedia : ""; 
    if(finalMedia.length === 1) savedMedia = finalMedia[0];

    const newPost = { 
        id: Date.now(), 
        date: new Date().toISOString().slice(0, 16).replace('T', ' '), 
        content: content, 
        media: savedMedia, 
        tags: tags, 
        pinned: pinned,
        access: { type: vis, value: (vis === 'password' ? pass : null) }
    };
    
    postsCache.push(newPost);
    
    if (filesToUpload.length > 0 && isLocal) {
         alert("Local Mode: You must manually move your files to 'img/' folder.");
    }
    
    isPosting = true;
    
    showUploadModal("Finalizing Post...");
    saveSystem(); 
    
    clearPostInputs();
    renderLeaflets();
    renderTagCloud();
}

function deletePost(postId, event) {
    event.stopPropagation();
    if (!confirm("Delete post?")) return;
    postsCache = postsCache.filter(p => p.id !== postId);
    renderLeaflets();
    renderTagCloud();
    saveSystem(); 
}

function openEditModal(postId, event) {
    if (event) event.stopPropagation();
    const post = postsCache.find(p => p.id === postId);
    if (!post) return;

    document.getElementById('edit-post-id').value = post.id;
    document.getElementById('edit-post-content').value = post.content;
    document.getElementById('edit-post-tags').value = (post.tags || []).join(', ');
    document.getElementById('edit-post-pin').checked = post.pinned || false;

    const vis = (post.access && post.access.type) ? post.access.type : 'public';
    document.getElementById('edit-post-visibility').value = vis;
    toggleEditPasswordInput();
    if(vis === 'password') document.getElementById('edit-post-password').value = post.access.value;

    // Populate Queue
    currentPostMediaQueue = [];
    if (post.media) {
        let arr = Array.isArray(post.media) ? post.media : [post.media];
        arr.forEach(url => {
            if(url.trim().length > 0) currentPostMediaQueue.push({ type: 'url', val: url.trim() });
        });
    }
    renderMediaQueue('edit');

    document.getElementById('edit-overlay').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-overlay').style.display = 'none';
    currentPostMediaQueue = []; // Clear
}

function submitEditedPost() {
    const id = parseInt(document.getElementById('edit-post-id').value);
    const content = document.getElementById('edit-post-content').value;
    const tagsInput = document.getElementById('edit-post-tags').value;
    const pinned = document.getElementById('edit-post-pin').checked;
    const vis = document.getElementById('edit-post-visibility').value;
    const pass = document.getElementById('edit-post-password').value;

    if (!content) return showToast("Content required", "error");

    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    let media = currentPostMediaQueue.map(item => item.val);
    if(media.length === 0) media = "";
    else if(media.length === 1) media = media[0];

    const idx = postsCache.findIndex(p => p.id === id);
    if (idx !== -1) {
        postsCache[idx].content = content;
        postsCache[idx].media = media;
        postsCache[idx].tags = tags;
        postsCache[idx].pinned = pinned;
        postsCache[idx].access = { type: vis, value: (vis === 'password' ? pass : null) };
        
        saveSystem();
        closeEditModal();
        renderLeaflets();
        renderTagCloud();
        showToast("Post updated.", "success");
    }
}

function togglePin(postId, event) {
    event.stopPropagation();
    const post = postsCache.find(p => p.id === postId);
    if(post) {
        post.pinned = !post.pinned;
        renderLeaflets();
        saveSystem();
    }
}

// Filter Logic
function handleSearch(val) {
    activeSearchQuery = val.trim().toLowerCase();
    renderLeaflets();
}

function filterByTag(tag) {
    if (activeTagFilter === tag) {
        activeTagFilter = null; 
    } else {
        activeTagFilter = tag;
    }
    renderLeaflets();
    toggleMobileMenu(false); 
}

function clearFilters() {
    activeTagFilter = null;
    activeSearchQuery = "";
    document.getElementById('search-input').value = "";
    renderLeaflets();
}

function toggleMobileMenu(forceState) {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (forceState === false) {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    } else {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    }
}

// Access Control Logic
function checkAccess(post) {
    if (isAdminLoggedIn) return true;
    
    // Global Tag Protection (VIP)
    if (currentConfig.protectedTags && post.tags) {
        const protectedList = currentConfig.protectedTags.split(',').map(t => t.trim());
        if (post.tags.some(t => protectedList.includes(t))) {
            if (!currentUser || currentUser.type !== 'vip') return false;
        }
    }

    if (!post.access || post.access.type === 'public') return true;
    if (post.access.type === 'member') return !!currentUser;
    if (post.access.type === 'admin') return false; 
    if (post.access.type === 'password') {
        return false; 
    }
    return true;
}

function unlockPost(id) {
    const post = postsCache.find(p => p.id === id);
    const input = document.getElementById('unlock-' + id).value;
    if(input === post.access.value) {
        const contentHtml = typeof marked !== 'undefined' ? marked.parse(post.content) : post.content;
        const el = document.getElementById('content-' + id);
        el.innerHTML = contentHtml;
        
        if(post.media && post.media.length > 0) {
             const mEl = document.getElementById('media-' + id);
             if(mEl) mEl.style.display = 'block'; 
        }

        document.getElementById('locked-wrap-' + id).style.display = 'none';
    } else {
        alert("Incorrect Password");
    }
}

function generateMediaHTML(url, idPrefix, openViewerClick) {
    const type = getMediaType(url);
    const uid = idPrefix + '-' + Math.random().toString(36).substr(2, 9);
    
    if (type === 'video') {
        const dlBtn = (currentConfig.allowVideoDownloads !== false) 
            ? `<button onclick="event.stopPropagation(); MediaController.download('${url}')">${MediaController.getIcon('dl')}</button>` 
            : '';
            
        return `<div class="lbm-media-wrapper" id="wrapper-${uid}" onclick="event.stopPropagation()">
            <video src="${url}" id="media-${uid}" playsinline onclick="MediaController.togglePlay('${uid}')" ontimeupdate="MediaController.updateTime('${uid}')"></video>
            <div class="lbm-overlay-play" id="overlay-play-${uid}" onclick="MediaController.togglePlay('${uid}')">${MediaController.getIcon('play')}</div>
            <div class="lbm-controls">
                <button id="play-btn-${uid}" onclick="MediaController.togglePlay('${uid}')">${MediaController.getIcon('play')}</button>
                <div class="lbm-scrubber-box"><input type="range" class="lbm-scrubber" id="seek-${uid}" value="0" min="0" max="100" oninput="MediaController.seek('${uid}', this.value)"></div>
                <div class="lbm-vol-box">
                    <button id="vol-btn-${uid}" onclick="MediaController.toggleMute('${uid}')">${MediaController.getIcon('vol')}</button>
                    <input type="range" class="lbm-volume" min="0" max="1" step="0.1" value="1" oninput="MediaController.setVolume('${uid}', this.value)">
                </div>
                ${dlBtn}
                <button onclick="MediaController.toggleFS('${uid}')">${MediaController.getIcon('fs')}</button>
            </div>
        </div>`;
    } 
    else if (type === 'audio') {
        return `<div class="lbm-media-wrapper audio-mode" onclick="event.stopPropagation()">
            <audio src="${url}" id="media-${uid}" ontimeupdate="MediaController.updateTime('${uid}')"></audio>
            <div class="lbm-controls">
                <button id="play-btn-${uid}" onclick="MediaController.togglePlay('${uid}')">${MediaController.getIcon('play')}</button>
                <div class="lbm-scrubber-box"><input type="range" class="lbm-scrubber" id="seek-${uid}" value="0" min="0" max="100" oninput="MediaController.seek('${uid}', this.value)"></div>
                <div class="lbm-vol-box">
                    <button id="vol-btn-${uid}" onclick="MediaController.toggleMute('${uid}')">${MediaController.getIcon('vol')}</button>
                    <input type="range" class="lbm-volume" min="0" max="1" step="0.1" value="1" oninput="MediaController.setVolume('${uid}', this.value)">
                </div>
            </div>
        </div>`;
    } 
    else {
        return `<div class="leaflet-media-container" onclick="event.stopPropagation(); ${openViewerClick}"><img src="${url}" alt="Media" onerror="this.style.display='none'"></div>`;
    }
}

// Render Logic
function renderLeaflets() {
    const container = document.getElementById('leaflets-container');
    const title = document.getElementById('header-leaflets-title');
    const clrBtn = document.getElementById('clear-filter-btn');
    const sortMode = document.getElementById('sort-filter').value;

    let posts = [...postsCache];

    posts.sort((a, b) => {
        if (sortMode === 'newest') return b.id - a.id;
        if (sortMode === 'oldest') return a.id - b.id;
        if (sortMode === 'popular') {
            const likesA = (interactionsCache[a.id]?.likes || 0);
            const likesB = (interactionsCache[b.id]?.likes || 0);
            return likesB - likesA;
        }
        if (sortMode === 'controversial') {
            const dislikesA = (interactionsCache[a.id]?.dislikes || 0);
            const dislikesB = (interactionsCache[b.id]?.dislikes || 0);
            return dislikesB - dislikesA;
        }
        return b.id - a.id;
    });

    posts.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0; 
    });

    if (activeSearchQuery || activeTagFilter) {
        posts = posts.filter(p => {
            const contentLower = p.content.toLowerCase();
            const matchesSearch = !activeSearchQuery || contentLower.includes(activeSearchQuery);
            
            const postTags = p.tags || [];
            const matchesTag = !activeTagFilter || postTags.includes(activeTagFilter);
            
            return matchesSearch && matchesTag;
        });

        let status = "Found";
        if(activeTagFilter) status = `Tag: //${activeTagFilter}`;
        if(activeSearchQuery) status += ` searching "${activeSearchQuery}"`;
        title.innerText = status;
        clrBtn.style.display = 'inline-block';
    } else {
        title.innerText = "Recent " + currentConfig.leafletsName;
        clrBtn.style.display = 'none';
    }

    if(posts.length === 0) { container.innerHTML = `<p style="font-family:var(--font-mono); color:var(--gray);">No matching content.</p>`; return; }
    
    let userReactions = {};
    try {
        userReactions = JSON.parse(localStorage.getItem(LOCAL_REACTIONS_KEY) || '{}');
    } catch(e) {}

    container.innerHTML = posts.map(post => {
        const ints = interactionsCache[post.id] || { likes: 0, dislikes: 0 };
        const total = (ints.likes || 0) + (ints.dislikes || 0);
        const ratio = total === 0 ? 50 : (ints.likes / total) * 100;
        
        const isAccessible = checkAccess(post);
        const isPasswordLocked = post.access && post.access.type === 'password' && !isAdminLoggedIn;
        
        let contentHtml = '';
        let mediaHtml = '';
        
        // Only render actual content if accessible
        if (isAccessible && !isPasswordLocked) {
            contentHtml = typeof marked !== 'undefined' ? marked.parse(post.content) : post.content;
            
            if (post.media) {
                let mediaArray = Array.isArray(post.media) ? post.media : [post.media];
                if (mediaArray.length > 0) {
                    const firstItem = mediaArray[0];
                    const countBadge = mediaArray.length > 1 ? `<div class="media-count-badge">+${mediaArray.length - 1}</div>` : '';
                    mediaHtml = `<div class="leaflet-media-container" id="media-${post.id}">${generateMediaHTML(firstItem, 'post-'+post.id, `openLightbox(${post.id})`)}${countBadge}</div>`;
                }
            }
        } else {
            contentHtml = `<div style="padding:2rem; text-align:center; opacity:0.3; font-family:var(--font-mono); font-size:0.7rem;">[DATA REDACTED]</div>`;
            mediaHtml = ''; 
        }

        let lockOverlay = '';
        let clickAction = `onclick="openLightbox(${post.id})"`;
        let reactions = '';

        if (!isAccessible) {
            clickAction = '';
            
            let lockText = "Login to view";
            let lockTitle = "PROTECTED CONTENT";
            
            if (currentUser) {
                lockTitle = "VIP CONTENT";
                lockText = "VIP Status Required";
            }
            
            lockOverlay = `
                <div class="locked-overlay">
                    <span class="locked-icon">🔒</span>
                    <div class="locked-text">${lockTitle}</div>
                    <div style="font-size:0.7rem; color:var(--gray);">${lockText}</div>
                </div>`;
        } else if (isPasswordLocked) {
            clickAction = '';
            lockOverlay = `
                <div class="locked-overlay" id="locked-wrap-${post.id}">
                    <span class="locked-icon">🔑</span>
                    <div class="locked-text">PASSWORD REQUIRED</div>
                    <div style="display:flex; gap:5px; margin-top:10px;">
                        <input type="password" id="unlock-${post.id}" class="setup-input" placeholder="Password" style="margin-bottom:0; font-size:0.7rem; padding:4px;" onclick="event.stopPropagation()">
                        <button class="action-btn" style="width:auto; padding:4px 8px; font-size:0.7rem;" onclick="event.stopPropagation(); unlockPost(${post.id})">Go</button>
                    </div>
                </div>`;
        } else if (currentConfig.reactionsEnabled) {
            let [lTxt, dTxt] = [currentConfig.likeLabel || '(＾∇＾)', currentConfig.dislikeLabel || '(；へ：)'];
            if(currentConfig.reactionIcon === 'thumb') [lTxt, dTxt] = ['👍', '👎'];
            if(currentConfig.reactionIcon === 'arrow') [lTxt, dTxt] = ['▲', '▼'];
            
            const myAction = userReactions[post.id];
            const likeActive = myAction === 'like' ? 'active-reaction' : '';
            const dislikeActive = myAction === 'dislike' ? 'active-reaction' : '';

            reactions = `
            <div class="reaction-widget" onclick="event.stopPropagation()">
                <button class="reaction-btn like-btn ${likeActive}" onclick="handleReaction(${post.id}, 'like')">${ints.likes || 0} ${lTxt}</button>
                <div class="reaction-bar"><div class="reaction-fill" style="width: ${ratio}%"></div></div>
                <button class="reaction-btn dislike-btn ${dislikeActive}" onclick="handleReaction(${post.id}, 'dislike')">${dTxt} ${ints.dislikes || 0}</button>
            </div>`;
        }
        
        const avatar = (currentConfig.pfpImage && currentConfig.pfpImage.length > 5) ? `<img src="${currentConfig.pfpImage}" style="width:100%; height:100%; object-fit:cover;">` : '🌿';
        const authorName = currentConfig.siteName || "Admin";

        const tagsHtml = (post.tags && post.tags.length > 0) 
            ? `<div style="margin-top:10px;padding-left:1rem;">${post.tags.map(t => `<span class="tag-link" onclick="event.stopPropagation(); filterByTag('${escapeHtml(t)}')">//${escapeHtml(t)}</span>`).join(' ')}</div>` 
            : '';

        const delBtn = isAdminLoggedIn ? `<button class="delete-btn" onclick="deletePost(${post.id}, event)">[x] Delete</button>` : '';
        const editBtn = isAdminLoggedIn ? `<button class="pin-btn" onclick="openEditModal(${post.id}, event)">[Edit]</button>` : '';
        const pinToggle = isAdminLoggedIn ? `<button class="pin-btn" onclick="togglePin(${post.id}, event)">${post.pinned ? '[Unpin]' : '[Pin]'}</button>` : '';
        const shareBtn = `<button class="pin-btn" onclick="copyPermalink(${post.id}, event)" title="Link to this post" style="margin-left:auto;">#</button>`;
        
        const pinIcon = post.pinned ? '<span style="color:var(--accent-color);margin-right:5px;">📌</span>' : '';

        return `
        <article class="leaflet-item ${post.pinned ? 'pinned-post' : ''}" id="${post.id}" ${clickAction}>
            <div class="leaflet-avatar">${avatar}</div>
            <div class="leaflet-body" style="position:relative;">
                <div class="leaflet-header">${pinIcon}<span class="leaflet-author">${authorName}</span><span>${post.date}</span>${shareBtn}${editBtn}${pinToggle}${delBtn}</div>
                <div class="leaflet-content">
                    <div class="text-content-wrapper" id="content-${post.id}">${contentHtml}</div>
                    ${mediaHtml}
                </div>
                ${lockOverlay}
                ${tagsHtml}
                ${reactions}
            </div>
        </article>`;
    }).join('');

    setTimeout(() => {
        posts.forEach(post => {
            const el = document.getElementById(`content-${post.id}`);
            if(el && el.scrollHeight > 250) {
                el.innerHTML += `
                <div class="read-more-overlay" id="overlay-${post.id}">
                    <button class="read-more-btn" onclick="event.stopPropagation(); toggleContent(${post.id})">+ Show More</button>
                </div>`;
            } else if (el) {
                el.style.maxHeight = 'none'; 
            }
        });
    }, 0);
}

function toggleContent(id) {
    const el = document.getElementById(`content-${id}`);
    const overlay = document.getElementById(`overlay-${id}`);
    if(el) el.classList.add('expanded');
    if(overlay) overlay.style.display = 'none';
}

function renderGallery() {
    const container = document.getElementById('gallery-container');
    const items = [...postsCache].sort((a,b) => b.id - a.id).filter(p => p.media && p.media.length > 0 && checkAccess(p));
    
    if(items.length === 0) { container.innerHTML = "<p style='font-family:var(--font-mono);color:var(--gray);'>No accessible images.</p>"; return; }
    
    let flatMedia = [];
    items.forEach(post => {
        let arr = Array.isArray(post.media) ? post.media : [post.media];
        arr.forEach(m => flatMedia.push({url: m, id: post.id}));
    });

    container.innerHTML = flatMedia.map(item => {
        const type = getMediaType(item.url);
        let el;
        if (type === 'video') el = `<video src="${item.url}" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>`;
        else if (type === 'audio') el = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#222;">🎵 AUDIO</div>`;
        else el = `<img src="${item.url}" loading="lazy">`;
        
        return `<div class="gallery-item" onclick="event.stopPropagation(); openMediaViewer('${item.url}', '${type}')">${el}</div>`;
    }).join('');
}

function renderTagCloud() {
    const container = document.getElementById('tag-cloud-container');
    if(!container) return;
    
    const allTags = new Set();
    postsCache.forEach(p => {
        if(p.tags) p.tags.forEach(t => allTags.add(t));
    });
    
    if(allTags.size === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = '<div style="margin:10px 0; border-top:1px dotted var(--border-color); padding-top:10px; font-size:11px; color:var(--gray); font-family:var(--font-mono);">TAGS</div>' + 
        Array.from(allTags).sort().map(tag => {
            const activeClass = (activeTagFilter === tag) ? 'active' : '';
            return `<button class="tag-cloud-item ${activeClass}" onclick="filterByTag('${escapeHtml(tag)}')">//${escapeHtml(tag)}</button>`;
        }).join('');
}

// User Interaction
function handleReaction(postId, type) {
    if(!interactionsCache[postId]) interactionsCache[postId] = { likes: 0, dislikes: 0, comments: [] };
    
    let userReactions = {};
    try { userReactions = JSON.parse(localStorage.getItem(LOCAL_REACTIONS_KEY) || '{}'); } catch(e) {}
    
    const currentAction = userReactions[postId];
    
    if (currentAction === type) {
        interactionsCache[postId][type + 's'] = Math.max(0, (interactionsCache[postId][type + 's'] || 0) - 1);
        delete userReactions[postId];
        showToast("Vote removed.", "info");
    } else {
        if (currentAction) {
            interactionsCache[postId][currentAction + 's'] = Math.max(0, (interactionsCache[postId][currentAction + 's'] || 0) - 1);
        }
        interactionsCache[postId][type + 's'] = (interactionsCache[postId][type + 's'] || 0) + 1;
        userReactions[postId] = type;
        showToast("Vote recorded!", "success");
    }
    
    localStorage.setItem(LOCAL_REACTIONS_KEY, JSON.stringify(userReactions));
    renderLeaflets();
    if(currentLightboxPostId === postId) openLightbox(postId); 
    saveInteractions();
}

// Helper to safely prepare reply in Lightbox
function prepareReply(postId, commentId) {
    if (!interactionsCache[postId] || !interactionsCache[postId].comments) return;
    const comment = interactionsCache[postId].comments.find(c => c.id === commentId);
    if (comment) {
        document.getElementById('comment-parent-id').value = comment.id;
        document.getElementById('reply-display').style.display = 'block';
        document.getElementById('reply-name').innerText = comment.author;
    }
}
window.prepareReply = prepareReply; 

function openLightbox(postId) {
    const post = postsCache.find(p => p.id === postId);
    if(!post) return;
    
    if(!checkAccess(post) && !isAdminLoggedIn && post.access.type !== 'password') {
        return showToast("Access Denied", "error");
    }
    
    // Re-check password lock for lightbox view
    if (post.access && post.access.type === 'password' && !isAdminLoggedIn) {
         const overlay = document.getElementById('locked-wrap-' + postId);
         if(overlay && overlay.style.display !== 'none') return showToast("Unlock post first.", "error");
    }
    
    currentLightboxPostId = postId;
    
    const body = document.getElementById('lightbox-body');
    const ints = interactionsCache[postId] || { comments: [] };
    const comments = ints.comments || [];
    const likes = ints.likes || 0;
    const dislikes = ints.dislikes || 0;
    
    let userReactions = {};
    try { userReactions = JSON.parse(localStorage.getItem(LOCAL_REACTIONS_KEY) || '{}'); } catch(e) {}
    const myAction = userReactions[postId];
    const likeActive = myAction === 'like' ? 'active' : '';
    const dislikeActive = myAction === 'dislike' ? 'active' : '';
    
    const total = likes + dislikes;
    const ratio = total === 0 ? 50 : (likes / total) * 100;

    let [lTxt, dTxt] = [currentConfig.likeLabel || '(＾∇＾)', currentConfig.dislikeLabel || '(；へ：)'];
    if(currentConfig.reactionIcon === 'thumb') [lTxt, dTxt] = ['👍', '👎'];
    if(currentConfig.reactionIcon === 'arrow') [lTxt, dTxt] = ['▲', '▼'];

    let mediaHtml = '';
    if (post.media) {
         let mediaArray = Array.isArray(post.media) ? post.media : [post.media];
         mediaHtml = mediaArray.map(url => {
             return `<div class="leaflet-media-container">${generateMediaHTML(url, 'lightbox-'+postId, '')}</div>`;
         }).join('');
    }
    
    const contentHtml = typeof marked !== 'undefined' ? marked.parse(post.content) : post.content;
    
    const avatar = (currentConfig.pfpImage && currentConfig.pfpImage.length > 5) ? `<img src="${currentConfig.pfpImage}" style="width:100%; height:100%; object-fit:cover;">` : '🌿';
    const authorName = currentConfig.siteName || "Admin";

    let commentsHtml = '';
    if (currentConfig.allowComments) {
        const renderTree = (pid, d) => {
            const kids = comments.filter(c => c.parentId === pid);
            if(!kids.length) return '';
            return `<ul class="${d?'reply-list':'comments-list'}">` + kids.map(c => {
                const initial = c.author ? escapeHtml(c.author).charAt(0).toUpperCase() : '?';
                const adminClass = c.isAdmin ? 'admin-comment' : '';
                const adminBadge = c.isAdmin ? '<span class="admin-badge">ADMIN</span>' : '';
                
                return `
                <li class="comment-item ${adminClass}">
                    <div class="comment-inner">
                        <div class="comment-avatar">${initial}</div>
                        <div class="comment-body">
                            <div class="comment-header">
                                <span class="comment-author">${escapeHtml(c.author)} ${adminBadge}</span>
                                <span>${c.date}</span>
                                ${isAdminLoggedIn ? `<button class="delete-btn" style="float:right;" onclick="deleteComment(${postId}, ${c.id})">[x]</button>` : ''}
                            </div>
                            <div>${escapeHtml(c.text)}</div>
                            <button class="reply-btn" onclick="prepareReply(${postId}, ${c.id})">Reply</button>
                        </div>
                    </div>
                    ${renderTree(c.id, d+1)}
                </li>`;
            }).join('') + `</ul>`;
        };
        
        const defaultName = isAdminLoggedIn ? (currentConfig.siteName || "Admin") : (currentUser ? currentUser.username : "");
        
        commentsHtml = `
        <div class="comments-section">
            <div class="lightbox-comment-form">
                <input type="text" id="comment-author" placeholder="Name" value="${defaultName}" ${currentUser ? 'readonly' : ''}>
                <input type="hidden" id="comment-parent-id">
                <div id="reply-display" style="display:none;font-size:11px;color:var(--accent-color);font-family:var(--font-mono);margin-bottom:5px;">Replying to <span id="reply-name"></span> <button onclick="this.parentNode.style.display='none';document.getElementById('comment-parent-id').value=''">x</button></div>
                ${getMdToolbar('comment-text')}
                <textarea id="comment-text" class="has-toolbar" placeholder="Write your reply..."></textarea>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <button class="action-btn" style="width:auto;" onclick="submitComment(${postId})">Reply</button>
                    <span class="form-footer-text">Please be respectful.</span>
                </div>
            </div>
            <div id="comments-container" class="lightbox-comments-list">${renderTree(null, 0)}</div>
        </div>`;
    }

    const tagsHtml = (post.tags && post.tags.length > 0) 
            ? `<div style="margin-top:10px;">${post.tags.map(t => `<span class="tag-link" onclick="event.stopPropagation(); filterByTag('${escapeHtml(t)}'); closeLightbox();">//${escapeHtml(t)}</span>`).join(' ')}</div>` 
            : '';
    
    const pinIcon = post.pinned ? '<span style="color:var(--accent-color);margin-right:5px;">📌</span>' : '';

    body.innerHTML = `
        <div class="leaflet-item" style="cursor:default; border:none; background:transparent; border-radius:0; box-shadow:none;">
            <div class="leaflet-avatar">${avatar}</div>
            <div class="leaflet-body">
                <div class="leaflet-header">${pinIcon}<span class="leaflet-author">${authorName}</span><span>${post.date}</span></div>
                <div class="leaflet-content"><div>${contentHtml}</div>${mediaHtml}</div>
                ${tagsHtml}
            </div>
        </div>
        
        <div class="lightbox-stats" style="align-items:center;">
            <div class="lightbox-stat-item" style="color:var(--like-color); white-space:nowrap;"><b>${likes}</b> ${lTxt}</div>
            <div class="reaction-bar" style="margin:0 15px; height:4px; flex:1; background:var(--border-color); border-radius:2px; overflow:hidden;">
                <div class="reaction-fill" style="width: ${ratio}%; height:100%; background: linear-gradient(90deg, var(--like-color), var(--accent-color)); transition:width 0.3s;"></div>
            </div>
            <div class="lightbox-stat-item" style="color:var(--dislike-color); white-space:nowrap;"><b>${dislikes}</b> ${dTxt}</div>
            <div class="lightbox-stat-item" style="margin-left:15px; padding-left:15px; border-left:1px solid var(--border-color); white-space:nowrap;"><b>${comments.length}</b> Comments</div>
        </div>

        <div class="lightbox-actions">
            <button class="lightbox-action-btn ${likeActive}" onclick="handleReaction(${postId}, 'like')">${lTxt}</button>
            <button class="lightbox-action-btn ${dislikeActive}" onclick="handleReaction(${postId}, 'dislike')">${dTxt}</button>
        </div>

        ${commentsHtml}`;
    
    document.getElementById('leaflet-lightbox').classList.add('open');
    document.body.classList.add('modal-open');
}

function submitComment(postId) {
    const author = document.getElementById('comment-author').value || "Guest";
    const text = document.getElementById('comment-text').value;
    if(!text) return;
    const pidVal = document.getElementById('comment-parent-id').value;
    
    if(!interactionsCache[postId]) interactionsCache[postId] = { likes: 0, dislikes: 0, comments: [] };
    if(!interactionsCache[postId].comments) interactionsCache[postId].comments = [];
    
    interactionsCache[postId].comments.push({ 
        id: Date.now(), 
        author, 
        text, 
        date: new Date().toISOString().slice(0,16).replace('T',' '), 
        parentId: pidVal ? parseInt(pidVal) : null,
        isAdmin: isAdminLoggedIn
    });
    openLightbox(postId); 
    saveInteractions();
}

function deleteComment(postId, cid) {
    if(confirm("Delete?")) {
        interactionsCache[postId].comments = interactionsCache[postId].comments.filter(c => c.id !== cid);
        openLightbox(postId);
        saveInteractions();
    }
}

// Export Utilities
async function generateConfigFile(mode) {
    const data = await prepareSystemData(mode);
    if(!data) return;
    const content = `window.AZUMINT_SYSTEM = "${unicodeToBase64(JSON.stringify(data))}";`;
    downloadFile(content, "system.js");
}

function downloadStaticIndex() {
    applyVisualConfig();
    const clone = document.documentElement.cloneNode(true);
    const html = "<!DOCTYPE html>\n" + clone.outerHTML;
    downloadFile(html, "index.html");
}

// RSS Feed Generator
function generateRSS() {
    const siteUrl = window.location.origin + window.location.pathname.replace('index.html', '');
    const now = new Date().toUTCString();
    
    // Only public posts in RSS
    let items = [...postsCache].sort((a,b) => b.id - a.id)
        .filter(p => !p.access || p.access.type === 'public')
        .map(post => {
        const link = `${siteUrl}#${post.id}`;
        let desc = post.content;
        
        let arr = Array.isArray(post.media) ? post.media : (post.media ? [post.media] : []);
        if(arr.length > 0) desc += ` <br><a href="${arr[0]}">[Attached Media]</a>`;
        
        return `
        <item>
            <title>${post.date}</title>
            <link>${link}</link>
            <guid>${link}</guid>
            <pubDate>${new Date(post.id).toUTCString()}</pubDate>
            <description><![CDATA[${desc}]]></description>
        </item>`;
    }).join('');

    const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
<title>${currentConfig.siteName}</title>
<link>${siteUrl}</link>
<description>${currentConfig.tagline}</description>
<lastBuildDate>${now}</lastBuildDate>
<generator>LBM 0.6</generator>
${items}
</channel>
</rss>`;
    return rss;
}

function downloadRSS() {
    const rssContent = generateRSS();
    downloadFile(rssContent, "rss.xml");
}

// UI Helpers
function showSetup() { document.getElementById('setup-overlay').style.display = 'flex'; document.title = "System Setup"; }
function hideUploadModal() { const m = document.getElementById('upload-modal'); if(m) m.style.display='none'; document.getElementById('upload-progress-bar').style.width='0%'; }
function showUploadModal(txt) { document.getElementById('upload-modal').style.display='flex'; document.getElementById('upload-status-text').innerText=txt; document.getElementById('upload-error-log').style.display='none'; document.getElementById('upload-close-btn').style.display='none'; }
function handleUploadError(msg) { document.getElementById('upload-status-text').innerText="FAILED"; document.getElementById('upload-status-text').style.color="#ff7675"; document.getElementById('upload-error-log').innerText=msg; document.getElementById('upload-error-log').style.display='block'; document.getElementById('upload-close-btn').style.display='inline-block'; }

function updateSyncStatus(s,t) { const d=document.getElementById('sync-dot'); if(d) d.className='sync-indicator '+s; const tx=document.getElementById('sync-text'); if(tx) tx.innerText=t; }
function markUnsynced() { updateSyncStatus('unsynced', 'Unsaved Changes'); }

function handleFileSelect() { 
    const files = document.getElementById('file-selector').files; 
    if(files.length > 0) { 
        for(let i=0; i<files.length; i++) {
            currentPostMediaQueue.push({ type: 'file', val: files[i] });
        }
        renderMediaQueue('admin');
        document.getElementById('file-selector').value = ''; 
    } 
}

function addUrlToQueue(mode) {
    const inputId = mode === 'admin' ? 'admin-media-input' : 'edit-add-media-input';
    const val = document.getElementById(inputId).value.trim();
    if(val) {
        currentPostMediaQueue.push({ type: 'url', val: val });
        renderMediaQueue(mode);
        document.getElementById(inputId).value = '';
    }
}

function renderMediaQueue(mode) {
    const containerId = mode === 'admin' ? 'admin-media-queue' : 'edit-media-queue';
    const container = document.getElementById(containerId);
    if(!container) return;

    container.innerHTML = currentPostMediaQueue.map((item, idx) => {
        let prev = '';
        let name = '';
        
        if(item.type === 'file') {
            name = item.val.name;
            if(item.val.type.startsWith('image/')) {
                 prev = `<img src="${URL.createObjectURL(item.val)}" class="media-preview">`;
            } else {
                 prev = `<div class="media-preview" style="background:#333; display:flex; align-items:center; justify-content:center;">FILE</div>`;
            }
        } else {
            name = item.val;
            if(item.val.match(/\.(jpeg|jpg|gif|png)$/) != null) {
                 prev = `<img src="${item.val}" class="media-preview">`;
            } else {
                 prev = `<div class="media-preview" style="background:#333; display:flex; align-items:center; justify-content:center;">URL</div>`;
            }
        }

        return `
        <div class="media-queue-item">
            ${prev}
            <div class="media-info">${name}</div>
            <div class="queue-controls">
                <button class="queue-btn" onclick="moveQueueItem(${idx}, -1, '${mode}')">▲</button>
                <button class="queue-btn" onclick="moveQueueItem(${idx}, 1, '${mode}')">▼</button>
                <button class="queue-btn remove" onclick="removeQueueItem(${idx}, '${mode}')">×</button>
            </div>
        </div>`;
    }).join('');
}

function moveQueueItem(idx, dir, mode) {
    if(idx + dir < 0 || idx + dir >= currentPostMediaQueue.length) return;
    const temp = currentPostMediaQueue[idx];
    currentPostMediaQueue[idx] = currentPostMediaQueue[idx+dir];
    currentPostMediaQueue[idx+dir] = temp;
    renderMediaQueue(mode);
}

function removeQueueItem(idx, mode) {
    currentPostMediaQueue.splice(idx, 1);
    renderMediaQueue(mode);
}

function clearPostInputs() { 
    document.getElementById('admin-content').value=''; 
    document.getElementById('admin-media').value=''; 
    document.getElementById('admin-tags').value=''; 
    document.getElementById('admin-pin').checked = false; 
    document.getElementById('file-selector').value=''; 
    document.getElementById('upload-file-info').style.display='none'; 
    currentPostMediaQueue = [];
    renderMediaQueue('admin');
}

function getMediaType(url) { 
    if(!url) return null; 
    const cleanUrl = url.split('?')[0];
    const ext = cleanUrl.split('.').pop().toLowerCase(); 
    if (['mp4','webm','mov'].includes(ext)) return 'video';
    if (['mp3','wav','ogg','m4a','flac'].includes(ext)) return 'audio';
    return 'image';
}

function switchTab(t) { 
    document.querySelectorAll('.view-section').forEach(e=>e.classList.remove('active')); 
    document.querySelectorAll('.nav-btn').forEach(e=>e.classList.remove('active')); 
    document.getElementById('tab-'+t).classList.add('active'); 
    
    if(t==='leaflets') document.getElementById('nav-leaflets-btn').classList.add('active'); 
    if(t==='member-login' && !currentUser && !isAdminLoggedIn) document.getElementById('nav-login-btn').classList.add('active'); 
    if(t==='register') document.getElementById('nav-register-btn').classList.add('active'); 
    
    if(t==='member-dashboard' && currentUser) {
        renderMemberDashboard();
    }
}

function switchAdminSubTab(t) { 
    document.getElementById('admin-sub-post').style.display='none'; 
    document.getElementById('admin-sub-settings').style.display='none'; 
    document.getElementById('admin-sub-users').style.display='none';
    document.getElementById('admin-sub-'+t).style.display='block'; 
    
    if(t==='users') {
        renderUsersList();
        renderAdminMessages();
    }
}

function openMediaViewer(url, type) { 
    currentMediaList = [];
    [...postsCache].sort((a,b) => b.id - a.id).forEach(p => {
         let arr = Array.isArray(p.media) ? p.media : (p.media ? [p.media] : []);
         arr.forEach(m => {
            const t = getMediaType(m);
            if(checkAccess(p)) currentMediaList.push({url: m, type: t});
         });
    });
    
    currentMediaIndex = currentMediaList.findIndex(m => m.url === url);
    if(currentMediaIndex === -1) { currentMediaList = [{url, type}]; currentMediaIndex = 0; }
    
    const wrapper = document.getElementById('media-content-wrapper');
    if(wrapper) {
        wrapper.removeAttribute('onclick');
    }

    renderMediaOverlay();
    document.getElementById('media-fullscreen-overlay').classList.add('active');
    document.body.classList.add('modal-open'); 
}

function renderMediaOverlay() {
    const item = currentMediaList[currentMediaIndex];
    if(!item) return;
    const w = document.getElementById('media-content-wrapper');
    
    // Check if we already have the structure to animate
    let box = document.getElementById('media-transition-box');
    
    if (!box) {
        // Initial Render
        w.innerHTML = `
            <button class="media-nav prev" onclick="event.stopPropagation(); navigateMedia(-1)">&lt;</button>
            <div id="media-transition-box" style="display:flex; align-items:center; justify-content:center; transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); overflow:hidden; position: relative;">
                <!-- Content injected here -->
            </div>
            <button class="media-nav next" onclick="event.stopPropagation(); navigateMedia(1)">&gt;</button>
        `;
        box = document.getElementById('media-transition-box');
    }
    
    // Helper to update content
    const updateContent = (url, type) => {
        // Fade out old
        box.style.opacity = '0.5';
        
        const finish = (html, width, height) => {
            box.style.width = width ? width + 'px' : 'auto';
            box.style.height = height ? height + 'px' : 'auto';
            box.innerHTML = html;
            box.style.opacity = '1';
        };

        if (type === 'video') {
            const html = generateMediaHTML(url, 'overlay-video', '');
            finish(html, null, null); 
        } else if (type === 'audio') {
            const html = generateMediaHTML(url, 'overlay-audio', '');
            finish(html, 500, null);
        } else {
            // Image Preload for smooth box morph
            const img = new Image();
            img.src = url;
            img.onload = () => {
                // Calculate Fit
                const maxW = window.innerWidth * 0.8;
                const maxH = window.innerHeight * 0.9;
                let w = img.naturalWidth;
                let h = img.naturalHeight;
                
                const ratio = Math.min(maxW / w, maxH / h);
                if(ratio < 1) { w *= ratio; h *= ratio; }
                
                const html = `<img src="${url}" class="media-fade-in" style="width:100%; height:100%; object-fit:contain; box-shadow:0 0 20px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">`;
                finish(html, w, h);
            };
        }
    };

    updateContent(item.url, item.type);
}

function navigateMedia(dir) {
    currentMediaIndex += dir;
    if(currentMediaIndex < 0) currentMediaIndex = currentMediaList.length - 1;
    if(currentMediaIndex >= currentMediaList.length) currentMediaIndex = 0;
    renderMediaOverlay();
}

function closeMediaViewer() { 
    const el = document.getElementById('media-fullscreen-overlay');
    el.classList.add('closing');
    
    setTimeout(() => {
        el.classList.remove('active', 'closing'); 
        if(!currentLightboxPostId) document.body.classList.remove('modal-open'); 
        const v=document.querySelector('.media-overlay video'); 
        if(v) v.pause(); 
    }, 300);
}

function closeLightbox() { 
    const el = document.getElementById('leaflet-lightbox');
    el.classList.add('closing');
    setTimeout(() => {
        el.classList.remove('open', 'closing'); 
        document.body.classList.remove('modal-open'); 
        currentLightboxPostId=null; 
        const v=document.querySelector('#leaflet-lightbox video'); if(v) v.pause();
        const a=document.querySelector('#leaflet-lightbox audio'); if(a) a.pause();
    }, 300);
}