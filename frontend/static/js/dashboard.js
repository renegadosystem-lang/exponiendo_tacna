// /static/js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const username = localStorage.getItem('username');
    if (!localStorage.getItem('accessToken') || !username) {
        window.location.href = '/index.html';
        return;
    }

    const myProfileLink = document.getElementById('my-profile-link');
    if (myProfileLink) myProfileLink.href = `/profile.html?user=${username}`;

    const tokenForPayload = localStorage.getItem('accessToken');
    const payload = JSON.parse(atob(tokenForPayload.split('.')[1]));
    const currentUserId = parseInt(payload.sub, 10);

    // --- Selectores del DOM ---
    const exploreGrid = document.getElementById('explore-grid');
    const myAlbumsGrid = document.getElementById('my-albums-grid');
    const savedAlbumsGrid = document.getElementById('saved-albums-grid'); // Nuevo Grid
    const logoutBtn = document.getElementById('logout-btn');
    const paginationControls = document.getElementById('pagination-controls');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const createAlbumModal = document.getElementById('create-album-modal');
    const createAlbumForm = document.getElementById('create-album-form');
    const createAlbumFilesInput = document.getElementById('create-album-files');
    const createAlbumStatus = document.getElementById('create-album-status');

    // ... (Las funciones showToast y showConfirm se mantienen como en la respuesta anterior)
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 4000);
    };

    const showConfirm = (title, message) => {
        return new Promise(resolve => {
            const modal = document.getElementById('confirm-modal');
            const titleEl = document.getElementById('confirm-title');
            const messageEl = document.getElementById('confirm-message');
            const okBtn = document.getElementById('confirm-ok-btn');
            const cancelBtn = document.getElementById('confirm-cancel-btn');
            titleEl.textContent = title;
            messageEl.textContent = message;
            const close = (decision) => {
                modal.classList.remove('is-visible');
                okBtn.replaceWith(okBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                resolve(decision);
            };
            modal.querySelector('#confirm-ok-btn').onclick = () => close(true);
            modal.querySelector('#confirm-cancel-btn').onclick = () => close(false);
            modal.onclick = (e) => {
                if (e.target === modal) close(false);
            };
            modal.classList.add('is-visible');
        });
    };

    const fetchWithAuth = (url, options = {}) => {
        const token = localStorage.getItem('accessToken');
        const headers = { ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (token && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
    };

    // --- Lógica de Pestañas (Actualizada) ---
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.dataset.tab;
            const target = document.getElementById(targetId);
            tabContents.forEach(content => content.classList.remove('active'));
            target.classList.add('active');

            // Cargar contenido solo si la pestaña está activa y no tiene contenido
            if (targetId === 'saved-albums' && savedAlbumsGrid.innerHTML === '') {
                loadSavedAlbums();
            }
        });
    });

    // --- Lógica de Carga de Álbumes ---
    const loadAlbums = async (page = 1) => {
        if (page === 1) loadMyAlbums(); // Carga mis álbumes en la primera carga
        exploreGrid.innerHTML = '<p>Cargando álbumes...</p>';
        try {
            const response = await fetch(`${backendUrl}/api/albums?page=${page}&per_page=16`);
            if (!response.ok) throw new Error('No se pudieron cargar los álbumes.');
            const data = await response.json();
            exploreGrid.innerHTML = '';
            data.albums.forEach(album => {
                exploreGrid.insertAdjacentHTML('beforeend', createAlbumCard(album, album.user_id === currentUserId));
            });
            renderPagination(data);
        } catch (error) {
            exploreGrid.innerHTML = `<p>No se pudieron cargar los álbumes. Intenta de nuevo más tarde.</p>`;
        }
    };
    
    const loadMyAlbums = async () => {
        myAlbumsGrid.innerHTML = '<p>Cargando tus álbumes...</p>';
        try {
            const response = await fetchWithAuth(`/api/profiles/${username}`);
            if (!response.ok) throw new Error('No se pudieron cargar tus álbumes.');
            const profileData = await response.json();
            myAlbumsGrid.innerHTML = '';
            if (profileData.albums && profileData.albums.length > 0) {
                profileData.albums.forEach(album => myAlbumsGrid.insertAdjacentHTML('beforeend', createAlbumCard(album, true)));
            } else {
                myAlbumsGrid.innerHTML = '<p>No has creado ningún álbum.</p>';
            }
        } catch (error) {
            myAlbumsGrid.innerHTML = `<p>No se pudieron cargar tus álbumes.</p>`;
        }
    };
    
    // NUEVA FUNCIÓN para cargar álbumes guardados
    const loadSavedAlbums = async () => {
        savedAlbumsGrid.innerHTML = '<p>Cargando tus álbumes guardados...</p>';
        try {
            // AVISO: Esta ruta '/api/me/saved-albums' es un ejemplo. Debe existir en tu backend.
            const response = await fetchWithAuth(`/api/me/saved-albums`);
            if (!response.ok) throw new Error('No se pudieron cargar tus álbumes guardados.');
            const data = await response.json();
            savedAlbumsGrid.innerHTML = '';
            if (data.albums && data.albums.length > 0) {
                data.albums.forEach(album => {
                    const isOwner = album.user_id === currentUserId;
                    savedAlbumsGrid.insertAdjacentHTML('beforeend', createAlbumCard(album, isOwner));
                });
            } else {
                savedAlbumsGrid.innerHTML = '<p>No tienes ningún álbum guardado.</p>';
            }
        } catch (error) {
            savedAlbumsGrid.innerHTML = `<p>No se pudieron cargar los álbumes guardados.</p>`;
        }
    };


    const createAlbumCard = (album, isOwner) => {
        // ... (esta función no necesita cambios)
        const thumbnailUrl = album.thumbnail_url || '/static/img/placeholder-default.jpg';
        const profileUrl = `/profile.html?user=${album.owner_username}`;
        let thumbnailElement = '';
        if (thumbnailUrl && (thumbnailUrl.endsWith('.mp4') || thumbnailUrl.endsWith('.mov'))) {
            thumbnailElement = `<video src="${thumbnailUrl}" autoplay loop muted playsinline></video>`;
        } else {
            thumbnailElement = `<img src="${thumbnailUrl}" alt="${album.title}" loading="lazy">`;
        }
        const ownerControls = isOwner ? `
            <div class="album-owner-controls">
                <button class="btn-control delete" data-album-id="${album.id}">Eliminar</button>
            </div>` : '';
        return `
            <div class="album-card" data-album-id="${album.id}" style="cursor: pointer;">
                <div class="album-card-thumbnail">${thumbnailElement}</div>
                <div class="album-info">
                    <h3>${album.title}</h3>
                    <p>por: <a href="${profileUrl}" class="profile-link">@${album.owner_username || 'usuario'}</a></p>
                    <div class="album-stats"><span>👁️ ${album.views_count} vistas</span></div>
                </div>
                ${isOwner ? ownerControls : ''}
            </div>`;
    };

    const renderPagination = (paginationData) => {
        // ... (esta función no necesita cambios)
        const { current_page, total_pages } = paginationData;
        paginationControls.innerHTML = '';
        if (total_pages <= 1) { paginationControls.style.display = 'none'; return; }
        paginationControls.style.display = 'flex';
        let html = '';
        html += `<a href="#" class="page-btn ${current_page === 1 ? 'disabled' : ''}" data-page="${current_page - 1}">‹ Anterior</a>`;
        for (let i = 1; i <= total_pages; i++) {
            if (i === current_page) html += `<a href="#" class="page-number active" data-page="${i}">${i}</a>`;
            else if (Math.abs(i - current_page) < 2 || i === 1 || i === total_pages) html += `<a href="#" class="page-number" data-page="${i}">${i}</a>`;
            else if (Math.abs(i - current_page) === 2) html += `<span class="ellipsis">...</span>`;
        }
        html += `<a href="#" class="page-btn ${current_page === total_pages ? 'disabled' : ''}" data-page="${current_page + 1}">Siguiente ›</a>`;
        paginationControls.innerHTML = html;
    };

    // ... (El resto del archivo, como la lógica de clics, formularios, etc., se mantiene sin cambios)
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const deleteBtn = target.closest('.btn-control.delete');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const albumId = deleteBtn.dataset.albumId;
            const confirmed = await showConfirm('Eliminar Álbum', '¿Estás seguro de que quieres eliminar este álbum y todo su contenido?');
            if (confirmed) {
                const response = await fetchWithAuth(`/api/albums/${albumId}`, { method: 'DELETE' });
                if (response.ok) {
                    showToast('Álbum eliminado.');
                    loadAlbums(1);
                } else {
                    showToast('Error al eliminar el álbum.', 'error');
                }
            }
            return;
        }
        const albumCard = target.closest('.album-card[data-album-id]');
        if (albumCard && !target.closest('a') && !target.closest('button')) {
            window.location.href = `/album.html?id=${albumCard.dataset.albumId}`;
        }
    });

    paginationControls.addEventListener('click', (e) => {
        e.preventDefault();
        const pageBtn = e.target.closest('[data-page]');
        if (pageBtn && !pageBtn.classList.contains('disabled') && !pageBtn.classList.contains('active')) {
            loadAlbums(parseInt(pageBtn.dataset.page, 10));
        }
    });

    createAlbumFilesInput.addEventListener('change', () => {
        if (createAlbumFilesInput.files.length > 0) {
            createAlbumStatus.textContent = `${createAlbumFilesInput.files.length} archivo(s) seleccionado(s).`;
        } else {
            createAlbumStatus.textContent = '';
        }
    });

    createAlbumForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        const files = createAlbumFilesInput.files;
        if (files.length === 0) {
            showToast('Debes seleccionar al menos un archivo para crear el álbum.', 'error');
            return;
        }
        submitButton.disabled = true;
        submitButton.textContent = 'Creando álbum...';
        const albumDetails = {
            title: e.target.title.value,
            description: e.target.description.value,
            tags: e.target.tags.value
        };
        const createResponse = await fetchWithAuth('/api/albums', {
            method: 'POST',
            body: JSON.stringify(albumDetails)
        });
        if (!createResponse.ok) {
            showToast("Error al crear los detalles del álbum.", 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Crear y Subir';
            return;
        }
        const createData = await createResponse.json();
        const newAlbumId = createData.album_id;
        let uploadsFallidas = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            submitButton.textContent = `Subiendo ${i + 1} de ${files.length}...`;
            const formData = new FormData();
            formData.append('file', file);
            const uploadResponse = await fetchWithAuth(`/api/albums/${newAlbumId}/media`, {
                method: 'POST',
                body: formData
            });
            if (!uploadResponse.ok) uploadsFallidas++;
        }
        submitButton.disabled = false;
        submitButton.textContent = 'Crear y Subir';
        if (uploadsFallidas > 0) {
            showToast(`${uploadsFallidas} de ${files.length} archivos no se pudieron subir.`, 'error');
        } else {
            showToast('¡Álbum creado y archivos subidos con éxito!');
        }
        createAlbumModal.classList.remove('is-visible');
        e.target.reset();
        createAlbumStatus.textContent = '';
        loadAlbums(1);
    });

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = '/index.html';
    });
    
    loadAlbums(1);
    setupModalListeners();
});

function setupModalListeners() {
    // ... (esta función no necesita cambios)
    document.body.addEventListener('click', e => {
        const target = e.target;
        const modalTarget = target.closest('[data-modal-target]');
        if (modalTarget) {
            e.preventDefault();
            const modal = document.querySelector(modalTarget.dataset.modalTarget);
            if (modal) modal.classList.add('is-visible');
        }
        const closeTarget = target.closest('.close-button');
        if (closeTarget) {
            closeTarget.closest('.modal').classList.remove('is-visible');
        } else if (target.matches('.modal.is-visible')) {
            target.classList.remove('is-visible');
        }
    });
}