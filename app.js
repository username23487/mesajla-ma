// 1. Firebase Yapılandırması (Senden Gelen Config)
const firebaseConfig = {
    apiKey: "AIzaSyBWz7yk3t5ouT2ivuHNm4LEIVDBrWsRucc",
    authDomain: "mesajlasma-d6f4f.firebaseapp.com",
    projectId: "mesajlasma-d6f4f",
    storageBucket: "mesajlasma-d6f4f.firebasestorage.app",
    messagingSenderId: "989630645465",
    appId: "1:989630645465:web:0547341213e9b79cc72ac8",
    measurementId: "G-BSNC1Q1Y7C"
};

// 2. Firebase Uygulamasını Başlatma ve SDK'ları Tanımlama
const app = firebase.initializeApp(firebaseConfig);
const auth = app.auth();
const db = app.firestore();

// 3. DOM Elemanları
const authScreen = document.getElementById('auth-screen');
const chatApplication = document.getElementById('chat-application');
const toggleRegister = document.getElementById('toggle-register');
const authForm = document.getElementById('auth-form');
const authButton = document.getElementById('auth-button');
const usernameInput = document.getElementById('username');
const authError = document.getElementById('auth-error');
const logoutButton = document.getElementById('logout-button');
const currentUserInfo = document.getElementById('current-user-info');

// Sidebar Menü Elemanları
const chatMenu = document.getElementById('chat-menu');
const sidebarAuthPlaceholder = document.getElementById('sidebar-auth-placeholder');

// Sohbet Elemanları
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messageContainer = document.getElementById('message-container');
const privateMessagesContainer = document.getElementById('private-messages');
const chatTitle = document.getElementById('chat-title');

// Menü Elemanları
const tabGeneral = document.getElementById('tab-general');
const tabOnline = document.getElementById('tab-online');
const tabPrivateInit = document.getElementById('tab-private-init');
const onlineUsersList = document.getElementById('online-users-list');
const privateChatInit = document.getElementById('private-chat-init');
const startPrivateChatButton = document.getElementById('start-private-chat');
const privateUserIdInput = document.getElementById('private-user-id');

let isRegistering = false;
let currentUsername = null;
let currentChatListener = null; 
let privateChatListener = null; 
let onlineUsersListener = null;

let activeChat = 'general'; // 'general' veya 'private'
let activePrivateChat = {
    chatId: null,
    targetUid: null,
    targetUsername: null
};

// 4. EKRAN VE MENÜ İŞLEVLERİ

