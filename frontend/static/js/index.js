// /static/js/index.js (Lógica para la página de inicio)

document.addEventListener('DOMContentLoaded', function() {
    // Si el usuario ya tiene sesión, lo redirigimos directamente al dashboard.
    if (localStorage.getItem('accessToken')) {
        window.location.href = '/dashboard.html';
        return; 
    }

    // Activamos los listeners globales de main.js para los modales
    if (window.initializeGlobalEventListeners) {
        window.initializeGlobalEventListeners();
    }

    setupForms();
    loadMostViewedAlbums();
    setupGuestAlbumClickListener();
});

function setupForms() {
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const loginModal = document.getElementById('login-modal');
    const paymentModal = document.getElementById('payment-modal');

    if (loginForm) {
        const errorMessageDiv = document.getElementById('login-error-message');
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            errorMessageDiv.style.display = 'none';
            const username = e.target.username.value;
            const password = e.target.password.value;

            fetch(`${window.backendUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })
            .then(async response => {
                const data = await response.json();
                if (!response.ok) {
                    // Si la respuesta no es exitosa, manejamos el error aquí
                    if (data.error === 'pending_approval') {
                        loginModal.classList.remove('is-visible');
                        paymentModal.classList.add('is-visible');
                        // Devolvemos una promesa rechazada para detener la cadena
                        return Promise.reject(null); // Usamos null para que no se muestre en la consola
                    } else {
                        // Para otros errores, lanzamos el mensaje
                        throw new Error(data.error || 'Error desconocido');
                    }
                }
                // Si la respuesta fue exitosa, pasamos los datos al siguiente .then()
                return data;
            })
            .then(data => {
                // Este bloque AHORA solo se ejecutará si el login fue 100% exitoso
                localStorage.setItem('accessToken', data.access_token);
                localStorage.setItem('username', data.username);
                localStorage.setItem('is_admin', data.is_admin);
                if (data.profile_picture_url) {
                    localStorage.setItem('profile_picture_url', data.profile_picture_url);
                }
                window.location.href = '/dashboard.html';
            })
            .catch(error => {
                // El .catch ahora solo mostrará errores reales, no el de "pago pendiente"
                if (error) {
                    showError(errorMessageDiv, error.message || 'No se pudo conectar con el servidor.');
                }
            });
        });
    }

    if (registerForm) {
        const messageDiv = document.getElementById('register-message');
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = e.target.username.value;
            const email = e.target.email.value;
            const password = e.target.password.value;

            fetch(`${window.backendUrl}/api/register`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ username, email, password }) 
            })
            .then(response => response.json().then(data => ({ ok: response.ok, data })))
            .then(({ ok, data }) => { 
                if (ok) { 
                    showMessage(messageDiv, data.message + ". Ahora puedes iniciar sesión.", 'success'); 
                    registerForm.reset(); 
                } else { 
                    showMessage(messageDiv, data.error, 'error'); 
                } 
            })
            .catch(error => { 
                showMessage(messageDiv, 'No se pudo conectar con el servidor.', 'error'); 
            });
        });
    }
}

function loadMostViewedAlbums() {
    const gridContainer = document.getElementById('album-grid-container');
    const apiUrl = `${window.backendUrl}/api/albums?sort_by=views_count&sort_order=desc&per_page=6`;
    fetch(apiUrl)
        .then(response => response.ok ? response.json() : Promise.reject('Error de red'))
        .then(data => {
            gridContainer.innerHTML = '';
            if (data.albums && data.albums.length > 0) {
                data.albums.forEach(album => {
                    const thumbnailUrl = album.thumbnail_url || '/static/img/placeholder-default.jpg';
                    const profileUrl = `/profile.html?user=${album.owner_username}`;
                    const albumCard = document.createElement('div');
                    albumCard.className = 'album-card';
                    albumCard.style.cursor = 'pointer';
                    albumCard.innerHTML = `
                        <div class="album-card-thumbnail" style="background-image: url('${thumbnailUrl}');"></div>
                        <div class="album-info">
                            <h3>${album.title}</h3>
                            <p>por: <a href="${profileUrl}" class="profile-link" onclick="event.stopPropagation()">@${album.owner_username || 'usuario'}</a></p>
                            <div class="album-stats"><span>👁️ ${album.views_count} vistas</span></div>
                        </div>`;
                    gridContainer.appendChild(albumCard);
                });
            } else { 
                gridContainer.innerHTML = '<p>Aún no hay álbumes para mostrar.</p>'; 
            }
        }).catch(error => { 
            gridContainer.innerHTML = '<p>No se pudieron cargar los álbumes.</p>'; 
        });
}

function setupGuestAlbumClickListener() {
    const gridContainer = document.getElementById('album-grid-container');
    gridContainer.addEventListener('click', function(e) {
        const card = e.target.closest('.album-card');
        if (card && !e.target.closest('a')) {
            e.preventDefault();
            e.stopPropagation();
            showAlert('Acceso Restringido', 'Para ver el contenido, crea una cuenta o inicia sesión.');
        }
    });
}

function showError(element, message) { 
    element.textContent = message; 
    element.style.display = 'block'; 
}
function showMessage(element, message, type) { 
    element.textContent = message; 
    element.className = type === 'success' ? 'success-message' : 'error-message'; 
    element.style.display = 'block'; 

}
