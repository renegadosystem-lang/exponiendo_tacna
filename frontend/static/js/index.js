// /static/js/index.js (NUEVO ARCHIVO PARA LA PÁGINA DE INICIO)

document.addEventListener('DOMContentLoaded', function() {
    // La variable backendUrl ahora se usa desde utils.js, que se carga antes.

    // Comprobar si el usuario ya tiene sesión, y si es así, redirigir al dashboard.
    if (localStorage.getItem('accessToken')) {
        window.location.href = '/dashboard.html';
        return; // Detener la ejecución del resto del script
    }

    setupForms();
    loadMostViewedAlbums();
    setupGuestAlbumClickListener();
});

/**
 * Configura los formularios de registro e inicio de sesión.
 */
function setupForms() {
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        const errorMessageDiv = document.getElementById('login-error-message');
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            errorMessageDiv.style.display = 'none';
            const username = e.target.username.value;
            const password = e.target.password.value;
            
            // Usamos fetchWithAuth (aunque aquí no hay token, es una buena práctica mantenerlo consistente)
            fetch(`${backendUrl}/api/login`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ username, password }) 
            })
            .then(response => { 
                if (!response.ok) { 
                    return response.json().then(err => { throw new Error(err.error || 'Error desconocido') }); 
                } 
                return response.json(); 
            })
            .then(data => { 
                localStorage.setItem('accessToken', data.access_token); 
                localStorage.setItem('username', data.username); 
                window.location.href = '/dashboard.html'; 
            })
            .catch(error => { 
                console.error('Error en el inicio de sesión:', error); 
                showError(errorMessageDiv, error.message || 'No se pudo conectar con el servidor.'); 
            });
        });
    }

    if (registerForm) {
        const messageDiv = document.getElementById('register-message');
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            messageDiv.style.display = 'none';
            const username = e.target.username.value;
            const email = e.target.email.value;
            const password = e.target.password.value;

            fetch(`${backendUrl}/api/register`, { 
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
                console.error('Error en el registro:', error); 
                showMessage(messageDiv, 'No se pudo conectar con el servidor.', 'error'); 
            });
        });
    }
}

/**
 * Carga los álbumes más vistos desde la API y los muestra en la cuadrícula.
 */
function loadMostViewedAlbums() {
    const gridContainer = document.getElementById('album-grid-container');
    const apiUrl = `${backendUrl}/api/albums?sort_by=views_count&sort_order=desc&per_page=6`;

    fetch(apiUrl)
        .then(response => { 
            if (!response.ok) throw new Error('Error de red'); 
            return response.json(); 
        })
        .then(data => {
            gridContainer.innerHTML = '';
            if (data.albums && data.albums.length > 0) {
                data.albums.forEach(album => {
                    const thumbnailUrl = album.thumbnail_url || '/static/img/placeholder-default.jpg';
                    // Para invitados, los enlaces a perfiles deben funcionar, pero los de álbumes no.
                    const profileUrl = `/profile.html?user=${album.owner_username}`;
                    const albumCard = document.createElement('div');
                    albumCard.className = 'album-card';
                    albumCard.style.cursor = 'pointer'; // Cursor para indicar que es clickeable
                    albumCard.dataset.albumId = album.id;
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
            console.error('Error al cargar álbumes:', error); 
            gridContainer.innerHTML = '<p>No se pudieron cargar los álbumes.</p>'; 
        });
}

/**
 * Configura un listener en la cuadrícula de álbumes para mostrar una alerta a los invitados.
 */
function setupGuestAlbumClickListener() {
    const gridContainer = document.getElementById('album-grid-container');
    gridContainer.addEventListener('click', function(e) {
        const card = e.target.closest('.album-card');
        // Asegurarnos de que no se hizo clic en el enlace del perfil
        if (card && !e.target.closest('a')) {
            e.preventDefault();
            e.stopPropagation();
            // Usamos showAlert de utils.js
            showAlert('Acceso Restringido', 'Para ver el contenido completo, por favor crea una cuenta o inicia sesión.');
        }
    });
}

// --- Pequeñas funciones de ayuda para mostrar mensajes en los formularios ---
function showError(element, message) { 
    element.textContent = message; 
    element.style.display = 'block'; 
}

function showMessage(element, message, type) { 
    element.textContent = message; 
    element.className = type === 'success' ? 'success-message' : 'error-message'; 
    element.style.display = 'block'; 
}