document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    
    // --- 1. VERIFICACIÓN DE AUTENTICACIÓN (CORREGIDA) ---
    const username = localStorage.getItem('username');
    // Se comprueba directamente en localStorage para evitar el error 'token is not defined'
    if (!localStorage.getItem('accessToken') || !username) {
        window.location.href = '/index.html';
        return;
    }

    const myProfileLink = document.getElementById('my-profile-link');
    if (myProfileLink) {
        myProfileLink.href = `/profile.html?user=${username}`;
    }

    // El token se decodifica aquí solo para obtener el ID del usuario,
    // pero no se usará una variable 'token' global.
    const tokenForPayload = localStorage.getItem('accessToken');
    const payload = JSON.parse(atob(tokenForPayload.split('.')[1]));
    const currentUserId = parseInt(payload.sub, 10);

    // --- 2. SELECTORES DE ELEMENTOS DEL DOM ---
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

    // --- 3. FUNCIÓN GENÉRICA PARA LLAMADAS A LA API ---
    const fetchWithAuth = (url, options = {}) => {
        const token = localStorage.getItem('accessToken');
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
        });
    });

    // --- 5. LÓGICA DE CARGA DE ÁLBUMES ---
    const loadAlbums = async (page = 1) => {
        exploreGrid.innerHTML = '<p>Cargando álbumes...</p>';
        if (page === 1) loadMyAlbums();
        try {
            const response = await fetch(`${backendUrl}/api/albums?page=${page}`);
            if (!response.ok) throw new Error('No se pudieron cargar los álbumes.');
            const data = await response.json();
            exploreGrid.innerHTML = '';
            data.albums.forEach(album => {
                exploreGrid.insertAdjacentHTML('beforeend', createAlbumCard(album, album.user_id === currentUserId));
            });
            renderPagination(data);
        } catch (error) {
            exploreGrid.innerHTML = `<p>${error.message}</p>`;
        }
    };
    
    const loadMyAlbums = async () => {
        myAlbumsGrid.innerHTML = '<p>Cargando tus álbumes...</p>';
        try {
            const response = await fetch(`${backendUrl}/api/profiles/${username}`);
            if (!response.ok) throw new Error('No se pudieron cargar tus álbumes.');
            const profileData = await response.json();
            
            myAlbumsGrid.innerHTML = '';
            if (profileData.albums && profileData.albums.length > 0) {
                profileData.albums.forEach(album => myAlbumsGrid.insertAdjacentHTML('beforeend', createAlbumCard(album, true)));
            } else {
                myAlbumsGrid.innerHTML = '<p>No has creado ningún álbum.</p>';
            }
        } catch (error) {
            myAlbumsGrid.innerHTML = `<p>${error.message}</p>`;
        }
    };

    const createAlbumCard = (album, isOwner) => {
        const thumbnailUrl = album.thumbnail_url || '/static/img/placeholder-default.jpg';
        const profileUrl = `/profile.html?user=${album.owner_username}`;
        
        const ownerControls = isOwner ? `
            <div class="album-owner-controls">
                <button class="btn-control upload" data-album-id="${album.id}" data-album-title="${album.title}">Añadir</button>
                <button class="btn-control edit" data-album-id="${album.id}" data-album-title="${album.title}" data-album-description="${album.description || ''}">Editar</button>
                <button class="btn-control delete" data-album-id="${album.id}">Eliminar</button>
            </div>` : '';
        
        return `
            <div class="album-card" data-album-id="${album.id}" style="cursor: pointer;">
                <div class="album-card-thumbnail" style="background-image: url('${thumbnailUrl}');"></div>
                <div class="album-info">
                    <h3>${album.title}</h3>
                    <p>por: <a href="${profileUrl}" class="profile-link">@${album.owner_username || 'usuario'}</a></p>
                    <div class="album-stats"><span>👁️ ${album.views_count} vistas</span></div>
                </div>
                ${isOwner ? ownerControls : ''}
            </div>`;
    };
        // --- PEGA ESTA FUNCIÓN COMPLETA AQUÍ ---
    const renderPagination = (paginationData) => {
        const { current_page, total_pages } = paginationData;
        paginationControls.innerHTML = '';
        if (total_pages <= 1) {
            paginationControls.style.display = 'none';
            return;
        }
        paginationControls.style.display = 'flex';

        let html = '';
        // Botón de Anterior
        html += `<a href="#" class="page-btn ${current_page === 1 ? 'disabled' : ''}" data-page="${current_page - 1}">‹ Anterior</a>`;

        // Números de Página
        for (let i = 1; i <= total_pages; i++) {
            if (i === current_page) {
                html += `<a href="#" class="page-number active" data-page="${i}">${i}</a>`;
            } else if (Math.abs(i - current_page) < 2 || i === 1 || i === total_pages) {
                html += `<a href="#" class="page-number" data-page="${i}">${i}</a>`;
            } else if (Math.abs(i - current_page) === 2) {
                html += `<span class="ellipsis">...</span>`;
            }
        }
        
        // Botón de Siguiente
        html += `<a href="#" class="page-btn ${current_page === total_pages ? 'disabled' : ''}" data-page="${current_page + 1}">Siguiente ›</a>`;
        
        paginationControls.innerHTML = html;
    };

    // --- 6. MANEJADOR DE CLICS PRINCIPAL (CORREGIDO) ---
    document.body.addEventListener('click', async (e) => {
        const target = e.target;

        // Lógica para abrir modales de creación y cierre
        if (target.matches('#create-album-btn')) { modals.create.classList.add('is-visible'); }
        if (target.closest('.close-button')) { target.closest('.modal').classList.remove('is-visible'); }
        if (target.matches('.modal')) { target.classList.remove('is-visible'); }

        // Lógica para los controles de álbum (upload, edit, delete)
        const uploadBtn = target.closest('.btn-control.upload');
        if(uploadBtn) {
            currentAlbumId = uploadBtn.dataset.albumId;
            document.getElementById('upload-modal-title').textContent = `Subir a: ${uploadBtn.dataset.albumTitle}`;
            modals.upload.classList.add('is-visible');
            return;
        }
        // ... (lógica similar para edit y delete)

        // Lógica de navegación: si no se hizo clic en un control o enlace, ir al álbum
        const albumCard = target.closest('.album-card[data-album-id]');
        if (albumCard && !target.closest('a') && !target.closest('button')) {
            window.location.href = `/album.html?id=${albumCard.dataset.albumId}`;
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