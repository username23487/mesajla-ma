// 🔥 KENDİ FIREBASE AYARLARINIZLA GÜNCELLENDİ 🔥
const firebaseConfig = {
    apiKey: "AIzaSyBcel9UpmT4fMjPE--Cr0P87L_CPqt9tqo",
    authDomain: "mesajlasma-373e3.firebaseapp.com",
    projectId: "mesajlasma-373e3",
    storageBucket: "mesajlasma-373e3.firebasestorage.app",
    messagingSenderId: "598072632815",
    appId: "1:598072632815:web:c2cb4bf550bd65a042421a"
};

// 1. Firebase'i başlat (Global SDK'dan erişim)
// Bu kodun çalışması için index.html'deki <script> etiketlerinin doğru olması gerekir.
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); 

// Elementler
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
const authForm = document.getElementById('auth-form');
const authMessage = document.getElementById('auth-message');
const logoutButton = document.getElementById('logout-button');
const body = document.body;

// Auth durumunu dinle (Giriş yapıldığında ne olacak?)
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Kullanıcı giriş yapmış. Kullanıcı adını alıp Chat ekranına geçelim.
        const userDoc = await db.collection('users').doc(user.uid).get();
        const username = userDoc.data().username || user.email;

        body.innerHTML = ''; // Body içeriğini temizle
        body.classList.remove('auth-page'); // Giriş sayfa stilini kaldır

        // Ana sohbet uygulamasını yükle
        loadChatApp(user.uid, username);

    } else {
        // Kullanıcı çıkış yapmış veya giriş yapmamış. Giriş ekranını göster.
        body.innerHTML = `
            <div class="container auth-container">
                <h1>💬 Hoş Geldin Coder!</h1>
                <p>Devam etmek için e-posta ve şifre ile giriş yap veya kaydol.</p>
                <div id="auth-form">
                    <input type="email" id="email" placeholder="E-posta" required>
                    <input type="password" id="password" placeholder="Şifre" required>
                    <input type="text" id="username" placeholder="Kullanıcı Adı (Sadece Kayıt Olurken)" style="display:none;">
                    <button onclick="handleAuth(true)">Giriş Yap</button>
                    <button onclick="handleAuth(false)">Kaydol</button>
                    <p id="auth-message" class="error"></p>
                </div>
                <button id="logout-button" style="display:none;" onclick="auth.signOut()">Çıkış Yap</button>
            </div>
        `;
        // Element referanslarını tekrar ayarla (DOM değiştiği için)
        updateAuthElements(); 
    }
});

// Element referanslarını güncelleme fonksiyonu (onAuthStateChanged sonrası DOM değişimi için)
function updateAuthElements() {
    // Burası, çıkış yapıldıktan sonra elementlerin tekrar doğru referanslara atanmasını sağlar.
    window.emailInput = document.getElementById('email');
    window.passwordInput = document.getElementById('password');
    window.usernameInput = document.getElementById('username');
    window.authForm = document.getElementById('auth-form');
    window.authMessage = document.getElementById('auth-message');
    window.logoutButton = document.getElementById('logout-button');
}

