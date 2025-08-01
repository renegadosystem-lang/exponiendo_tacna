document.addEventListener('DOMContentLoaded', () => {
    // --- 1. VERIFICACIÓN DE AUTENTICACIÓN Y VARIABLES ---
    const token = localStorage.getItem('accessToken');
    const username = localStorage.getItem('username');
    if (!token || !username) {
        window.location.href = '/';
        return;
    }
    const myProfileLink = document.getElementById('my-profile-link');
    if (myProfileLink) myProfileLink.href = `/profile/${username}`;

    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentUserId = parseInt(payload.sub, 10);

    // --- Variables para la Galería Lightbox ---
    let currentAlbumMedia = [];
    let currentIndex = 0;

    // --- 2. SELECTORES DE ELEMENTOS DEL DOM ---
    const exploreGrid = document.getElementById('explore-grid');
    const myAlbumsGrid = document.getElementById('my-albums-grid');
    const logoutBtn = document.getElementById('logout-btn');
    const paginationControls = document.getElementById('pagination-controls');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const viewAlbumModal = document.getElementById('view-album-modal');
    const lightboxContent = document.querySelector('.lightbox-content');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');

    // --- 3. FUNCIÓN GENÉRICA PARA LLAMADAS A LA API ---
    const fetchWithAuth = (url, options = {}) => {
        const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(url, { ...options, headers });
    };

    // --- 4. LÓGICA DE PESTAÑAS ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            tabContents.forEach(content => content.classList.remove('active'));
            target.classList.add('active');
            paginationControls.style.display = (tab.dataset.tab === 'explore') ? 'flex' : 'none';
        });
    });

    // --- 5. LÓGICA DE LA GALERÍA LIGHTBOX ---
    const showMediaAtIndex = (index) => {
        if (!currentAlbumMedia || currentAlbumMedia.length === 0) {
            viewAlbumModal.style.display = 'none';
            return;
        }
        if (index < 0 || index >= currentAlbumMedia.length) {
            index = Math.max(0, Math.min(index, currentAlbumMedia.length - 1));
        }
        
        currentIndex = index;
        const item = currentAlbumMedia[index];
        
        lightboxContent.innerHTML = ''; 
        
        let mediaElement;
        if (item.file_type === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.controls = true;
            mediaElement.autoplay = true;
        } else {
            mediaElement = document.createElement('img');
        }
        mediaElement.src = `/uploads/${item.file_path}`;
        
        lightboxContent.appendChild(mediaElement);
        lightboxCaption.textContent = `Archivo ${index + 1} de ${currentAlbumMedia.length}`;

        lightboxPrev.style.display = index === 0 ? 'none' : 'block';
        lightboxNext.style.display = index === currentAlbumMedia.length - 1 ? 'none' : 'block';
    };

    lightboxPrev.addEventListener('click', () => showMediaAtIndex(currentIndex - 1));
    lightboxNext.addEventListener('click', () => showMediaAtIndex(currentIndex + 1));
    
    document.addEventListener('keydown', (e) => {
        if (viewAlbumModal.style.display === 'block') {
            if (e.key === 'ArrowLeft') lightboxPrev.click();
            if (e.key === 'ArrowRight') lightboxNext.click();
            if (e.key === 'Escape') {
                const closeBtn = viewAlbumModal.querySelector('.close-button');
                if (closeBtn) closeBtn.click();
            }
        }
    });

    const openAlbumViewer = async (albumId) => {
        try {
            const response = await fetch(`/api/albums/${albumId}`);
            if (!response.ok) throw new Error('No se pudo cargar el álbum');
            const albumData = await response.json();
            
            currentAlbumMedia = albumData.media || [];
            if (currentAlbumMedia.length > 0) {
                viewAlbumModal.style.display = 'block';
                showMediaAtIndex(0);
            } else {
                alert('Este álbum está vacío.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al cargar el contenido del álbum.');
        }
    };

    // --- 6. LÓGICA DE CARGA DE ÁLBUMES ---
    const loadAlbums = async (page = 1) => {
        exploreGrid.innerHTML = '<p>Cargando álbumes...</p>';
        if (page === 1) {
            loadMyAlbums();
        }
        try {
            const response = await fetch(`/api/albums?sort_by=created_at&sort_order=desc&page=${page}`);
            if (!response.ok) throw new Error('No se pudieron cargar los álbumes.');
            const data = await response.json();
            exploreGrid.innerHTML = '';
            if (data.albums.length === 0) {
                exploreGrid.innerHTML = '<p>No hay álbumes en esta página.</p>';
            }
            data.albums.forEach(album => {
                exploreGrid.innerHTML += createAlbumCard(album, album.user_id === currentUserId);
            });
            renderPagination(data);
        } catch (error) {
            console.error(error);
            exploreGrid.innerHTML = `<p>${error.message}</p>`;
        }
    };
    
    const loadMyAlbums = async () => {
        myAlbumsGrid.innerHTML = '<p>Cargando tus álbumes...</p>';
        try {
            const response = await fetch(`/api/albums`);
            if (!response.ok) throw new Error('No se pudieron cargar tus álbumes.');
            const { albums } = await response.json();
            const userAlbums = albums.filter(album => album.user_id === currentUserId);

            myAlbumsGrid.innerHTML = '';
            if (userAlbums.length > 0) {
                userAlbums.forEach(album => myAlbumsGrid.innerHTML += createAlbumCard(album, true));
            } else {
                myAlbumsGrid.innerHTML = '<p>No has creado ningún álbum. ¡Crea el primero!</p>';
            }
        } catch (error) {
            console.error(error);
            myAlbumsGrid.innerHTML = `<p>${error.message}</p>`;
        }
    };

    const createAlbumCard = (album, isOwner) => {
        const thumbnailUrl = album.thumbnail_url || '/static/img/placeholder-default.jpg';
        const ownerControls = isOwner ? `
            <div class="album-owner-controls">
                <button class="btn-control upload" data-album-id="${album.id}" data-album-title="${album.title}">Añadir</button>
                <button class="btn-control edit" data-album-id="${album.id}" data-album-title="${album.title}" data-album-description="${album.description || ''}">Editar</button>
                <button class="btn-control delete" data-album-id="${album.id}">Eliminar</button>
            </div>` : '';
        return `
            <div class="album-card" data-album-id="${album.id}" data-album-title="${album.title}">
                <div class="album-card-thumbnail" style="background-image: url('${thumbnailUrl}');"></div>
                <div class="album-info">
                    <h3>${album.title}</h3>
                    <p>por: <a href="/profile/${album.owner_username}" class="profile-link">@${album.owner_username || 'usuario'}</a></p>
                    <div class="album-stats"><span>👁️ ${album.views_count} vistas</span></div>
                </div>
                ${ownerControls}
            </div>`;
    };

    // --- 7. LÓGICA DE PAGINACIÓN PRINCIPAL ---
    const renderPagination = (paginationData) => {
        const { current_page, total_pages, has_prev, prev_page, has_next, next_page } = paginationData;
        paginationControls.innerHTML = '';
        if (total_pages <= 1) { paginationControls.style.display = 'none'; return; }
        paginationControls.style.display = 'flex';
        let html = '';
        const page_window = 2;
        html += `<a href="#" class="page-btn ${current_page === 1 ? 'disabled' : ''}" data-page="1">« Primera</a>`;
        html += `<a href="#" class="page-btn ${!has_prev ? 'disabled' : ''}" data-page="${prev_page}">‹ Anterior</a>`;
        let lastPageRendered = 0;
        for (let i = 1; i <= total_pages; i++) {
            const shouldShow = (i === 1 || i === total_pages || (i >= current_page - page_window && i <= current_page + page_window));
            if (shouldShow) {
                if (lastPageRendered !== 0 && i > lastPageRendered + 1) html += `<span class="ellipsis">...</span>`;
                html += `<a href="#" class="page-number ${i === current_page ? 'active' : ''}" data-page="${i}">${i}</a>`;
                lastPageRendered = i;
            }
        }
        html += `<a href="#" class="page-btn ${!has_next ? 'disabled' : ''}" data-page="${next_page}">Siguiente ›</a>`;
        html += `<a href="#" class="page-btn ${current_page === total_pages ? 'disabled' : ''}" data-page="${total_pages}">Última »</a>`;
        paginationControls.innerHTML = html;
    };
    
    paginationControls.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.target;
        if (target.matches('.page-btn') || target.matches('.page-number')) {
            if (target.classList.contains('disabled') || target.classList.contains('active')) return;
            const page = target.dataset.page;
            if (page) {
                loadAlbums(parseInt(page, 10));
                window.scrollTo(0, 0);
            }
        }
    });

    // --- 8. GESTIÓN DE MODALES ---
    const modals = { create: document.getElementById('create-album-modal'), edit: document.getElementById('edit-album-modal'), upload: document.getElementById('upload-media-modal'), view: viewAlbumModal };
    const setupModal = (modal, openTriggerSelector) => {
        if (!modal) return;
        const closeBtn = modal.querySelector('.close-button');
        if(closeBtn) {
            closeBtn.addEventListener('click', () => modal.style.display = 'none');
        }
        if (openTriggerSelector) {
            document.querySelector(openTriggerSelector).addEventListener('click', () => modal.style.display = 'block');
        }
        if (!modal.classList.contains('modal-lightbox')) {
            window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
        }
    };
    Object.keys(modals).forEach(key => setupModal(modals[key], key === 'create' ? '#create-album-btn' : null));
    
    // --- 9. LÓGICA DE EVENTOS (Delegación de Clics) ---
    let currentAlbumId = null;
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.matches('.btn-control.upload')) {
            currentAlbumId = target.dataset.albumId;
            document.getElementById('upload-modal-title').textContent = `Subir a: ${target.dataset.albumTitle}`;
            modals.upload.style.display = 'block';
        } else if (target.matches('.btn-control.edit')) {
            currentAlbumId = target.dataset.albumId;
            const form = modals.edit.querySelector('form');
            form.title.value = target.dataset.albumTitle;
            form.description.value = target.dataset.albumDescription;
            modals.edit.style.display = 'block';
        } else if (target.matches('.btn-control.delete')) {
            currentAlbumId = target.dataset.albumId;
            if (confirm('¿Estás seguro de que quieres eliminar este álbum y todo su contenido?')) {
                const response = await fetchWithAuth(`/api/albums/${currentAlbumId}`, { method: 'DELETE' });
                if (response.ok) { alert('Álbum eliminado.'); await loadAlbums(1); }
                else { alert('Error al eliminar el álbum.'); }
            }
        } else if(target.matches('.delete-media-btn')) {
            const mediaId = target.dataset.mediaId;
            if(confirm('¿Seguro que quieres eliminar esta foto/video?')) {
                const response = await fetchWithAuth(`/api/media/${mediaId}`, { method: 'DELETE' });
                if(response.ok) {
                    currentAlbumMedia = currentAlbumMedia.filter(item => item.id !== parseInt(mediaId));
                    showMediaAtIndex(currentIndex);
                } else {
                    alert('Error al eliminar el archivo.');
                }
            }
        } else {
            const albumCard = target.closest('.album-card');
            if (albumCard && !target.closest('.album-owner-controls')) {
                e.preventDefault();
                const albumId = albumCard.dataset.albumId;
                openAlbumViewer(albumId);
            }
        }
    });

    // --- 10. LÓGICA DE FORMULARIOS ---
    const handleFormSubmit = async (form, url, method, isFormData = false) => {
        const errorDiv = form.querySelector('.form-error-message');
        const submitButton = form.querySelector('button[type="submit"]');
        errorDiv.style.display = 'none';
        submitButton.disabled = true;
        try {
            let body;
            if (isFormData) {
                body = new FormData(form);
            } else {
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                body = JSON.stringify(data);
            }
            const response = await fetchWithAuth(url, { method, body });
            if (!response.ok) {
                let errorMsg = `Error ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || JSON.stringify(errorData);
                } catch (jsonError) {
                    errorMsg = await response.text();
                }
                throw new Error(errorMsg);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error en el formulario (${url}):`, error);
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
            return null;
        } finally {
            submitButton.disabled = false;
        }
    };
    
    modals.create.querySelector('form').addEventListener('submit', async (e) => { e.preventDefault(); const s = await handleFormSubmit(e.target, '/api/albums', 'POST'); if(s){modals.create.style.display='none';e.target.reset();await loadAlbums(1);} });
    modals.edit.querySelector('form').addEventListener('submit', async (e) => { e.preventDefault(); const s = await handleFormSubmit(e.target, `/api/albums/${currentAlbumId}`, 'PUT'); if(s){modals.edit.style.display='none';e.target.reset();await loadAlbums(1);} });
    
    // --- Lógica de subida múltiple ---
    const uploadForm = document.getElementById('upload-media-form');
    const fileUploadInput = document.getElementById('file-upload-input');
    const fileUploadStatus = document.getElementById('file-upload-filename');

    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', () => {
            if (fileUploadInput.files.length > 0) {
                fileUploadStatus.textContent = fileUploadInput.files.length === 1 ? '1 archivo seleccionado.' : `${fileUploadInput.files.length} archivos seleccionados.`;
            } else {
                fileUploadStatus.textContent = '';
            }
        });
    }

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = uploadForm.querySelector('.form-error-message');
        const submitButton = uploadForm.querySelector('button[type="submit"]');
        errorDiv.style.display = 'none';
        const files = fileUploadInput.files;
        if (files.length === 0) {
            errorDiv.textContent = 'Por favor, selecciona al menos un archivo.';
            errorDiv.style.display = 'block';
            return;
        }
        submitButton.disabled = true;
        const title = e.target.title.value;
        const description = e.target.description.value;
        const tags = e.target.tags.value;
        let uploadsFallidas = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            submitButton.textContent = `Subiendo ${i + 1} de ${files.length}...`;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', title);
            formData.append('description', description);
            formData.append('tags', tags);
            try {
                const url = `/api/albums/${currentAlbumId}/media`;
                const response = await fetchWithAuth(url, { method: 'POST', body: formData });
                if (!response.ok) uploadsFallidas++;
            } catch (error) {
                uploadsFallidas++;
            }
        }
        submitButton.textContent = 'Subir';
        submitButton.disabled = false;
        if (uploadsFallidas > 0) {
            alert(`${uploadsFallidas} de ${files.length} archivos no se pudieron subir.`);
        } else {
            alert('¡Todos los archivos se subieron con éxito!');
        }
        modals.upload.style.display = 'none';
        uploadForm.reset();
        if (fileUploadStatus) fileUploadStatus.textContent = '';
    });
    
    // --- 11. CERRAR SESIÓN Y LLAMADA INICIAL ---
    logoutBtn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        localStorage.removeItem('accessToken');
        localStorage.removeItem('username');
        window.location.href = '/'; 
    });
    
    loadAlbums(1);
});