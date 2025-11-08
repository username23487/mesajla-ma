// 🔥 KENDİ FIREBASE AYARLARINIZLA GÜNCELLEYİN 🔥
// Uygulama ID'si, Firestore kuralında kullanılmak üzere burada tanımlanmıştır.
const FIREBASE_APP_ID = "mesajlasma-373e3"; 
const firebaseConfig = {
    apiKey: "AIzaSyBcel9UpmT4fMjPE--Cr0P87L_CPqt9tqo",
    authDomain: "mesajlasma-373e3.firebaseapp.com",
    projectId: "mesajlasma-373e3",
    storageBucket: "mesajlasma-373e3.firebasestorage.app",
    messagingSenderId: "598072632815",
    appId: "1:598072632815:web:c2cb4bf550bd65a042421a"
};

// 1. Firebase'i başlat
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); 

// Global Stateler
let currentChatUserId = null; // Özel sohbetteki diğer kişinin ID'si
let currentChatUsername = null; // Özel sohbetteki diğer kişinin kullanıcı adı
let currentChatType = 'general'; // Mevcut sohbet türü ('general' veya 'private')
let unsubscribeChatListener = null; // Sohbet dinleyicisini durdurmak için
let loggedInUserId = null; // Giriş yapmış kullanıcının ID'si
let loggedInUsername = null; // Giriş yapmış kullanıcının Kullanıcı Adı

const body = document.body;

// Element referanslarını güncelleme fonksiyonu (onAuthStateChanged sonrası DOM değişimi için)
function updateAuthElements() {
    window.emailInput = document.getElementById('email');
    window.passwordInput = document.getElementById('password');
    window.usernameInput = document.getElementById('username');
    window.authForm = document.getElementById('auth-form');
    window.authMessage = document.getElementById('auth-message');
}

// Global olarak çağrılacak Auth fonksiyonu
async function handleAuth(isSignIn) {
    const email = window.emailInput.value;
    const password = window.passwordInput.value;
    const username = window.usernameInput.value;
    window.authMessage.textContent = ''; 

    try {
        if (isSignIn) {
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            if (!username) {
                window.authMessage.textContent = "Kayıt olurken kullanıcı adı zorunludur.";
                return;
            }
            
            // Kullanıcı adının daha önce alınıp alınmadığını kontrol et
            const userCheck = await db.collection('users').where('username', '==', username).get();
            if (!userCheck.empty) {
                window.authMessage.textContent = "Bu kullanıcı adı zaten alınmış. Lütfen başka bir tane seçin.";
                return;
            }

            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Kullanıcı adını Firestore'a kaydet (DM için ID/Kullanıcı adı)
            await db.collection('users').doc(user.uid).set({
                email: user.email,
                username: username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            window.authMessage.textContent = "Başarıyla kaydoldun! Sohbet ekranına geçiliyor...";
        }
    } catch (error) {
        console.error("Kimlik Doğrulama Hatası:", error);
        let errorMessage = "Bir hata oluştu.";
        if (error.code === 'auth/email-already-in-use') errorMessage = "Bu e-posta zaten kullanılıyor.";
        else if (error.code === 'auth/weak-password') errorMessage = "Şifre en az 6 karakter olmalıdır.";
        else if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') errorMessage = "Giriş bilgileri hatalı.";
        window.authMessage.textContent = errorMessage;
    }
}

// Auth durumunu dinle
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Kullanıcı giriş yapmış.
        const userDoc = await db.collection('users').doc(user.uid).get();
        loggedInUserId = user.uid;
        loggedInUsername = userDoc.data()?.username || user.email;

        body.innerHTML = ''; 
        body.classList.remove('auth-page'); 
        body.classList.add('chat-page');

        loadMainApp();

    } else {
        // Kullanıcı çıkış yapmış veya giriş yapmamış.
        if(unsubscribeChatListener) {
             unsubscribeChatListener();
             unsubscribeChatListener = null;
        }
        
        body.innerHTML = `
            <div class="container auth-container">
                <h1>💬 Hoş Geldin!</h1>
                <p>Devam etmek için e-posta ve şifre ile giriş yap veya kaydol.</p>
                <div id="auth-form">
                    <input type="email" id="email" placeholder="E-posta" required>
                    <input type="password" id="password" placeholder="Şifre" required>
                    <input type="text" id="username" placeholder="Kullanıcı Adı (Sadece Kayıt Olurken)" style="display:none;">
                    <button onclick="handleAuth(true)">Giriş Yap</button>
                    <button onclick="handleAuth(false)">Kaydol</button>
                    <p id="auth-message" class="error"></p>
                </div>
            </div>
        `;
        body.classList.add('auth-page');
        body.classList.remove('chat-page');
        updateAuthElements(); 
        loggedInUserId = null;
        loggedInUsername = null;
    }
});

