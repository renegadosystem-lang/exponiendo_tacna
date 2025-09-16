document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('user');

    let currentUserId = null;
    let profileDataStore = null;
    const token = localStorage.getItem('accessToken');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentUserId = parseInt(payload.sub, 10);
        } catch(e) { console.error("Token inválido:", e); localStorage.clear(); }
    }

    // --- Selectores del DOM ---
    const elements = {
        profileMainContent: document.getElementById('profile-main-content'),
        profileUsernameEl: document.getElementById('profile-username'),
        profileBioEl: document.getElementById('profile-bio'),
        followersCountEl: document.getElementById('followers-count'),
        followingCountEl: document.getElementById('following-count'),
        profileAvatarEl: document.getElementById('profile-avatar'),
        profileBannerEl: document.getElementById('profile-banner'),
        profileAlbumsGrid: document.getElementById('profile-albums-grid'),
        profileAlbumsUsername: document.getElementById('profile-albums-username'),
        logoutBtn: document.getElementById('logout-btn'),
        editProfileBtn: document.getElementById('edit-profile-btn'),
        followBtn: document.getElementById('follow-btn'),
        editProfileModal: document.getElementById('edit-profile-modal'),
        editProfileForm: document.getElementById('edit-profile-form'),
        editBioInput: document.getElementById('edit-bio'),
        editAvatarUpload: document.getElementById('edit-avatar-upload'),
        avatarFilename: document.getElementById('avatar-filename'),
        editBannerUpload: document.getElementById('edit-banner-upload'),
        bannerFilename: document.getElementById('banner-filename')
    };

    if (!profileUsername) {
        elements.profileMainContent.innerHTML = `<div class="container"><h1>Perfil no especificado</h1></div>`;
        return;
    }

    // --- Funciones de Utilidad ---
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

    // --- Lógica Principal de Carga de Perfil ---
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
            elements.profileUsernameEl.textContent = profile.username;
            elements.profileBioEl.textContent = profile.bio || "Este usuario aún no ha añadido una biografía.";
            elements.profileAlbumsUsername.textContent = profile.username;

            if (elements.followersCountEl && elements.followingCountEl) {
                elements.followersCountEl.innerHTML = `<strong>${profile.followers_count}</strong> seguidores`;
                elements.followingCountEl.innerHTML = `<strong>${profile.following_count}</strong> seguidos`;
            }

            const defaultAvatar = '/static/img/placeholder-default.jpg';
            const defaultBanner = '/static/img/hero-background.jpg';
            elements.profileAvatarEl.style.backgroundImage = `url('${profile.profile_picture_url || defaultAvatar}')`;
            elements.profileBannerEl.style.backgroundImage = `url('${profile.banner_image_url || defaultBanner}')`;
            
            elements.profileAlbumsGrid.innerHTML = '';
            if (profile.albums && profile.albums.length > 0) {
                profile.albums.forEach(album => {
                    elements.profileAlbumsGrid.insertAdjacentHTML('beforeend', createAlbumCard(album));
                });
            } else {
                elements.profileAlbumsGrid.innerHTML = '<p>Este usuario aún no tiene álbumes publicados.</p>';
            }

            if (currentUserId && currentUserId === profile.id) {
                setupOwnerControls(profile);
            } else {
                setupVisitorControls(profile);
            }
        } catch (error) {
            console.error('Error al cargar el perfil:', error);
            elements.profileMainContent.innerHTML = `<div class="container"><h1>Error al cargar el perfil.</h1><p>Intenta de nuevo más tarde.</p></div>`;
        }
    };

    const setupOwnerControls = (profile) => {
        elements.editProfileBtn.style.display = 'inline-block';
        elements.followBtn.style.display = 'none'; // El dueño no se sigue a sí mismo
        elements.editBioInput.value = profile.bio || '';
    };

    const setupVisitorControls = (profile) => {
        elements.editProfileBtn.style.display = 'none';
        if (currentUserId && currentUserId !== profile.id) {
            elements.followBtn.style.display = 'inline-block';
            elements.followBtn.textContent = profile.is_followed ? 'Dejar de Seguir' : 'Seguir';
        } else {
            elements.followBtn.style.display = 'none';
        }
    };
    
    // --- Manejadores de Eventos ---
    function setupEventListeners() {
        elements.logoutBtn.addEventListener('click', (e) => { 
            e.preventDefault(); 
            localStorage.clear();
            window.location.href = '/index.html'; 
        });

        elements.editProfileBtn.addEventListener('click', () => {
            if (profileDataStore) {
                elements.editBioInput.value = profileDataStore.bio || '';
                elements.editProfileModal.classList.add('is-visible');
            }
        });

        elements.followBtn.addEventListener('click', async () => {
            if (!profileDataStore) return;
            const response = await fetchWithAuth(`/api/users/${profileDataStore.id}/follow`, { method: 'POST' });
            if(response.ok) {
                loadProfileData(); 
            } else {
                alert("Error al intentar seguir al usuario.");
            }
        });

        elements.editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('bio', elements.editBioInput.value);

            if (elements.editAvatarUpload.files.length > 0) {
                formData.append('profile_picture', elements.editAvatarUpload.files[0]);
            }
            if (elements.editBannerUpload.files.length > 0) {
                formData.append('banner_image', elements.editBannerUpload.files[0]);
            }

            const response = await fetchWithAuth(`/api/profiles/${profileUsername}`, {
                method: 'PUT',
                body: formData
            });

            if (response.ok) {
                alert('Perfil actualizado con éxito.');
                elements.editProfileModal.classList.remove('is-visible');
                elements.editProfileForm.reset();
                elements.avatarFilename.textContent = '';
                elements.bannerFilename.textContent = '';
                loadProfileData();
            } else {
                const errorData = await response.json();
                alert(`Error al actualizar el perfil: ${errorData.message || 'Intenta de nuevo.'}`);
            }
        });

        elements.editAvatarUpload.addEventListener('change', () => {
            if (elements.editAvatarUpload.files.length > 0) {
                elements.avatarFilename.textContent = elements.editAvatarUpload.files[0].name;
            } else {
                elements.avatarFilename.textContent = '';
            }
        });

        elements.editBannerUpload.addEventListener('change', () => {
            if (elements.editBannerUpload.files.length > 0) {
                elements.bannerFilename.textContent = elements.editBannerUpload.files[0].name;
            } else {
                elements.bannerFilename.textContent = '';
            }
        });
    }

    // --- Lógica de Modales ---
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

    // --- Inicialización ---
    loadProfileData();
    setupEventListeners();
    setupModalListeners();
});