// Ekran değiştirme işlevi
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Menü sekmesi ve içeriği değiştirme
function switchTab(tabId) {
    document.querySelectorAll('#menu-tabs .tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    document.querySelectorAll('#sidebar .tab-content').forEach(content => content.classList.remove('active'));
    
    let contentElement;
    if (tabId === 'tab-general' || tabId === 'tab-online') {
        contentElement = onlineUsersList;
    } else if (tabId === 'tab-private-init') {
        contentElement = privateChatInit;
    }
    
    if (contentElement) {
        contentElement.classList.add('active');
    }
    
    // Genel sohbete otomatik geçiş
    if (tabId === 'tab-general' || tabId === 'tab-online') {
        switchChatArea('general');
    }
}

// Sohbet Alanı Değiştirme (Genel / Özel)
function switchChatArea(area) {
    activeChat = area;
    document.querySelectorAll('.chat-area').forEach(area => area.classList.remove('active'));
    
    if (area === 'general') {
        messageContainer.classList.add('active');
        chatTitle.textContent = 'Genel Sohbet';
        // Dinleyicileri yönet
        if (privateChatListener) privateChatListener(); // Özel sohbeti durdur
        listenForMessages(); // Genel sohbeti başlat
    } else if (area === 'private' && activePrivateChat.chatId) {
        privateMessagesContainer.classList.add('active');
        chatTitle.textContent = `Özel Sohbet: ${activePrivateChat.targetUsername}`;
        // Dinleyicileri yönet
        if (currentChatListener) currentChatListener(); // Genel sohbeti durdur
        listenForPrivateMessages(activePrivateChat.chatId); // Özel sohbeti başlat
    }
}

// Menü Butonlarına Dinleyici Ekleme
tabGeneral.addEventListener('click', () => switchTab('tab-general'));
tabOnline.addEventListener('click', () => switchTab('tab-online'));
tabPrivateInit.addEventListener('click', () => switchTab('tab-private-init'));


// Giriş/Kayıt formunu değiştirme işlevi
toggleRegister.addEventListener('click', (e) => {
    e.preventDefault(); 
    
    isRegistering = !isRegistering;
    authError.textContent = ''; 

    if (isRegistering) {
        authButton.textContent = 'Kayıt Ol';
        toggleRegister.textContent = 'Giriş Yap';
        usernameInput.style.display = 'block'; 
    } else {
        authButton.textContent = 'Giriş Yap';
        toggleRegister.textContent = 'Kayıt Ol';
        usernameInput.style.display = 'none'; 
    }
});


// 5. KİMLİK DOĞRULAMA (AUTH) İŞLEMLERİ 
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = usernameInput.value;

    try {
        if (isRegistering) {
            // KAYIT OLMA İŞLEMİ
            if (!username) {
                authError.textContent = 'Lütfen bir kullanıcı adı girin.';
                return;
            }
            
            // Kullanıcı adı benzersizlik kontrolü (Firestore)
            const usernameRef = db.collection('usernames').doc(username.toLowerCase());
            const doc = await usernameRef.get();
            
            if (doc.exists) {
                authError.textContent = `Kullanıcı adı (${username}) zaten alınmış.`;
                return;
            }

            // --- Gerçek Kayıt İşlemi ---
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Kullanıcı adını veritabanına kaydet
            await usernameRef.set({ 
                uid: user.uid,
                email: email,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Kullanıcının profilini güncelle (displayName)
            await user.updateProfile({
                displayName: username
            });
            // onAuthStateChanged otomatik olarak tetiklenir

        } else {
            // GİRİŞ YAPMA İŞLEMİ
            await auth.signInWithEmailAndPassword(email, password);
        }
    } catch (error) {
        console.error('Auth Hatası:', error);
        if (error.code === 'auth/weak-password') {
             authError.textContent = 'Şifre en az 6 karakter olmalıdır.';
        } else if (error.code === 'auth/email-already-in-use') {
             authError.textContent = 'Bu e-posta adresi zaten kayıtlı.';
        } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             authError.textContent = 'E-posta veya şifre hatalı.';
        } else if (error.code === 'auth/invalid-email') {
             authError.textContent = 'Geçersiz e-posta formatı.';
        } else {
             authError.textContent = 'İşlem sırasında bir hata oluştu: ' + error.message;
        }
    }
});


// Oturum Durumu Kontrolü 
auth.onAuthStateChanged(user => {
    if (user) {
        // Kullanıcı Giriş Yaptı
        
        // 1. Sidebar Menüsünü Göster
        chatMenu.classList.remove('hidden');
        sidebarAuthPlaceholder.style.display = 'none';

        // 2. Ana Uygulama Ekranına Geç
        switchScreen('chat-application');
        
        // 3. Kullanıcı Bilgilerini Yükle
        currentUsername = user.displayName || user.email.split('@')[0];
        currentUserInfo.innerHTML = `Hoş Geldin, **${currentUsername}**! ID: <span style="font-weight: bold; color: yellow;">${user.uid}</span>`;
        
        // 4. Dinleyicileri sıfırla/başlat
        if (currentChatListener) currentChatListener();
        if (privateChatListener) privateChatListener();
        if (onlineUsersListener) onlineUsersListener();

        handleOnlineStatus(true); // Çevrimiçi Durumunu Kaydet
        listenForOnlineUsers(); // Çevrimiçi Kullanıcıları Dinle
        switchTab('tab-online'); // Başlangıçta çevrimiçi listesini göster
        // Genel sohbet otomatik olarak switchTab içinde başlatılır
        
    } else {
        // Kullanıcı Çıkış Yaptı / Giriş Yapmadı
        
        // 1. Sidebar Placeholder'ı Göster
        chatMenu.classList.add('hidden');
        sidebarAuthPlaceholder.style.display = 'block';

        // 2. Giriş/Kayıt Ekranına Geç
        switchScreen('auth-screen');
        
        // 3. Dinleyicileri temizle
        if (currentChatListener) currentChatListener();
        if (privateChatListener) privateChatListener();
        if (onlineUsersListener) onlineUsersListener();
        
        // Arayüzü temizle
        currentUsername = null;
        messageContainer.innerHTML = '';
        privateMessagesContainer.innerHTML = '<p style="text-align: center; color: #aaa; padding: 20px;">Henüz aktif bir özel sohbet yok. Lütfen bir kullanıcı seçin.</p>';
        activePrivateChat = { chatId: null, targetUid: null, targetUsername: null };
    }
});


