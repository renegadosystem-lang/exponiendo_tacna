document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');
    let currentUserId = null; // Para saber si es nuestro propio álbum
    let albumOwnerId = null; // Para saber a quién seguimos

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentUserId = parseInt(payload.sub, 10);
        } catch(e) { console.error("Token inválido al cargar álbum:", e); localStorage.clear(); }
    }

    // Selectores para los nuevos elementos
    const albumTitleEl = document.getElementById('album-title');
    const albumOwnerLinkEl = document.getElementById('album-owner-link');
    const ownerAvatarEl = document.getElementById('owner-avatar');
    const albumDescriptionEl = document.getElementById('album-description');
    const albumTagsContainerEl = document.getElementById('album-tags-container');
    const mediaFeedEl = document.getElementById('media-feed');
    const commentsListEl = document.getElementById('comments-list');
    const commentForm = document.getElementById('comment-form');
    const backButton = document.getElementById('back-button');

    // Botones de interacción
    const followBtn = document.getElementById('follow-btn');
    const likeBtn = document.getElementById('like-btn');
    const saveBtn = document.getElementById('save-btn');
    const shareBtn = document.getElementById('share-btn');
    const reportBtn = document.getElementById('report-btn');

    // Contadores de estadísticas
    const viewsCountEl = document.getElementById('views-count');
    const photosVideosCountEl = document.getElementById('photos-videos-count');
    const likesCountEl = document.getElementById('likes-count');
    const savesCountEl = document.getElementById('saves-count');
    const commentsCountEl = document.getElementById('comments-count');

    // Share link modal
    const shareLinkModal = document.getElementById('share-link-modal');
    const albumShareLinkInput = document.getElementById('album-share-link');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const copyFeedbackEl = document.getElementById('copy-feedback');

    // Report modal
    const reportAlbumModal = document.getElementById('report-album-modal');
    const reportForm = document.getElementById('report-form');

    // Current user avatar for comment form
    const currentUserAvatarEl = document.getElementById('current-user-avatar');

    const urlParams = new URLSearchParams(window.location.search);
    const albumId = urlParams.get('id');

    if (!albumId) {
        document.body.innerHTML = '<h1>Error: No se especificó un álbum.</h1>';
        return;
    }

    // --- FUNCIÓN GENÉRICA PARA LLAMADAS A LA API (CON AUTORIZACIÓN OPCIONAL) ---
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

    const loadAlbum = async () => {
        try {
            const response = await fetchAPI(`/api/albums/${albumId}`);
            if (!response.ok) throw new Error('No se pudo cargar el álbum.');
            
            const album = await response.json();
            albumOwnerId = album.user_id; // Guardar el ID del dueño del álbum

            // --- HEADER Y METADATOS ---
            document.title = album.title;
            albumTitleEl.textContent = album.title;
            albumOwnerLinkEl.textContent = `@${album.owner_username}`;
            albumOwnerLinkEl.href = `/profile.html?user=${album.owner_username}`;
            ownerAvatarEl.src = album.owner_profile_picture || '/static/img/placeholder-default.jpg';
            albumDescriptionEl.textContent = album.description;

            // --- TAGS ---
            albumTagsContainerEl.innerHTML = '';
            if (album.tags && album.tags.length > 0) {
                album.tags.forEach(tag => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'tag';
                    tagEl.textContent = `#${tag}`;
                    albumTagsContainerEl.appendChild(tagEl);
                });
            }

            // --- MEDIA FEED ---
            mediaFeedEl.innerHTML = '';
            album.media.forEach(item => {
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
                mediaFeedEl.appendChild(feedItem);
            });

            // --- ESTADÍSTICAS ---
            viewsCountEl.textContent = album.views_count;
            photosVideosCountEl.textContent = `${album.photos_count} fotos / ${album.videos_count} videos`;
            likesCountEl.textContent = album.likes_count;
            savesCountEl.textContent = album.saves_count;
            commentsCountEl.textContent = album.comments.length;

            // --- ESTADO Y BOTONES DE INTERACCIÓN (SI EL USUARIO ESTÁ LOGUEADO) ---
            if (album.user_is_logged_in) {
                // Actualizar avatar del usuario actual para el comentario
                currentUserAvatarEl.src = album.current_user_profile_picture || '/static/img/placeholder-default.jpg';
                
                // Botón Seguir
                if (currentUserId && currentUserId !== albumOwnerId) { // No puedes seguirte a ti mismo
                    followBtn.style.display = 'flex'; // Mostrar botón seguir
                    followBtn.textContent = album.is_followed ? 'Dejar de Seguir' : 'Seguir';
                    followBtn.classList.toggle('active', album.is_followed); // Añadir clase 'active' si ya sigue
                } else {
                    followBtn.style.display = 'none';
                }

                // Botón Me Gusta
                likeBtn.classList.toggle('active', album.is_liked);
                // Botón Guardar
                saveBtn.classList.toggle('active', album.is_saved);
            } else {
                // Ocultar botones de interacción si no está logueado
                followBtn.style.display = 'none';
                commentForm.style.display = 'none'; // Ocultar formulario de comentario
                currentUserAvatarEl.style.display = 'none';
                // Los botones de like/save/share/report se mantienen pero la interacción requiere login
            }


            // --- COMENTARIOS ---
            commentsListEl.innerHTML = '';
            if (album.comments.length > 0) {
                album.comments.forEach(comment => {
                    const commentEl = document.createElement('div');
                    commentEl.className = 'comment';
                    commentEl.innerHTML = `
                        <p class="comment-text">${comment.text}</p>
                        <span class="comment-meta">
                            por <strong>@${comment.author_username}</strong> - ${new Date(comment.created_at).toLocaleString()}
                        </span>`;
                    commentsListEl.appendChild(commentEl);
                });
            } else {
                commentsListEl.innerHTML = '<p>No hay comentarios. ¡Sé el primero!</p>';
            }

        } catch (error) {
            console.error(error);
            document.body.innerHTML = `<h1>Error al cargar el álbum.</h1>`;
        }
    };

    // --- MANEJADORES DE EVENTOS ---

    // Comentarios
    commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!token) { alert('Debes iniciar sesión para comentar.'); return; }

        const text = e.target.text.value;
        const response = await fetchAPI(`/api/albums/${albumId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ text })
        });
        if (response.ok) {
            e.target.reset();
            loadAlbum(); 
        } else {
            alert('Hubo un error al enviar tu comentario.');
        }
    });

    // Botón Regresar
    backButton.addEventListener('click', () => {
        history.back();
    });

    // Botón Seguir
    followBtn.addEventListener('click', async () => {
        if (!token) { alert('Debes iniciar sesión para seguir a usuarios.'); return; }
        if (currentUserId === albumOwnerId) { alert('No puedes seguirte a ti mismo.'); return; }
        
        const response = await fetchAPI(`/api/users/${albumOwnerId}/follow`, { method: 'POST' });
        if (response.ok) {
            const data = await response.json();
            followBtn.textContent = data.is_followed ? 'Dejar de Seguir' : 'Seguir';
            followBtn.classList.toggle('active', data.is_followed);
        } else {
            alert('Error al actualizar seguimiento.');
        }
    });

    // Botón Me Gusta
    likeBtn.addEventListener('click', async () => {
        if (!token) { alert('Debes iniciar sesión para dar "Me gusta".'); return; }
        
        const response = await fetchAPI(`/api/albums/${albumId}/like`, { method: 'POST' });
        if (response.ok) {
            const data = await response.json();
            likeBtn.classList.toggle('active', data.is_liked);
            likesCountEl.textContent = data.likes_count;
        } else {
            alert('Error al dar "Me gusta".');
        }
    });

    // Botón Guardar
    saveBtn.addEventListener('click', async () => {
        if (!token) { alert('Debes iniciar sesión para guardar álbumes.'); return; }
        
        const response = await fetchAPI(`/api/albums/${albumId}/save`, { method: 'POST' });
        if (response.ok) {
            const data = await response.json();
            saveBtn.classList.toggle('active', data.is_saved);
            savesCountEl.textContent = data.saves_count;
        } else {
            alert('Error al guardar el álbum.');
        }
    });

    // Botón Compartir
    shareBtn.addEventListener('click', () => {
        albumShareLinkInput.value = window.location.href; // El enlace actual de la página
        shareLinkModal.classList.toggle('visible');
    });

    copyLinkBtn.addEventListener('click', () => {
        albumShareLinkInput.select();
        document.execCommand('copy');
        copyFeedbackEl.textContent = '¡Copiado!';
        copyFeedbackEl.classList.add('visible');
        setTimeout(() => {
            copyFeedbackEl.classList.remove('visible');
        }, 1500);
    });

    // Botón Reportar
    reportBtn.addEventListener('click', () => {
        if (!token) { alert('Debes iniciar sesión para reportar un álbum.'); return; }
        reportAlbumModal.classList.add('is-visible');
    });

    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reason = e.target.reason.value;
        const description = e.target.description.value;
        const errorDiv = reportForm.querySelector('.form-error-message');
        errorDiv.style.display = 'none';

        const response = await fetchAPI(`/api/albums/${albumId}/report`, {
            method: 'POST',
            body: JSON.stringify({ reason, description })
        });

        if (response.ok) {
            alert('Álbum reportado. Gracias por tu ayuda.');
            reportAlbumModal.classList.remove('is-visible');
            reportForm.reset();
        } else {
            const errorData = await response.json();
            errorDiv.textContent = errorData.error || errorData.message || 'Error al enviar el reporte.';
            errorDiv.style.display = 'block';
        }
    });

    // Cerrar modales genéricos
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        if (target.matches('.modal.is-visible') && !target.closest('.modal-content')) {
             target.classList.remove('is-visible');
        } else if (target.matches('.modal-content .close-button')) {
            target.closest('.modal').classList.remove('is-visible');
        }
    });


    // Carga inicial del álbum
    loadAlbum();
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