// /static/js/main.js (Versión Definitiva y Centralizada)

function initializeGlobalEventListeners() {
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');

    // --- Selectores ---
    const searchBtn = document.getElementById('search-btn');
    const notificationsBtn = document.getElementById('notifications-btn');
    const chatBtn = document.getElementById('chat-btn');
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const notificationsPanel = document.getElementById('notifications-panel');
    const markAllReadBtn = document.getElementById('mark-all-as-read-btn');
    const notificationBadge = document.querySelector('.notification-badge');
    const myProfileLink = document.getElementById('my-profile-link');
    const logoutBtn = document.getElementById('logout-btn');

    if (token) {
        const username = localStorage.getItem('username');
        if (myProfileLink && username) myProfileLink.href = `/profile.html?user=${username}`;
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.clear();
                window.location.href = '/index.html';
            });
        }
    } else {
        if(searchBtn) searchBtn.style.display = 'none';
        if(notificationsBtn) notificationsBtn.style.display = 'none';
        if(chatBtn) chatBtn.style.display = 'none';
        return;
    }
    
    // --- Lógica de Búsqueda, Notificaciones, etc. ---
    // (Esta sección se acorta para no repetir código, pero debe estar completa en tu archivo)
    const fetchWithAuth = (url, options = {}) => { /* ...lógica fetch... */ };
    let searchTimeout;
    const performSearch = async (query) => { /* ...lógica de búsqueda... */ };
    const renderSearchResults = (results) => { /* ...lógica de renderizado de búsqueda... */ };
    const fetchNotifications = async () => { /* ...lógica de notificaciones... */ };
    const renderNotifications = (notifications) => { /* ...lógica de renderizado de notificaciones... */ };
    const markAllAsRead = async () => { /* ...lógica de marcar como leído... */ };

    // --- Lógica Centralizada y Segura de Eventos ---
    // Usamos "guards" (if) para que el script no falle si un elemento no está en la página actual.
    if (searchBtn && !searchBtn.dataset.initialized) {
        searchBtn.addEventListener('click', () => searchModal.classList.add('is-visible'));
        searchBtn.dataset.initialized = 'true';
    }
    if (searchInput && !searchInput.dataset.initialized) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => { performSearch(e.target.value); }, 300);
        });
        searchInput.dataset.initialized = 'true';
    }
    if (searchResultsContainer && !searchResultsContainer.dataset.initialized) {
        searchResultsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action="start-chat"]');
            if (target) {
                const userInfo = JSON.parse(target.dataset.userInfo.replace(/&apos;/g, "'"));
                document.dispatchEvent(new CustomEvent('startChat', { detail: userInfo }));
                if(searchModal) searchModal.classList.remove('is-visible');
            }
        });
        searchResultsContainer.dataset.initialized = 'true';
    }
    if (notificationsBtn && !notificationsBtn.dataset.initialized) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (notificationsPanel) {
                const isVisible = notificationsPanel.classList.toggle('visible');
                if (isVisible) fetchNotifications();
            }
        });
        notificationsBtn.dataset.initialized = 'true';
    }
    if (markAllReadBtn && !markAllReadBtn.dataset.initialized) {
        markAllReadBtn.addEventListener('click', markAllAsRead);
        markAllReadBtn.dataset.initialized = 'true';
    }
    if (chatBtn && !chatBtn.dataset.initialized) {
        chatBtn.addEventListener('click', () => { window.location.href = '/chat.html'; });
        chatBtn.dataset.initialized = 'true';
    }
    
    // Lógica para abrir cualquier modal con data-modal-target
    document.body.addEventListener('click', e => {
        const modalTarget = e.target.closest('[data-modal-target]');
        if (modalTarget) {
            e.preventDefault();
            const modal = document.querySelector(modalTarget.dataset.modalTarget);
            if (modal) modal.classList.add('is-visible');
        }
    });

    fetchNotifications(); // Cargar notificaciones para el badge
}

// Hacemos la función accesible globalmente para que profile.js pueda llamarla
window.initializeGlobalEventListeners = initializeGlobalEventListeners;

// Ejecutamos la función al cargar la página, EXCEPTO en la de perfil
document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.classList.contains('profile-page')) {
        initializeGlobalEventListeners();
    }
});