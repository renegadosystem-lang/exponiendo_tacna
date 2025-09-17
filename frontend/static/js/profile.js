// /static/js/profile.js (Versión Refactorizada y Limpia)

document.addEventListener('DOMContentLoaded', () => {
    // Añadimos una clase al body para que main.js sepa que NO debe autoejecutarse.
    document.body.classList.add('profile-page');

    // --- 1. CONFIGURACIÓN Y VARIABLES ---
    // backendUrl se obtiene de utils.js
    const token = localStorage.getItem('accessToken');
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('user');

    let currentUserId = null;
    let profileDataStore = null; 

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentUserId = parseInt(payload.sub, 10);
        } catch(e) { console.error("Token inválido:", e); }
    }

    if (!profileUsername) {
        document.getElementById('profile-main-content').innerHTML = `<div class="container"><h1>Perfil no especificado</h1></div>`;
        return;
    }

    // --- 2. SELECTORES DE ELEMENTOS DEL DOM ---
    const elements = {
        profileNav: document.getElementById('profile-nav'),
        profileMainContent: document.getElementById('profile-main-content'),
        profileUsername: document.getElementById('profile-username'),
        profileBio: document.getElementById('profile-bio'),
        profileStats: document.getElementById('profile-stats'),
        profileAvatar: document.getElementById('profile-avatar'),
        profileBanner: document.getElementById('profile-banner'),
        albumsGrid: document.getElementById('profile-albums-grid'),
        avatarControls: document.getElementById('profile-owner-avatar-controls'),
        bannerControls: document.getElementById('profile-owner-banner-controls'),
        avatarUploadInput: document.getElementById('avatar-upload-input'),
        bannerUploadInput: document.getElementById('banner-upload-input'),
        deleteAvatarBtn: document.getElementById('delete-avatar-btn'),
        deleteBannerBtn: document.getElementById('delete-banner-btn'),
        editBioBtn: document.getElementById('edit-bio-btn'),
        followBtn: document.getElementById('follow-btn'),
        editBioModal: document.getElementById('edit-bio-modal'),
        editBioForm: document.getElementById('edit-bio-form')
    };
    
    // --- 3. CARGA DE DATOS Y RENDERIZADO ---
    const loadProfileData = async () => {
        try {
            const response = await fetchWithAuth(`/api/profiles/${profileUsername}`); // Usa fetchWithAuth de utils.js
            if (!response.ok) {
                elements.profileMainContent.innerHTML = `<div class="container"><h1>Usuario no encontrado</h1></div>`;
                return;
            }
            const profile = await response.json();
            profileDataStore = profile;

            renderProfileDetails(profile);
            renderAlbumGrid(profile.albums);

            // Determinar si el visitante es el dueño del perfil
            if (currentUserId && currentUserId === profile.id) {
                setupOwnerControls(profile);
            } else {
                setupVisitorControls(profile);
            }
            
            // MUY IMPORTANTE: Una vez que el header dinámico está en el DOM,
            // llamamos a la función global de main.js para que active sus botones.
            if (window.initializeGlobalEventListeners) {
                window.initializeGlobalEventListeners();
            }

        } catch (error) { 
            console.error('Error al cargar el perfil:', error);
            elements.profileMainContent.innerHTML = `<div class="container"><h1>Error al cargar el perfil</h1></div>`;
        }
    };

    const renderProfileDetails = (profile) => {
        document.title = `Perfil de ${profile.username}`;
        elements.profileUsername.textContent = profile.username;
        elements.profileBio.textContent = profile.bio || "Este usuario aún no ha añadido una biografía.";
        
        if(elements.profileStats) {
            elements.profileStats.innerHTML = `<span id="followers-count"><strong>${profile.followers_count}</strong> seguidores</span> <span id="following-count"><strong>${profile.following_count}</strong> seguidos</span>`;
        }

        const defaultAvatar = '/static/img/placeholder-default.jpg';
        elements.profileAvatar.style.backgroundImage = `url('${profile.profile_picture_url || defaultAvatar}')`;
        elements.profileBanner.style.backgroundImage = `url('${profile.banner_image_url || '/static/img/hero-background.jpg'}')`;
    };

    const renderAlbumGrid = (albums) => {
        elements.albumsGrid.innerHTML = '';
        if (albums && albums.length > 0) {
            albums.forEach(album => {
                elements.albumsGrid.insertAdjacentHTML('beforeend', createAlbumCard(album));
            });
        } else {
            elements.albumsGrid.innerHTML = '<p>Este usuario aún no tiene álbumes publicados.</p>';
        }
    };

    const createAlbumCard = (album) => {
        const thumbnailUrl = album.thumbnail_url || '/static/img/placeholder-default.jpg';
        return `
            <a href="/album.html?id=${album.id}" class="album-card-link">
                <div class="album-card">
                    <div class="album-card-thumbnail" style="background-image: url('${thumbnailUrl}');"></div>
                    <div class="album-info">
                        <h3>${album.title}</h3>
                        <div class="album-stats"><span>👁️ ${album.views_count} vistas</span></div>
                    </div>
                </div>
            </a>`;
    };
    
    // --- 4. LÓGICA DE CONTROLES (Header dinámico y botones de perfil) ---
    const setupOwnerControls = (profile) => {
        elements.profileNav.innerHTML = `<button class="nav-icon-btn" id="search-btn" data-modal-target="#search-modal" title="Buscar"><i class="fas fa-search"></i></button><button class="nav-icon-btn" id="notifications-btn" title="Notificaciones"><i class="fas fa-bell"></i><span class="notification-badge"></span></button><button class="nav-icon-btn" id="chat-btn" title="Chat"><i class="fas fa-comment-dots"></i></button><a href="/dashboard.html" class="btn btn-primary">Mi Dashboard</a><a href="#" id="logout-btn" class="btn btn-secondary">Cerrar Sesión</a>`;
        elements.avatarControls.style.display = 'flex';
        elements.bannerControls.style.display = 'flex';
        elements.editBioBtn.style.display = 'inline-block';
        elements.followBtn.style.display = 'none';
        elements.editBioForm.bio.value = profile.bio || '';
    };

    const setupVisitorControls = (profile) => {
        if (token) {
             elements.profileNav.innerHTML = `<button class="nav-icon-btn" id="search-btn" data-modal-target="#search-modal" title="Buscar"><i class="fas fa-search"></i></button><button class="nav-icon-btn" id="notifications-btn" title="Notificaciones"><i class="fas fa-bell"></i><span class="notification-badge"></span></button><button class="nav-icon-btn" id="chat-btn" title="Chat"><i class="fas fa-comment-dots"></i></button><a href="/dashboard.html" class="btn btn-primary">Mi Dashboard</a><a href="#" id="logout-btn" class="btn btn-secondary">Cerrar Sesión</a>`;
        } else {
            elements.profileNav.innerHTML = `<a href="/index.html#registro" class="btn btn-primary">Crear Cuenta</a><a href="/index.html#login" data-modal-target="#login-modal" class="btn btn-secondary">Iniciar Sesión</a>`;
        }
        elements.editBioBtn.style.display = 'none';
        if (currentUserId && currentUserId !== profile.id) {
            elements.followBtn.style.display = 'inline-block';
            elements.followBtn.textContent = profile.is_followed ? 'Dejar de Seguir' : 'Seguir';
            
            // Añadir botón de mensaje
            const existingMessageBtn = document.getElementById('message-btn');
            if (existingMessageBtn) existingMessageBtn.remove();
            const messageBtn = document.createElement('button');
            messageBtn.id = 'message-btn';
            messageBtn.className = 'btn btn-secondary';
            messageBtn.textContent = 'Enviar Mensaje';
            messageBtn.onclick = () => {
                localStorage.setItem('chat_with_user', JSON.stringify({id: profile.id, username: profile.username, avatar: profile.profile_picture_url}));
                window.location.href = '/chat.html';
            };
            elements.followBtn.insertAdjacentElement('afterend', messageBtn);
        }
    };
    
    // --- 5. MANEJADORES DE EVENTOS ESPECÍFICOS DE LA PÁGINA ---
    const handleImageUpload = async (file, type) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        const url = `/api/my-profile/${type}`;
        const response = await fetchWithAuth(url, { method: 'POST', body: formData });
        if(response.ok) {
            showToast('Imagen actualizada con éxito'); // Usa showToast de utils.js
            loadProfileData();
        } else {
            showToast('Error al subir la imagen.', 'error'); // Usa showToast de utils.js
        }
    };

    function setupEventListeners() {
        if(elements.editBioForm) {
            elements.editBioForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const response = await fetchWithAuth('/api/my-profile', { method: 'PUT', body: JSON.stringify({ bio: e.target.bio.value }) });
                if(response.ok) {
                    showToast('Biografía actualizada.');
                    elements.editBioModal.classList.remove('is-visible');
                    loadProfileData();
                } else {
                    showToast("Error al guardar la biografía.", 'error');
                }
            });
        }
        if(elements.avatarUploadInput) elements.avatarUploadInput.addEventListener('change', (e) => handleImageUpload(e.target.files[0], 'picture'));
        if(elements.bannerUploadInput) elements.bannerUploadInput.addEventListener('change', (e) => handleImageUpload(e.target.files[0], 'banner'));
        
        if(elements.deleteAvatarBtn) {
            elements.deleteAvatarBtn.addEventListener('click', async () => {
                const confirmed = await showConfirm('Eliminar Avatar', '¿Estás seguro?'); // Usa showConfirm de utils.js
                if (confirmed) {
                    const response = await fetchWithAuth('/api/my-profile/picture', { method: 'DELETE' });
                    if (response.ok) { showToast('Foto de perfil eliminada.'); loadProfileData(); }
                    else { showToast('No se pudo eliminar la foto.', 'error'); }
                }
            });
        }
        
        if(elements.deleteBannerBtn) {
            elements.deleteBannerBtn.addEventListener('click', async () => {
                const confirmed = await showConfirm('Eliminar Banner', '¿Estás seguro?'); // Usa showConfirm de utils.js
                if (confirmed) {
                    const response = await fetchWithAuth('/api/my-profile/banner', { method: 'DELETE' });
                    if (response.ok) { showToast('Banner eliminado.'); loadProfileData(); }
                    else { showToast('No se pudo eliminar el banner.', 'error'); }
                }
            });
        }

        if(elements.followBtn) {
            elements.followBtn.addEventListener('click', async () => {
                if (!profileDataStore) return;
                const response = await fetchWithAuth(`/api/users/${profileDataStore.id}/follow`, { method: 'POST' });
                if(response.ok) {
                    loadProfileData(); 
                } else {
                    showToast("Error al procesar la acción.", 'error');
                }
            });
        }

        // Si no hay token, los clics en los álbumes deben mostrar una alerta
        if (!token) {
             elements.albumsGrid.addEventListener('click', (e) => {
                if (e.target.closest('.album-card-link')) {
                    e.preventDefault();
                    showAlert('Acceso Restringido', 'Para ver el álbum debes crear una cuenta o iniciar sesión.');
                }
            });
        }
    }

    // --- 6. INVOCACIÓN INICIAL ---
    loadProfileData();
    setupEventListeners();
});