// /static/js/album.js (Versión 100% Completa y Definitiva)

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURACIÓN Y ESTADO ---
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');
    const urlParams = new URLSearchParams(window.location.search);
    const albumId = urlParams.get('id');

    let state = {
        currentUserId: null,
        albumOwnerId: null,
        albumData: null,
        sortableInstance: null,
        isLoggedIn: !!token
    };

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            state.currentUserId = parseInt(payload.sub, 10);
        } catch (e) {
            console.error("Token inválido o expirado:", e);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('username');
            state.isLoggedIn = false;
        }
    }

    // --- 2. SELECTORES DE ELEMENTOS DEL DOM ---
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

    // --- 3. FUNCIONES DE UTILIDAD ---
    const showAlert = (title, message) => {
        return new Promise(resolve => {
            const modal = document.getElementById('alert-modal');
            if (!modal) {
                alert(message);
                resolve();
                return;
            }
            const modalTitle = document.getElementById('alert-title');
            const modalMessage = document.getElementById('alert-message');
            const okBtn = document.getElementById('alert-ok-btn');
            
            if(modalTitle) modalTitle.textContent = title;
            if(modalMessage) modalMessage.textContent = message;

            const close = () => {
                modal.classList.remove('is-visible');
                okBtn.replaceWith(okBtn.cloneNode(true));
                resolve();
            };
            
            if(okBtn) okBtn.onclick = close;
            modal.classList.add('is-visible');
        });
    };

    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
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
            if (!modal) { resolve(window.confirm(message)); return; }
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
            modal.onclick = (e) => { if (e.target === modal) close(false); };
            modal.classList.add('is-visible');
        });
    };

    const fetchAPI = (url, options = {}) => {
        const currentToken = localStorage.getItem('accessToken');
        const headers = { ...options.headers };
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
    };

    // --- 4. RENDERIZADO Y LÓGICA DE UI ---
    const loadAlbum = async () => {
        try {
            const response = await fetchAPI(`/api/albums/${albumId}`);
            if (!response.ok) throw new Error('No se pudo cargar el álbum.');
            state.albumData = await response.json();
            state.albumOwnerId = state.albumData.user_id;

            renderAlbumDetails(state.albumData);
            renderMediaFeed(state.albumData.media);
            renderComments(state.albumData.comments, elements.commentsList);
            updateInteractionState(state.albumData);
        } catch (error) {
            console.error(error);
            document.body.innerHTML = `<h1>Error al cargar el álbum.</h1>`;
        }
    };

    function renderAlbumDetails(album) {
        document.title = album.title;
        if(elements.albumTitle) elements.albumTitle.textContent = album.title;
        if(elements.albumOwnerLink) {
            elements.albumOwnerLink.textContent = `@${album.owner_username}`;
            elements.albumOwnerLink.href = `/profile.html?user=${album.owner_username}`;
        }
        if(elements.ownerAvatar) elements.ownerAvatar.src = album.owner_profile_picture || '/static/img/placeholder-default.jpg';
        if(elements.albumDescription) elements.albumDescription.textContent = album.description;
        if(elements.viewsCount) elements.viewsCount.textContent = album.views_count;
        if(elements.photosVideosCount) elements.photosVideosCount.textContent = `${album.photos_count} fotos / ${album.videos_count} videos`;
        if(elements.likesCount) elements.likesCount.textContent = album.likes_count;
        if(elements.savesCount) elements.savesCount.textContent = album.saves_count;
        if(elements.commentsCount) elements.commentsCount.textContent = album.comments.length;

        if (elements.ownerStats) {
            elements.ownerStats.innerHTML = `
                <span><strong>${album.owner_followers_count}</strong> seguidores</span>
                <span><strong>${album.owner_following_count}</strong> seguidos</span>
            `;
        }
        if (elements.albumTagsContainer) {
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
    }

    function renderMediaFeed(media) {
        if(!elements.mediaFeed) return;
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

    function renderComments(comments, container) {
        if(!container) return;
        container.innerHTML = '';
        if (comments && comments.length > 0) {
            comments.forEach(comment => {
                const commentEl = document.createElement('div');
                commentEl.className = 'comment';
                commentEl.dataset.commentId = comment.id;

                let actionsMenu = '';
                const isOwnerOfComment = state.currentUserId === comment.author_id;
                const isOwnerOfAlbum = state.currentUserId === state.albumOwnerId;
                if (state.isLoggedIn) {
                    let menuButtons = '';
                    if (isOwnerOfComment || isOwnerOfAlbum) {
                        const buttonText = isOwnerOfComment ? 'Eliminar' : 'Eliminar (Dueño)';
                        menuButtons += `<button class="delete" data-action="delete-comment">${buttonText}</button>`;
                    } else {
                        menuButtons += '<button data-action="report-comment">Reportar</button>';
                    }
                    actionsMenu = `<div class="comment-actions"><button class="comment-actions-btn" data-action="toggle-menu"><i class="fas fa-ellipsis-v"></i></button><div class="comment-actions-menu">${menuButtons}</div></div>`;
                }

                commentEl.innerHTML = `
                    <p class="comment-text">${comment.text}</p>
                    <span class="comment-meta">
                        por <a href="/profile.html?user=${comment.author_username}" class="profile-link"><strong>@${comment.author_username}</strong></a> - ${new Date(comment.created_at).toLocaleString()}
                        <button class="reply-btn" data-action="show-reply-form">Responder</button>
                    </span>
                    ${actionsMenu}
                    <div class="reply-form-container"></div>
                    <div class="comment-replies"></div>
                `;
                container.appendChild(commentEl);

                if (comment.replies && comment.replies.length > 0) {
                    const repliesContainer = commentEl.querySelector('.comment-replies');
                    renderComments(comment.replies, repliesContainer);
                }
            });
        } else if (container === elements.commentsList) {
            container.innerHTML = '<p>No hay comentarios. ¡Sé el primero!</p>';
        }
    }

    function updateInteractionState(album) {
        const isLoggedIn = album.user_is_logged_in;
        state.isLoggedIn = isLoggedIn;

        if (elements.commentForm) elements.commentForm.style.display = isLoggedIn ? 'block' : 'none';
        if (elements.currentUserAvatar) elements.currentUserAvatar.style.display = isLoggedIn ? 'block' : 'none';
        if (elements.likeBtn) elements.likeBtn.style.display = 'flex';
        if (elements.saveBtn) elements.saveBtn.style.display = 'flex';
        if (elements.followBtn) elements.followBtn.style.display = 'none';

        if (isLoggedIn) {
            if (elements.currentUserAvatar) elements.currentUserAvatar.src = album.current_user_profile_picture || '/static/img/placeholder-default.jpg';
            if (state.currentUserId && state.currentUserId !== state.albumOwnerId) {
                if (elements.followBtn) {
                    elements.followBtn.style.display = 'flex';
                    elements.followBtn.textContent = album.is_followed ? 'Dejar de Seguir' : 'Seguir';
                }
            }
            if (elements.likeBtn) elements.likeBtn.classList.toggle('active', album.is_liked);
            if (elements.saveBtn) elements.saveBtn.classList.toggle('active', album.is_saved);
        }

        if (elements.ownerActionButtons) {
            if (state.currentUserId === state.albumOwnerId) {
                elements.ownerActionButtons.innerHTML = `<button id="manage-album-btn" class="btn btn-primary" data-modal-target="#manage-album-modal"><i class="fas fa-edit"></i> Gestionar Álbum</button>`;
            } else {
                elements.ownerActionButtons.innerHTML = '';
            }
        }
    }

    function openManagementModal() {
        if (!state.albumData || !elements.editAlbumForm) return;
        const album = state.albumData;
        elements.editAlbumForm.title.value = album.title;
        elements.editAlbumForm.description.value = album.description;
        elements.editAlbumForm.tags.value = album.tags.join(', ');
        loadMediaForManagement(album.media);
    }

    function loadMediaForManagement(media) {
        if (!elements.mediaManagementGrid) return;
        elements.mediaManagementGrid.innerHTML = '';
        const currentCoverPath = state.albumData.thumbnail_path;
        media.forEach(item => {
            const isCover = currentCoverPath === item.file_path;
            const itemEl = document.createElement('div');
            itemEl.className = `media-mgmt-item ${isCover ? 'is-cover' : ''}`;
            itemEl.dataset.id = item.id;
            const thumbnail = item.file_type.startsWith('video') ? `<video src="${item.file_path}#t=0.5" preload="metadata"></video>` : `<img src="${item.file_path}" loading="lazy">`;
            itemEl.innerHTML = `${thumbnail}<button class="delete-btn" data-action="delete-media" title="Eliminar">&times;</button><button class="set-cover-btn" data-action="set-cover" title="Poner como portada"><i class="fas fa-image"></i></button>`;
            elements.mediaManagementGrid.appendChild(itemEl);
        });
        if (state.sortableInstance) state.sortableInstance.destroy();
        if (typeof Sortable !== 'undefined') {
            state.sortableInstance = new Sortable(elements.mediaManagementGrid, { animation: 150, ghostClass: 'sortable-ghost' });
        }
    }

    // --- 5. MANEJADORES DE EVENTOS ---
    function setupEventListeners() {
        if (!albumId) return;
        if (elements.backButton) elements.backButton.addEventListener('click', () => history.back());
        if (elements.commentForm) elements.commentForm.addEventListener('submit', handleCommentSubmit);
        if (elements.followBtn) elements.followBtn.addEventListener('click', handleFollow);
        if (elements.likeBtn) elements.likeBtn.addEventListener('click', handleLike);
        if (elements.saveBtn) elements.saveBtn.addEventListener('click', handleSave);
        if (elements.shareBtn) elements.shareBtn.addEventListener('click', handleShare);
        if (elements.copyLinkBtn) elements.copyLinkBtn.addEventListener('click', handleCopyLink);
        if (elements.reportForm) elements.reportForm.addEventListener('submit', handleReportSubmit);
        if (elements.commentsList) elements.commentsList.addEventListener('click', handleCommentAction);
        if (elements.ownerActionButtons) elements.ownerActionButtons.addEventListener('click', e => {
            if (e.target.closest('#manage-album-btn')) openManagementModal();
        });
        if (elements.managementTabs) elements.managementTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                elements.managementTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                elements.managementTabContents.forEach(c => c.classList.remove('active'));
                const targetContent = document.getElementById(tab.dataset.tab);
                if (targetContent) targetContent.classList.add('active');
            });
        });
        if (elements.editAlbumForm) elements.editAlbumForm.addEventListener('submit', handleEditAlbumSubmit);
        if (elements.saveOrderBtn) elements.saveOrderBtn.addEventListener('click', handleSaveMediaOrder);
        if (elements.mediaManagementGrid) elements.mediaManagementGrid.addEventListener('click', handleMediaManagementClick);
        if (elements.addMediaForm) elements.addMediaForm.addEventListener('submit', handleAddMediaSubmit);
        if (elements.addFilesInput) elements.addFilesInput.addEventListener('change', () => {
            if (elements.addFilesInput.files.length > 0) {
                if (elements.addFilesStatus) elements.addFilesStatus.textContent = `${elements.addFilesInput.files.length} archivo(s) seleccionado(s).`;
            } else {
                if (elements.addFilesStatus) elements.addFilesStatus.textContent = '';
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.comment-actions')) {
            document.querySelectorAll('.comment-actions-menu.visible').forEach(menu => menu.classList.remove('visible'));
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            document.querySelectorAll('.comment-actions-menu.visible').forEach(menu => menu.classList.remove('visible'));
        }
    });
    
    async function handleCommentAction(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const commentEl = target.closest('.comment');

        if (action !== 'submit-reply') {
             e.preventDefault();
        }
        
        if (action === 'toggle-menu') {
            const menu = commentEl.querySelector('.comment-actions-menu');
            document.querySelectorAll('.comment-actions-menu.visible').forEach(m => {
                if (m !== menu) m.classList.remove('visible');
            });
            menu.classList.toggle('visible');
        }

        if (action === 'delete-comment') {
            if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes iniciar sesión para esta acción.'); }
            const commentId = commentEl.dataset.commentId;
            const confirmed = await showConfirm('Eliminar Comentario', '¿Estás seguro de que quieres eliminar este comentario?');
            if (confirmed) {
                const response = await fetchAPI(`/api/comments/${commentId}`, { method: 'DELETE' });
                if (response.ok) { showToast('Comentario eliminado.'); loadAlbum(); } 
                else { showToast('Error al eliminar el comentario.', 'error'); }
            }
        }
        
        if (action === 'show-reply-form') {
            if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes iniciar sesión para responder.'); }
            const container = commentEl.querySelector('.reply-form-container');
            if (container.innerHTML !== '') { container.innerHTML = ''; return; }
            const commentId = commentEl.dataset.commentId;
            container.innerHTML = `<form class="reply-form" onsubmit="return false;"><textarea name="text" placeholder="Escribe una respuesta..." required></textarea><button type="submit" class="btn btn-primary" data-action="submit-reply" data-parent-id="${commentId}">Enviar</button></form>`;
        }

        if (action === 'submit-reply') {
            e.preventDefault();
            if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes iniciar sesión para responder.'); }
            const form = target.closest('form');
            const parentId = target.dataset.parentId;
            const text = form.querySelector('textarea').value;
            if (!text.trim()) { return showToast('La respuesta no puede estar vacía', 'error'); }
            const response = await fetchAPI(`/api/comments/${parentId}/reply`, { method: 'POST', body: JSON.stringify({ text }) });
            if (response.ok) { showToast('Respuesta enviada.'); loadAlbum(); } 
            else { showToast('Error al enviar la respuesta.', 'error'); }
        }
    }
    
    function handleShare() {
        if (elements.albumShareLinkInput) {
            elements.albumShareLinkInput.value = window.location.href;
        }
        if (elements.shareLinkModal) {
            elements.shareLinkModal.classList.toggle('visible');
        }
    }

    function handleCopyLink() {
        if (!elements.albumShareLinkInput) return;
        elements.albumShareLinkInput.select();
        document.execCommand('copy');
        if(elements.copyFeedback) {
            elements.copyFeedback.classList.add('visible');
            setTimeout(() => { elements.copyFeedback.classList.remove('visible'); }, 2000);
        }
    }

    async function handleCommentSubmit(e) {
        e.preventDefault();
        if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes iniciar sesión para comentar.'); }
        const text = e.target.text.value;
        if (!text.trim()) { return showToast('El comentario no puede estar vacío.', 'error'); }
        const response = await fetchAPI(`/api/albums/${albumId}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
        if (response.ok) { e.target.reset(); loadAlbum(); } 
        else { showToast('Hubo un error al enviar tu comentario.', 'error'); }
    }

    async function handleFollow() {
        if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes iniciar sesión para seguir a otros usuarios.'); }
        const response = await fetchAPI(`/api/users/${state.albumOwnerId}/follow`, { method: 'POST' });
        if (response.ok) { loadAlbum(); } 
        else { showToast('Error al actualizar seguimiento.', 'error'); }
    }

    async function handleLike() {
        if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes iniciar sesión para dar "Me gusta".'); }
        const response = await fetchAPI(`/api/albums/${albumId}/like`, { method: 'POST' });
        if (response.ok) {
            const data = await response.json();
            elements.likeBtn.classList.toggle('active', data.is_liked);
            elements.likesCount.textContent = data.likes_count;
        } else { showToast('Error al procesar "Me gusta".', 'error'); }
    }

    async function handleSave() {
        if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes iniciar sesión para guardar álbumes.'); }
        const response = await fetchAPI(`/api/albums/${albumId}/save`, { method: 'POST' });
        if (response.ok) {
            const data = await response.json();
            elements.saveBtn.classList.toggle('active', data.is_saved);
            elements.savesCount.textContent = data.saves_count;
        } else { showToast('Error al guardar el álbum.', 'error'); }
    }

    async function handleReportSubmit(e) {
        e.preventDefault();
        if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes iniciar sesión para reportar contenido.'); }
        const reason = e.target.reason.value;
        if (!reason) { return showToast('Debes seleccionar una razón para el reporte.', 'error'); }
        const response = await fetchAPI(`/api/albums/${albumId}/report`, { method: 'POST', body: JSON.stringify({ reason: reason, description: e.target.description.value }) });
        if (response.ok) {
            showToast('Álbum reportado. Gracias por tu ayuda.');
            if (elements.reportAlbumModal) elements.reportAlbumModal.classList.remove('is-visible');
            if (elements.reportForm) elements.reportForm.reset();
        } else {
            const data = await response.json();
            showToast(`Error: ${data.message || data.error}`, 'error');
        }
    }

    async function handleEditAlbumSubmit(e) {
        e.preventDefault();
        if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes ser el dueño para editar.'); }
        const data = { title: elements.editAlbumForm.title.value, description: elements.editAlbumForm.description.value, tags: elements.editAlbumForm.tags.value };
        const response = await fetchAPI(`/api/albums/${albumId}`, { method: 'PUT', body: JSON.stringify(data) });
        if (response.ok) {
            showToast('Detalles del álbum actualizados.');
            if(elements.manageAlbumModal) elements.manageAlbumModal.classList.remove('is-visible');
            loadAlbum();
        } else {
            showToast('Error al actualizar los detalles.', 'error');
        }
    }

    async function handleSaveMediaOrder() {
        if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes ser el dueño para editar.'); }
        const mediaIds = state.sortableInstance.toArray();
        const response = await fetchAPI(`/api/albums/${albumId}/reorder`, { method: 'PUT', body: JSON.stringify({ media_ids: mediaIds }) });
        if (response.ok) { showToast('Orden de archivos guardado.'); loadAlbum(); } 
        else { showToast('Error al guardar el orden.', 'error'); }
    }
    
    async function handleMediaManagementClick(e) {
        if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes ser el dueño para editar.'); }
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const mediaItemEl = target.closest('.media-mgmt-item');
        if(!mediaItemEl) return;
        const mediaId = mediaItemEl.dataset.id;
        if (!mediaId) return;

        if (action === 'delete-media') {
            const confirmed = await showConfirm('Eliminar Archivo', '¿Seguro que quieres eliminar este archivo permanentemente?');
            if (confirmed) {
                const response = await fetchAPI(`/api/media/${mediaId}`, { method: 'DELETE' });
                if (response.ok) { showToast('Archivo eliminado.'); mediaItemEl.remove(); loadAlbum(); } 
                else { showToast('Error al eliminar el archivo.', 'error'); }
            }
        }
        if (action === 'set-cover') {
            const response = await fetchAPI(`/api/albums/${albumId}/cover`, { method: 'PUT', body: JSON.stringify({ media_id: mediaId }) });
            if (response.ok) { showToast('Nueva portada establecida.'); document.querySelectorAll('.media-mgmt-item.is-cover').forEach(el => el.classList.remove('is-cover')); mediaItemEl.classList.add('is-cover'); } 
            else { showToast('Error al establecer la portada.', 'error'); }
        }
    }

    async function handleAddMediaSubmit(e) {
        e.preventDefault();
        if (!state.isLoggedIn) { return showAlert('Acceso Restringido', 'Debes ser el dueño para añadir archivos.'); }
        const files = elements.addFilesInput.files;
        if (files.length === 0) { return showToast('Por favor, selecciona al menos un archivo.', 'error'); }
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
        if (uploadsFallidas > 0) { showToast(`${uploadsFallidas} de ${files.length} archivos no se pudieron subir.`, 'error'); } 
        else { showToast('¡Archivos añadidos con éxito!'); }
        
        loadAlbum().then(() => {
            openManagementModal();
            const mediaTab = document.querySelector('[data-tab="media-tab"]');
            if(mediaTab) mediaTab.click();
        });
        e.target.reset();
        if(elements.addFilesStatus) elements.addFilesStatus.textContent = '';
    }

    // --- 6. INICIO ---
    if (albumId) {
        loadAlbum();
        setupEventListeners();
    } else {
        document.body.innerHTML = '<h1>Error: No se especificó un álbum.</h1>';
    }
});