document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');

    const albumTitleEl = document.getElementById('album-title');
    const albumOwnerEl = document.getElementById('album-owner');
    const albumDescriptionEl = document.getElementById('album-description');
    const mediaGridEl = document.getElementById('media-grid');
    const commentsListEl = document.getElementById('comments-list');
    const commentForm = document.getElementById('comment-form');

    // 1. Obtener el ID del álbum desde la URL (ej: album.html?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    const albumId = urlParams.get('id');

    if (!albumId) {
        document.body.innerHTML = '<h1>Error: No se especificó un álbum.</h1>';
        return;
    }

    // 2. Función para obtener y renderizar los datos del álbum
    const loadAlbum = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/albums/${albumId}`);
            if (!response.ok) throw new Error('No se pudo cargar el álbum.');
            
            const album = await response.json();

            // Rellenar la información del álbum
            document.title = album.title; // Actualiza el título de la pestaña del navegador
            albumTitleEl.textContent = album.title;
            albumOwnerEl.innerHTML = `Publicado por: <a href="/profile.html?user=${album.owner_username}" class="profile-link">@${album.owner_username}</a>`;
            albumDescriptionEl.textContent = album.description;

            // Renderizar las fotos y videos
            mediaGridEl.innerHTML = '';
            album.media.forEach(item => {
                let mediaElement;
                if (item.file_type.startsWith('video')) {
                    mediaElement = `<video controls src="${item.file_path}"></video>`;
                } else {
                    mediaElement = `<img src="${item.file_path}" alt="Contenido del álbum">`;
                }
                mediaGridEl.innerHTML += `<div class="media-item">${mediaElement}</div>`;
            });

            // Renderizar los comentarios
            commentsListEl.innerHTML = '';
            if (album.comments.length > 0) {
                album.comments.forEach(comment => {
                    const commentEl = document.createElement('div');
                    commentEl.className = 'comment';
                    commentEl.innerHTML = `
                        <p class="comment-text">${comment.text}</p>
                        <span class="comment-meta">
                            por <strong>@${comment.author_username}</strong> - ${new Date(comment.created_at).toLocaleString()}
                        </span>`;
                    commentsListEl.appendChild(commentEl);
                });
            } else {
                commentsListEl.innerHTML = '<p>No hay comentarios. ¡Sé el primero!</p>';
            }

        } catch (error) {
            console.error(error);
            document.body.innerHTML = `<h1>Error al cargar el álbum.</h1>`;
        }
    };

    // 3. Manejar el envío de nuevos comentarios
    commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!token) {
            alert('Debes iniciar sesión para comentar.');
            // Podrías redirigir al login aquí
            return;
        }

        const text = e.target.text.value;
        const response = await fetch(`${backendUrl}/api/albums/${albumId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text })
        });

        if (response.ok) {
            e.target.reset();
            loadAlbum(); // Recargamos todo el álbum para mostrar el nuevo comentario
        } else {
            alert('Hubo un error al enviar tu comentario.');
        }
    });

    // Carga inicial
    loadAlbum();
});