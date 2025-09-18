// /static/js/main.js (Versión Final con Notificaciones en Tiempo Real y Chat Preview)

function initializeGlobalEventListeners() {
    const token = localStorage.getItem('accessToken');
if (token) {
    const socket = io(backendUrl); 

    socket.on('connect', () => {
        console.log('Socket conectado globalmente.');
        socket.emit('authenticate', { token });
    });

    socket.on('new_notification', (data) => {
        const notificationsButton = document.getElementById('notifications-btn');
        if (notificationsButton) {
            notificationsButton.classList.add('has-unread');
        }
        showToast('Tienes una nueva notificación');
        
        const notificationsPanel = document.getElementById('notifications-panel');
        if (notificationsPanel && notificationsPanel.classList.contains('visible')) {
            // Llama a una función global para recargar notificaciones si está abierta
            if(window.fetchNotifications) window.fetchNotifications();
        }
    });
}
    // --- FIN: LÓGICA DE SOCKET.IO ---

    // --- Selectores de Elementos Globales ---
    const searchBtn = document.getElementById('search-btn');
    const notificationsBtn = document.getElementById('notifications-btn');
    const chatBtn = document.getElementById('chat-btn');
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const notificationsPanel = document.getElementById('notifications-panel');
    const chatPreviewPanel = document.getElementById('chat-preview-panel'); // Nuevo
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
        if(searchBtn) searchBtn.style.display = 'none';
        if(notificationsBtn) notificationsBtn.style.display = 'none';
        if(chatBtn) chatBtn.style.display = 'none';
    }
    
    // --- Lógica de Búsqueda ---
    let searchTimeout;
    const performSearch = async (query) => {
        if (!query || query.length < 2) {
            searchResultsContainer.innerHTML = '';
            return;
        }
        try {
            const response = await fetchWithAuth(`/api/search?q=${query}`);
            const results = await response.json();
            renderSearchResults(results);
        } catch (error) {
            console.error("Error en la búsqueda:", error);
        }
    };

    const renderSearchResults = (results) => {
        let html = '<h4>Usuarios</h4>';
        if (results.users && results.users.length) {
            html += results.users.map(u => `<div class="search-result-item"><span>@${u.username}</span><button class="btn btn-secondary start-chat" data-user-info='{"id": ${u.id}, "username": "${u.username}", "avatar": "${u.profile_picture_url}"}'>Chat</button></div>`).join('');
        } else {
            html += '<p>No se encontraron usuarios.</p>';
        }
        html += '<h4>Álbumes</h4>';
        if (results.albums && results.albums.length) {
            html += results.albums.map(a => `<div class="search-result-item"><a href="/album.html?id=${a.id}">${a.title}</a></div>`).join('');
        } else {
            html += '<p>No se encontraron álbumes.</p>';
        }
        searchResultsContainer.innerHTML = html;
    };

    // --- Lógica de Notificaciones ---
    const fetchNotifications = async () => {
        try {
            const response = await fetchWithAuth('/api/notifications');
            const notifications = await response.json();
            renderNotifications(notifications);
            
            const unreadCount = notifications.filter(n => !n.is_read).length;
            if (notificationsBtn) {
                if (unreadCount > 0) {
                    notificationsBtn.classList.add('has-unread');
                } else {
                    notificationsBtn.classList.remove('has-unread');
                }
            }
        } catch (error) {
            console.error("Error cargando notificaciones:", error);
        }
    };

    const renderNotifications = (notifications) => {
        const list = document.getElementById('notifications-list');
        if (!list) return;

        if (notifications.length === 0) {
            list.innerHTML = `<div class="notifications-empty"><i class="fas fa-bell-slash"></i><p>Todo está al día</p><span>No tienes notificaciones nuevas.</span></div>`;
            return;
        }

        const notificationIcons = {
            'new_follower': 'fa-user-plus', 'new_like': 'fa-heart',
            'new_comment': 'fa-comment', 'new_reply': 'fa-comments',
            'new_message': 'fa-envelope', 'report_received': 'fa-flag'
        };

        list.innerHTML = notifications.map(n => `
            <div class="notification-item-wrapper">
                <a href="${n.link}" class="notification-item ${n.is_read ? 'read' : ''}">
                    <div class="notification-icon"><i class="fas ${notificationIcons[n.notification_type] || 'fa-bell'}"></i></div>
                    <div class="notification-content">
                        <p>${n.message}</p>
                        <span class="timestamp">${formatTimeAgo(n.created_at)}</span>
                    </div>
                </a>
                <button class="delete-notification-btn" data-id="${n.id}" title="Eliminar notificación">&times;</button>
            </div>
        `).join('');
    };
    
    // --- NUEVA LÓGICA PARA VISTA PREVIA DE CHAT ---
    const fetchChatPreview = async () => {
        const list = document.getElementById('chat-preview-list');
        if(!list) return;
        list.innerHTML = `<p style="padding: 1rem; text-align: center; color: var(--text-muted);">Cargando chats...</p>`;
        try {
            const response = await fetchWithAuth('/api/chats');
            const conversations = await response.json();
            renderChatPreview(conversations);
        } catch (error) {
            console.error("Error al cargar la vista previa del chat:", error);
            list.innerHTML = `<p style="padding: 1rem; text-align: center; color: var(--text-muted);">Error al cargar chats.</p>`;
        }
    };

    const renderChatPreview = (conversations) => {
        const list = document.getElementById('chat-preview-list');
        if (!list) return;
        if (conversations.length === 0) {
            list.innerHTML = `<p style="padding: 1rem; text-align: center; color: var(--text-muted);">No tienes conversaciones.</p>`;
            return;
        }
        list.innerHTML = conversations.map(convo => `
            <a href="/chat.html" class="chat-preview-item">
                <img src="${convo.other_user.profile_picture_url || '/static/img/placeholder-default.jpg'}" alt="${convo.other_user.username}">
                <div class="chat-preview-info">
                    <h4>${convo.other_user.username}</h4>
                    <p class="last-message">${convo.last_message.content}</p>
                </div>
                ${convo.unread_count > 0 ? `<span class="unread-badge">${convo.unread_count}</span>` : ''}
            </a>
        `).join('');
    };

    // --- Lógica de Eventos Centralizada ---
    document.body.addEventListener('click', async (e) => {
        const modalTarget = e.target.closest('[data-modal-target]');
        const closeButton = e.target.closest('.close-button');

        // Abrir modales
        if (modalTarget) {
            e.preventDefault();
            const modal = document.querySelector(modalTarget.dataset.modalTarget);
            if (modal) modal.classList.add('is-visible');
        }
        // Cerrar modales
        if (closeButton || e.target.matches('.modal.is-visible')) {
            closeAllModals();
        }
        // Lógica para botones de notificación
        const markAllReadBtn = e.target.closest('#mark-all-as-read-btn');
        const clearReadBtn = e.target.closest('#clear-read-notifications-btn');
        const deleteNotificationBtn = e.target.closest('.delete-notification-btn');

        if (markAllReadBtn) {
            await fetchWithAuth('/api/notifications/read', { method: 'POST' });
            fetchNotifications();
        }
        if (clearReadBtn) {
            await fetchWithAuth('/api/me/notifications/read', { method: 'DELETE' });
            showToast("Notificaciones leídas eliminadas.");
            fetchNotifications();
        }
        if (deleteNotificationBtn) {
            e.preventDefault();
            e.stopPropagation();
            deleteNotificationBtn.parentElement.style.opacity = '0';
            setTimeout(async () => {
                await fetchWithAuth(`/api/notifications/${deleteNotificationBtn.dataset.id}`, { method: 'DELETE' });
                fetchNotifications();
            }, 300);
        }
        // Lógica para el botón de chat
        const chatButton = e.target.closest('.start-chat');
        if (chatButton) {
            const userInfo = JSON.parse(chatButton.dataset.userInfo);
            localStorage.setItem('chat_with_user', JSON.stringify(userInfo));
            window.location.href = '/chat.html';
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => performSearch(e.target.value), 300);
        });
    }

    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatPreviewPanel?.classList.remove('visible');
            const isVisible = notificationsPanel.classList.toggle('visible');
            if (isVisible) fetchNotifications();
        });
    }

    if (chatBtn) {
        chatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationsPanel?.classList.remove('visible');
            const isVisible = chatPreviewPanel.classList.toggle('visible');
            if (isVisible) fetchChatPreview();
        });
    }
    
    const closeAllModals = () => {
        document.querySelectorAll('.modal.is-visible').forEach(modal => modal.classList.remove('is-visible'));
    };

    document.body.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            closeAllModals();
            notificationsPanel?.classList.remove('visible');
            chatPreviewPanel?.classList.remove('visible');
        }
    });

    // Carga inicial de notificaciones si el usuario está logueado
    if (token) {
        fetchNotifications();
    }
}

window.initializeGlobalEventListeners = initializeGlobalEventListeners;

document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.classList.contains('profile-page')) {
        initializeGlobalEventListeners();
    }
});