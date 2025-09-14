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

    if (!profileUsername) {
        document.getElementById('profile-main-content').innerHTML = `<div class="container"><h1>Perfil no especificado</h1></div>`;
        return;
    }

    const editBioModal = document.getElementById('edit-bio-modal');
    const followBtn = document.getElementById('follow-btn');

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

    const loadProfileData = async () => {
        try {
            const response = await fetchWithAuth(`/api/profiles/${profileUsername}`);
            if (!response.ok) {
                document.getElementById('profile-main-content').innerHTML = `<div class="container"><h1>Usuario no encontrado</h1></div>`;
                return;
            }
            const profile = await response.json();
            profileDataStore = profile;

            document.title = `Perfil de ${profile.username}`;
            document.getElementById('profile-username').textContent = profile.username;
            document.getElementById('profile-bio').textContent = profile.bio || "Este usuario aún no ha añadido una biografía.";

            const followersCountEl = document.getElementById('followers-count');
            const followingCountEl = document.getElementById('following-count');
            if (followersCountEl && followingCountEl) {
                followersCountEl.innerHTML = `<strong>${profile.followers_count}</strong> seguidores`;
                followingCountEl.innerHTML = `<strong>${profile.following_count}</strong> seguidos`;
            }

            const defaultAvatar = '/static/img/placeholder-default.jpg';
            const defaultBanner = '/static/img/hero-background.jpg';
            document.getElementById('profile-avatar').style.backgroundImage = `url('${profile.profile_picture_url || defaultAvatar}')`;
            document.getElementById('profile-banner').style.backgroundImage = `url('${profile.banner_image_url || defaultBanner}')`;
            
            const albumsGrid = document.getElementById('profile-albums-grid');
            albumsGrid.innerHTML = '';
            if (profile.albums && profile.albums.length > 0) {
                profile.albums.forEach(album => {
                    albumsGrid.insertAdjacentHTML('beforeend', createAlbumCard(album));
                });
            } else {
                albumsGrid.innerHTML = '<p>Este usuario aún no tiene álbumes publicados.</p>';
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
        document.getElementById('profile-nav').innerHTML = `
            <a href="/dashboard.html" class="btn btn-primary">Mi Dashboard</a>
            <a href="#" id="logout-btn" class="btn btn-secondary">Cerrar Sesión</a>`;
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = '/index.html';
        });

        ['profile-owner-avatar-controls', 'profile-owner-banner-controls'].forEach(id => {
            document.getElementById(id).style.display = 'flex';
        });
        
        editBioBtn.style.display = 'inline-block';
        const bioForm = document.getElementById('edit-bio-form');
        bioForm.bio.value = profile.bio || '';
    };

    const setupVisitorControls = (profile) => {
        const nav = document.getElementById('profile-nav');
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

        if (currentUserId && currentUserId !== profile.id) {
            followBtn.style.display = 'inline-block';
            followBtn.textContent = profile.is_followed ? 'Dejar de Seguir' : 'Seguir';
        }
    };

    const handleImageUpload = async (file, type) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        const url = `/api/my-profile/${type}`;
        const response = await fetchWithAuth(url, { method: 'POST', body: formData });
        if(response.ok) {
            alert('Imagen actualizada con éxito');
            loadProfileData();
        } else {
            alert('Error al subir la imagen.');
        }
    };

    function setupEventListeners() {
        document.getElementById('edit-bio-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const response = await fetchWithAuth('/api/my-profile', { method: 'PUT', body: JSON.stringify({ bio: e.target.bio.value }) });
            if(response.ok) {
                editBioModal.classList.remove('is-visible');
                loadProfileData();
            } else {
                alert("Error al guardar la biografía.");
            }
        });

        document.getElementById('avatar-upload-input').addEventListener('change', (e) => handleImageUpload(e.target.files[0], 'picture'));
        document.getElementById('banner-upload-input').addEventListener('change', (e) => handleImageUpload(e.target.files[0], 'banner'));
        document.getElementById('delete-avatar-btn').addEventListener('click', async () => {
            if (confirm('¿Estás seguro?')) {
                const response = await fetchWithAuth('/api/my-profile/picture', { method: 'DELETE' });
                if (response.ok) { alert('Foto de perfil eliminada.'); loadProfileData(); }
                else { alert('No se pudo eliminar la foto.'); }
            }
        });
        document.getElementById('delete-banner-btn').addEventListener('click', async () => {
            if (confirm('¿Estás seguro?')) {
                const response = await fetchWithAuth('/api/my-profile/banner', { method: 'DELETE' });
                if (response.ok) { alert('Banner eliminado.'); loadProfileData(); }
                else { alert('No se pudo eliminar el banner.'); }
            }
        });

        followBtn.addEventListener('click', async () => {
            if (!profileDataStore) return;
            const response = await fetchWithAuth(`/api/users/${profileDataStore.id}/follow`, { method: 'POST' });
            if(response.ok) {
                loadProfileData(); 
            } else {
                alert("Error al intentar seguir al usuario.");
            }
        });
    }

    function setupModalListeners() {
        document.body.addEventListener('click', e => {
            const target = e.target;
            const modalTarget = target.closest('[data-modal-target]');
            if (modalTarget) {
                e.preventDefault();
                const modal = document.querySelector(modalTarget.dataset.modalTarget);
                if(modal) modal.classList.add('is-visible');
            }
            if (target.closest('.close-button') || target.matches('.modal.is-visible')) {
                const modal = target.closest('.modal');
                if(modal) modal.classList.remove('is-visible');
            }
        });
    }

    // --- INVOCACIÓN INICIAL ---
    loadProfileData();
    setupEventListeners();
    setupModalListeners();
});