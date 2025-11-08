// Uygulamanın temel JavaScript dosyası.
// Bir sonraki adımda Firebase (Auth ve Database) kodlarını buraya ekleyeceğiz.

console.log("Mesajlaşma uygulaması projesi başlatıldı!");

// Temel DOM elemanlarını alalım
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const toggleRegister = document.getElementById('toggle-register');
const authForm = document.getElementById('auth-form');
const authButton = document.getElementById('auth-button');
const usernameInput = document.getElementById('username');

let isRegistering = false;

// Giriş/Kayıt formunu değiştirme işlevi
toggleRegister.addEventListener('click', (e) => {
    e.preventDefault();
    isRegistering = !isRegistering;
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

// Ekran değiştirme işlevi
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Şu an için sadece ekran değiştirme örneği:
// switchScreen('auth-screen'); // Başlangıçta giriş ekranı aktif
// Örneğin: switchScreen('chat-screen'); // Giriş başarılıysa sohbet ekranına geç
