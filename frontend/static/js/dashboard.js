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

    const exploreGrid = document.getElementById('explore-grid');
    const myAlbumsGrid = document.getElementById('my-albums-grid');
    const logoutBtn = document.getElementById('logout-btn');
    const paginationControls = document.getElementById('pagination-controls');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const modals = { 
        create: document.getElementById('create-album-modal'), 
        edit: document.getElementById('edit-album-modal'), 
        upload: document.getElementById('upload-media-modal'), 
    };
    let currentAlbumId = null;

    const fetchWithAuth = (url, options = {}) => {
        const token = localStorage.getItem('accessToken'); // Obtiene el token FRESCO en cada llamada
        const headers = { ...options.headers };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            tabContents.forEach(content => content.classList.remove('active'));
            target.classList.add('active');
        });
    });

    const loadAlbums = async (page = 1) => {
        if (page === 1) loadMyAlbums();
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

    const createAlbumCard = (album, isOwner) => {
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
        const { current_page, total_pages } = paginationData;
        paginationControls.innerHTML = '';
        if (total_pages <= 1) { paginationControls.style.display = 'none'; return; }
        paginationControls.style.display = 'flex';
        let html = '';
        html += `<a href="#" class="page-btn ${current_page === 1 ? 'disabled' : ''}" data-page="${current_page - 1}">‹ Anterior</a>`;
        for (let i = 1; i <= total_pages; i++) {
            if (i === current_page) {
                html += `<a href="#" class="page-number active" data-page="${i}">${i}</a>`;
            } else if (Math.abs(i - current_page) < 2 || i === 1 || i === total_pages) {
                html += `<a href="#" class="page-number" data-page="${i}">${i}</a>`;
            } else if (Math.abs(i - current_page) === 2) {
                html += `<span class="ellipsis">...</span>`;
            }
        }
        html += `<a href="#" class="page-btn ${current_page === total_pages ? 'disabled' : ''}" data-page="${current_page + 1}">Siguiente ›</a>`;
        paginationControls.innerHTML = html;
    };

    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const deleteBtn = target.closest('.btn-control.delete');
        if (deleteBtn) {
            e.preventDefault();
            currentAlbumId = deleteBtn.dataset.albumId;
            if (confirm('¿Estás seguro de que quieres eliminar este álbum y todo su contenido?')) {
                const response = await fetchWithAuth(`/api/albums/${currentAlbumId}`, { method: 'DELETE' });
                if (response.ok) {
                    alert('Álbum eliminado.');
                    loadAlbums(1);
                } else {
                    alert('Error al eliminar el álbum.');
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

    document.getElementById('create-album-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        const response = await fetchWithAuth('/api/albums', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        if (response.ok) {
            modals.create.classList.remove('is-visible');
            e.target.reset();
            loadAlbums(1);
        } else {
            alert("Error al crear el álbum.");
        }
    });

    const uploadForm = document.getElementById('upload-media-form');
    const fileUploadInput = document.getElementById('file-upload-input');
    
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const files = fileUploadInput.files;
        if (files.length === 0) {
            alert('Por favor, selecciona al menos un archivo.');
            return;
        }
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        let uploadsFallidas = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            submitButton.textContent = `Subiendo ${i + 1} de ${files.length}...`;
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetchWithAuth(`/api/albums/${currentAlbumId}/media`, { method: 'POST', body: formData });
            if (!response.ok) uploadsFallidas++;
        }
        submitButton.textContent = 'Subir';
        submitButton.disabled = false;
        if (uploadsFallidas > 0) {
            alert(`${uploadsFallidas} de ${files.length} archivos no se pudieron subir.`);
        } else {
            alert('¡Todos los archivos se subieron con éxito!');
        }
        modals.upload.classList.remove('is-visible');
        e.target.reset();
        document.getElementById('file-upload-filename').textContent = '';
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
    document.body.addEventListener('click', e => {
        const target = e.target;
        const modalTarget = target.closest('[data-modal-target]');
        if (modalTarget) {
            e.preventDefault();
            const modal = document.querySelector(modalTarget.dataset.modalTarget);
            if(modal) modal.classList.add('is-visible');
        }
        const closeTarget = target.closest('.close-button');
        if (closeTarget) {
            closeTarget.closest('.modal').classList.remove('is-visible');
        } else if (target.matches('.modal.is-visible')) {
            target.classList.remove('is-visible');
        }
    });
}