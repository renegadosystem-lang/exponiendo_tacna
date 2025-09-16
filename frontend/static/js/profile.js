document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURACIÓN Y VARIABLES ---
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('user');

    let currentUserId = null;
    let profileDataStore = null; 

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentUserId = parseInt(payload.sub, 10);
        } catch(e) { console.error("Token inválido:", e); localStorage.clear(); }
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
        followersCount: document.getElementById('followers-count'),
        followingCount: document.getElementById('following-count'),
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
    
    // --- 3. FUNCIÓN GENÉRICA PARA LLAMADAS A LA API ---
    const fetchWithAuth = (url, options = {}) => {
        const currentToken = localStorage.getItem('accessToken');
        const headers = { ...options.headers };
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
    };

    // --- 4. CARGAR DATOS DEL PERFIL ---
    const loadProfileData = async () => {
        try {
            const response = await fetchWithAuth(`/api/profiles/${profileUsername}`);
            if (!response.ok) {
                elements.profileMainContent.innerHTML = `<div class="container"><h1>Usuario no encontrado</h1></div>`;
                return;
            }
            const profile = await response.json();
            profileDataStore = profile;

            document.title = `Perfil de ${profile.username}`;
            elements.profileUsername.textContent = profile.username;
            elements.profileBio.textContent = profile.bio || "Este usuario aún no ha añadido una biografía.";

            if (elements.followersCount && elements.followingCount) {
                elements.followersCount.innerHTML = `<strong>${profile.followers_count}</strong> seguidores`;
                elements.followingCount.innerHTML = `<strong>${profile.following_count}</strong> seguidos`;
            }

            const defaultAvatar = '/static/img/placeholder-default.jpg';
            const defaultBanner = '/static/img/hero-background.jpg';
            elements.profileAvatar.style.backgroundImage = `url('${profile.profile_picture_url || defaultAvatar}')`;
            elements.profileBanner.style.backgroundImage = `url('${profile.banner_image_url || defaultBanner}')`;
            
            elements.albumsGrid.innerHTML = '';
            if (profile.albums && profile.albums.length > 0) {
                profile.albums.forEach(album => {
                    elements.albumsGrid.insertAdjacentHTML('beforeend', createAlbumCard(album));
                });
            } else {
                elements.albumsGrid.innerHTML = '<p>Este usuario aún no tiene álbumes publicados.</p>';
            }

            if (currentUserId && currentUserId === profile.id) {
                setupOwnerControls(profile);
            } else {
                setupVisitorControls(profile);
            }
        } catch (error) {
            console.error('Error al cargar el perfil:', error);
        }
    };

    const createAlbumCard = (album) => {
        const thumbnailUrl = album.thumbnail_url || '/static/img/placeholder-default.jpg';
        let thumbnailElement = '';
        if (thumbnailUrl && (thumbnailUrl.endsWith('.mp4') || thumbnailUrl.endsWith('.mov'))) {
            thumbnailElement = `<video src="${thumbnailUrl}" autoplay loop muted playsinline></video>`;
        } else {
            thumbnailElement = `<img src="${thumbnailUrl}" alt="${album.title}" loading="lazy">`;
        }
        return `
            <a href="/album.html?id=${album.id}" class="album-card-link">
                <div class="album-card">
                    <div class="album-card-thumbnail">${thumbnailElement}</div>
                    <div class="album-info">
                        <h3>${album.title}</h3>
                        <div class="album-stats"><span>👁️ ${album.views_count} vistas</span></div>
                    </div>
                </div>
            </a>`;
    };
    
    // --- 5. LÓGICA DE CONTROLES Y EVENTOS ---
    const setupOwnerControls = (profile) => {
        elements.profileNav.innerHTML = `
            <a href="/dashboard.html" class="btn btn-primary">Mi Dashboard</a>
            <a href="#" id="logout-btn" class="btn btn-secondary">Cerrar Sesión</a>`;
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = '/index.html';
        });

        elements.avatarControls.style.display = 'flex';
        elements.bannerControls.style.display = 'flex';
        elements.editBioBtn.style.display = 'inline-block';
        elements.followBtn.style.display = 'none';
        
        elements.editBioForm.bio.value = profile.bio || '';
    };

    const setupVisitorControls = (profile) => {
        const nav = elements.profileNav;
        if (token) {
             nav.innerHTML = `
                <a href="/dashboard.html" class="btn btn-primary">Mi Dashboard</a>
                <a href="#" id="logout-btn" class="btn btn-secondary">Cerrar Sesión</a>`;
             nav.querySelector('#logout-btn').addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.clear();
                window.location.href = '/index.html';
            });
        } else {
            nav.innerHTML = `
                <a href="/index.html#registro" class="btn btn-primary">Crear Cuenta</a>
                <a href="/index.html#login" class="btn btn-secondary">Iniciar Sesión</a>`;
        }
        elements.editBioBtn.style.display = 'none';
        if (currentUserId && currentUserId !== profile.id) {
            elements.followBtn.style.display = 'inline-block';
            elements.followBtn.textContent = profile.is_followed ? 'Dejar de Seguir' : 'Seguir';
            elements.followBtn.className = profile.is_followed ? 'btn btn-secondary' : 'btn btn-primary';
            elements.followBtn.onclick = handleFollowToggle;
        }
        elements.avatarControls.style.display = 'none';
        elements.bannerControls.style.display = 'none';
    };

    const handleFollowToggle = async () => {
        if (!token) {
            window.location.href = '/index.html#login';
            return;
        }
        try {
            const action = profileDataStore.is_followed ? 'unfollow' : 'follow';
            const response = await fetchWithAuth(`/api/profiles/${profileDataStore.username}/${action}`, { method: 'POST' });
            if (response.ok) {
                profileDataStore.is_followed = !profileDataStore.is_followed;
                profileDataStore.followers_count += profileDataStore.is_followed ? 1 : -1;
                elements.followersCount.innerHTML = `<strong>${profileDataStore.followers_count}</strong> seguidores`;
                elements.followBtn.textContent = profileDataStore.is_followed ? 'Dejar de Seguir' : 'Seguir';
                elements.followBtn.className = profileDataStore.is_followed ? 'btn btn-secondary' : 'btn btn-primary';
            } else {
                console.error('Error al cambiar el estado de seguimiento');
            }
        } catch (error) {
            console.error('Error en la solicitud de seguimiento:', error);
        }
    };

    elements.editBioBtn.addEventListener('click', () => {
        elements.editBioModal.style.display = 'block';
    });

    elements.editBioModal.querySelector('.close').addEventListener('click', () => {
        elements.editBioModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === elements.editBioModal) {
            elements.editBioModal.style.display = 'none';
        }
    });

    elements.editBioForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newBio = elements.editBioForm.bio.value.trim();
        try {
            const response = await fetchWithAuth(`/api/profiles/${profileDataStore.username}`, {
                method: 'PUT',
                body: JSON.stringify({ bio: newBio })
            });
            if (response.ok) {
                profileDataStore.bio = newBio;
                elements.profileBio.textContent = newBio || "Este usuario aún no ha añadido una biografía.";
                elements.editBioModal.style.display = 'none';
            } else {
                console.error('Error al actualizar la biografía');
            }
        } catch (error) {
            console.error('Error en la solicitud de actualización de biografía:', error);
        }
    });

    elements.avatarUploadInput.addEventListener('change', async () => {
        const file = elements.avatarUploadInput.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('profile_picture', file);
            try {
                const response = await fetchWithAuth(`/api/profiles/${profileDataStore.username}/picture`, {
                    method: 'PUT',
                    body: formData
                });
                if (response.ok) {
                    const data = await response.json();
                    elements.profileAvatar.style.backgroundImage = `url('${data.profile_picture_url}')`;
                } else {
                    console.error('Error al subir la foto de perfil');
                }
            } catch (error) {
                console.error('Error en la solicitud de subida de foto de perfil:', error);
            }
        }
    });

    elements.bannerUploadInput.addEventListener('change', async () => {
        const file = elements.bannerUploadInput.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('banner_image', file);
            try {
                const response = await fetchWithAuth(`/api/profiles/${profileDataStore.username}/banner`, {
                    method: 'PUT',
                    body: formData

                });
                if (response.ok) {
                    const data = await response.json();
                    elements.profileBanner.style.backgroundImage = `url('${data.banner_image_url}')`;
                } else {
                    console.error('Error al subir la imagen de banner');
                }
            } catch (error) {
                console.error('Error en la solicitud de subida de imagen de banner:', error);
            }
        }
    });

    elements.deleteAvatarBtn.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que deseas eliminar tu foto de perfil?')) {
            try {
                const response = await fetchWithAuth(`/api/profiles/${profileDataStore.username}/picture`, { method: 'DELETE' });
                if (response.ok) {
                    elements.profileAvatar.style.backgroundImage = `url('/static/img/placeholder-default.jpg')`;
                } else {
                    console.error('Error al eliminar la foto de perfil');
                }
            } catch (error) {
                console.error('Error en la solicitud de eliminación de foto de perfil:', error);
            }
        }
    });

    elements.deleteBannerBtn.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que deseas eliminar tu imagen de banner?')) {
            try {
                const response = await fetchWithAuth(`/api/profiles/${profileDataStore.username}/banner`, { method: 'DELETE' });
                if (response.ok) {
                    elements.profileBanner.style.backgroundImage = `url('/static/img/hero-background.jpg')`;
                } else {
                    console.error('Error al eliminar la imagen de banner');
                }
            } catch (error) {
                console.error('Error en la solicitud de eliminación de imagen de banner:', error);
            }
        }
    });

    // --- 6. INICIAR CARGA DE DATOS ---
    loadProfileData();
});