// /static/js/main.js

document.addEventListener('DOMContentLoaded', () => {
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
    const notificationsList = document.getElementById('notifications-list');
    const markAllReadBtn = document.getElementById('mark-all-as-read-btn');
    const notificationBadge = document.querySelector('.notification-badge');

    if (!token) {
        if(searchBtn) searchBtn.style.display = 'none';
        if(notificationsBtn) notificationsBtn.style.display = 'none';
        if(chatBtn) chatBtn.style.display = 'none';
        return;
    }

    // --- Helper de Fetch ---
    const fetchWithAuth = (url, options = {}) => {
        const headers = { ...options.headers };
        headers['Authorization'] = `Bearer ${token}`;
        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
    };

    // --- Lógica de Búsqueda ---
    let searchTimeout;
    const performSearch = async (query) => {
        if (query.length < 2) {
            searchResultsContainer.innerHTML = '<p class="search-no-results">Escribe al menos 2 caracteres para buscar.</p>';
            return;
        }
        try {
            const response = await fetchWithAuth(`/api/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Error en la búsqueda');
            const results = await response.json();
            renderSearchResults(results);
        } catch (error) {
            searchResultsContainer.innerHTML = '<p class="search-no-results">Error al buscar.</p>';
        }
    };

    const renderSearchResults = (results) => {
        searchResultsContainer.innerHTML = '';
        if (!results.users.length && !results.albums.length) {
            searchResultsContainer.innerHTML = '<p class="search-no-results">No se encontraron resultados.</p>';
            return;
        }

        if (results.users.length) {
            const usersHtml = results.users.map(user => `
                <a href="/profile.html?user=${user.username}" class="search-result-item">
                    <img src="${user.profile_picture_url || '/static/img/placeholder-default.jpg'}" alt="${user.username}">
                    <span>${user.username}</span>
                </a>
            `).join('');
            searchResultsContainer.innerHTML += `<h4 class="search-result-category">Usuarios</h4>${usersHtml}`;
        }

        if (results.albums.length) {
            const albumsHtml = results.albums.map(album => `
                <a href="/album.html?id=${album.id}" class="search-result-item">
                    <img src="${album.thumbnail_url || '/static/img/placeholder-default.jpg'}" alt="${album.title}">
                    <span>${album.title} <small style="color: var(--text-muted)">por @${album.owner_username}</small></span>
                </a>
            `).join('');
            searchResultsContainer.innerHTML += `<h4 class="search-result-category">Álbumes</h4>${albumsHtml}`;
        }
    };

    // --- Lógica de Notificaciones ---
    const fetchNotifications = async () => {
        try {
            const response = await fetchWithAuth('/api/notifications');
            if (!response.ok) return;
            const notifications = await response.json();
            renderNotifications(notifications);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };
    
    const renderNotifications = (notifications) => {
        if (!notifications || notifications.length === 0) {
            notificationsList.innerHTML = '<p style="text-align: center; padding: 1rem; color: var(--text-muted);">No tienes notificaciones.</p>';
            if (notificationBadge) notificationBadge.style.display = 'none';
            return;
        }

        const unreadCount = notifications.filter(n => !n.is_read).length;
        if (notificationBadge) {
            notificationBadge.style.display = unreadCount > 0 ? 'block' : 'none';
        }

        notificationsList.innerHTML = notifications.map(n => {
            let message = '';
            let link = '#';
            if (n.type === 'new_follower') {
                message = `<strong>${n.actor_username}</strong> ha comenzado a seguirte.`;
                link = `/profile.html?user=${n.actor_username}`;
            } else if (n.type === 'new_like') {
                message = `A <strong>${n.actor_username}</strong> le ha gustado tu álbum <strong>${n.album_title || ''}</strong>.`;
                link = `/album.html?id=${n.related_entity_id}`;
            }

            return `
                <a href="${link}" class="notification-item ${!n.is_read ? 'unread' : ''}">
                    <img src="${n.actor_profile_picture || '/static/img/placeholder-default.jpg'}" alt="${n.actor_username}">
                    <div>
                        <p>${message}</p>
                        <div class="timestamp">${new Date(n.created_at).toLocaleString()}</div>
                    </div>
                </a>
            `;
        }).join('');
    };
    
    const markAllAsRead = async () => {
        try {
            await fetchWithAuth('/api/notifications/read', { method: 'POST' });
            fetchNotifications(); // Recargar para actualizar el estado visual
        } catch (error) {
            console.error('Error marking notifications as read:', error);
        }
    };


    // --- Event Listeners ---
    if (searchBtn) {
        searchBtn.addEventListener('click', () => searchModal.classList.add('is-visible'));
    }
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(e.target.value);
            }, 300); // Debounce de 300ms
        });
    }

    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que el listener de document cierre el panel inmediatamente
            const isVisible = notificationsPanel.classList.toggle('visible');
            if (isVisible) {
                fetchNotifications();
            }
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllAsRead);
    }
    
    if (chatBtn) {
        chatBtn.addEventListener('click', () => {
            window.location.href = '/chat.html';
        });
    }
    
    // Cerrar paneles si se hace clic fuera
    document.addEventListener('click', (e) => {
        if (notificationsPanel && !notificationsPanel.contains(e.target) && !notificationsBtn.contains(e.target)) {
            notificationsPanel.classList.remove('visible');
        }
        const modalVisible = document.querySelector('.modal.is-visible');
        if (modalVisible && e.target === modalVisible) {
             modalVisible.classList.remove('is-visible');
        }
        if (e.target.matches('.close-button')) {
            e.target.closest('.modal').classList.remove('is-visible');
        }
    });

    // Carga inicial de notificaciones para mostrar el badge
    fetchNotifications();
});