// Global olarak çağrılacak Auth fonksiyonu
async function handleAuth(isSignIn) {
    // Buradaki elementler artık global scope'ta olduğu için window. ön eki kullanıldı
    const email = window.emailInput.value;
    const password = window.passwordInput.value;
    const username = window.usernameInput.value;
    window.authMessage.textContent = ''; 

    try {
        if (isSignIn) {
            // --- GİRİŞ YAP ---
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            // --- KAYDOL ---
            if (!username) {
                window.authMessage.textContent = "Kayıt olurken kullanıcı adı zorunludur.";
                return;
            }

            // 1. Kullanıcı adının daha önce alınıp alınmadığını kontrol et
            const userCheck = await db.collection('users').where('username', '==', username).get();
            if (!userCheck.empty) {
                window.authMessage.textContent = "Bu kullanıcı adı zaten alınmış. Lütfen başka bir tane seçin.";
                return;
            }

            // 2. Firebase Auth ile yeni kullanıcı oluştur
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // 3. Kullanıcı adını Firestore'a kaydet 
            await db.collection('users').doc(user.uid).set({
                email: user.email,
                username: username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            window.authMessage.textContent = "Başarıyla kaydoldun! Sohbet ekranına geçiliyor...";
        }
    } catch (error) {
        console.error("Kimlik Doğrulama Hatası:", error);
        // Hata mesajlarını kısaltarak kullanıcıya göster
        let errorMessage = "Bir hata oluştu.";
        if (error.code === 'auth/email-already-in-use') errorMessage = "Bu e-posta zaten kullanılıyor.";
        else if (error.code === 'auth/weak-password') errorMessage = "Şifre en az 6 karakter olmalıdır.";
        else if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') errorMessage = "Giriş bilgileri hatalı.";
        window.authMessage.textContent = errorMessage;
    }
}


// =========================================================
// 2. ADIM: CHAT UYGULAMASI (GENEL SOHBET) MANTIĞI
// =========================================================

/**
 * Kullanıcı başarıyla giriş yaptıktan sonra sohbet arayüzünü yükler.
 * @param {string} userId - Mevcut kullanıcı ID'si
 * @param {string} username - Mevcut kullanıcı adı
 */
function loadChatApp(userId, username) {
    // Sohbet arayüzü HTML'ini sayfaya bas
    body.innerHTML = `
        <div class="chat-wrapper">
            <div class="header">
                <h2>Genel Sohbet Odası 🗣️</h2>
                <div class="user-info">
                    <span class="user-id">ID: ${userId}</span> 
                    <button class="logout-btn" onclick="auth.signOut()">Çıkış Yap</button>
                </div>
            </div>
            <div id="messages-container" class="messages-container">
                <!-- Mesajlar buraya eklenecek -->
            </div>
            <div class="message-input-area">
                <input type="text" id="message-input" placeholder="Mesajınızı buraya yazın..." />
                <button id="send-button" onclick="sendMessage('${userId}', '${username}')">Gönder</button>
            </div>
        </div>
    `;

    // Yeni elementleri referansla
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Mesaj kutusunu alta kaydır

    // Anlık Mesaj Dinleyicisini Başlat
    setupMessageListener(messagesContainer);

    // Enter tuşu ile mesaj gönderme
    document.getElementById('message-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendMessage(userId, username);
        }
    });
}

/**
 * Firestore'dan anlık mesajları dinler ve arayüze ekler.
 * @param {HTMLElement} container - Mesajların ekleneceği DOM elementi
 */
function setupMessageListener(container) {
    const messagesCollection = db.collection('artifacts').doc('mesajlasma-373e3').collection('public').doc('data').collection('general_chat');
    
    // Mesajları 'createdAt' alanına göre artan sırada (en yeni altta) dinle
    messagesCollection.orderBy('createdAt', 'asc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const message = change.doc.data();
                const user = auth.currentUser;

                // Sadece yeni eklenen (added) mesajları ekle
                if (change.type === "added") {
                    const messageElement = createMessageElement(message, user.uid);
                    container.appendChild(messageElement);
                }
                // Mesaj kutusunu her yeni mesajda alta kaydır
                container.scrollTop = container.scrollHeight;
            });
        }, (error) => {
            console.error("Mesaj dinleme hatası:", error);
            // Hata durumunda kullanıcıya gösterilebilecek bir mesaj eklenebilir.
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
    
    // Stil için Tailwind benzeri classlar kullanılıyor
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
 * Yeni bir mesajı Firestore'a kaydeder.
 * @param {string} userId - Mesajı gönderen ID
 * @param {string} username - Mesajı gönderen kullanıcı adı
 */
async function sendMessage(userId, username) {
    const inputElement = document.getElementById('message-input');
    const text = inputElement.value.trim();

    if (text === '') return; // Boş mesaj gönderme

    const newMessage = {
        userId: userId,
        username: username,
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // Sunucu saati ile zaman damgası
    };

    try {
        const messagesCollection = db.collection('artifacts').doc('mesajlasma-373e3').collection('public').doc('data').collection('general_chat');
        await messagesCollection.add(newMessage);
        
        inputElement.value = ''; // Gönderdikten sonra giriş alanını temizle

    } catch (error) {
        console.error("Mesaj gönderme hatası:", error);
        alert("Mesaj gönderilemedi. Lütfen konsolu kontrol edin.");
    }
}