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
        const response = await fetchWithAuth('/api/notifications');
        const notifications = await response.json();
        renderNotifications(notifications); // Esta función no cambia
        
        const unreadCount = notifications.filter(n => !n.is_read).length;
        const notificationsButton = document.getElementById('notifications-btn');

        // CAMBIO: En lugar de poner un número, activamos/desactivamos una clase.
        if (notificationsButton) {
            if (unreadCount > 0) {
                notificationsButton.classList.add('has-unread');
            } else {
                notificationsButton.classList.remove('has-unread');
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
            list.innerHTML = `
                <div class="notifications-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>Todo está al día</p>
                    <span>No tienes notificaciones nuevas.</span>
                </div>`;
            return;
        }

        const notificationIcons = {
            'new_follower': 'fa-user-plus',
            'new_like': 'fa-heart',
            'new_comment': 'fa-comment',
            'new_reply': 'fa-comments',
            'new_message': 'fa-envelope',
            'report_received': 'fa-flag'
        };

        list.innerHTML = notifications.map(n => `
            <div class="notification-item-wrapper">
                <a href="${n.link}" class="notification-item ${n.is_read ? 'read' : ''}">
                    <div class="notification-icon">
                        <i class="fas ${notificationIcons[n.notification_type] || 'fa-bell'}"></i>
                    </div>
                    <div class="notification-content">
                        <p>${n.message}</p>
                        <span class="timestamp">${formatTimeAgo(n.created_at)}</span>
                    </div>
                </a>
                <button class="delete-notification-btn" data-id="${n.id}" title="Eliminar notificación">
                    &times;
                </button>
            </div>
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

    // --- NUEVA LÓGICA PARA LIMPIAR Y ELIMINAR NOTIFICACIONES ---
    const deleteNotification = async (id, element) => {
        try {
            const response = await fetchWithAuth(`/api/notifications/${id}`, { method: 'DELETE' });
            if (response.ok) {
                // Animación de salida y eliminación
                element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                element.style.opacity = '0';
                element.style.transform = 'translateX(20px)';
                setTimeout(() => {
                    element.remove();
                    // Si ya no quedan notificaciones, mostrar el estado vacío
                    if (document.querySelectorAll('.notification-item-wrapper').length === 0) {
                        fetchNotifications();
                    }
                }, 300);
            }
        } catch (error) {
            console.error("Error al eliminar notificación:", error);
        }
    };

    const clearReadNotifications = async () => {
        try {
            const response = await fetchWithAuth('/api/me/notifications/read', { method: 'DELETE' });
            if (response.ok) {
                showToast("Notificaciones leídas eliminadas.");
                fetchNotifications(); // Recargar el panel
            }
        } catch (error) {
            console.error("Error al limpiar notificaciones:", error);
        }
    };
    
    // --- Lógica de Eventos (ACTUALIZADA) ---
    if (notificationsPanel) {
        notificationsPanel.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-notification-btn');
            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                deleteNotification(deleteBtn.dataset.id, deleteBtn.parentElement);
            }

            const clearBtn = e.target.closest('#clear-read-notifications-btn');
            if (clearBtn) {
                clearReadNotifications();
            }
        });
    }

    // --- Listener de Teclado (ACTUALIZADO) ---
    document.body.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            closeAllModals();
            // Cierra también el panel de notificaciones
            if (notificationsPanel && notificationsPanel.classList.contains('visible')) {
                notificationsPanel.classList.remove('visible');
            }
        }
    });

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