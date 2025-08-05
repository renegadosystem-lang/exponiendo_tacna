document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURACIÓN Y VARIABLES ---
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('user');

    let currentUserId = null;
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

    // --- Variables para la Galería Lightbox ---
    let currentAlbumMedia = [];
    let currentIndex = 0;

    // --- 2. SELECTORES DE ELEMENTOS DEL DOM ---
    const viewAlbumModal = document.getElementById('view-album-modal');
    const editBioModal = document.getElementById('edit-bio-modal');
    const lightboxContent = document.querySelector('.lightbox-content');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');

    // --- 3. FUNCIÓN GENÉRICA PARA LLAMADAS A LA API ---
    const fetchWithAuth = (url, options = {}) => {
        const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
    };

    // --- 4. LÓGICA DE LA GALERÍA LIGHTBOX ---
    const showMediaAtIndex = (index) => {
        if (!currentAlbumMedia || currentAlbumMedia.length === 0) {
            viewAlbumModal.classList.remove('is-visible');
            return;
        }
        if (index < 0 || index >= currentAlbumMedia.length) {
            index = Math.max(0, Math.min(index, currentAlbumMedia.length - 1));
        }
        
        currentIndex = index;
        const item = currentAlbumMedia[index];
        
        lightboxContent.innerHTML = '';
        let mediaElement;
        if (item.file_type.startsWith('video')) {
            mediaElement = document.createElement('video');
            mediaElement.controls = true;
            mediaElement.autoplay = true;
        } else {
            mediaElement = document.createElement('img');
        }
        mediaElement.src = item.file_path; // La URL ya viene completa desde el backend
        
        lightboxContent.appendChild(mediaElement);
        lightboxCaption.textContent = `Archivo ${index + 1} de ${currentAlbumMedia.length}`;
        lightboxPrev.style.display = index === 0 ? 'none' : 'block';
        lightboxNext.style.display = index === currentAlbumMedia.length - 1 ? 'none' : 'block';
    };

    const openAlbumViewer = async (albumId) => {
        try {
            const response = await fetch(`${backendUrl}/api/albums/${albumId}`);
            if (!response.ok) throw new Error('No se pudo cargar el álbum');
            const albumData = await response.json();
            
            currentAlbumMedia = albumData.media || [];
            if (currentAlbumMedia.length > 0) {
                viewAlbumModal.classList.add('is-visible');
                showMediaAtIndex(0);
            } else {
                alert('Este álbum está vacío.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al cargar el contenido del álbum.');
        }
    };

    // --- 5. CARGAR DATOS DEL PERFIL ---
    const loadProfileData = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/profiles/${profileUsername}`);
            if (!response.ok) {
                document.getElementById('profile-main-content').innerHTML = `<div class="container"><h1>Usuario no encontrado</h1></div>`;
                return;
            }
            const profile = await response.json();

            document.title = `Perfil de ${profile.username}`;
            document.getElementById('profile-username').textContent = profile.username;
            document.getElementById('profile-bio').textContent = profile.bio || "Este usuario aún no ha añadido una biografía.";

            const defaultAvatar = '/static/img/placeholder-default.jpg';
            const defaultBanner = '/static/img/hero-background.jpg';

            document.getElementById('profile-avatar').style.backgroundImage = `url('${profile.profile_picture_url || defaultAvatar}')`;
            document.getElementById('profile-banner').style.backgroundImage = `url('${profile.banner_image_url || defaultBanner}')`;
            
            const albumsGrid = document.getElementById('profile-albums-grid');
            albumsGrid.innerHTML = '';
            if (profile.albums && profile.albums.length > 0) {
                profile.albums.forEach(album => {
                    albumsGrid.innerHTML += createAlbumCard(album);
                });
            } else {
                albumsGrid.innerHTML = '<p>Este usuario aún no tiene álbumes públicos.</p>';
            }

            if (currentUserId && currentUserId === profile.id) {
                setupOwnerControls(profile);
            } else {
                setupVisitorNav();
            }
        } catch (error) {
            console.error('Error al cargar el perfil:', error);
        }
    };

    const createAlbumCard = (album) => {
        const thumbnailUrl = album.thumbnail_url || '/static/img/placeholder-default.jpg';
        return `
            <a href="#" class="album-card-link" data-album-id="${album.id}">
                <div class="album-card">
                    <div class="album-card-thumbnail" style="background-image: url('${thumbnailUrl}');"></div>
                    <div class="album-info">
                        <h3>${album.title}</h3>
                        <div class="album-stats"><span>👁️ ${album.views_count} vistas</span></div>
                    </div>
                </div>
            </a>`;
    };
    
    // --- 6. LÓGICA PARA DUEÑOS DEL PERFIL Y VISITANTES ---
    const setupOwnerControls = (profile) => {
        document.getElementById('profile-nav').innerHTML = `
            <a href="/dashboard.html" class="btn btn-primary">Mi Dashboard</a>
            <a href="#" id="logout-btn" class="btn btn-secondary">Cerrar Sesión</a>`;
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = '/index.html';
        });

        ['profile-owner-avatar-controls', 'profile-owner-banner-controls', 'edit-bio-btn'].forEach(id => {
            document.getElementById(id).style.display = 'flex';
        });
        
        const bioForm = document.getElementById('edit-bio-form');
        bioForm.bio.value = profile.bio;
        
        bioForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const response = await fetchWithAuth('/api/my-profile', { method: 'PUT', body: JSON.stringify({ bio: e.target.bio.value }) });
            if(response && response.ok) {
                editBioModal.classList.remove('is-visible');
                loadProfileData();
            }
        });

        document.getElementById('avatar-upload-input').addEventListener('change', (e) => handleImageUpload(e.target.files[0], 'picture'));
        document.getElementById('banner-upload-input').addEventListener('change', (e) => handleImageUpload(e.target.files[0], 'banner'));
        
        document.getElementById('delete-avatar-btn').addEventListener('click', async () => {
            if (confirm('¿Estás seguro?')) {
                const response = await fetchWithAuth('/api/my-profile/picture', { method: 'DELETE' });
                if (response && response.ok) { alert('Foto de perfil eliminada.'); loadProfileData(); }
                else { alert('No se pudo eliminar la foto.'); }
            }
        });
        
        document.getElementById('delete-banner-btn').addEventListener('click', async () => {
            if (confirm('¿Estás seguro?')) {
                const response = await fetchWithAuth('/api/my-profile/banner', { method: 'DELETE' });
                if (response && response.ok) { alert('Banner eliminado.'); loadProfileData(); }
                else { alert('No se pudo eliminar el banner.'); }
            }
        });
    };

    const handleImageUpload = async (file, type) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        const url = `/api/my-profile/${type}`;
        const response = await fetchWithAuth(url, { method: 'POST', body: formData });
        if(response && response.ok) {
            alert('Imagen actualizada con éxito');
            loadProfileData();
        } else {
            alert('Error al subir la imagen.');
        }
    };
    
    const setupVisitorNav = () => {
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
    };
    
    // --- 7. LÓGICA DE EVENTOS (UNIFICADA Y CORREGIDA) ---
    lightboxPrev.addEventListener('click', () => showMediaAtIndex(currentIndex - 1));
    lightboxNext.addEventListener('click', () => showMediaAtIndex(currentIndex + 1));
    
    document.addEventListener('keydown', (e) => {
        if (viewAlbumModal.classList.contains('is-visible')) {
            if (e.key === 'ArrowLeft') lightboxPrev.click();
            if (e.key === 'ArrowRight') lightboxNext.click();
            if (e.key === 'Escape') viewAlbumModal.classList.remove('is-visible');
        }
    });

    document.body.addEventListener('click', (e) => {
        const target = e.target;
        
        // Abrir modal de biografía
        if (target.matches('#edit-bio-btn')) {
            editBioModal.classList.add('is-visible');
        }
        // Cerrar modales
        else if (target.matches('.close-button')) {
            target.closest('.modal').classList.remove('is-visible');
        } else if (target.matches('.modal.is-visible') && !target.closest('.modal-content')) {
             target.classList.remove('is-visible');
        }
        // Abrir visor de galería
        else {
            const albumLink = target.closest('.album-card-link');
            if (albumLink) {
                e.preventDefault();
                openAlbumViewer(albumLink.dataset.albumId);
            }
        }
    });
    
    // --- INVOCACIÓN INICIAL ---
    loadProfileData();
});
