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
let currentChatUserId = null; 
let currentChatUsername = null; 
let currentChatType = 'general'; 
let unsubscribeChatListener = null; 
let loggedInUserId = null; 
let loggedInUsername = null; 

const body = document.body;

// Auth Sayfası Form Yönetimi
function showForm(formType) {
    const signInContainer = document.getElementById('signin-form-container');
    const signUpContainer = document.getElementById('signup-form-container');
    const authMessage = document.getElementById('auth-message');
    authMessage.textContent = ''; // Hata mesajını temizle

    if (formType === 'signin') {
        signInContainer.classList.remove('hidden');
        signUpContainer.classList.add('hidden');
        document.getElementById('auth-info-text').textContent = 'Devam etmek için e-posta ve şifre ile giriş yapın.';
    } else {
        signInContainer.classList.add('hidden');
        signUpContainer.classList.remove('hidden');
        document.getElementById('auth-info-text').textContent = 'Kayıt olmak için lütfen kullanıcı adı, e-posta ve şifre girin.';
    }
}

// Giriş İşlemi
async function handleSignin() {
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    const authMessage = document.getElementById('auth-message');
    authMessage.textContent = '';

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error("Giriş Hatası:", error);
        let errorMessage = "Giriş bilgileri hatalı.";
        if (error.code === 'auth/invalid-email') errorMessage = "Geçersiz e-posta formatı.";
        else if (error.code === 'auth/user-not-found') errorMessage = "Bu e-posta kayıtlı değil.";
        authMessage.textContent = errorMessage;
    }
}

// Kayıt İşlemi (Kullanıcı Adı Zorunlu Kontrolü)
async function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const username = document.getElementById('signup-username').value.trim();
    const authMessage = document.getElementById('auth-message');
    authMessage.textContent = ''; 

    if (!username) {
        authMessage.textContent = "Kayıt olurken kullanıcı adı zorunludur.";
        return;
    }

    try {
        // Kullanıcı adının daha önce alınıp alınmadığını kontrol et
        const userCheck = await db.collection('users').where('username', '==', username).get();
        if (!userCheck.empty) {
            authMessage.textContent = "Bu kullanıcı adı zaten alınmış. Lütfen başka bir tane seçin.";
            return;
        }

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Kullanıcı adını Firestore'a kaydet
        await db.collection('users').doc(user.uid).set({
            email: user.email,
            username: username,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        authMessage.textContent = "Başarıyla kaydoldun! Sohbet ekranına geçiliyor...";
    } catch (error) {
        console.error("Kayıt Hatası:", error);
        let errorMessage = "Bir hata oluştu.";
        if (error.code === 'auth/email-already-in-use') errorMessage = "Bu e-posta zaten kullanılıyor.";
        else if (error.code === 'auth/weak-password') errorMessage = "Şifre en az 6 karakter olmalıdır.";
        else if (error.code === 'auth/invalid-email') errorMessage = "Geçersiz e-posta formatı.";
        authMessage.textContent = errorMessage;
    }
}

// Auth durumunu dinle (Bu kısım aynı kaldı)
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Kullanıcı giriş yapmış.
        const userDoc = await db.collection('users').doc(user.uid).get();
        loggedInUserId = user.uid;
        // Kullanıcı adı Firestore'dan çekiliyor.
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
        
        // Uygulama yüklenirken varsayılan olarak Giriş sayfasını göster
        body.innerHTML = `
            <div class="container auth-container">
                <h1>💬 Hoş Geldin!</h1>
                <p id="auth-info-text">Devam etmek için lütfen giriş yapın veya kaydolun.</p>

                <div id="signup-form-container" class="hidden">
                    <input type="text" id="signup-username" placeholder="Kullanıcı Adı (Zorunlu)" required>
                    <input type="email" id="signup-email" placeholder="E-posta" required>
                    <input type="password" id="signup-password" placeholder="Şifre" required>
                    <button onclick="handleSignup()">Kaydol</button>
                    <p style="margin-top: 15px;">
                        Zaten hesabın var mı? <a href="#" onclick="showForm('signin')">Giriş Yap</a>
                    </p>
                </div>

                <div id="signin-form-container">
                    <input type="email" id="signin-email" placeholder="E-posta" required>
                    <input type="password" id="signin-password" placeholder="Şifre" required>
                    <button onclick="handleSignin()">Giriş Yap</button>
                    <p style="margin-top: 15px;">
                        Hesabın yok mu? <a href="#" onclick="showForm('signup')">Şimdi Kaydol</a>
                    </p>
                </div>
                
                <p id="auth-message" class="error"></p>
            </div>
        `;
        body.classList.add('auth-page');
        body.classList.remove('chat-page');
        showForm('signin'); // Ekranı Giriş formuyla başlat
        
        loggedInUserId = null;
        loggedInUsername = null;
    }
});


