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
const chatScreen = document.getElementById('chat-screen');
const toggleRegister = document.getElementById('toggle-register');
const authForm = document.getElementById('auth-form');
const authButton = document.getElementById('auth-button');
const usernameInput = document.getElementById('username');
const authError = document.getElementById('auth-error');
const logoutButton = document.getElementById('logout-button');
const currentUserInfo = document.getElementById('current-user-info');

// Genel Sohbet Elemanları
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messageContainer = document.getElementById('message-container');

// Özel Sohbet Elemanları
const privateUserIdInput = document.getElementById('private-user-id');
const startPrivateChatButton = document.getElementById('start-private-chat');
const privateMessagesContainer = document.getElementById('private-messages');
const privateChatArea = document.getElementById('private-chat-area');

let isRegistering = false;
let currentUsername = null;
let currentChatListener = null; 
let privateChatListener = null; 

// Özel sohbet durumu
let activePrivateChat = {
    chatId: null,
    targetUid: null,
    targetUsername: null
};

// Ekran değiştirme işlevi
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Giriş/Kayıt formunu değiştirme işlevi (DÜZELTİLMİŞ KISIM)
toggleRegister.addEventListener('click', (e) => {
    e.preventDefault(); // Sayfanın yeniden yüklenmesini kesinlikle engelle
    
    isRegistering = !isRegistering;
    authError.textContent = ''; // Hata mesajını temizle

    if (isRegistering) {
        authButton.textContent = 'Kayıt Ol';
        toggleRegister.textContent = 'Giriş Yap';
        // Kullanıcı Adı inputunu görünür yap
        usernameInput.style.display = 'block'; 
        // HTML'deki `toggle-register` elemanının metnini güncelleyelim
        document.getElementById('toggle-register').textContent = 'Giriş Yap'; 
    } else {
        authButton.textContent = 'Giriş Yap';
        toggleRegister.textContent = 'Kayıt Ol';
        // Kullanıcı Adı inputunu gizle
        usernameInput.style.display = 'none'; 
        document.getElementById('toggle-register').textContent = 'Kayıt Ol';
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
            
            // Kullanıcı adı benzersizlik kontrolü (Firestore)
            // Kullanıcı adlarını küçük harfle kaydediyoruz.
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

// Oturum Durumu Kontrolü (State Change)
auth.onAuthStateChanged(user => {
    if (user) {
        // Kullanıcı Giriş Yaptı
        currentUsername = user.displayName || user.email.split('@')[0];
        // Kullanıcının UID'sini görünür ve kolay kopyalanabilir yapıyoruz.
        currentUserInfo.innerHTML = `Hoş Geldin, **${currentUsername}**! ID: <span style="font-weight: bold; color: yellow;">${user.uid}</span>`;
        switchScreen('chat-screen');
        
        // Önceki dinleyicileri kapat
        if (currentChatListener) currentChatListener();
        if (privateChatListener) privateChatListener();
        
        // Yeni mesajları dinlemeye başla
        listenForMessages();

    } else {
        // Kullanıcı Çıkış Yaptı / Giriş Yapmadı
        currentUsername = null;
        switchScreen('auth-screen');
        messageContainer.innerHTML = '';
        privateMessagesContainer.innerHTML = '';
        activePrivateChat = { chatId: null, targetUid: null, targetUsername: null };
        
        // Dinleyicileri temizle
        if (currentChatListener) currentChatListener();
        if (privateChatListener) privateChatListener();
    }
});

// 5. GENEL/ÖZEL MESAJ GÖNDERME
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();

    if (text && currentUsername) {
        // Mesajı özel sohbet aktifse özel sohbete, değilse genel sohbete gönder
        if (activePrivateChat.chatId) {
            await sendPrivateMessage(text);
        } else {
            await sendGeneralMessage(text);
        }
        messageInput.value = ''; // Input'u temizle
    }
});

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

// 6. MESAJLARI DİNLEME ve GÖSTERME (Genel Sohbet)
function listenForMessages() {
    // Genel Sohbet Dinleyicisi
    currentChatListener = db.collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(50)
      .onSnapshot(snapshot => {
        messageContainer.innerHTML = '';
        
        snapshot.forEach(doc => {
            const message = doc.data();
            displayMessage(message, messageContainer, false); // Genel sohbet mesajları
        });
        
        // En alta kaydır
        messageContainer.scrollTop = messageContainer.scrollHeight;
    });
}

// Mesajı DOM'a ekleme fonksiyonu (Genel ve Özel için tek fonksiyon)
function displayMessage(message, container, isPrivate = false) {
    const isSelf = message.uid === auth.currentUser.uid;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isSelf ? 'self' : 'other');
    
    let authorText = isSelf ? 'Sen' : message.author;
    
    // Özel sohbette yazar adını biraz farklı gösterelim
    if (isPrivate) {
        authorText += ' (Özel)';
        // Özel sohbet alanının başlığını güncelleyelim
        const header = container.querySelector('h3');
        if (header) {
             header.textContent = `Özel Sohbet (Aktif: ${activePrivateChat.targetUsername})`;
        }
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

// 7. ÖZEL SOHBET MANTIKLARI

// Chat ID oluşturma (UID'leri alfabetik sıraya göre birleştirir)
function getChatId(targetUid) {
    const currentUid = auth.currentUser.uid;
    return currentUid < targetUid 
        ? `${currentUid}-${targetUid}` 
        : `${targetUid}-${currentUid}`;
}

// Özel sohbeti başlat butonu
startPrivateChatButton.addEventListener('click', async () => {
    const targetUid = privateUserIdInput.value.trim();
    
    if (!targetUid || targetUid === auth.currentUser.uid) {
        alert("Geçerli bir hedef Kullanıcı ID'si (kendi ID'nizden farklı) girin.");
        return;
    }

    // Hedef kullanıcının varlığını kontrol et ve kullanıcı adını al
    // Kullanıcı adını 'usernames' koleksiyonundaki UID'ye göre arıyoruz
    const targetUserDoc = await db.collection('usernames').where('uid', '==', targetUid).limit(1).get();
    
    if (targetUserDoc.empty) {
        alert("Girdiğiniz ID'ye sahip bir kullanıcı bulunamadı.");
        return;
    }
    
    // Kullanıcı adı dokümanın ID'sidir (username.toLowerCase() olarak kaydedilmişti)
    const targetUsername = targetUserDoc.docs[0].id; 

    // Chat ID oluştur ve özel sohbeti başlat
    activePrivateChat.targetUid = targetUid;
    activePrivateChat.targetUsername = targetUsername;
    activePrivateChat.chatId = getChatId(targetUid);
    
    // Önceki dinleyiciyi kapat
    if (privateChatListener) privateChatListener();
    
    listenForPrivateMessages(activePrivateChat.chatId);
    
    // Kullanıcının dikkatini özel sohbete çekmek için arayüzü güncelleyelim.
    privateMessagesContainer.style.border = '2px solid var(--primary-color)';
    
    alert(`Özel sohbet başlatıldı: ${targetUsername} ile konuşuyorsunuz.`);
    privateUserIdInput.value = '';
});

// Özel mesajları dinleme
function listenForPrivateMessages(chatId) {
    privateMessagesContainer.innerHTML = `<h3>Özel Sohbet (Aktif: ${activePrivateChat.targetUsername})</h3>`;
    
    privateChatListener = db.collection('private_chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(50)
      .onSnapshot(snapshot => {
        // Sadece mesajları temizle, başlık kalsın
        const existingMessages = privateMessagesContainer.querySelectorAll('.message');
        // Başlık (h3) elemanını koruyarak eski mesajları temizle
        existingMessages.forEach(msg => {
            if (!msg.parentElement.querySelector('h3')) {
                msg.remove();
            }
        });

        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const message = change.doc.data();
                displayMessage(message, privateMessagesContainer, true);
            }
        });
        
        privateMessagesContainer.scrollTop = privateMessagesContainer.scrollHeight;
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
                targetUid: activePrivateChat.targetUid,
                type: 'private'
            });
    } catch (error) {
        console.error('Özel mesaj gönderme hatası:', error);
        alert('Özel mesaj gönderilemedi.');
    }
}
