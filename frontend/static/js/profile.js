document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURACIÓN Y VARIABLES ---
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('user');
    
    let currentUserId = null;
    // --- CORRECCIÓN: Se comprueba directamente en localStorage ---
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

    // --- 2. SELECTORES DE ELEMENTOS DEL DOM ---
    const editBioModal = document.getElementById('edit-bio-modal');

    // --- 3. FUNCIÓN GENÉRICA PARA LLAMADAS A LA API ---
    // Función fetchWithAuth (CORREGIDA)
    const fetchWithAuth = (url, options = {}) => {
        const token = localStorage.getItem('accessToken');
        const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
    };

    // --- 4. CARGAR DATOS DEL PERFIL ---
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

            // --- LÓGICA AÑADIDA PARA MOSTRAR/OCULTAR BOTÓN DE SEGUIR ---
        const followBtn = document.getElementById('follow-btn');
        if (currentUserId && currentUserId !== profile.id) {
            followBtn.style.display = 'inline-block';
            followBtn.textContent = profile.is_followed ? 'Dejar de Seguir' : 'Seguir';
            
            followBtn.addEventListener('click', async () => {
                const response = await fetchWithAuth(`/api/users/${profile.id}/follow`, { method: 'POST' });
                if(response.ok) {
                    // Recargar los datos para actualizar el botón y el contador
                    loadProfileData(); 
                } else {
                    alert("Error al intentar seguir al usuario.");
                }
            });
        }

            // --- INICIO: CÓDIGO AÑADIDO PARA MOSTRAR CONTADORES DE SEGUIDORES ---
            const followersCountEl = document.getElementById('followers-count');
            const followingCountEl = document.getElementById('following-count');

            if (followersCountEl && followingCountEl) {
                followersCountEl.innerHTML = `<strong>${profile.followers_count}</strong> seguidores`;
                followingCountEl.innerHTML = `<strong>${profile.following_count}</strong> seguidos`;
            }
            // --- FIN: CÓDIGO AÑADIDO ---

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
                albumsGrid.innerHTML = '<p>Este usuario aún no tiene álbumes publicados.</p>';
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

    // En dashboard.js y profile.js
const createAlbumCard = (album, isOwner) => {
    const thumbnailUrl = album.thumbnail_url || '/static/img/placeholder-default.jpg';
    const profileUrl = `/profile.html?user=${album.owner_username}`;
    
    // --- LÓGICA PARA RENDERIZAR VIDEO O IMAGEN ---
    let thumbnailElement = '';
    if (thumbnailUrl && (thumbnailUrl.endsWith('.mp4') || thumbnailUrl.endsWith('.mov'))) {
        thumbnailElement = `<video src="${thumbnailUrl}" autoplay loop muted playsinline></video>`;
    } else {
        thumbnailElement = `<img src="${thumbnailUrl}" alt="${album.title}" loading="lazy">`;
    }

    const ownerControls = isOwner ? `
        <div class="album-owner-controls">
            <button class="btn-control delete" data-album-id="${album.id}">Eliminar</button>
        </div>` : '';
        
    return `
        <div class="album-card" data-album-id="${album.id}" style="cursor: pointer;">
            <div class="album-card-thumbnail">
                ${thumbnailElement}
            </div>
            <div class="album-info">
                <h3>${album.title}</h3>
                <p>por: <a href="${profileUrl}" class="profile-link">@${album.owner_username || 'usuario'}</a></p>
                <div class="album-stats"><span>👁️ ${album.views_count} vistas</span></div>
            </div>
            ${isOwner ? ownerControls : ''}
        </div>`;
};
    
    // --- 5. LÓGICA PARA DUEÑOS DEL PERFIL Y VISITANTES ---
    const setupOwnerControls = (profile) => {
        document.getElementById('profile-nav').innerHTML = `
            <a href="/dashboard.html" class="btn btn-primary">Mi Dashboard</a>
            <a href="#" id="logout-btn" class="btn btn-secondary">Cerrar Sesión</a>`;
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = '/index.html';
        });

        // Muestra los botones de control para el dueño del perfil
        ['profile-owner-avatar-controls', 'profile-owner-banner-controls', 'edit-bio-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'flex';
        });
        
        const bioForm = document.getElementById('edit-bio-form');
        bioForm.bio.value = profile.bio || '';
        
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
    
    // =============================================================
    // --- LÓGICA CENTRALIZADA PARA TODOS LOS MODALES ---
    // =============================================================
    function setupModalListeners() {
        document.body.addEventListener('click', e => {
            const target = e.target;
            
            // Busca un elemento padre que tenga el atributo para abrir un modal
            const modalTarget = target.closest('[data-modal-target]');
            if (modalTarget) {
                e.preventDefault();
                const modal = document.querySelector(modalTarget.dataset.modalTarget);
                if(modal) modal.classList.add('is-visible');
            }
            
            // Busca un elemento padre que sea un botón de cierre
            if (target.closest('.close-button')) {
                target.closest('.modal').classList.remove('is-visible');
            }
            
            // Cierra si se hace clic directamente en el fondo del modal (y no en su contenido)
            if (target.matches('.modal.is-visible')) {
                 target.classList.remove('is-visible');
            }
        });
    }

    // --- INVOCACIÓN INICIAL ---
    loadProfileData();
    setupModalListeners(); // Llama a la función que activa todos los listeners de modales
});