// =========================================================
// CHAT APP MANTIĞI (Aynı kaldı)
// =========================================================

function getPrivateChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

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

    loadUserList(loggedInUserId);
    loadChatApp('general');
    
    document.getElementById('message-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });
}

function loadUserList() {
    const userListElement = document.getElementById('user-list');
    
    db.collection('users').get().then((snapshot) => {
        userListElement.innerHTML = ''; 
        
        snapshot.forEach((doc) => {
            const user = doc.data();
            const userId = doc.id;
            
            if (userId === loggedInUserId) return;

            const userItem = document.createElement('div');
            userItem.classList.add('user-item');
            userItem.textContent = user.username || 'Anonim Kullanıcı';
            userItem.setAttribute('data-user-id', userId);
            userItem.setAttribute('data-username', user.username);
            
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

function loadChatApp(type, otherUserId = null, otherUsername = null) {
    const chatTitleElement = document.getElementById('chat-title');
    const messagesContainer = document.getElementById('messages-container');
    const userItems = document.querySelectorAll('.user-item');

    if(unsubscribeChatListener) {
        unsubscribeChatListener();
        unsubscribeChatListener = null;
    }

    messagesContainer.innerHTML = '';
    currentChatType = type;
    currentChatUserId = otherUserId;
    currentChatUsername = otherUsername;
    
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

    let messagesCollectionRef;
    if (type === 'general') {
        messagesCollectionRef = db.collection('artifacts').doc(FIREBASE_APP_ID).collection('public').doc('data').collection('general_chat');
    } else {
        const chatId = getPrivateChatId(loggedInUserId, otherUserId);
        messagesCollectionRef = db.collection('private_chats').doc(chatId).collection('messages');
    }

    unsubscribeChatListener = messagesCollectionRef.orderBy('createdAt', 'asc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const message = change.doc.data();

                if (change.type === "added") {
                    const messageElement = createMessageElement(message, loggedInUserId);
                    messagesContainer.appendChild(messageElement);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight; 
                }
            });
        }, (error) => {
            console.error("Mesaj dinleme hatası:", error);
            messagesContainer.innerHTML = `<p class="error" style="text-align:center;">Mesajlar yüklenirken bir hata oluştu.</p>`;
        });
}

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
        const date = message.createdAt.toDate();
        time.textContent = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } else {
        time.textContent = 'Şimdi';
    }

    div.appendChild(senderName);
    div.appendChild(messageContent);
    div.appendChild(time);

    return div;
}

async function handleSendMessage() {
    if (!loggedInUserId) return; 

    const inputElement = document.getElementById('message-input');
    const text = inputElement.value.trim();

    if (text === '') return; 

    const newMessage = {
        userId: loggedInUserId,
        username: loggedInUsername,
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp() 
    };

    let messagesCollectionRef;

    try {
        if (currentChatType === 'general') {
            messagesCollectionRef = db.collection('artifacts').doc(FIREBASE_APP_ID).collection('public').doc('data').collection('general_chat');
        } else if (currentChatType === 'private' && currentChatUserId) {
            const chatId = getPrivateChatId(loggedInUserId, currentChatUserId);
            messagesCollectionRef = db.collection('private_chats').doc(chatId).collection('messages');
        } else {
            console.error("Hata: Geçersiz sohbet türü veya eksik kullanıcı ID'si.");
            return;
        }

        await messagesCollectionRef.add(newMessage);
        
        inputElement.value = ''; 

    } catch (error) {
        console.error("Mesaj gönderme hatası:", error);
    }
}