// 6. ÇEVRİMİÇİ DURUMU YÖNETİMİ 

// Kullanıcının çevrimiçi durumunu kaydet/sil
async function handleOnlineStatus(isOnline) {
    const user = auth.currentUser;
    
    if (!user) {
        return; 
    }

    const onlineRef = db.collection('online_users').doc(user.uid);
    
    if (isOnline) {
        try {
            await onlineRef.set({
                uid: user.uid,
                username: user.displayName || user.email.split('@')[0],
                last_seen: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } catch (e) {
            console.error("Çevrimiçi durumu ayarlanamadı:", e);
        }
    } else {
        // Bu kısım sadece logoutButton event'inde tetiklenir
        console.warn("handleOnlineStatus(false) çağrıldı ancak burada silme işlemi yapılmadı. Logout butonunu kontrol edin.");
    }
}

// Çevrimiçi Kullanıcıları Dinleme
function listenForOnlineUsers() {
    if (onlineUsersListener) onlineUsersListener(); 
    
    const currentUid = auth.currentUser ? auth.currentUser.uid : null;
    if (!currentUid) {
        onlineUsersList.innerHTML = '<p style="padding: 10px; color: red;">Yetkilendirme bekleniyor...</p>';
        return; 
    }

    onlineUsersListener = db.collection('online_users')
        .onSnapshot(snapshot => {
            onlineUsersList.innerHTML = '';
            let hasActiveUsers = false;

            snapshot.forEach(doc => {
                const user = doc.data();
                
                if (user.uid !== currentUid) { // Kendini listeden hariç tut
                    displayOnlineUser(user);
                    hasActiveUsers = true;
                }
            });
            
            if (!hasActiveUsers) {
                 onlineUsersList.innerHTML = '<p style="padding: 10px; color: #aaa;">Sizden başka çevrimiçi kimse yok.</p>';
            }
        }, error => {
            console.error("Çevrimiçi kullanıcıları dinleme hatası:", error);
            onlineUsersList.innerHTML = '<p style="padding: 10px; color: red;">Kullanıcı listesi yüklenemedi.</p>';
        });
}


// Çıkış Yapma İşlevi (Online kaydını temizler)
logoutButton.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (user) {
        // Çıkış yapmadan önce online_users kaydını sil
        const onlineRef = db.collection('online_users').doc(user.uid);
        try {
            await onlineRef.delete();
            console.log("Online durumu başarıyla silindi.");
        } catch (e) {
            console.error("Online durumu silinirken hata:", e);
        }
    }
    // Sonra çıkış işlemini tamamla
    auth.signOut();
});


// 7. MESAJLAŞMA İŞLEVLERİ

// Çevrimiçi Kullanıcıyı Menüye Ekleme
function displayOnlineUser(user) {
    const item = document.createElement('div');
    item.classList.add('online-user-item');

    item.innerHTML = `
        <span>${user.username}</span>
        <small>ID: ${user.uid}</small>
    `;

    // Tıklanınca özel sohbeti başlat
    item.addEventListener('click', () => {
        startPrivateChatFromMenu(user.uid, user.username);
    });

    onlineUsersList.appendChild(item);
}