// =========================================================
// 2. ADIM: ANA UYGULAMA MANTIĞI (KULLANICI LİSTESİ + SOHBET)
// =========================================================

/**
 * Kullanıcı ID'lerini alfabetik sıraya göre birleştirerek özel sohbet odası ID'sini oluşturur.
 * Güvenlik kuralı da bu ID'ye dayanır.
 * @param {string} uid1 
 * @param {string} uid2 
 * @returns {string} Örneğin: "uidA_uidB"
 */
function getPrivateChatId(uid1, uid2) {
    // ID'leri alfabetik olarak sırala ve birleştir
    return [uid1, uid2].sort().join('_');
}

/**
 * Kullanıcı giriş yaptıktan sonra ana sohbet arayüzünü (listeyi ve sohbet penceresini) yükler.
 */
function loadMainApp() {
    body.innerHTML = `
        <div class="app-container">
            <div class="sidebar">
                <div class="profile">
                    <h3>Merhaba, ${loggedInUsername}</h3>
                    <span class="uid-label">UID: ${loggedInUserId.substring(0, 8)}...</span>
                    <button class="logout-btn" onclick="auth.signOut()">Çıkış Yap</button>
                </div>
                
                <h4 class="sidebar-title">Sohbetler</h4>
                <div id="general-chat-link" class="user-item active" onclick="loadChatApp('general')">
                    <i class="icon">🌍</i> Genel Sohbet
                </div>

                <h4 class="sidebar-title">Özel Mesajlar</h4>
                <div id="user-list" class="user-list">
                    <p class="loading-text" style="padding: 0 20px;">Kullanıcılar yükleniyor...</p>
                </div>
            </div>

            <div class="chat-area">
                <div class="header">
                    <h2 id="chat-title">Genel Sohbet Odası 🗣️</h2>
                </div>
                <div id="messages-container" class="messages-container">
                    </div>
                <div class="message-input-area">
                    <input type="text" id="message-input" placeholder="Mesajınızı buraya yazın..." />
                    <button id="send-button" onclick="handleSendMessage()">Gönder</button>
                </div>
            </div>
        </div>
    `;

    // Kullanıcı listesini yükle
    loadUserList(loggedInUserId);
    
    // Varsayılan olarak Genel Sohbeti yükle
    loadChatApp('general');
    
    // Enter tuşu ile mesaj gönderme
    document.getElementById('message-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });
}

/**
 * Firestore'dan tüm kullanıcıları çeker ve listeye ekler.
 */
function loadUserList() {
    const userListElement = document.getElementById('user-list');
    
    db.collection('users').get().then((snapshot) => {
        userListElement.innerHTML = ''; // Yükleniyor yazısını kaldır
        
        snapshot.forEach((doc) => {
            const user = doc.data();
            const userId = doc.id;
            
            // Kendi adımızı listede gösterme
            if (userId === loggedInUserId) return;

            const userItem = document.createElement('div');
            userItem.classList.add('user-item');
            userItem.textContent = user.username || 'Anonim Kullanıcı';
            userItem.setAttribute('data-user-id', userId);
            userItem.setAttribute('data-username', user.username);
            
            // Tıklandığında Özel Sohbeti yükle
            userItem.onclick = () => {
                const username = userItem.getAttribute('data-username');
                loadChatApp('private', userId, username);
            };
            
            userListElement.appendChild(userItem);
        });
    }).catch(error => {
        console.error("Kullanıcı listesi yüklenirken hata:", error);
        userListElement.innerHTML = `<p class="error" style="padding: 0 20px;">Kullanıcılar yüklenemedi.</p>`;
    });
}

/**
 * Belirli bir sohbet penceresini (Genel veya Özel) yükler ve dinlemeyi başlatır.
 * @param {string} type - 'general' veya 'private'
 * @param {string} [otherUserId] - Özel sohbet için diğer kullanıcının ID'si
 * @param {string} [otherUsername] - Özel sohbet için diğer kullanıcının kullanıcı adı
 */
function loadChatApp(type, otherUserId = null, otherUsername = null) {
    const chatTitleElement = document.getElementById('chat-title');
    const messagesContainer = document.getElementById('messages-container');
    const userItems = document.querySelectorAll('.user-item');

    // Önceki dinleyiciyi durdur
    if(unsubscribeChatListener) {
        unsubscribeChatListener();
        unsubscribeChatListener = null;
    }

    // Arayüzü temizle
    messagesContainer.innerHTML = '';
    currentChatType = type;
    currentChatUserId = otherUserId;
    currentChatUsername = otherUsername;
    
    // 1. Sidebar'daki aktif linki ayarla (UI İyileştirmesi)
    userItems.forEach(item => item.classList.remove('active'));
    
    if (type === 'general') {
        chatTitleElement.textContent = 'Genel Sohbet Odası 🗣️';
        document.getElementById('general-chat-link').classList.add('active');
    } else {
        chatTitleElement.textContent = `Özel Sohbet: ${otherUsername} 🔒`;
        const activeItem = document.querySelector(`.user-item[data-user-id='${otherUserId}']`);
        if(activeItem) {
             activeItem.classList.add('active');
        }
    }

    // 2. Mesaj koleksiyonunu belirle ve dinlemeyi başlat
    let messagesCollectionRef;
    if (type === 'general') {
        // Genel Sohbet Koleksiyonu
        messagesCollectionRef = db.collection('artifacts').doc(FIREBASE_APP_ID).collection('public').doc('data').collection('general_chat');
    } else {
        // Özel Sohbet Koleksiyonu
        const chatId = getPrivateChatId(loggedInUserId, otherUserId);
        messagesCollectionRef = db.collection('private_chats').doc(chatId).collection('messages');
    }

    // Dinleyiciyi başlat ve global değişkene kaydet
    unsubscribeChatListener = messagesCollectionRef.orderBy('createdAt', 'asc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const message = change.doc.data();

                // Sadece yeni eklenen (added) mesajları ekle
                if (change.type === "added") {
                    const messageElement = createMessageElement(message, loggedInUserId);
                    messagesContainer.appendChild(messageElement);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Mesaj kutusunu alta kaydır
                }
            });
        }, (error) => {
            console.error("Mesaj dinleme hatası:", error);
            messagesContainer.innerHTML = `<p class="error" style="text-align:center;">Mesajlar yüklenirken bir hata oluştu.</p>`;
        });
}

