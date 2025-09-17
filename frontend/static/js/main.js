// /static/js/main.js (Versión Refactorizada y Centralizada)

function initializeGlobalEventListeners() {
    // Ya no se define backendUrl aquí, se usa el de utils.js
    const token = localStorage.getItem('accessToken');

    // --- Selectores de Elementos Globales ---
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

    // --- Configuración Inicial del Header ---
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
        // Ocultar botones si no hay sesión (en páginas como album.html)
        if(searchBtn) searchBtn.style.display = 'none';
        if(notificationsBtn) notificationsBtn.style.display = 'none';
        if(chatBtn) chatBtn.style.display = 'none';
        // No necesitamos retornar aquí para que la lógica de modales de invitados siga funcionando
    }
    
    // --- Lógica de Búsqueda ---
    let searchTimeout;
    const performSearch = async (query) => {
        if (!query || query.length < 2) {
            searchResultsContainer.innerHTML = '';
            return;
        }
        try {
            const response = await fetchWithAuth(`/api/search?q=${query}`); // Usa fetchWithAuth de utils.js
            const results = await response.json();
            renderSearchResults(results);
        } catch (error) {
            console.error("Error en la búsqueda:", error);
        }
    };

    const renderSearchResults = (results) => {
        let html = '<h4>Usuarios</h4>';
        if (results.users.length) {
            html += results.users.map(u => `<div class="search-result-item"><span>@${u.username}</span><button class="btn btn-secondary start-chat" data-user-info='{"id": ${u.id}, "username": "${u.username}", "avatar": "${u.profile_picture_url}"}'>Chat</button></div>`).join('');
        } else {
            html += '<p>No se encontraron usuarios.</p>';
        }
        html += '<h4>Álbumes</h4>';
        if (results.albums.length) {
            html += results.albums.map(a => `<div class="search-result-item"><a href="/album.html?id=${a.id}">${a.title}</a></div>`).join('');
        } else {
            html += '<p>No se encontraron álbumes.</p>';
        }
        searchResultsContainer.innerHTML = html;
    };

    // --- Lógica de Notificaciones ---
    const fetchNotifications = async () => {
        try {
            const response = await fetchWithAuth('/api/notifications'); // Usa fetchWithAuth de utils.js
            const notifications = await response.json();
            renderNotifications(notifications);
            const unreadCount = notifications.filter(n => !n.is_read).length;
            if (notificationBadge) {
                notificationBadge.textContent = unreadCount > 0 ? unreadCount : '';
                notificationBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
            }
        } catch (error) {
            console.error("Error cargando notificaciones:", error);
        }
    };

    const renderNotifications = (notifications) => {
        const list = document.getElementById('notifications-list');
        if (!list) return;
        if (notifications.length === 0) {
            list.innerHTML = '<p>No tienes notificaciones.</p>';
            return;
        }
        list.innerHTML = notifications.map(n => `
            <a href="${n.link}" class="notification-item ${n.is_read ? 'read' : ''}">
                <img src="${n.actor_profile_picture || '/static/img/placeholder-default.jpg'}" alt="avatar">
                <p>${n.message}</p>
            </a>
        `).join('');
    };

    const markAllAsRead = async () => {
        try {
            await fetchWithAuth('/api/notifications/read', { method: 'POST' }); // Usa fetchWithAuth de utils.js
            fetchNotifications(); // Recargar para actualizar la UI
        } catch (error) {
            console.error("Error al marcar notificaciones como leídas:", error);
        }
    };

    // --- Lógica Centralizada y Segura de Eventos ---
    // Usamos 'data-initialized' para evitar añadir listeners múltiples veces si esta función se llama de nuevo
    if (searchInput && !searchInput.dataset.initialized) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => performSearch(e.target.value), 300);
        });
        searchInput.dataset.initialized = 'true';
    }

    if (searchResultsContainer && !searchResultsContainer.dataset.initialized) {
        searchResultsContainer.addEventListener('click', (e) => {
            const chatButton = e.target.closest('.start-chat');
            if (chatButton) {
                const userInfo = JSON.parse(chatButton.dataset.userInfo);
                localStorage.setItem('chat_with_user', JSON.stringify(userInfo));
                window.location.href = '/chat.html';
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

    // --- LÓGICA GLOBAL Y UNIFICADA PARA MODALES ---
    const closeAllModals = () => {
        document.querySelectorAll('.modal.is-visible').forEach(modal => {
            modal.classList.remove('is-visible');
        });
    };

    // Listener unificado para abrir y cerrar modales
    document.body.addEventListener('click', e => {
        // Lógica para ABRIR
        const modalTarget = e.target.closest('[data-modal-target]');
        if (modalTarget) {
            e.preventDefault();
            const modal = document.querySelector(modalTarget.dataset.modalTarget);
            if (modal) modal.classList.add('is-visible');
        }

        // Lógica para CERRAR
        if (e.target.matches('.close-button') || e.target.matches('.modal.is-visible')) {
            closeAllModals();
        }
    });

    document.body.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            closeAllModals();
        }
    });
    // --- FIN DE LÓGICA DE MODALES ---

    // Carga inicial de notificaciones si el usuario está logueado
    if (token) {
        fetchNotifications();
    }
}

// Hacemos la función accesible globalmente
window.initializeGlobalEventListeners = initializeGlobalEventListeners;

// Ejecutamos la función al cargar la página, EXCEPTO en páginas que lo harán manualmente
document.addEventListener('DOMContentLoaded', () => {
    // La clase 'profile-page' la añadimos en profile.js para evitar esta ejecución automática
    if (!document.body.classList.contains('profile-page')) {
        initializeGlobalEventListeners();
    }
});