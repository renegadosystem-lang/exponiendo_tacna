document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');

    // Selectores para los nuevos elementos
    const albumTitleEl = document.getElementById('album-title');
    const albumOwnerEl = document.getElementById('album-owner');
    const albumDescriptionEl = document.getElementById('album-description');
    const albumTagsContainerEl = document.getElementById('album-tags-container');
    const mediaFeedEl = document.getElementById('media-feed');
    const commentsListEl = document.getElementById('comments-list');
    const commentForm = document.getElementById('comment-form');
    const backButton = document.getElementById('back-button');

    const urlParams = new URLSearchParams(window.location.search);
    const albumId = urlParams.get('id');

    if (!albumId) {
        document.body.innerHTML = '<h1>Error: No se especificó un álbum.</h1>';
        return;
    }

    const loadAlbum = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/albums/${albumId}`);
            if (!response.ok) throw new Error('No se pudo cargar el álbum.');
            
            const album = await response.json();

            // Rellenar el encabezado
            document.title = album.title;
            albumTitleEl.textContent = album.title;
            albumOwnerEl.innerHTML = `Publicado por: <a href="/profile.html?user=${album.owner_username}" class="profile-link">@${album.owner_username}</a>`;
            albumDescriptionEl.textContent = album.description;

            // Renderizar los tags
            albumTagsContainerEl.innerHTML = '';
            if (album.tags && album.tags.length > 0) {
                album.tags.forEach(tag => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'tag';
                    tagEl.textContent = `#${tag}`;
                    albumTagsContainerEl.appendChild(tagEl);
                });
            }

            // --- LÓGICA DE RENDERIZADO VERTICAL (LA MEJORA CLAVE) ---
            mediaFeedEl.innerHTML = '';
            album.media.forEach(item => {
                // 1. Creamos un contenedor para cada foto/video
                const feedItem = document.createElement('div');
                feedItem.className = 'feed-item';

                // 2. Creamos el elemento multimedia
                let mediaElement;
                if (item.file_type.startsWith('video')) {
                    mediaElement = document.createElement('video');
                    mediaElement.controls = true;
                    mediaElement.preload = "metadata"; // No descarga todo el video de golpe
                    mediaElement.src = item.file_path;
                } else {
                    mediaElement = document.createElement('img');
                    mediaElement.src = item.file_path;
                    mediaElement.alt = "Contenido del álbum";
                    mediaElement.loading = "lazy"; // Carga las imágenes a medida que se desplaza
                }
                
                // 3. Añadimos el elemento al contenedor y el contenedor al feed
                feedItem.appendChild(mediaElement);
                mediaFeedEl.appendChild(feedItem);
            });

            // Renderizar los comentarios (sin cambios en esta parte)
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

    commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!token) {
            alert('Debes iniciar sesión para comentar.');
            return;
        }
        const text = e.target.text.value;
        const response = await fetch(`${backendUrl}/api/albums/${albumId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text })
        });
        if (response.ok) {
            e.target.reset();
            loadAlbum(); // Recargamos para mostrar el nuevo comentario
        } else {
            alert('Hubo un error al enviar tu comentario.');
        }
    });

    // Acción del botón de regresar
    backButton.addEventListener('click', () => {
        history.back(); // Vuelve a la página anterior
    });

    loadAlbum();
});