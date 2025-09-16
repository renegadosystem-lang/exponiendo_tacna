// /static/js/main.js (Versión Corregida)

document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');

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

    const fetchWithAuth = (url, options = {}) => {
        const headers = { ...options.headers };
        headers['Authorization'] = `Bearer ${token}`;
        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
    };

    let searchTimeout;
    const performSearch = async (query) => {
        if (query.length < 2) {
            searchResultsContainer.innerHTML = '<p class="search-no-results">Escribe al menos 2 caracteres.</p>';
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
        const isChatPage = document.body.classList.contains('chat-page');

        if (!results.users.length && !results.albums.length) {
            searchResultsContainer.innerHTML = '<p class="search-no-results">No se encontraron resultados.</p>';
            return;
        }

        if (results.users.length) {
            const usersHtml = results.users.map(user => {
                // Preparamos los datos del usuario para pasarlos
                const userData = JSON.stringify({id: user.id, username: user.username, avatar: user.profile_picture_url}).replace(/'/g, "&apos;");

                if (isChatPage) {
                    // Si estamos en el chat, el resultado es un botón que inicia la conversación
                    return `<button class="search-result-item" data-user-info='${userData}' data-action="start-chat">
                                <img src="${user.profile_picture_url || '/static/img/placeholder-default.jpg'}" alt="${user.username}">
                                <span>${user.username}</span>
                            </button>`;
                } else {
                    // Si estamos en otra página, es un enlace al perfil
                    return `<a href="/profile.html?user=${user.username}" class="search-result-item">
                                <img src="${user.profile_picture_url || '/static/img/placeholder-default.jpg'}" alt="${user.username}">
                                <span>${user.username}</span>
                            </a>`;
                }
            }).join('');
            searchResultsContainer.innerHTML += `<h4 class="search-result-category">Usuarios</h4>${usersHtml}`;
        }

        if (results.albums.length && !isChatPage) { // No mostrar álbumes en la búsqueda de chat
            const albumsHtml = results.albums.map(album => `
                <a href="/album.html?id=${album.id}" class="search-result-item">
                    <img src="${album.thumbnail_url || '/static/img/placeholder-default.jpg'}" alt="${album.title}">
                    <span>${album.title} <small style="color: var(--text-muted)">por @${album.owner_username}</small></span>
                </a>
            `).join('');
            searchResultsContainer.innerHTML += `<h4 class="search-result-category">Álbumes</h4>${albumsHtml}`;
        }
    };
    
    const fetchNotifications = async () => { /* ... (código sin cambios) ... */ };
    const renderNotifications = (notifications) => { /* ... (código sin cambios) ... */ };
    const markAllAsRead = async () => { /* ... (código sin cambios) ... */ };

    if (searchBtn) { searchBtn.addEventListener('click', () => searchModal.classList.add('is-visible')); }
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => { performSearch(e.target.value); }, 300);
        });
    }

    // LISTENER PARA LOS RESULTADOS DE BÚSQUEDA EN EL CHAT
    if (searchResultsContainer) {
        searchResultsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action="start-chat"]');
            if (target) {
                const userInfo = JSON.parse(target.dataset.userInfo.replace(/&apos;/g, "'"));
                // Usamos un evento personalizado para comunicarnos con chat.js sin acoplar los scripts
                document.dispatchEvent(new CustomEvent('startChat', { detail: userInfo }));
                searchModal.classList.remove('is-visible');
            }
        });
    }

    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = notificationsPanel.classList.toggle('visible');
            if (isVisible) {
                fetchNotifications();
            }
        });
    }

    if (markAllReadBtn) { markAllReadBtn.addEventListener('click', markAllAsRead); }
    if (chatBtn) { chatBtn.addEventListener('click', () => { window.location.href = '/chat.html'; }); }
    
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

    fetchNotifications();
});