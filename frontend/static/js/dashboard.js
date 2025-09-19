// /static/js/dashboard.js (Versión Refactorizada y Optimizada)

document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZACIÓN GLOBAL ---
    // Le decimos al motor principal que se active en esta página.
    window.initializeGlobalEventListeners();
    // Las variables y funciones globales (backendUrl, showAlert, etc.) se usan desde utils.js y main.js

    const username = localStorage.getItem('username');
    if (!localStorage.getItem('accessToken') || !username) {
        window.location.href = '/index.html';
        return;
    }

    const tokenForPayload = localStorage.getItem('accessToken');
    const payload = JSON.parse(atob(tokenForPayload.split('.')[1]));
    const currentUserId = parseInt(payload.sub, 10);

    // --- Selectores del DOM ---
    const exploreGrid = document.getElementById('explore-grid');
    const myAlbumsGrid = document.getElementById('my-albums-grid');
    const savedAlbumsGrid = document.getElementById('saved-albums-grid');
    const paginationControls = document.getElementById('pagination-controls');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const createAlbumModal = document.getElementById('create-album-modal');
    const createAlbumForm = document.getElementById('create-album-form');
    const createAlbumFilesInput = document.getElementById('create-album-files');
    const createAlbumStatus = document.getElementById('create-album-status');

    // --- Lógica de Pestañas ---
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            
            const targetId = tab.dataset.tab;
            const target = document.getElementById(targetId);
            
            tabContents.forEach(content => content.classList.remove('active'));
            target.classList.add('active');

            // Cargar contenido de la pestaña solo si es la primera vez que se visita
            if (targetId === 'saved-albums' && savedAlbumsGrid.innerHTML.trim() === '') {
                loadSavedAlbums();
            } else if (targetId === 'my-albums' && myAlbumsGrid.innerHTML.trim() === '') {
                loadMyAlbums();
            }
        });
    });

    // --- Lógica de Carga de Álbumes ---
    const loadAlbums = async (page = 1) => {
        exploreGrid.innerHTML = '<p>Cargando álbumes...</p>';
        try {
            // fetchWithAuth no es necesario aquí, ya que es una ruta pública
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
    
    // CAMBIO: Usa el nuevo endpoint optimizado /api/me/albums
    const loadMyAlbums = async () => {
        myAlbumsGrid.innerHTML = '<p>Cargando tus álbumes...</p>';
        try {
            const response = await fetchWithAuth(`/api/me/albums`); // Más eficiente
            if (!response.ok) throw new Error('No se pudieron cargar tus álbumes.');
            
            const data = await response.json();
            myAlbumsGrid.innerHTML = '';
            if (data.albums && data.albums.length > 0) {
                data.albums.forEach(album => myAlbumsGrid.insertAdjacentHTML('beforeend', createAlbumCard(album, true)));
            } else {
                myAlbumsGrid.innerHTML = '<p>No has creado ningún álbum.</p>';
            }
        } catch (error) {
            myAlbumsGrid.innerHTML = `<p>No se pudieron cargar tus álbumes.</p>`;
        }
    };
    
    const loadSavedAlbums = async () => {
        savedAlbumsGrid.innerHTML = '<p>Cargando tus álbumes guardados...</p>';
        try {
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
        const thumbnailUrl = album.thumbnail_url || '/static/img/placeholder-default.jpg';
        const profileUrl = `/profile.html?user=${album.owner_username}`;
        
        // La lógica para miniaturas de video ahora se maneja en el backend al generar thumbnail_url, simplificando el frontend
        const thumbnailElement = `<img src="${thumbnailUrl}" alt="${album.title}" loading="lazy">`;
        
        const ownerControls = isOwner ? `
            <div class="album-owner-controls">
                <button class="btn-control delete" data-album-id="${album.id}">Eliminar</button>
            </div>` : '';

        return `
            <div class="album-card">
                <a href="/album.html?id=${album.id}" class="album-card-link">
                    <div class="album-card-thumbnail">${thumbnailElement}</div>
                    <div class="album-info">
                        <h3>${album.title}</h3>
                        <p>por: @${album.owner_username || 'usuario'}</p>
                        <div class="album-stats"><span>👁️ ${album.views_count} vistas</span></div>
                    </div>
                </a>
                ${ownerControls}
            </div>`;
    };

    const renderPagination = (paginationData) => {
        const { current_page, total_pages } = paginationData;
        paginationControls.innerHTML = '';
        if (total_pages <= 1) { 
            paginationControls.style.display = 'none'; 
            return; 
        }
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

    // --- Lógica de Eventos de la Página ---
    document.body.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.btn-control.delete');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const albumId = deleteBtn.dataset.albumId;
            // Usa showConfirm de utils.js
            const confirmed = await showConfirm('Eliminar Álbum', '¿Estás seguro de que quieres eliminar este álbum y todo su contenido? Esta acción no se puede deshacer.');
            if (confirmed) {
                const response = await fetchWithAuth(`/api/albums/${albumId}`, { method: 'DELETE' });
                if (response.ok) {
                    showToast('Álbum eliminado.'); // Usa showToast de utils.js
                    // Recargar las dos vistas donde podría aparecer el álbum
                    loadAlbums(1);
                    loadMyAlbums();
                } else {
                    showToast('Error al eliminar el álbum.', 'error'); // Usa showToast de utils.js
                }
            }
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
        const numFiles = createAlbumFilesInput.files.length;
        createAlbumStatus.textContent = numFiles > 0 ? `${numFiles} archivo(s) seleccionado(s).` : '';
    });

    createAlbumForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        const files = createAlbumFilesInput.files;

        if (files.length === 0) {
            showToast('Debes seleccionar al menos un archivo.', 'error');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Creando álbum...';

        const albumDetails = {
            title: e.target.title.value,
            description: e.target.description.value,
            tags: e.target.tags.value
        };

        try {
            const createResponse = await fetchWithAuth('/api/albums', {
                method: 'POST',
                body: JSON.stringify(albumDetails)
            });

            if (!createResponse.ok) throw new Error("Error al crear los detalles del álbum.");

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

            if (uploadsFallidas > 0) {
                showToast(`${uploadsFallidas} de ${files.length} archivos no se pudieron subir.`, 'error');
            } else {
                showToast('¡Álbum creado con éxito!');
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Crear y Subir';
            createAlbumModal.classList.remove('is-visible');
            e.target.reset();
            createAlbumStatus.textContent = '';
            // Recargar ambas vistas para que el nuevo álbum aparezca inmediatamente
            loadAlbums(1);
            loadMyAlbums();
        }
    });

    // Carga inicial
    loadAlbums(1); // Carga la pestaña "Explorar"
    loadMyAlbums(); // Carga "Mis Álbumes" en segundo plano
});