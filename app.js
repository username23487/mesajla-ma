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
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
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
    if (tabId === 'tab-general') {
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
    } else if (area === 'private' && activePrivateChat.chatId) {
        privateMessagesContainer.classList.add('active');
        chatTitle.textContent = `Özel Sohbet: ${activePrivateChat.targetUsername}`;
        // Dinleyicileri yönet
        if (currentChatListener) listenForMessages(); // Genel sohbeti durdur
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


// Oturum Durumu Kontrolü (Ekran Geçişi Düzeltmesi burada kontrol edildi)
auth.onAuthStateChanged(user => {
    if (user) {
        // Kullanıcı Giriş Yaptı
        // NOT: CSS'te #auth-screen ve #chat-application arasındaki geçiş doğru yapıldığı için
        // bu kısım giriş yapıldığında sohbet uygulamasını açar.
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
        switchTab('tab-online'); // Başlangıçta çevrimiçi listesini göster
        switchChatArea('general'); // Başlangıçta genel sohbete geç

    } else {
        // Kullanıcı Çıkış Yaptı / Giriş Yapmadı
        handleOnlineStatus(false); // Çevrimdışı Durumunu Kaydet (Session Storage ile değil, Database ile çalışır)
        currentUsername = null;
        switchScreen('auth-screen');
        
        // Dinleyicileri temizle
        if (currentChatListener) currentChatListener();
        if (privateChatListener) privateChatListener();
        if (onlineUsersListener) onlineUsersListener();
        
        // Arayüzü temizle
        messageContainer.innerHTML = '';
        privateMessagesContainer.innerHTML = '<p style="text-align: center; color: #aaa; padding: 20px;">Henüz aktif bir özel sohbet yok. Lütfen bir kullanıcı seçin.</p>';
        activePrivateChat = { chatId: null, targetUid: null, targetUsername: null };
    }
});


// 6. ÇEVRİMİÇİ DURUMU YÖNETİMİ (SORUN 1 & 2 FIX)

// Kullanıcının çevrimiçi durumunu kaydet/sil
async function handleOnlineStatus(isOnline) {
    const user = auth.currentUser;
    // Eğer isOnline false ise ve user null ise (tamamen çıkış yapılmışsa), işlem yapmaya gerek yok.
    if (!user && isOnline) return; 

    const onlineRef = db.collection('online_users').doc(user ? user.uid : 'temp-id');
    
    if (isOnline) {
        try {
            // Kullanıcı bilgileri doğru ve güncel olmalı
            await onlineRef.set({
                uid: user.uid,
                username: user.displayName || user.email.split('@')[0],
                last_seen: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } catch (e) {
            console.error("Çevrimiçi durumu ayarlanamadı:", e);
        }
    } else {
        // Oturum kapandığında kaydı sil (ÇOK ÖNEMLİ DÜZELTME)
        // Eğer kullanıcı çıkış yapıyorsa (signOut), user null olur. Bu durumda 
        // silme işlemini signOut event'i sırasında yapmamız gerekir.
        // Bu yüzden Firestore'un ON DISCONNECT özelliğini kullanmak daha güvenlidir,
        // ancak web'de basitçe signOut anında sileriz.
        
        // Ekstra Güvenlik Adımı: Eğer bir kullanıcı çıkış yapmışsa ve online listesinde kaldıysa,
        // bu kaydı temizlemeliyiz.
        if (auth.currentUser === null) {
            // Bu kısım normalde çalışmaz, çünkü signOut sırasında onAuthStateChanged çağrılır.
            // Fakat ekstra bir önlem olarak, bir önceki kullanıcının UID'sini tutmak gerekebilir.
            // En iyi çözüm, signOut olayına bağlanmak.
            
            // Basitlik adına, signOut olayını yakalıyoruz:
            // (Bu kod logoutButton listener'ında uygulanacak)
        }
    }
}

// Çevrimiçi Kullanıcıları Dinleme
function listenForOnlineUsers() {
    if (onlineUsersListener) onlineUsersListener(); 

    onlineUsersListener = db.collection('online_users')
        .onSnapshot(async snapshot => {
            onlineUsersList.innerHTML = '';
            const currentUid = auth.currentUser ? auth.currentUser.uid : null;

            if (!currentUid) return;

            const batch = db.batch();
            let hasActiveUsers = false;

            for (const doc of snapshot.docs) {
                const user = doc.data();
                
                // Kullanıcı silinmiş mi kontrol et (Auth'ta olup olmadığını kontrol et)
                // Bu doğrudan client-side'da yapılamaz, Admin SDK gerektirir.
                // Basitçe, eğer kendi oturumumuz açıksa ve user.uid'i bizimkine eşit değilse göster.
                
                if (user.uid !== currentUid) { // Kendini listeden hariç tut
                    displayOnlineUser(user);
                    hasActiveUsers = true;
                }
            }

            // EK DÜZELTME: Sürekli çevrimdışı kalanları silmek için bir kontrol ekleyelim
            // Bu kontrol, Firestore kurallarında daha iyidir (örneğin 5 dakika pasif kalanı sil),
            // ancak manuel bir kontrol mekanizması da ekleyebiliriz.
            // Şimdilik sadece aktif oturumları gösterip, çıkış anında silmeyi garanti edelim.
            
            if (!hasActiveUsers) {
                 onlineUsersList.innerHTML = '<p style="padding: 10px; color: #aaa;">Sizden başka çevrimiçi kimse yok.</p>';
            }
        }, error => {
            console.error("Çevrimiçi kullanıcıları dinleme hatası:", error);
            onlineUsersList.innerHTML = '<p style="padding: 10px; color: red;">Kullanıcı listesi yüklenemedi.</p>';
        });
}


// Çıkış Yapma İşlevi (SORUN 1 FIX - Çıkış anında online kaydını temizle)
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


// Diğer fonksiyonlar (displayOnlineUser, startPrivateChatFromMenu, getChatId, 
// messageForm.addEventListener, sendGeneralMessage, listenForMessages, 
// sendPrivateMessage, listenForPrivateMessages, displayMessage)

// ... (Burada 7. Bölümdeki Mesajlaşma İşlevleri aynı kalır)

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
    if (!auth.currentUser) return alert("Önce giriş yapmalısınız.");
    
    activePrivateChat.targetUid = uid;
    activePrivateChat.targetUsername = username;
    activePrivateChat.chatId = getChatId(uid);
    
    // Sohbete geçiş
    switchChatArea('private'); 
}


// 7. MESAJLAŞMA İŞLEVLERİ

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

// Otomatik başlatma: Eğer başlangıçta kullanıcı varsa veya giriş ekranındaysak
document.addEventListener('DOMContentLoaded', () => {
    // Başlangıçta Auth durumu onAuthStateChanged tarafından halledilir.
});