function startPrivateChatFromMenu(uid, username) {
    if (!auth.currentUser) {
        // Bu durum onAuthStateChanged ile zaten kontrol edilmeli, ancak güvenlik için eklendi.
        console.error("Özel sohbet başlatmak için giriş yapmalısınız.");
        return; 
    }
    
    activePrivateChat.targetUid = uid;
    activePrivateChat.targetUsername = username;
    activePrivateChat.chatId = getChatId(uid);
    
    // Sohbete geçiş
    switchChatArea('private'); 
}

// Chat ID oluşturma
function getChatId(targetUid) {
    const currentUid = auth.currentUser.uid;
    // Lexicographical order (alfabetik/sayısal) kullanarak sabit bir ID oluşturur.
    return currentUid < targetUid 
        ? `${currentUid}-${targetUid}` 
        : `${targetUid}-${currentUid}`;
}

// Mesaj gönderme
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();

    if (!text || !currentUsername || !auth.currentUser) return; // Null kontrolü

    if (activeChat === 'private' && activePrivateChat.chatId) {
        await sendPrivateMessage(text);
    } else if (activeChat === 'general') {
        await sendGeneralMessage(text);
    }
    
    messageInput.value = '';
});

// Genel mesaj gönderme
async function sendGeneralMessage(text) {
    try {
        await db.collection('messages').add({
            text: text,
            author: currentUsername,
            uid: auth.currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'general'
        });
    } catch (error) {
        console.error('Genel mesaj gönderme hatası:', error);
    }
}

// Genel mesajları dinleme
function listenForMessages() {
    // Önceki dinleyiciyi kapat
    if (currentChatListener) currentChatListener();

    currentChatListener = db.collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(50)
      .onSnapshot(snapshot => {
        // Sadece genel sohbet aktifse veya ilk yükleniyorsa güncelleyin
        if (activeChat === 'general') {
            messageContainer.innerHTML = '';
            snapshot.forEach(doc => {
                displayMessage(doc.data(), messageContainer, false);
            });
            messageContainer.scrollTop = messageContainer.scrollHeight;
        }
    });
}

// Özel mesaj gönderme
async function sendPrivateMessage(text) {
    try {
        await db.collection('private_chats')
            .doc(activePrivateChat.chatId)
            .collection('messages')
            .add({
                text: text,
                author: currentUsername,
                uid: auth.currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'private'
            });
    } catch (error) {
        console.error('Özel mesaj gönderme hatası:', error);
    }
}

// Özel mesajları dinleme
function listenForPrivateMessages(chatId) {
    // Dinleyiciyi durdur
    if (privateChatListener) privateChatListener();
    
    privateMessagesContainer.innerHTML = ''; // Temizle
    
    privateChatListener = db.collection('private_chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(50)
      .onSnapshot(snapshot => {
        // Sadece özel sohbet aktifse DOM'u güncelle
        if (activeChat === 'private' && activePrivateChat.chatId === chatId) {
             privateMessagesContainer.innerHTML = '';
             snapshot.forEach(doc => {
                displayMessage(doc.data(), privateMessagesContainer, true);
            });
            privateMessagesContainer.scrollTop = privateMessagesContainer.scrollHeight;
        }
    });
}

// Mesajı DOM'a ekleme fonksiyonu
function displayMessage(message, container, isPrivate = false) {
    const isSelf = message.uid === auth.currentUser.uid;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isSelf ? 'self' : 'other');
    
    let authorText = isSelf ? 'Sen' : message.author;
    
    // Özel sohbette yazar adını biraz farklı gösterelim
    if (isPrivate) {
        authorText += ' (Özel)';
    }

    messageElement.innerHTML = `
        <div class="message-author">
            ${authorText}
        </div>
        <div class="message-content">
            ${message.text}
        </div>
    `;

    container.appendChild(messageElement);
}

// DOM Yüklendiğinde Başlangıç Durumunu Ayarla 
document.addEventListener('DOMContentLoaded', () => {
    // onAuthStateChanged tetiklenene kadar placeholder görünür kalır.
    if (!auth.currentUser) {
        chatMenu.classList.add('hidden');
        sidebarAuthPlaceholder.style.display = 'block';
    }
});
