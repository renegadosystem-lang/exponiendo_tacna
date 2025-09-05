document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // --- 1. CONFIGURACIÓN Y ESTADO ---
    // =========================================================================
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');
    const urlParams = new URLSearchParams(window.location.search);
    const albumId = urlParams.get('id');

    let state = {
        currentUserId: null,
        albumOwnerId: null
    };

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            state.currentUserId = parseInt(payload.sub, 10);
        } catch (e) {
            console.error("Token inválido:", e);
            localStorage.clear(); // Limpiar token corrupto
        }
    }

    // =========================================================================
    // --- 2. SELECTORES DE ELEMENTOS DEL DOM ---
    // =========================================================================
    const elements = {
        albumTitle: document.getElementById('album-title'),
        albumOwnerLink: document.getElementById('album-owner-link'),
        ownerAvatar: document.getElementById('owner-avatar'),
        albumDescription: document.getElementById('album-description'),
        albumTagsContainer: document.getElementById('album-tags-container'),
        mediaFeed: document.getElementById('media-feed'),
        commentsList: document.getElementById('comments-list'),
        commentForm: document.getElementById('comment-form'),
        backButton: document.getElementById('back-button'),
        followBtn: document.getElementById('follow-btn'),
        likeBtn: document.getElementById('like-btn'),
        saveBtn: document.getElementById('save-btn'),
        shareBtn: document.getElementById('share-btn'),
        reportBtn: document.getElementById('report-btn'),
        viewsCount: document.getElementById('views-count'),
        photosVideosCount: document.getElementById('photos-videos-count'),
        likesCount: document.getElementById('likes-count'),
        savesCount: document.getElementById('saves-count'),
        commentsCount: document.getElementById('comments-count'),
        shareLinkModal: document.getElementById('share-link-modal'),
        albumShareLinkInput: document.getElementById('album-share-link'),
        copyLinkBtn: document.getElementById('copy-link-btn'),
        copyFeedback: document.getElementById('copy-feedback'),
        reportAlbumModal: document.getElementById('report-album-modal'),
        reportForm: document.getElementById('report-form'),
        currentUserAvatar: document.getElementById('current-user-avatar')
    };

    // =========================================================================
    // --- 3. FUNCIONES DE AYUDA Y API ---
    // =========================================================================
    const fetchAPI = (url, options = {}) => {
        const headers = { ...options.headers };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
    };

    // =========================================================================
    // --- 4. FUNCIONES DE RENDERIZADO (UI) ---
    // =========================================================================

    /** Rellena la información principal del álbum y del creador. */
    function renderAlbumDetails(album) {
        document.title = album.title;
        elements.albumTitle.textContent = album.title;
        elements.albumOwnerLink.textContent = `@${album.owner_username}`;
        elements.albumOwnerLink.href = `/profile.html?user=${album.owner_username}`;
        elements.ownerAvatar.src = album.owner_profile_picture || '/static/img/placeholder-default.jpg';
        elements.albumDescription.textContent = album.description;
        elements.viewsCount.textContent = album.views_count;
        elements.photosVideosCount.textContent = `${album.photos_count} fotos / ${album.videos_count} videos`;
        elements.likesCount.textContent = album.likes_count;
        elements.savesCount.textContent = album.saves_count;
        elements.commentsCount.textContent = album.comments.length;

        elements.albumTagsContainer.innerHTML = '';
        if (album.tags && album.tags.length > 0) {
            album.tags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'tag';
                tagEl.textContent = `#${tag}`;
                elements.albumTagsContainer.appendChild(tagEl);
            });
        }
    }

    /** Limpia y renderiza el feed de imágenes y videos. */
    function renderMediaFeed(media) {
        elements.mediaFeed.innerHTML = '';
        media.forEach(item => {
            const feedItem = document.createElement('div');
            feedItem.className = 'feed-item';
            let mediaElement;
            if (item.file_type.startsWith('video')) {
                mediaElement = document.createElement('video');
                mediaElement.controls = true;
                mediaElement.preload = "metadata";
                mediaElement.src = item.file_path;
            } else {
                mediaElement = document.createElement('img');
                mediaElement.src = item.file_path;
                mediaElement.alt = "Contenido del álbum";
                mediaElement.loading = "lazy";
            }
            feedItem.appendChild(mediaElement);
            elements.mediaFeed.appendChild(feedItem);
        });
    }
    
    /** Limpia y renderiza la lista de comentarios. */
    function renderComments(comments) {
        elements.commentsList.innerHTML = '';
        if (comments.length > 0) {
            comments.forEach(comment => {
                const commentEl = document.createElement('div');
                commentEl.className = 'comment';
                commentEl.innerHTML = `
                    <p class="comment-text">${comment.text}</p>
                    <span class="comment-meta">
                        por <strong>@${comment.author_username}</strong> - ${new Date(comment.created_at).toLocaleString()}
                    </span>`;
                elements.commentsList.appendChild(commentEl);
            });
        } else {
            elements.commentsList.innerHTML = '<p>No hay comentarios. ¡Sé el primero!</p>';
        }
    }

    /** Muestra/oculta botones según si el usuario está logueado. */
    function updateInteractionState(album) {
        // CORRECCIÓN CLAVE: Usamos el booleano 'is_logged_in' que envía el backend.
        // Es más robusto y directo que el método anterior.
        if (album.user_is_logged_in) {
            elements.commentForm.style.display = 'block';
            elements.currentUserAvatar.style.display = 'block';
            elements.currentUserAvatar.src = album.current_user_profile_picture || '/static/img/placeholder-default.jpg';
            
            if (state.currentUserId && state.currentUserId !== state.albumOwnerId) {
                elements.followBtn.style.display = 'flex';
                elements.followBtn.textContent = album.is_followed ? 'Dejar de Seguir' : 'Seguir';
            } else {
                elements.followBtn.style.display = 'none';
            }

            elements.likeBtn.classList.toggle('active', album.is_liked);
            elements.saveBtn.classList.toggle('active', album.is_saved);
        } else {
            elements.followBtn.style.display = 'none';
            elements.commentForm.style.display = 'none';
            elements.currentUserAvatar.style.display = 'none';
        }
    }

    // =========================================================================
    // --- 5. FUNCIÓN PRINCIPAL DE CARGA ---
    // =========================================================================
    const loadAlbum = async () => {
        try {
            const response = await fetchAPI(`/api/albums/${albumId}`);
            if (!response.ok) throw new Error('No se pudo cargar el álbum.');
            
            const album = await response.json();
            state.albumOwnerId = album.user_id;

            renderAlbumDetails(album);
            renderMediaFeed(album.media);
            renderComments(album.comments);
            updateInteractionState(album);

        } catch (error) {
            console.error(error);
            document.body.innerHTML = `<h1>Error al cargar el álbum.</h1>`;
        }
    };

    // =========================================================================
    // --- 6. MANEJADORES DE EVENTOS ---
    // =========================================================================
    function setupEventListeners() {
        if (!albumId) return;

        elements.backButton.addEventListener('click', () => history.back());

        elements.commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!token) { alert('Debes iniciar sesión para comentar.'); return; }
            const text = e.target.text.value;
            const response = await fetchAPI(`/api/albums/${albumId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ text })
            });
            if (response.ok) { e.target.reset(); loadAlbum(); } 
            else { alert('Hubo un error al enviar tu comentario.'); }
        });

        elements.followBtn.addEventListener('click', async () => {
            if (!token) { alert('Debes iniciar sesión para seguir a usuarios.'); return; }
            const response = await fetchAPI(`/api/users/${state.albumOwnerId}/follow`, { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                elements.followBtn.textContent = data.is_followed ? 'Dejar de Seguir' : 'Seguir';
            } else { alert('Error al actualizar seguimiento.'); }
        });

        elements.likeBtn.addEventListener('click', async () => {
            if (!token) { alert('Debes iniciar sesión para dar "Me gusta".'); return; }
            const response = await fetchAPI(`/api/albums/${albumId}/like`, { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                elements.likeBtn.classList.toggle('active', data.is_liked);
                elements.likesCount.textContent = data.likes_count;
            } else { alert('Error al dar "Me gusta".'); }
        });

        elements.saveBtn.addEventListener('click', async () => {
            if (!token) { alert('Debes iniciar sesión para guardar álbumes.'); return; }
            const response = await fetchAPI(`/api/albums/${albumId}/save`, { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                elements.saveBtn.classList.toggle('active', data.is_saved);
                elements.savesCount.textContent = data.saves_count;
            } else { alert('Error al guardar el álbum.'); }
        });

        elements.shareBtn.addEventListener('click', () => {
            elements.albumShareLinkInput.value = window.location.href;
            elements.shareLinkModal.classList.toggle('visible');
        });

        elements.copyLinkBtn.addEventListener('click', () => {
            elements.albumShareLinkInput.select();
            document.execCommand('copy');
            elements.copyFeedback.textContent = '¡Copiado!';
            elements.copyFeedback.classList.add('visible');
            setTimeout(() => { elements.copyFeedback.classList.remove('visible'); }, 1500);
        });

        elements.reportBtn.addEventListener('click', () => {
            if (!token) { alert('Debes iniciar sesión para reportar un álbum.'); return; }
            elements.reportAlbumModal.classList.add('is-visible');
        });

        elements.reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const reason = e.target.reason.value;
            const description = e.target.description.value;
            const errorDiv = elements.reportForm.querySelector('.form-error-message');
            errorDiv.style.display = 'none';

            const response = await fetchAPI(`/api/albums/${albumId}/report`, {
                method: 'POST',
                body: JSON.stringify({ reason, description })
            });

            if (response.ok) {
                alert('Álbum reportado. Gracias por tu ayuda.');
                elements.reportAlbumModal.classList.remove('is-visible');
                elements.reportForm.reset();
            } else {
                const errorData = await response.json();
                errorDiv.textContent = errorData.error || errorData.message || 'Error al enviar el reporte.';
                errorDiv.style.display = 'block';
            }
        });

        // Cierre de modales genérico
        document.body.addEventListener('click', (e) => {
            const target = e.target;
            if (target.matches('.modal.is-visible') && !target.closest('.modal-content')) {
                 target.classList.remove('is-visible');
            } else if (target.matches('.modal-content .close-button')) {
                target.closest('.modal').classList.remove('is-visible');
            }
        });
    }

    // =========================================================================
    // --- 7. INICIO ---
    // =========================================================================
    if (albumId) {
        loadAlbum();
        setupEventListeners();
    } else {
        document.body.innerHTML = '<h1>Error: No se especificó un álbum.</h1>';
    }
});