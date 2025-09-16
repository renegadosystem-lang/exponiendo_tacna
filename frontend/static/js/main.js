// /static/js/main.js (Versión Corregida y Centralizada)

function initializeGlobalEventListeners() {
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');

    // Selectores
    const searchBtn = document.getElementById('search-btn');
    const notificationsBtn = document.getElementById('notifications-btn');
    const chatBtn = document.getElementById('chat-btn');
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const notificationsPanel = document.getElementById('notifications-panel');
    const markAllReadBtn = document.getElementById('mark-all-as-read-btn');
    const notificationBadge = document.querySelector('.notification-badge');

    if (!token) {
        if(searchBtn) searchBtn.style.display = 'none';
        if(notificationsBtn) notificationsBtn.style.display = 'none';
        if(chatBtn) chatBtn.style.display = 'none';
        return;
    }

    const fetchWithAuth = (url, options = {}) => { /* ... (código sin cambios) ... */ };
    let searchTimeout;
    const performSearch = async (query) => { /* ... (código sin cambios) ... */ };
    const renderSearchResults = (results) => { /* ... (código sin cambios) ... */ };
    const fetchNotifications = async () => { /* ... (código sin cambios) ... */ };
    const renderNotifications = (notifications) => { /* ... (código sin cambios) ... */ };
    const markAllAsRead = async () => { /* ... (código sin cambios) ... */ };
    
    // --- Lógica Centralizada de Eventos ---
    if (searchBtn && !searchBtn.dataset.initialized) {
        searchBtn.addEventListener('click', () => searchModal.classList.add('is-visible'));
        searchBtn.dataset.initialized = true;
    }
    if (searchInput && !searchInput.dataset.initialized) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => { performSearch(e.target.value); }, 300);
        });
        searchInput.dataset.initialized = true;
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
        searchResultsContainer.dataset.initialized = true;
    }
    if (notificationsBtn && !notificationsBtn.dataset.initialized) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = notificationsPanel.classList.toggle('visible');
            if (isVisible) fetchNotifications();
        });
        notificationsBtn.dataset.initialized = true;
    }
    if (markAllReadBtn && !markAllReadBtn.dataset.initialized) {
        markAllReadBtn.addEventListener('click', markAllAsRead);
        markAllReadBtn.dataset.initialized = true;
    }
    if (chatBtn && !chatBtn.dataset.initialized) {
        chatBtn.addEventListener('click', () => { window.location.href = '/chat.html'; });
        chatBtn.dataset.initialized = true;
    }

    // --- Lógica Centralizada para Modales ---
    document.body.addEventListener('click', e => {
        const modalTarget = e.target.closest('[data-modal-target]');
        if (modalTarget) {
            e.preventDefault();
            const modal = document.querySelector(modalTarget.dataset.modalTarget);
            if (modal) modal.classList.add('is-visible');
        }
    });

    fetchNotifications();
}

// Hacemos la función accesible globalmente
window.initializeGlobalEventListeners = initializeGlobalEventListeners;

// Ejecutamos la función al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // Excluimos la ejecución automática en la página de perfil, ya que la llamaremos manualmente
    if (!document.getElementById('profile-main-content')) {
        initializeGlobalEventListeners();
    }
}); 