/**
 * Bir mesaj nesnesini DOM elementine dönüştürür.
 * @param {object} message - Mesaj verisi
 * @param {string} currentUserId - Mevcut kullanıcının ID'si
 * @returns {HTMLElement} - Oluşturulan mesaj div'i
 */
function createMessageElement(message, currentUserId) {
    const isCurrentUser = message.userId === currentUserId;
    const div = document.createElement('div');
    
    div.classList.add('message', isCurrentUser ? 'mine' : 'other');

    const senderName = document.createElement('span');
    senderName.classList.add('sender');
    senderName.textContent = isCurrentUser ? 'Sen' : message.username;
    
    const messageContent = document.createElement('p');
    messageContent.classList.add('content');
    messageContent.textContent = message.text;

    const time = document.createElement('span');
    time.classList.add('time');
    
    if (message.createdAt && message.createdAt.toDate) {
        // Tarihi okunabilir bir formata çevir
        const date = message.createdAt.toDate();
        time.textContent = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } else {
        time.textContent = 'Şimdi';
    }

    // Mesaj yapısını oluştur
    div.appendChild(senderName);
    div.appendChild(messageContent);
    div.appendChild(time);

    return div;
}

/**
 * Global state'e göre doğru sohbete mesaj gönderir.
 */
async function handleSendMessage() {
    if (!loggedInUserId) return; // Kullanıcı giriş yapmadıysa gönderme

    const inputElement = document.getElementById('message-input');
    const text = inputElement.value.trim();

    if (text === '') return; // Boş mesaj gönderme

    const newMessage = {
        userId: loggedInUserId,
        username: loggedInUsername,
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // Sunucu saati ile zaman damgası
    };

    let messagesCollectionRef;

    try {
        if (currentChatType === 'general') {
            // Genel Sohbet
            messagesCollectionRef = db.collection('artifacts').doc(FIREBASE_APP_ID).collection('public').doc('data').collection('general_chat');
        } else if (currentChatType === 'private' && currentChatUserId) {
            // Özel Sohbet
            const chatId = getPrivateChatId(loggedInUserId, currentChatUserId);
            messagesCollectionRef = db.collection('private_chats').doc(chatId).collection('messages');
        } else {
            console.error("Hata: Geçersiz sohbet türü veya eksik kullanıcı ID'si.");
            return;
        }

        await messagesCollectionRef.add(newMessage);
        
        inputElement.value = ''; // Gönderdikten sonra giriş alanını temizle

    } catch (error) {
        console.error("Mesaj gönderme hatası:", error);
        // Hata durumunda kullanıcıya gösterilebilecek bir mesaj eklenebilir.
    }
}