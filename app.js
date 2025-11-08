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
const chatApplication = document.getElementById('chat-application'); // Yeni ana uygulama kapsayıcısı
const toggleRegister = document.getElementById('toggle-register');
const authForm = document.getElementById('auth-form');
const authButton = document.getElementById('auth-button');
const usernameInput = document.getElementById('username');
const authError = document.getElementById('auth-error');
const logoutButton = document.getElementById('logout-button');
const currentUserInfo = document.getElementById('current-user-info');

// Sohbet Elemanları
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messageContainer = document.getElementById('message-container'); // Genel Sohbet Alanı
const privateMessagesContainer = document.getElementById('private-messages'); // Özel Sohbet Alanı
const chatTitle = document.getElementById('chat-title'); // Sohbet Başlığı

// Menü Elemanları
const sidebar = document.getElementById('sidebar');
const tabGeneral = document.getElementById('tab-general');
const tabOnline = document.getElementById('tab-online');
const tabPrivateList = document.getElementById('tab-private-list');
const onlineUsersList = document.getElementById('online-users-list');
const privateChatInit = document.getElementById('private-chat-init'); // Özel sohbet başlatma alanı
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
    // 1. Butonları Güncelle
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    // 2. İçerikleri Güncelle
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    let contentId;
    if (tabId === 'tab-general') contentId = 'online-users-list'; // Geçici olarak online listeyi gösterelim
    if (tabId === 'tab-online') contentId = 'online-users-list'; 
    if (tabId === 'tab-private-list') contentId = 'private-chat-init'; // Şimdilik özel sohbet başlatma alanını gösterelim

    document.getElementById(contentId).classList.add('active');
}

// Sohbet Alanı Değiştirme (Genel / Özel)
function switchChatArea(area) {
    activeChat = area;
    document.querySelectorAll('.chat-area').forEach(area => area.classList.remove('active'));
    
    if (area === 'general') {
        messageContainer.classList.add('active');
        chatTitle.textContent = 'Genel Sohbet';
        // Özel sohbet dinleyicisini kapat
        if (privateChatListener) privateChatListener();
        activePrivateChat = { chatId: null, targetUid: null, targetUsername: null };
    } else if (area === 'private' && activePrivateChat.chatId) {
        privateMessagesContainer.classList.add('active');
        chatTitle.textContent = `Özel Sohbet: ${activePrivateChat.targetUsername}`;
        // Özel sohbeti yeniden dinlemeye başla
        listenForPrivateMessages(activePrivateChat.chatId);
    }
}

// Menü Butonlarına Dinleyici Ekleme
tabGeneral.addEventListener('click', () => {
    switchTab('tab-general');
    switchChatArea('general');
});
tabOnline.addEventListener('click', () => switchTab('tab-online'));
tabPrivateList.addEventListener('click', () => switchTab('tab-private-list'));


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


// 5. KİMLİK DOĞRULAMA (AUTH) İŞLEMLERİ VE OTURUM YÖNETİMİ

// Oturum Durumu Kontrolü
auth.onAuthStateChanged(user => {
    if (user) {
        // Kullanıcı Giriş Yaptı
        currentUsername = user.displayName || user.email.split('@')[0];
        currentUserInfo.innerHTML = `Hoş Geldin, **${currentUsername}**! ID: <span style="font-weight: bold; color: yellow;">${user.uid}</span>`;
        switchScreen('chat-application');
        
        // Dinleyicileri başlat/sıfırla
        if (currentChatListener) currentChatListener();
        if (privateChatListener) privateChatListener();
        if (onlineUsersListener) onlineUsersListener();

        listenForMessages();
        handleOnlineStatus(true); // Çevrimiçi Durumunu Kaydet
        listenForOnlineUsers(); // Çevrimiçi Kullanıcıları Dinle
        switchChatArea('general'); // Başlangıçta genel sohbete geç

    } else {
        // Kullanıcı Çıkış Yaptı / Giriş Yapmadı
        handleOnlineStatus(false); // Çevrimdışı Durumunu Kaydet
        currentUsername = null;
        switchScreen('auth-screen');
        messageContainer.innerHTML = '';
        privateMessagesContainer.innerHTML = '';
        activePrivateChat = { chatId: null, targetUid: null, targetUsername: null };
        
        // Dinleyicileri temizle
        if (currentChatListener) currentChatListener();
        if (privateChatListener) privateChatListener();
        if (onlineUsersListener) onlineUsersListener();
    }
});

// Çıkış Yapma
logoutButton.addEventListener('click', () => {
    auth.signOut();
});

// 6. ÇEVRİMİÇİ DURUMU YÖNETİMİ

// Kullanıcının çevrimiçi durumunu kaydet/sil
async function handleOnlineStatus(isOnline) {
    const user = auth.currentUser;
    if (!user) return;

    const onlineRef = db.collection('online_users').doc(user.uid);
    
    if (isOnline) {
        await onlineRef.set({
            uid: user.uid,
            username: user.displayName || user.email.split('@')[0],
            last_seen: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } else {
        // Oturum kapandığında kaydı sil
        await onlineRef.delete();
    }
}

// Çevrimiçi Kullanıcıları Dinleme
function listenForOnlineUsers() {
    onlineUsersListener = db.collection('online_users')
        .onSnapshot(snapshot => {
            onlineUsersList.innerHTML = '';
            const currentUid = auth.currentUser.uid;

            snapshot.forEach(doc => {
                const user = doc.data();
                if (user.uid !== currentUid) { // Kendini listeden hariç tut
                    displayOnlineUser(user);
                }
            });
            
            if (onlineUsersList.innerHTML === '') {
                 onlineUsersList.innerHTML = '<p style="padding: 10px; color: #aaa;">Sizden başka çevrimiçi kimse yok.</p>';
            }
        });
}

// Çevrimiçi Kullanıcıyı Menüye Ekleme
function displayOnlineUser(user) {
    const item = document.createElement('div');
    item.classList.add('online-user-item');
    item.dataset.uid = user.uid; // ID'yi veri özelliğine sakla

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
    activePrivateChat.targetUid = uid;
    activePrivateChat.targetUsername = username;
    activePrivateChat.chatId = getChatId(uid);
    
    if (privateChatListener) privateChatListener(); // Eski dinleyiciyi kapat
    
    listenForPrivateMessages(activePrivateChat.chatId);
    
    switchChatArea('private'); // Özel sohbet alanına geç
    
    // Geri bildirim ver
    alert(`Özel sohbet başlatıldı: ${username} ile konuşuyorsunuz.`);
}

// 7. MESAJLAŞMA İŞLEVLERİ (GENEL VE ÖZEL)

// Chat ID oluşturma
function getChatId(targetUid) {
    const currentUid = auth.currentUser.uid;
    return currentUid < targetUid 
        ? `${currentUid}-${targetUid}` 
        : `${targetUid}-${currentUid}`;
}

// Mesaj gönderme
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();

    if (!text || !currentUsername) return;

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
        alert('Genel mesaj gönderilemedi.');
    }
}

// Genel mesajları dinleme
function listenForMessages() {
    currentChatListener = db.collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(50)
      .onSnapshot(snapshot => {
        // Sadece genel sohbet aktifse DOM'u güncelle
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
        alert('Özel mesaj gönderilemedi.');
    }
}

// Özel mesajları dinleme
function listenForPrivateMessages(chatId) {
    // Önceki dinleyiciyi temizle
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
