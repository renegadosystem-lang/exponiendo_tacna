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
        albumOwnerId: null,
        albumData: null,
        sortableInstance: null
    };

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            state.currentUserId = parseInt(payload.sub, 10);
        } catch (e) {
            console.error("Token inválido:", e);
            localStorage.clear();
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
        reportBtn: document.getElementById('report-btn'),
        viewsCount: document.getElementById('views-count'),
        photosVideosCount: document.getElementById('photos-videos-count'),
        likesCount: document.getElementById('likes-count'),
        savesCount: document.getElementById('saves-count'),
        commentsCount: document.getElementById('comments-count'),
        ownerStats: document.getElementById('owner-stats'),
        shareLinkModal: document.getElementById('share-link-modal'),
        albumShareLinkInput: document.getElementById('album-share-link'),
        copyLinkBtn: document.getElementById('copy-link-btn'),
        copyFeedback: document.getElementById('copy-feedback'),
        shareBtn: document.getElementById('share-btn'),
        currentUserAvatar: document.getElementById('current-user-avatar'),
        ownerActionButtons: document.getElementById('owner-action-buttons'),
        manageAlbumModal: document.getElementById('manage-album-modal'),
        editAlbumForm: document.getElementById('edit-album-form'),
        mediaManagementGrid: document.getElementById('media-management-grid'),
        saveOrderBtn: document.getElementById('save-order-btn'),
        managementTabs: document.querySelectorAll('#manage-album-modal .tab-link'),
        managementTabContents: document.querySelectorAll('#manage-album-modal .tab-content'),
        reportAlbumModal: document.getElementById('report-album-modal'),
        reportForm: document.getElementById('report-form'),
        addMediaForm: document.getElementById('add-media-form'),
        addFilesInput: document.getElementById('add-files-input'),
        addFilesStatus: document.getElementById('add-files-status')
    };

    // =========================================================================
    // --- 3. FUNCIONES DE UTILIDAD (Toast y Confirm) ---
    // =========================================================================

    /** Muestra una notificación toast temporal. */
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10); // Para activar la animación de entrada
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 4000); // El toast desaparece después de 4 segundos
    };

    /** Muestra un diálogo de confirmación y devuelve una promesa. */
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
                // Clonamos los botones para eliminar los listeners antiguos de forma segura
                okBtn.replaceWith(okBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                resolve(decision);
            };
            
            modal.querySelector('#confirm-ok-btn').onclick = () => close(true);
            modal.querySelector('#confirm-cancel-btn').onclick = () => close(false);
            
            // Reutilizamos el listener de modales para cerrar al hacer clic afuera
            modal.onclick = (e) => {
                if(e.target === modal) close(false);
            };

            modal.classList.add('is-visible');
        });
    };

    // =========================================================================
    // --- 4. FUNCIONES DE AYUDA ---
    // =========================================================================

    const fetchAPI = (url, options = {}) => {
        const token = localStorage.getItem('accessToken');
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
    // --- 5. FUNCIONES DE RENDERIZADO (UI) ---
    // =========================================================================
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

        if(elements.ownerStats){
            elements.ownerStats.innerHTML = `
                <span id="owner-followers-count"><strong>${album.owner_followers_count}</strong> seguidores</span>
                <span id="owner-following-count"><strong>${album.owner_following_count}</strong> seguidos</span>
            `;
        }

        elements.albumTagsContainer.innerHTML = '';
        if (album.tags && album.tags.length > 0) {
            album.tags.forEach(tag => {
                const tagEl = document.createElement('span'); tagEl.className = 'tag';
                tagEl.textContent = `#${tag}`;
                elements.albumTagsContainer.appendChild(tagEl);
            });
        }
    }

    function renderMediaFeed(media) {
        elements.mediaFeed.innerHTML = '';
        media.forEach(item => {
            const feedItem = document.createElement('div'); feedItem.className = 'feed-item';
            let mediaElement;
            if (item.file_type.startsWith('video')) {
                mediaElement = document.createElement('video');
                mediaElement.controls = true; mediaElement.preload = "metadata"; mediaElement.src = item.file_path;
            } else {
                mediaElement = document.createElement('img');
                mediaElement.src = item.file_path; mediaElement.alt = "Contenido del álbum"; mediaElement.loading = "lazy";
            }
            feedItem.appendChild(mediaElement);
            elements.mediaFeed.appendChild(feedItem);
        });
    }
    
    function renderComments(comments) {
        elements.commentsList.innerHTML = '';
        if (comments.length > 0) {
            comments.forEach(comment => {
                const commentEl = document.createElement('div');
                commentEl.className = 'comment';
                commentEl.dataset.commentId = comment.id;

                const isOwnerOfComment = state.currentUserId === comment.author_id;
                const isOwnerOfAlbum = state.currentUserId === state.albumOwnerId;
                let actionsMenu = '';

                if (state.currentUserId && (isOwnerOfComment || isOwnerOfAlbum)) {
                     actionsMenu = `
                        <div class="comment-actions">
                            <button class="comment-actions-btn" data-action="toggle-menu"><i class="fas fa-ellipsis-v"></i></button>
                            <div class="comment-actions-menu">
                                ${isOwnerOfComment ? '<button class="delete" data-action="delete-comment">Eliminar</button>' : ''}
                                ${isOwnerOfAlbum && !isOwnerOfComment ? '<button class="delete" data-action="delete-comment">Eliminar (Dueño)</button>' : ''}
                                ${!isOwnerOfComment ? '<button data-action="report-comment">Reportar</button>' : ''}
                            </div>
                        </div>`;
                } else if (state.currentUserId) {
                     actionsMenu = `
                        <div class="comment-actions">
                             <button class="comment-actions-btn" data-action="toggle-menu"><i class="fas fa-ellipsis-v"></i></button>
                            <div class="comment-actions-menu">
                               <button data-action="report-comment">Reportar</button>
                            </div>
                        </div>`;
                }

                commentEl.innerHTML = `
                    <p class="comment-text">${comment.text}</p>
                    <span class="comment-meta">
                        por <a href="/profile.html?user=${comment.author_username}" class="profile-link"><strong>@${comment.author_username}</strong></a> - ${new Date(comment.created_at).toLocaleString()}
                    </span>
                    ${actionsMenu}`;
                elements.commentsList.appendChild(commentEl);
            });
        } else {
            elements.commentsList.innerHTML = '<p>No hay comentarios. ¡Sé el primero!</p>';
        }
    }

    function updateInteractionState(album) {
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

        if (state.currentUserId === state.albumOwnerId) {
            elements.ownerActionButtons.innerHTML = `
                <button id="manage-album-btn" class="btn btn-primary" data-modal-target="#manage-album-modal">
                    <i class="fas fa-edit"></i> Gestionar Álbum
                </button>`;
        } else {
            elements.ownerActionButtons.innerHTML = '';
        }
    }
    
    function openManagementModal() {
        if (!state.albumData) return;
        const album = state.albumData;
        
        elements.editAlbumForm.title.value = album.title;
        elements.editAlbumForm.description.value = album.description;
        elements.editAlbumForm.tags.value = album.tags.join(', ');

        loadMediaForManagement(album.media);
    }

    function loadMediaForManagement(media) {
        elements.mediaManagementGrid.innerHTML = '';
        const currentCoverPath = state.albumData.thumbnail_path;

        media.forEach(item => {
            const isCover = currentCoverPath === item.file_path;
            const itemEl = document.createElement('div');
            itemEl.className = `media-mgmt-item ${isCover ? 'is-cover' : ''}`;
            itemEl.dataset.id = item.id; 

            const thumbnail = item.file_type.startsWith('video') 
                ? `<video src="${item.file_path}#t=0.5" preload="metadata"></video>`
                : `<img src="${item.file_path}" loading="lazy">`;

            itemEl.innerHTML = `
                ${thumbnail}
                <button class="delete-btn" data-action="delete-media" title="Eliminar">&times;</button>
                <button class="set-cover-btn" data-action="set-cover" title="Poner como portada"><i class="fas fa-image"></i></button>
            `;
            elements.mediaManagementGrid.appendChild(itemEl);
        });

        if (state.sortableInstance) {
            state.sortableInstance.destroy();
        }
        state.sortableInstance = new Sortable(elements.mediaManagementGrid, {
            animation: 150,
            ghostClass: 'sortable-ghost'
        });
    }

    // =========================================================================
    // --- 6. FUNCIÓN PRINCIPAL DE CARGA ---
    // =========================================================================
    const loadAlbum = async () => {
        try {
            const response = await fetchAPI(`/api/albums/${albumId}`);
            if (!response.ok) throw new Error('No se pudo cargar el álbum.');
            
            state.albumData = await response.json();
            state.albumOwnerId = state.albumData.user_id;

            renderAlbumDetails(state.albumData);
            renderMediaFeed(state.albumData.media);
            renderComments(state.albumData.comments);
            updateInteractionState(state.albumData);
        } catch (error) {
            console.error(error);
            document.body.innerHTML = `<h1>Error al cargar el álbum.</h1>`;
        }
    };

    // =========================================================================
    // --- 7. MANEJADORES DE EVENTOS ---
    // =========================================================================
    function setupEventListeners() {
        if (!albumId) return;

        elements.backButton.addEventListener('click', () => history.back());
        elements.commentForm.addEventListener('submit', handleCommentSubmit);
        elements.followBtn.addEventListener('click', handleFollow);
        elements.likeBtn.addEventListener('click', handleLike);
        elements.saveBtn.addEventListener('click', handleSave);
        elements.shareBtn.addEventListener('click', handleShare);
        elements.copyLinkBtn.addEventListener('click', handleCopyLink);
        elements.reportForm.addEventListener('submit', handleReportSubmit);
        elements.commentsList.addEventListener('click', handleCommentAction);
        
        elements.ownerActionButtons.addEventListener('click', e => {
            if (e.target.closest('#manage-album-btn')) {
                openManagementModal();
            }
        });

        elements.managementTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                elements.managementTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                elements.managementTabContents.forEach(c => c.classList.remove('active'));
                document.getElementById(tab.dataset.tab).classList.add('active');
            });
        });

        elements.editAlbumForm.addEventListener('submit', handleEditAlbumSubmit);
        elements.saveOrderBtn.addEventListener('click', handleSaveMediaOrder);
        elements.mediaManagementGrid.addEventListener('click', handleMediaManagementClick);
        elements.addMediaForm.addEventListener('submit', handleAddMediaSubmit);
        elements.addFilesInput.addEventListener('change', () => {
             if (elements.addFilesInput.files.length > 0) {
                elements.addFilesStatus.textContent = `${elements.addFilesInput.files.length} archivo(s) seleccionado(s).`;
            } else {
                elements.addFilesStatus.textContent = '';
            }
        });
    }
    
    // --- LÓGICA DE CADA ACCIÓN ---

    async function handleCommentSubmit(e) {
        e.preventDefault();
        if (!token) { alert('Debes iniciar sesión para comentar.'); return; }
        const text = e.target.text.value;
        if (!text.trim()) { alert('El comentario no puede estar vacío.'); return; }
        
        const response = await fetchAPI(`/api/albums/${albumId}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
        if (response.ok) { e.target.reset(); loadAlbum(); } 
        else { alert('Hubo un error al enviar tu comentario.'); }
    }

    async function handleFollow() {
        if (!token) { alert('Debes iniciar sesión para seguir a usuarios.'); return; }
        const response = await fetchAPI(`/api/users/${state.albumOwnerId}/follow`, { method: 'POST' });
        if (response.ok) {
            loadAlbum();
        } else { alert('Error al actualizar seguimiento.'); }
    }

    async function handleLike() {
        if (!token) { alert('Debes iniciar sesión para dar "Me gusta".'); return; }
        const response = await fetchAPI(`/api/albums/${albumId}/like`, { method: 'POST' });
        if (response.ok) {
            const data = await response.json();
            elements.likeBtn.classList.toggle('active', data.is_liked);
            elements.likesCount.textContent = data.likes_count;
        } else { alert('Error al dar "Me gusta".'); }
    }

    async function handleSave() {
        if (!token) { alert('Debes iniciar sesión para guardar álbumes.'); return; }
        const response = await fetchAPI(`/api/albums/${albumId}/save`, { method: 'POST' });
        if (response.ok) {
            const data = await response.json();
            elements.saveBtn.classList.toggle('active', data.is_saved);
            elements.savesCount.textContent = data.saves_count;
        } else { alert('Error al guardar el álbum.'); }
    }

    function handleShare() {
        elements.shareLinkModal.classList.toggle('visible');
    }

    function handleCopyLink() {
        elements.albumShareLinkInput.value = window.location.href;
        elements.albumShareLinkInput.select();
        document.execCommand('copy');
        elements.copyFeedback.classList.add('visible');
        setTimeout(() => { elements.copyFeedback.classList.remove('visible'); }, 2000);
    }

    async function handleReportSubmit(e) {
        e.preventDefault();
        const reason = e.target.reason.value;
        if (!reason) { alert('Debes seleccionar una razón para el reporte.'); return; }
        
        const response = await fetchAPI(`/api/albums/${albumId}/report`, { method: 'POST', body: JSON.stringify({ 
            reason: reason,
            description: e.target.description.value
        }) });

        if (response.ok) {
            alert('Álbum reportado. Gracias por tu ayuda.');
            elements.reportAlbumModal.classList.remove('is-visible');
            elements.reportForm.reset();
        } else {
            const data = await response.json();
            alert(`Error: ${data.message || data.error}`);
        }
    }

    async function handleCommentAction(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
    
        const action = target.dataset.action;
        const commentEl = target.closest('.comment');
        const commentId = commentEl.dataset.commentId;
    
        if (action === 'toggle-menu') {
            const menu = commentEl.querySelector('.comment-actions-menu');
            document.querySelectorAll('.comment-actions-menu.visible').forEach(m => {
                if(m !== menu) m.classList.remove('visible');
            });
            menu.classList.toggle('visible');
        }
    
        if (action === 'delete-comment') {
            const confirmed = await showConfirm(
                'Eliminar Comentario', 
                '¿Estás seguro de que quieres eliminar este comentario permanentemente?'
            );
            if (confirmed) {
                const response = await fetchAPI(`/api/comments/${commentId}`, { method: 'DELETE' });
                if (response.ok) { 
                    showToast('Comentario eliminado.');
                    loadAlbum(); 
                } else { 
                    showToast('Error al eliminar el comentario.', 'error');
                }
            }
        }
        
        if (action === 'report-comment') {
            // Un prompt personalizado requeriría un modal más complejo,
            // por ahora, mantenemos el prompt del navegador pero podrías reemplazarlo
            // con un modal que devuelva el texto.
            const reason = prompt("Por favor, introduce la razón del reporte:", "Contenido inapropiado");
            if (reason) {
                const response = await fetchAPI(`/api/comments/${commentId}/report`, { method: 'POST', body: JSON.stringify({ reason: reason }) });
                const data = await response.json();
                if(response.ok) {
                    showToast(data.message);
                } else {
                    showToast(data.error || data.message, 'error');
                }
            }
        }
    }

    async function handleEditAlbumSubmit(e) {
        e.preventDefault();
        const data = {
            title: elements.editAlbumForm.title.value,
            description: elements.editAlbumForm.description.value,
            tags: elements.editAlbumForm.tags.value
        };
        const response = await fetchAPI(`/api/albums/${albumId}`, { method: 'PUT', body: JSON.stringify(data) });
        if (response.ok) {
            alert('Detalles del álbum actualizados.');
            elements.manageAlbumModal.classList.remove('is-visible');
            loadAlbum();
        } else {
            alert('Error al actualizar los detalles.');
        }
    }

    async function handleSaveMediaOrder() {
        const mediaIds = state.sortableInstance.toArray();
        const response = await fetchAPI(`/api/albums/${albumId}/reorder`, { method: 'PUT', body: JSON.stringify({ media_ids: mediaIds }) });
        if (response.ok) {
            alert('Orden de archivos guardado.');
            loadAlbum(); 
        } else {
            alert('Error al guardar el orden.');
        }
    }
    
    async function handleMediaManagementClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        const mediaItemEl = target.closest('.media-mgmt-item');
        const mediaId = mediaItemEl.dataset.id;
        
        if(!mediaId) return;

        if (action === 'delete-media') {
            if (confirm('¿Seguro que quieres eliminar este archivo permanentemente?')) {
                const response = await fetchAPI(`/api/media/${mediaId}`, { method: 'DELETE' });
                if (response.ok) {
                    mediaItemEl.remove();
                    loadAlbum();
                } else {
                    alert('Error al eliminar el archivo.');
                }
            }
        }

        if (action === 'set-cover') {
            const response = await fetchAPI(`/api/albums/${albumId}/cover`, { method: 'PUT', body: JSON.stringify({ media_id: mediaId }) });
            if (response.ok) {
                alert('Nueva portada establecida.');
                document.querySelectorAll('.media-mgmt-item.is-cover').forEach(el => el.classList.remove('is-cover'));
                mediaItemEl.classList.add('is-cover');
            } else {
                alert('Error al establecer la portada.');
            }
        }
    }

    async function handleAddMediaSubmit(e) {
        e.preventDefault();
        const files = elements.addFilesInput.files;
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
            
            const response = await fetchAPI(`/api/albums/${albumId}/media`, { method: 'POST', body: formData });
            if (!response.ok) uploadsFallidas++;
        }
        submitButton.textContent = 'Añadir Archivos';
        submitButton.disabled = false;
        if (uploadsFallidas > 0) {
            alert(`${uploadsFallidas} de ${files.length} archivos no se pudieron subir.`);
        } else {
            alert('¡Archivos añadidos con éxito!');
        }
        
        loadAlbum().then(() => {
            openManagementModal();
            document.querySelector('[data-tab="media-tab"]').click();
        });
        e.target.reset();
        elements.addFilesStatus.textContent = '';
    }

    // =========================================================================
    // --- 8. INICIO ---
    // =========================================================================
    if (albumId) {
        loadAlbum();
        setupEventListeners();
        setupModalListeners();
    } else {
        document.body.innerHTML = '<h1>Error: No se especificó un álbum.</h1>';
    }
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