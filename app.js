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

// 2. Firebase Uygulamasını Başlatma
const app = firebase.initializeApp(firebaseConfig);
const auth = app.auth();
const db = app.firestore();

// 3. DOM Elemanları
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const toggleRegister = document.getElementById('toggle-register');
const authForm = document.getElementById('auth-form');
const authButton = document.getElementById('auth-button');
const usernameInput = document.getElementById('username');
const authError = document.getElementById('auth-error');
const logoutButton = document.getElementById('logout-button');
const currentUserInfo = document.getElementById('current-user-info');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messageContainer = document.getElementById('message-container');

let isRegistering = false;
let currentUsername = null;

// Ekran değiştirme işlevi
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Giriş/Kayıt formunu değiştirme işlevi
toggleRegister.addEventListener('click', (e) => {
    e.preventDefault();
    isRegistering = !isRegistering;
    authError.textContent = ''; // Hata mesajını temizle

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

// 4. Kimlik Doğrulama (Auth) İşlemleri

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
            
            // Kullanıcı adı benzersizlik kontrolü (Firestore ile)
            const usernameRef = db.collection('usernames').doc(username.toLowerCase());
            const doc = await usernameRef.get();
            
            if (doc.exists) {
                authError.textContent = 'Bu kullanıcı adı zaten alınmış.';
                return;
            }

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

            alert('Kayıt başarılı! Giriş yapılıyor...');

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
        } else {
             authError.textContent = 'Giriş/Kayıt sırasında bir hata oluştu.';
        }
    }
});

// Çıkış Yapma
logoutButton.addEventListener('click', () => {
    auth.signOut();
});


// 5. Oturum Durumu Kontrolü (State Change)

auth.onAuthStateChanged(user => {
    if (user) {
        // Kullanıcı Giriş Yaptı
        currentUsername = user.displayName || user.email.split('@')[0]; // Kullanıcı adı yoksa e-postanın başını kullan
        currentUserInfo.textContent = `Hoş Geldin, ${currentUsername}! ID: ${user.uid}`;
        switchScreen('chat-screen');
        
        // Giriş yaptıktan sonra mesajları dinlemeye başla
        listenForMessages();

    } else {
        // Kullanıcı Çıkış Yaptı / Giriş Yapmadı
        currentUsername = null;
        switchScreen('auth-screen');
        messageContainer.innerHTML = ''; // Mesajları temizle
    }
});

// 6. Mesaj Gönderme (Genel Sohbet)

messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();

    if (text && currentUsername) {
        try {
            await db.collection('messages').add({
                text: text,
                author: currentUsername,
                uid: auth.currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            messageInput.value = ''; // Mesajı gönderdikten sonra input'u temizle
        } catch (error) {
            console.error('Mesaj gönderme hatası:', error);
            alert('Mesaj gönderilemedi.');
        }
    }
});

// 7. Mesajları Dinleme ve Gösterme

function listenForMessages() {
    // Firestore'da 'messages' koleksiyonundaki değişiklikleri dinle
    db.collection('messages')
      .orderBy('timestamp', 'asc') // En yeni mesajları altta göster
      .limit(50) // Son 50 mesajı göster
      .onSnapshot(snapshot => {
        messageContainer.innerHTML = ''; // Her anlık güncellemeyle konteyneri temizle
        
        snapshot.forEach(doc => {
            const message = doc.data();
            displayMessage(message);
        });
        
        // En alta kaydır
        messageContainer.scrollTop = messageContainer.scrollHeight;
    });
}

// Mesajı DOM'a ekleme fonksiyonu
function displayMessage(message) {
    const isSelf = message.uid === auth.currentUser.uid;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isSelf ? 'self' : 'other');
    
    // Mesaj içeriği
    messageElement.innerHTML = `
        <div class="message-author">
            ${message.author}
        </div>
        <div class="message-content">
            ${message.text}
        </div>
    `;

    messageContainer.appendChild(messageElement);
}


// --- ÖZEL SOHBET KISMI (HENÜZ DEVRE DIŞI) ---
// Özel sohbet mantığı, genel sohbet stabilize edildikten sonra eklenecektir.