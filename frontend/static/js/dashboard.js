document.addEventListener('DOMContentLoaded', () => {
    // La URL de tu backend en Render
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';

    // --- 1. VERIFICACIÓN DE AUTENTICACIÓN Y VARIABLES ---
    const token = localStorage.getItem('accessToken');
    const username = localStorage.getItem('username');
    if (!token || !username) {
        window.location.href = '/index.html';
        return;
    }
    const myProfileLink = document.getElementById('my-profile-link');
    if (myProfileLink) {
        myProfileLink.href = `/profile.html?user=${username}`;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentUserId = parseInt(payload.sub, 10);

    // --- 2. SELECTORES DE ELEMENTOS DEL DOM ---
    const exploreGrid = document.getElementById('explore-grid');
    const myAlbumsGrid = document.getElementById('my-albums-grid');
    const logoutBtn = document.getElementById('logout-btn');
    const paginationControls = document.getElementById('pagination-controls');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    // --- 3. FUNCIÓN GENÉRICA PARA LLAMADAS A LA API ---
    const fetchWithAuth = (url, options = {}) => {
        const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
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

    // --- CÓDIGO DEL LIGHTBOX ELIMINADO ---
    // Ya no necesitamos las funciones openAlbumViewer, showMediaAtIndex,
    // ni las variables o event listeners relacionados con el modal de visualización.

    // --- 6. LÓGICA DE CARGA DE ÁLBUMES ---
    const loadAlbums = async (page = 1) => {
        exploreGrid.innerHTML = '<p>Cargando álbumes...</p>';
        // Se llama a loadMyAlbums al cargar la página por primera vez
        if (page === 1) {
            loadMyAlbums();
        }
        try {
            const response = await fetch(`${backendUrl}/api/albums?page=${page}`);
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
            // Usamos el endpoint del perfil para obtener solo los álbumes del usuario actual
            const response = await fetch(`${backendUrl}/api/profiles/${username}`);
            if (!response.ok) throw new Error('No se pudieron cargar tus álbumes.');
            const profileData = await response.json();
            
            myAlbumsGrid.innerHTML = '';
            if (profileData.albums && profileData.albums.length > 0) {
                profileData.albums.forEach(album => myAlbumsGrid.innerHTML += createAlbumCard(album, true));
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
        // El enlace al perfil ahora usa el username que viene con el álbum
        const profileUrl = `/profile.html?user=${album.owner_username}`;
        
        const ownerControls = isOwner ? `
            <div class="album-owner-controls">
                <button class="btn-control upload" data-album-id="${album.id}" data-album-title="${album.title}">Añadir</button>
                <button class="btn-control edit" data-album-id="${album.id}" data-album-title="${album.title}" data-album-description="${album.description || ''}">Editar</button>
                <button class="btn-control delete" data-album-id="${album.id}">Eliminar</button>
            </div>` : '';

        // Toda la tarjeta está envuelta en un <a> que dirige a album.html
        return `
            <a href="/album.html?id=${album.id}" class="album-card-link">
                <div class="album-card">
                    <div class="album-card-thumbnail" style="background-image: url('${thumbnailUrl}');"></div>
                    <div class="album-info">
                        <h3>${album.title}</h3>
                        <p>por: <a href="${profileUrl}" class="profile-link">@${album.owner_username || 'usuario'}</a></p>
                        <div class="album-stats"><span>👁️ ${album.views_count} vistas</span></div>
                    </div>
                    ${isOwner ? ownerControls : ''}
                </div>
            </a>`;
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

    // --- 8. GESTIÓN DE MODALES (sin el modal de visualización) ---
    const modals = { 
        create: document.getElementById('create-album-modal'), 
        edit: document.getElementById('edit-album-modal'), 
        upload: document.getElementById('upload-media-modal'), 
    };

    // --- 9. LÓGICA DE EVENTOS (Delegación de Clics - SIMPLIFICADA) ---
    let currentAlbumId = null;
    document.body.addEventListener('click', async (e) => {
        const target = e.target;

        // Prevenir la navegación si se hace clic en un control dentro del enlace
        if (target.closest('.album-owner-controls') || target.closest('.profile-link')) {
            e.preventDefault();
        }

        if (target.matches('#create-album-btn')) {
            modals.create.classList.add('is-visible');
        } else if (target.matches('.btn-control.upload')) {
            currentAlbumId = target.dataset.albumId;
            document.getElementById('upload-modal-title').textContent = `Subir a: ${target.dataset.albumTitle}`;
            modals.upload.classList.add('is-visible');
        } else if (target.matches('.btn-control.edit')) {
            currentAlbumId = target.dataset.albumId;
            const form = modals.edit.querySelector('form');
            form.title.value = target.dataset.albumTitle;
            form.description.value = target.dataset.albumDescription;
            modals.edit.classList.add('is-visible');
        } else if (target.matches('.btn-control.delete')) {
            currentAlbumId = target.dataset.albumId;
            if (confirm('¿Estás seguro de que quieres eliminar este álbum y todo su contenido?')) {
                const response = await fetchWithAuth(`/api/albums/${currentAlbumId}`, { method: 'DELETE' });
                if (response.ok) { alert('Álbum eliminado.'); await loadAlbums(1); }
                else { alert('Error al eliminar el álbum.'); }
            }
        } else if (target.matches('.close-button')) {
            target.closest('.modal').classList.remove('is-visible');
        } else if (target.matches('.modal.is-visible') && !target.closest('.modal-content')) {
             target.classList.remove('is-visible');
        }
    });

    // --- 10. LÓGICA DE FORMULARIOS (sin cambios) ---
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
    
    document.getElementById('create-album-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const success = await handleFormSubmit(e.target, '/api/albums', 'POST');
        if (success) {
            modals.create.classList.remove('is-visible');
            e.target.reset();
            await loadAlbums(1);
        }
    });
    document.getElementById('edit-album-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const success = await handleFormSubmit(e.target, `/api/albums/${currentAlbumId}`, 'PUT');
        if (success) {
            modals.edit.classList.remove('is-visible');
            e.target.reset();
            await loadAlbums(1);
        }
    });
    
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
    if (uploadForm) {
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
                    const response = await fetchWithAuth(`/api/albums/${currentAlbumId}/media`, { method: 'POST', body: formData });
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
            modals.upload.classList.remove('is-visible');
            uploadForm.reset();
            if (fileUploadStatus) fileUploadStatus.textContent = '';
        });
    }
    
    // --- 11. CERRAR SESIÓN Y LLAMADA INICIAL ---
    logoutBtn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        localStorage.clear();
        window.location.href = '/index.html'; 
    });
    
    loadAlbums(1);
});

// =============================================================
// --- LÓGICA CENTRALIZADA PARA TODOS LOS MODALES ---
// =============================================================
function setupModalListeners() {
    // Función para abrir un modal
    const openModal = (modal) => {
        if (modal) modal.classList.add('is-visible');
    };

    // Función para cerrar un modal
    const closeModal = (modal) => {
        if (modal) modal.classList.remove('is-visible');
    };

    // Abre el modal al hacer clic en un botón con el atributo 'data-modal-target'
    document.querySelectorAll('[data-modal-target]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = document.querySelector(button.dataset.modalTarget);
            openModal(modal);
        });
    });

    // Cierra el modal al hacer clic en el botón de cierre '×'
    document.querySelectorAll('.close-button').forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            closeModal(modal);
        });
    });

    // Cierra el modal al hacer clic fuera del contenido (en el fondo oscuro)
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });
}

// Llama a la función para activar los listeners en la página actual
setupModalListeners();