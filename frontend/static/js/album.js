// /static/js/album.js (Versión Final, Refactorizada y 100% Funcional)

document.addEventListener('DOMContentLoaded', () => {
    // Las funciones y variables globales se cargan desde utils.js y main.js

    // --- 1. CONFIGURACIÓN Y ESTADO ---
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
            localStorage.clear();
            state.isLoggedIn = false;
        }
    }

    // --- 2. SELECTORES DE ELEMENTOS DEL DOM ---
    const elements = {
        mainNav: document.getElementById('main-nav'),
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
        reportForm: document.getElementById('report-form'),
        addMediaForm: document.getElementById('add-media-form'),
        addFilesInput: document.getElementById('add-files-input'),
        addFilesStatus: document.getElementById('add-files-status')
    };

    // --- 3. RENDERIZADO Y LÓGICA DE UI ---
    const loadAlbum = async () => {
        if (!albumId) {
            document.body.innerHTML = '<h1>Error: No se especificó un álbum.</h1>';
            return;
        }
        try {
            const response = await fetchWithAuth(`/api/albums/${albumId}`);
            if (!response.ok) throw new Error('No se pudo cargar el álbum.');
            
            state.albumData = await response.json();
            state.albumOwnerId = state.albumData.user_id;

            renderAlbumDetails(state.albumData);
            renderMediaFeed(state.albumData.media);
            renderComments(state.albumData.comments, elements.commentsList);
            updateInteractionState(state.albumData);
        } catch (error) {
            console.error(error);
            document.body.innerHTML = `<h1>Error al cargar el álbum. Es posible que no exista o haya sido eliminado.</h1>`;
        }
    };

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
        elements.commentsCount.textContent = countTotalComments(album.comments);

        elements.ownerStats.innerHTML = `<span><strong>${album.owner_followers_count}</strong> seguidores</span> <span><strong>${album.owner_following_count}</strong> seguidos</span>`;
        
        elements.albumTagsContainer.innerHTML = '';
        album.tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag';
            tagEl.textContent = `#${tag}`;
            elements.albumTagsContainer.appendChild(tagEl);
        });
    }

    function countTotalComments(comments) {
        let count = comments.length;
        for (const comment of comments) {
            if (comment.replies && comment.replies.length > 0) {
                count += countTotalComments(comment.replies);
            }
        }
        return count;
    }

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

    function renderComments(comments, container, depth = 0) {
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

                let mentionHtml = '';
                if (comment.replying_to && depth > 0) {
                    mentionHtml = `<a href="/profile.html?user=${comment.replying_to}" class="comment-reply-mention">@${comment.replying_to}</a> `;
                }

                commentEl.innerHTML = `
                    <p class="comment-text">${mentionHtml}${comment.text}</p>
                    <span class="comment-meta">
                        por <a href="/profile.html?user=${comment.author_username}" class="profile-link"><strong>@${comment.author_username}</strong></a> - ${new Date(comment.created_at).toLocaleString()}
                        ${state.isLoggedIn ? '<button class="reply-btn" data-action="show-reply-form">Responder</button>' : ''}
                    </span>
                    ${actionsMenu}
                    <div class="reply-form-container"></div>
                    <div class="comment-replies"></div>
                `;
                container.appendChild(commentEl);

                if (comment.replies && comment.replies.length > 0) {
                    const repliesContainer = commentEl.querySelector('.comment-replies');
                    renderComments(comment.replies, repliesContainer, depth + 1);
                }
            });
        } else if (container === elements.commentsList) {
            container.innerHTML = '<p>No hay comentarios. ¡Sé el primero!</p>';
        }
    }

    function updateInteractionState(album) {
        const isLoggedIn = album.user_is_logged_in;
        state.isLoggedIn = isLoggedIn;

        if (isLoggedIn) {
            elements.mainNav.innerHTML = `
                <button class="nav-icon-btn" id="search-btn" data-modal-target="#search-modal" title="Buscar"><i class="fas fa-search"></i></button>
                <button class="nav-icon-btn" id="notifications-btn" title="Notificaciones"><i class="fas fa-bell"></i><span class="notification-badge"></span></button>
                <button class="nav-icon-btn" id="chat-btn" title="Chat"><i class="fas fa-comment-dots"></i></button>
                <a href="/profile.html?user=${localStorage.getItem('username')}" id="my-profile-link" class="btn btn-secondary">Mi Perfil</a>
                <a href="#" id="logout-btn" class="btn btn-secondary">Cerrar Sesión</a>`;
        } else {
            elements.mainNav.innerHTML = `
                <a href="/index.html#registro" class="btn btn-primary">Crear Cuenta</a>
                <a href="/index.html#login" data-modal-target="#login-modal" class="btn btn-secondary">Iniciar Sesión</a>`;
        }
        
        window.initializeGlobalEventListeners();

        elements.commentForm.style.display = isLoggedIn ? 'flex' : 'none';
        if (isLoggedIn) {
            elements.currentUserAvatar.src = album.current_user_profile_picture || '/static/img/placeholder-default.jpg';
            if (state.currentUserId !== state.albumOwnerId) {
                elements.followBtn.style.display = 'flex';
                elements.followBtn.textContent = album.is_followed ? 'Dejar de Seguir' : 'Seguir';
            } else {
                elements.followBtn.style.display = 'none';
            }
            elements.likeBtn.classList.toggle('active', album.is_liked);
            elements.saveBtn.classList.toggle('active', album.is_saved);
        }

        if (state.isLoggedIn && state.currentUserId === state.albumOwnerId) {
            elements.ownerActionButtons.innerHTML = `<button id="manage-album-btn" class="btn btn-primary" data-modal-target="#manage-album-modal"><i class="fas fa-edit"></i> Gestionar Álbum</button>`;
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
            const thumbnail = item.file_type.startsWith('video') ? `<video src="${item.file_path}#t=0.5" preload="metadata"></video>` : `<img src="${item.file_path}" loading="lazy">`;
            itemEl.innerHTML = `${thumbnail}<button class="delete-btn" data-action="delete-media" title="Eliminar">&times;</button><button class="set-cover-btn" data-action="set-cover" title="Poner como portada"><i class="fas fa-image"></i></button>`;
            elements.mediaManagementGrid.appendChild(itemEl);
        });
        if (state.sortableInstance) state.sortableInstance.destroy();
        if (typeof Sortable !== 'undefined') {
            state.sortableInstance = new Sortable(elements.mediaManagementGrid, { animation: 150, ghostClass: 'sortable-ghost' });
        }
    }

    // --- 4. MANEJADORES DE EVENTOS ---
    function setupEventListeners() {
        if (elements.backButton) elements.backButton.addEventListener('click', () => history.back());
        if (elements.commentForm) elements.commentForm.addEventListener('submit', handleCommentSubmit);
        if (elements.followBtn) elements.followBtn.addEventListener('click', handleFollow);
        if (elements.likeBtn) elements.likeBtn.addEventListener('click', handleLike);
        if (elements.saveBtn) elements.saveBtn.addEventListener('click', handleSave);
        if (elements.shareBtn) elements.shareBtn.addEventListener('click', handleShare);
        if (elements.copyLinkBtn) elements.copyLinkBtn.addEventListener('click', handleCopyLink);
        if (elements.reportForm) elements.reportForm.addEventListener('submit', handleReportSubmit);
        if (elements.commentsList) elements.commentsList.addEventListener('click', handleCommentAction);
        
        document.body.addEventListener('click', e => {
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
            const numFiles = elements.addFilesInput.files.length;
            elements.addFilesStatus.textContent = numFiles > 0 ? `${numFiles} archivo(s) seleccionado(s).` : '';
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.comment-actions')) {
                document.querySelectorAll('.comment-actions-menu.visible').forEach(menu => menu.classList.remove('visible'));
            }
        });
    }
    
    async function handleCommentSubmit(e) {
        e.preventDefault();
        const text = e.target.text.value;
        if (!text.trim()) return showToast('El comentario no puede estar vacío.', 'error');
        const response = await fetchWithAuth(`/api/albums/${albumId}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
        if (response.ok) { e.target.reset(); loadAlbum(); } 
        else { showToast('Hubo un error al enviar tu comentario.', 'error'); }
    }

    async function handleFollow() {
        if (!state.isLoggedIn) return showAlert('Acceso Restringido', 'Debes iniciar sesión para seguir a otros usuarios.');
        const response = await fetchWithAuth(`/api/users/${state.albumOwnerId}/follow`, { method: 'POST' });
        if (response.ok) { loadAlbum(); } 
        else { showToast('Error al actualizar seguimiento.', 'error'); }
    }

    async function handleLike() {
        if (!state.isLoggedIn) return showAlert('Acceso Restringido', 'Debes iniciar sesión para dar "Me gusta".');
        const response = await fetchWithAuth(`/api/albums/${albumId}/like`, { method: 'POST' });
        if (response.ok) {
            const data = await response.json();
            elements.likeBtn.classList.toggle('active', data.is_liked);
            elements.likesCount.textContent = data.likes_count;
        } else { showToast('Error al procesar "Me gusta".', 'error'); }
    }

    async function handleSave() {
        if (!state.isLoggedIn) return showAlert('Acceso Restringido', 'Debes iniciar sesión para guardar álbumes.');
        const response = await fetchWithAuth(`/api/albums/${albumId}/save`, { method: 'POST' });
        if (response.ok) {
            const data = await response.json();
            elements.saveBtn.classList.toggle('active', data.is_saved);
            elements.savesCount.textContent = data.saves_count;
        } else { showToast('Error al guardar el álbum.', 'error'); }
    }
    
    function handleShare() {
        elements.albumShareLinkInput.value = window.location.href;
        elements.shareLinkModal.classList.toggle('visible');
    }
    
    function handleCopyLink() {
        elements.albumShareLinkInput.select();
        document.execCommand('copy');
        elements.copyFeedback.classList.add('visible');
        setTimeout(() => { elements.copyFeedback.classList.remove('visible'); }, 2000);
    }
    
    async function handleReportSubmit(e) {
        e.preventDefault();
        if (!state.isLoggedIn) return showAlert('Acceso Restringido', 'Debes iniciar sesión para reportar contenido.');
        const reason = e.target.reason.value;
        if (!reason) return showToast('Debes seleccionar una razón para el reporte.', 'error');
        
        const response = await fetchWithAuth(`/api/albums/${albumId}/report`, { 
            method: 'POST', 
            body: JSON.stringify({ reason: reason, description: e.target.description.value }) 
        });

        if (response.ok) {
            showToast('Álbum reportado. Gracias por tu ayuda.');
            const reportModal = document.getElementById('report-album-modal');
            if(reportModal) reportModal.classList.remove('is-visible');
            e.target.reset();
        } else {
            const data = await response.json();
            showToast(`Error: ${data.message || data.error}`, 'error');
        }
    }

    async function handleEditAlbumSubmit(e) {
        e.preventDefault();
        const data = { title: elements.editAlbumForm.title.value, description: elements.editAlbumForm.description.value, tags: elements.editAlbumForm.tags.value };
        const response = await fetchWithAuth(`/api/albums/${albumId}`, { method: 'PUT', body: JSON.stringify(data) });
        if (response.ok) {
            showToast('Detalles del álbum actualizados.');
            if(elements.manageAlbumModal) elements.manageAlbumModal.classList.remove('is-visible');
            loadAlbum();
        } else { showToast('Error al actualizar los detalles.', 'error'); }
    }

    async function handleSaveMediaOrder() {
        const mediaIds = state.sortableInstance.toArray();
        const response = await fetchWithAuth(`/api/albums/${albumId}/reorder`, { method: 'PUT', body: JSON.stringify({ media_ids: mediaIds }) });
        if (response.ok) { 
            showToast('Orden de archivos guardado.');
            if(elements.manageAlbumModal) elements.manageAlbumModal.classList.remove('is-visible');
            loadAlbum(); 
        } else { showToast('Error al guardar el orden.', 'error'); }
    }
    
    async function handleAddMediaSubmit(e) {
        e.preventDefault();
        const files = elements.addFilesInput.files;
        if (files.length === 0) return showToast('Por favor, selecciona al menos un archivo.', 'error');
        
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        let uploadsFallidas = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            submitButton.textContent = `Subiendo ${i + 1} de ${files.length}...`;
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetchWithAuth(`/api/albums/${albumId}/media`, { method: 'POST', body: formData });
            if (!response.ok) uploadsFallidas++;
        }
        
        submitButton.textContent = 'Añadir Archivos';
        submitButton.disabled = false;
        
        if (uploadsFallidas > 0) showToast(`${uploadsFallidas} de ${files.length} archivos no se pudieron subir.`, 'error');
        else showToast('¡Archivos añadidos con éxito!');
        
        if(elements.manageAlbumModal) elements.manageAlbumModal.classList.remove('is-visible');
        e.target.reset();
        elements.addFilesStatus.textContent = '';
        loadAlbum();
    }
    
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
            const commentId = commentEl.dataset.commentId;
            const confirmed = await showConfirm('Eliminar Comentario', '¿Estás seguro de que quieres eliminar este comentario?');
            if (confirmed) {
                const response = await fetchWithAuth(`/api/comments/${commentId}`, { method: 'DELETE' });
                if (response.ok) { showToast('Comentario eliminado.'); loadAlbum(); } 
                else { showToast('Error al eliminar el comentario.', 'error'); }
            }
        }
        
        if (action === 'show-reply-form') {
            const container = commentEl.querySelector('.reply-form-container');
            if (container.innerHTML !== '') { 
                container.innerHTML = ''; 
                return; 
            }
            const commentId = commentEl.dataset.commentId;
            container.innerHTML = `
                <form class="reply-form" onsubmit="return false;">
                    <textarea name="text" placeholder="Escribe una respuesta..." required></textarea>
                    <button type="submit" class="btn btn-primary" data-action="submit-reply" data-parent-id="${commentId}">Enviar</button>
                </form>`;
            container.querySelector('textarea').focus();
        }

        if (action === 'submit-reply') {
            e.preventDefault();
            const form = target.closest('form');
            const parentId = target.dataset.parentId;
            const text = form.querySelector('textarea').value;
            if (!text.trim()) return showToast('La respuesta no puede estar vacía', 'error');
            const response = await fetchWithAuth(`/api/comments/${parentId}/reply`, { method: 'POST', body: JSON.stringify({ text }) });
            if (response.ok) { showToast('Respuesta enviada.'); loadAlbum(); } 
            else { showToast('Error al enviar la respuesta.', 'error'); }
        }

        if (action === 'report-comment') {
            // Lógica de reporte de comentario...
            showToast('Función de reporte de comentario aún no implementada.');
        }
    }
    
    async function handleMediaManagementClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const mediaItemEl = target.closest('.media-mgmt-item');
        if (!mediaItemEl) return;
        
        const mediaId = mediaItemEl.dataset.id;
        if (!mediaId) return;

        if (action === 'delete-media') {
            const confirmed = await showConfirm('Eliminar Archivo', '¿Seguro que quieres eliminar este archivo permanentemente?');
            if (confirmed) {
                const response = await fetchWithAuth(`/api/media/${mediaId}`, { method: 'DELETE' });
                if (response.ok) { 
                    showToast('Archivo eliminado.'); 
                    mediaItemEl.remove();
                    loadAlbum();
                } else { showToast('Error al eliminar el archivo.', 'error'); }
            }
        }

        if (action === 'set-cover') {
            const response = await fetchWithAuth(`/api/albums/${albumId}/cover`, { method: 'PUT', body: JSON.stringify({ media_id: mediaId }) });
            if (response.ok) { 
                showToast('Nueva portada establecida.'); 
                document.querySelectorAll('.media-mgmt-item.is-cover').forEach(el => el.classList.remove('is-cover')); 
                mediaItemEl.classList.add('is-cover'); 
            } else { showToast('Error al establecer la portada.', 'error'); }
        }
    }

    // --- 5. INICIO ---
    loadAlbum();
    setupEventListeners();
});