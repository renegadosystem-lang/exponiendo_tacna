// /static/js/main.js (Versión Final con Inicialización Manual)

// La lógica de Socket.IO se mantiene global y se ejecuta una sola vez.
const token = localStorage.getItem('accessToken');
if (token && typeof io !== 'undefined') {
    const socket = io(window.backendUrl); 

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
            if (window.fetchNotifications) {
                window.fetchNotifications();
            }
        }
    });
}

// Se hace global para que otros scripts puedan accederla
let allConversations = [];
let fetchNotifications;

function initializeGlobalEventListeners() {
    const currentToken = localStorage.getItem('accessToken');
    
    // --- Selectores de Elementos Globales ---
    const searchBtn = document.getElementById('search-btn');
    const notificationsBtn = document.getElementById('notifications-btn');
    const chatBtn = document.getElementById('chat-btn');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const notificationsPanel = document.getElementById('notifications-panel');
    const chatPreviewPanel = document.getElementById('chat-preview-panel');
    const myProfileLink = document.getElementById('my-profile-link');
    const logoutBtn = document.getElementById('logout-btn');

    if (currentToken) {
        const username = localStorage.getItem('username');
        if (myProfileLink && username) myProfileLink.href = `/profile.html?user=${username}`;
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.clear();
                window.location.href = '/index.html';
            });
        }
    }
    
    let searchTimeout;
    const performSearch = async (query) => {
        if (!searchResultsContainer) return;
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
    if (!searchResultsContainer) return;
    let html = '<h4>Usuarios</h4>';
    if (results.users && results.users.length) {
        // --- INICIO DE LA MODIFICACIÓN ---
        html += results.users.map(u => `
            <div class="search-result-item">
                <div class="search-result-info">
                    <img src="${u.profile_picture_url || '/static/img/placeholder-default.jpg'}" alt="${u.username}">
                    <span>@${u.username}</span>
                </div>
                <div class="search-result-actions">
                    <a href="/profile.html?user=${u.username}" class="btn btn-secondary">Ver Perfil</a>
                    <button class="btn btn-primary start-chat" data-user-info='${JSON.stringify(u)}'>Chat</button>
                </div>
            </div>
        `).join('');
        // --- FIN DE LA MODIFICACIÓN ---
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

    fetchNotifications = async () => {
        try {
            const response = await fetchWithAuth('/api/notifications');
            if (!response.ok) throw new Error('Sesión inválida o expirada.');
            const notifications = await response.json();
            renderNotifications(notifications);
            
            if (notificationsBtn) {
                const unreadCount = notifications.filter(n => !n.is_read).length;
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
    window.fetchNotifications = fetchNotifications;

    const renderNotifications = (notifications) => {
        const list = document.getElementById('notifications-list');
        if (!list) return;
        if (!Array.isArray(notifications)) return;

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
    
    const fetchChatPreview = async () => {
        const list = document.getElementById('chat-preview-list');
        if(!list) return;
        list.innerHTML = `<p style="padding: 1rem; text-align: center; color: var(--text-muted);">Cargando chats...</p>`;
        try {
            const response = await fetchWithAuth('/api/chats');
            if (!response.ok) throw new Error('Sesión inválida o expirada.');
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
        if (!Array.isArray(conversations)) return;

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

    const closeAllModals = () => document.querySelectorAll('.modal.is-visible').forEach(modal => modal.classList.remove('is-visible'));

    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (chatPreviewPanel) chatPreviewPanel.classList.remove('visible');
            if (notificationsPanel) {
                const isVisible = notificationsPanel.classList.toggle('visible');
                if (isVisible) fetchNotifications();
            }
        });
    }

    if (chatBtn) {
        chatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (notificationsPanel) notificationsPanel.classList.remove('visible');
            if (chatPreviewPanel) {
                const isVisible = chatPreviewPanel.classList.toggle('visible');
                if (isVisible) fetchChatPreview();
            }
        });
    }
    
    document.body.addEventListener('click', async (e) => {
        const modalTarget = e.target.closest('[data-modal-target]');
        if (modalTarget) {
            e.preventDefault();
            const modal = document.querySelector(modalTarget.dataset.modalTarget);
            if (modal) modal.classList.add('is-visible');
        }

        const closeButton = e.target.closest('.close-button');
        if (closeButton || e.target.matches('.modal.is-visible')) {
            closeAllModals();
        }
        
        const markAllReadBtn = e.target.closest('#mark-all-as-read-btn');
        if (markAllReadBtn) {
            await fetchWithAuth('/api/notifications/read', { method: 'POST' });
            fetchNotifications();
        }

        const clearReadBtn = e.target.closest('#clear-read-notifications-btn');
        if (clearReadBtn) {
            await fetchWithAuth('/api/me/notifications/read', { method: 'DELETE' });
            showToast("Notificaciones leídas eliminadas.");
            fetchNotifications();
        }

        const deleteNotificationBtn = e.target.closest('.delete-notification-btn');
        if (deleteNotificationBtn) {
            e.preventDefault();
            e.stopPropagation();
            deleteNotificationBtn.parentElement.style.opacity = '0';
            setTimeout(async () => {
                await fetchWithAuth(`/api/notifications/${deleteNotificationBtn.dataset.id}`, { method: 'DELETE' });
                fetchNotifications();
            }, 300);
        }

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

    document.body.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            closeAllModals();
            if (notificationsPanel) notificationsPanel.classList.remove('visible');
            if (chatPreviewPanel) chatPreviewPanel.classList.remove('visible');
        }
    });

    if (currentToken) {
        fetchNotifications();
    }
}

window.initializeGlobalEventListeners = initializeGlobalEventListeners;

// El DOMContentLoaded ahora está vacío aquí. Cada página es responsable de llamar a la inicialización.
document.addEventListener('DOMContentLoaded', () => {
    // No hacer nada aquí globalmente.

});
