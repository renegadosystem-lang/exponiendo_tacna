/* =========================================================================
   script.js - Lógica Frontend para Exponiendo Tacna (REFORMULADO TOTALMENTE)
   --------------------------------------------------------------------------
   Autor: Su Diseñador Web (Gemini)
   Versión: 6.0.0 (Reescritura Completa y Optimizada para Estabilidad)
   Fecha: 31 de Julio de 2025
   Descripción:
   Este script JavaScript ha sido completamente reformulado para gestionar la
   interactividad del frontend de "Exponiendo Tacna". Integra la autenticación
   de usuarios, la carga y visualización dinámica de álbumes (con búsqueda,
   filtrado y paginación), el manejo de formularios de contacto y subida de
   contenido, y la navegación adaptativa para dispositivos móviles.
   Se ha puesto especial énfasis en la robustez de los selectores DOM y la
   consistencia en la manipulación de estilos para garantizar la estabilidad
   del layout y una experiencia de usuario fluida, evitando cualquier desorden.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // ======================================================================
    // 1. SELECTORES Y CONSTANTES GLOBALES (Módulo DOM)
    //    Centraliza y verifica la existencia de todos los elementos del DOM.
    //    Es VITAL que estos IDs y clases en su HTML coincidan EXACTAMENTE.
    // ======================================================================
    const DOM = (() => {
        const getElement = (id) => document.getElementById(id);
        const querySelector = (selector) => document.querySelector(selector);
        const querySelectorAll = (selector) => document.querySelectorAll(selector);

        return {
            // Elementos de Autenticación
            loginBtn: getElement('loginBtn'),
            registerBtn: getElement('registerBtn'),
            logoutBtn: getElement('logoutBtn'),
            usernameDisplay: getElement('usernameDisplay'),
            authModal: getElement('auth-modal'),
            closeModalButton: getElement('closeModalButton'),
            tabButtons: querySelectorAll('.tab-buttons .tab-btn'), // Contenedor .tab-buttons con botones .tab-btn
            loginTab: getElement('login-tab'),
            registerTab: getElement('register-tab'),
            loginForm: getElement('loginForm'),
            registerForm: getElement('registerForm'),
            loginMessage: getElement('loginMessage'),
            registerMessage: getElement('registerMessage'),
            
            // Elementos de Contenido y Filtrado
            searchInput: getElement('searchInput'),
            categoryFilter: getElement('categoryFilter'),
            dateFilter: getElement('dateFilter'),
            applyFiltersBtn: querySelector('.filters .btn'), // Primer botón .btn dentro de .filters
            clearFiltersBtn: querySelector('.filters .btn-secondary'), // Botón .btn-secondary dentro de .filters
            contentGrid: getElement('contentGrid'),
            paginationContainer: querySelector('.pagination'),

            // Elementos de Subida de Contenido
            uploadPrompt: getElement('uploadPrompt'),
            loginToUploadBtn: getElement('loginToUploadBtn'),
            registerToUploadBtn: getElement('registerToUploadBtn'),
            uploadForm: getElement('uploadForm'),
            albumTitle: getElement('albumTitle'),
            albumDescription: getElement('albumDescription'),
            albumTags: getElement('albumTags'),
            albumFiles: getElement('albumFiles'),
            uploadMessage: getElement('uploadMessage'),

            // Elementos de Contacto
            contactForm: getElement('contactForm'),
            contactMessage: getElement('contactMessage'),

            // Navegación Móvil
            menuToggle: querySelector('.menu-toggle'),
            mainNav: getElement('mainNav')
        };
    })();

    // ======================================================================
    // 2. MÓDULO DE UTILIDADES GENERALES
    //    Funciones reusables para mensajes y verificaciones.
    // ======================================================================
    const Utils = (() => {
        const showMessage = (element, message, isError = false) => {
            if (element) {
                element.textContent = message;
                element.style.color = isError ? 'var(--color-danger)' : 'var(--color-success)';
                element.style.display = 'block';
                setTimeout(() => {
                    element.textContent = '';
                    element.style.display = 'none';
                }, 5000); // El mensaje desaparece después de 5 segundos
            }
        };

        const API_BASE_URL = '/api'; // URL base de su API Flask

        return { showMessage, API_BASE_URL };
    })();

    // ======================================================================
    // 3. MÓDULO DE AUTENTICACIÓN (LOGIN, REGISTRO, ESTADO)
    //    Gestiona todo lo relacionado con la autenticación del usuario.
    // ======================================================================
    const AuthModule = (() => {
        const saveToken = (token) => {
            localStorage.setItem('token', token);
        };

        const getToken = () => {
            return localStorage.getItem('token');
        };

        const removeToken = () => {
            localStorage.removeItem('token');
        };

        const updateAuthUI = (isLoggedIn, username = '') => {
            if (isLoggedIn) {
                if (DOM.usernameDisplay) {
                    DOM.usernameDisplay.textContent = `Bienvenido, ${username}`;
                    DOM.usernameDisplay.style.display = 'inline-block';
                }
                if (DOM.loginBtn) DOM.loginBtn.style.display = 'none';
                if (DOM.registerBtn) DOM.registerBtn.style.display = 'none';
                if (DOM.logoutBtn) DOM.logoutBtn.style.display = 'inline-block';
                
                // Mostrar/ocultar formulario de subida
                if (DOM.uploadPrompt) DOM.uploadPrompt.style.display = 'none';
                if (DOM.uploadForm) DOM.uploadForm.style.display = 'block';
            } else {
                if (DOM.usernameDisplay) DOM.usernameDisplay.style.display = 'none';
                if (DOM.loginBtn) DOM.loginBtn.style.display = 'inline-block';
                if (DOM.registerBtn) DOM.registerBtn.style.display = 'inline-block';
                if (DOM.logoutBtn) DOM.logoutBtn.style.display = 'none';

                // Mostrar/ocultar formulario de subida
                if (DOM.uploadPrompt) DOM.uploadPrompt.style.display = 'block';
                if (DOM.uploadForm) DOM.uploadForm.style.display = 'none';
            }
        };

        const logoutUser = () => {
            removeToken();
            updateAuthUI(false);
            if (DOM.authModal) DOM.authModal.style.display = 'none';
            Utils.showMessage(DOM.loginMessage, 'Has cerrado sesión.', false);
            ContentModule.fetchAlbums(); // Recargar contenido
        };

        const handleLogin = async (event) => {
            event.preventDefault();
            const username = DOM.loginForm.loginUsername.value;
            const password = DOM.loginForm.loginPassword.value;

            try {
                const response = await fetch(`${Utils.API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();

                if (response.ok) {
                    saveToken(data.access_token);
                    Utils.showMessage(DOM.loginMessage, 'Inicio de sesión exitoso. Redirigiendo...', false);
                    setTimeout(() => {
                        if (DOM.authModal) DOM.authModal.style.display = 'none';
                        updateAuthUI(true, username);
                        DOM.loginForm.reset();
                        ContentModule.fetchAlbums();
                    }, 1000);
                } else {
                    Utils.showMessage(DOM.loginMessage, data.message || 'Error en el inicio de sesión', true);
                }
            } catch (error) {
                console.error('Error de red al iniciar sesión:', error);
                Utils.showMessage(DOM.loginMessage, 'Error de conexión. Intente de nuevo más tarde.', true);
            }
        };

        const handleRegister = async (event) => {
            event.preventDefault();
            const username = DOM.registerForm.registerUsername.value;
            const email = DOM.registerForm.registerEmail.value;
            const password = DOM.registerForm.registerPassword.value;

            try {
                const response = await fetch(`${Utils.API_BASE_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                const data = await response.json();

                if (response.ok) {
                    Utils.showMessage(DOM.registerMessage, 'Registro exitoso. Ahora puedes iniciar sesión.', false);
                    DOM.registerForm.reset();
                    if (DOM.tabButtons && DOM.tabButtons[0]) DOM.tabButtons[0].click(); // Cambiar a login
                } else {
                    Utils.showMessage(DOM.registerMessage, data.message || 'Error en el registro', true);
                }
            } catch (error) {
                console.error('Error de red al registrarse:', error);
                Utils.showMessage(DOM.registerMessage, 'Error de conexión. Intente de nuevo más tarde.', true);
            }
        };

        const checkAuthStatus = async () => {
            const token = getToken();
            if (token) {
                try {
                    const response = await fetch(`${Utils.API_BASE_URL}/user/profile`, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();

                    if (response.ok && data.username) {
                        updateAuthUI(true, data.username);
                    } else {
                        logoutUser();
                        console.error('Error al obtener perfil o token inválido:', data.message || 'Desconocido');
                    }
                } catch (error) {
                    console.error('Error al verificar el estado de autenticación:', error);
                    logoutUser();
                }
            } else {
                updateAuthUI(false);
            }
        };

        const openAuthModal = (tabToShow = 'login') => {
            if (DOM.authModal) DOM.authModal.style.display = 'flex'; // Centrado con flexbox
            DOM.tabButtons.forEach(button => {
                const tabId = button.dataset.tab;
                const tabContent = document.getElementById(`${tabId}-tab`);

                if (tabContent) { // Asegurar que el contenido de la pestaña existe
                    if (tabId === tabToShow) {
                        button.classList.add('active');
                        tabContent.classList.add('active');
                        tabContent.style.display = 'block';
                    } else {
                        button.classList.remove('active');
                        tabContent.classList.remove('active');
                        tabContent.style.display = 'none';
                    }
                }
            });
        };

        const closeAuthModal = () => {
            if (DOM.authModal) DOM.authModal.style.display = 'none';
            if (DOM.loginForm) DOM.loginForm.reset();
            if (DOM.registerForm) DOM.registerForm.reset();
            if (DOM.loginMessage) DOM.loginMessage.textContent = '';
            if (DOM.registerMessage) DOM.registerMessage.textContent = '';
        };

        const handleTabSwitch = (event) => {
            DOM.tabButtons.forEach(button => button.classList.remove('active'));
            event.target.classList.add('active');

            const tabId = event.target.dataset.tab;
            if (DOM.loginTab) DOM.loginTab.style.display = 'none';
            if (DOM.registerTab) DOM.registerTab.style.display = 'none';

            const targetTabContent = document.getElementById(`${tabId}-tab`);
            if (targetTabContent) {
                targetTabContent.style.display = 'block';
            }
        };

        const init = () => {
            if (DOM.loginBtn) DOM.loginBtn.addEventListener('click', () => openAuthModal('login'));
            if (DOM.registerBtn) DOM.registerBtn.addEventListener('click', () => openAuthModal('register'));
            if (DOM.logoutBtn) DOM.logoutBtn.addEventListener('click', logoutUser);
            if (DOM.closeModalButton) DOM.closeModalButton.addEventListener('click', closeAuthModal);
            if (DOM.authModal) DOM.authModal.addEventListener('click', (e) => { // Cierra modal al hacer clic fuera
                if (e.target === DOM.authModal) {
                    closeAuthModal();
                }
            });

            if (DOM.tabButtons) {
                DOM.tabButtons.forEach(button => {
                    button.addEventListener('click', handleTabSwitch);
                });
            }
            if (DOM.loginForm) DOM.loginForm.addEventListener('submit', handleLogin);
            if (DOM.registerForm) DOM.registerForm.addEventListener('submit', handleRegister);

            if (DOM.loginToUploadBtn) DOM.loginToUploadBtn.addEventListener('click', () => openAuthModal('login'));
            if (DOM.registerToUploadBtn) DOM.registerToUploadBtn.addEventListener('click', () => openAuthModal('register'));

            checkAuthStatus(); // Verificar estado al cargar la página
        };

        return { init, getToken, checkAuthStatus };
    })();

    // ======================================================================
    // 4. MÓDULO DE CONTENIDO (CARGA, FILTRADO, PAGINACIÓN DE ÁLBUMES)
    //    Gestiona la obtención, renderizado y filtrado de los álbumes.
    // ======================================================================
    const ContentModule = (() => {
        let currentPage = 1;
        const itemsPerPage = 6;
        let currentFilters = {};
        let totalAlbums = 0;

        const renderAlbum = (album) => {
            const imageUrl = `/uploads/${album.thumbnail || 'default.jpg'}`;
            const descriptionSnippet = album.description && album.description.length > 100 ? 
                                       album.description.substring(0, 97) + '...' : 
                                       (album.description || ''); // Asegura que no sea null

            const albumElement = document.createElement('div');
            albumElement.classList.add('content-item');
            albumElement.innerHTML = `
                <img src="${imageUrl}" alt="${album.title}">
                <div class="content-item-info">
                    <h4>${album.title}</h4>
                    <p>${descriptionSnippet}</p>
                    <div class="meta">
                        <span><i class="fas fa-calendar-alt"></i> ${new Date(album.created_at).toLocaleDateString()}</span>
                        <span><i class="fas fa-eye"></i> ${album.views || 0} Vistas</span>
                    </div>
                    <button class="btn view-album-btn" data-album-id="${album.id}">Ver Álbum</button>
                </div>
            `;
            albumElement.querySelector('.view-album-btn').addEventListener('click', () => {
                alert(`Navegar a detalle del álbum: ${album.title} (ID: ${album.id})`);
                // window.location.href = `/album/${album.id}`; // Descomentar para navegación real
            });
            return albumElement;
        };

        const renderAlbums = (albums) => {
            if (DOM.contentGrid) DOM.contentGrid.innerHTML = '';
            if (albums.length === 0) {
                if (DOM.contentGrid) DOM.contentGrid.innerHTML = '<p style="text-align: center; color: var(--color-text-muted);">No se encontraron álbumes que coincidan con los criterios.</p>';
            } else {
                albums.forEach(album => {
                    if (DOM.contentGrid) DOM.contentGrid.appendChild(renderAlbum(album));
                });
            }
        };

        const renderPagination = (totalItems, itemsPerPage, currentPage) => {
            if (!DOM.paginationContainer) return;
            DOM.paginationContainer.innerHTML = '';
            const totalPages = Math.ceil(totalItems / itemsPerPage);

            if (totalPages <= 1) return;

            const prevBtn = document.createElement('button');
            prevBtn.classList.add('page-btn');
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Anterior';
            prevBtn.disabled = currentPage === 1;
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    fetchAlbums();
                }
            });
            DOM.paginationContainer.appendChild(prevBtn);

            const maxPageButtons = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

            if (endPage - startPage + 1 < maxPageButtons) {
                startPage = Math.max(1, endPage - maxPageButtons + 1);
            }

            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.classList.add('page-btn');
                pageBtn.textContent = i;
                if (i === currentPage) {
                    pageBtn.classList.add('active');
                }
                pageBtn.addEventListener('click', () => {
                    currentPage = i;
                    fetchAlbums();
                });
                DOM.paginationContainer.appendChild(pageBtn);
            }

            const nextBtn = document.createElement('button');
            nextBtn.classList.add('page-btn');
            nextBtn.innerHTML = 'Siguiente <i class="fas fa-chevron-right"></i>';
            nextBtn.disabled = currentPage === totalPages;
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    fetchAlbums();
                }
            });
            DOM.paginationContainer.appendChild(nextBtn);
        };

        const fetchAlbums = async () => {
            if (DOM.contentGrid) DOM.contentGrid.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">Cargando álbumes...</p>';
            try {
                const queryParams = new URLSearchParams({
                    page: currentPage,
                    limit: itemsPerPage,
                    ...currentFilters
                }).toString();

                const response = await fetch(`${Utils.API_BASE_URL}/albums?${queryParams}`);
                const data = await response.json();

                if (response.ok) {
                    totalAlbums = data.total_albums;
                    renderAlbums(data.albums);
                    renderPagination(totalAlbums, itemsPerPage, currentPage);
                } else {
                    if (DOM.contentGrid) Utils.showMessage(DOM.contentGrid, `Error al cargar álbumes: ${data.message || 'Desconocido'}`, true);
                    console.error('Error fetching albums:', data.message);
                }
            } catch (error) {
                if (DOM.contentGrid) Utils.showMessage(DOM.contentGrid, 'Error de conexión al cargar los álbumes.', true);
                console.error('Network error fetching albums:', error);
            }
        };

        const applyFilters = () => {
            currentFilters = {};
            if (DOM.searchInput && DOM.searchInput.value) {
                currentFilters.q = DOM.searchInput.value;
            }
            if (DOM.categoryFilter && DOM.categoryFilter.value) {
                currentFilters.category = DOM.categoryFilter.value;
            }
            if (DOM.dateFilter && DOM.dateFilter.value) {
                currentFilters.date = DOM.dateFilter.value;
            }
            currentPage = 1;
            fetchAlbums();
        };

        const clearFilters = () => {
            if (DOM.searchInput) DOM.searchInput.value = '';
            if (DOM.categoryFilter) DOM.categoryFilter.value = '';
            if (DOM.dateFilter) DOM.dateFilter.value = '';
            currentFilters = {};
            currentPage = 1;
            fetchAlbums();
        };

        const init = () => {
            if (DOM.applyFiltersBtn) DOM.applyFiltersBtn.addEventListener('click', applyFilters);
            if (DOM.clearFiltersBtn) DOM.clearFiltersBtn.addEventListener('click', clearFilters);
            // Si desea filtrar mientras escribe/cambia, descomente:
            // if (DOM.searchInput) DOM.searchInput.addEventListener('input', applyFilters);
            // if (DOM.categoryFilter) DOM.categoryFilter.addEventListener('change', applyFilters);
            // if (DOM.dateFilter) DOM.dateFilter.addEventListener('change', applyFilters);
            fetchAlbums();
        };

        return { init, fetchAlbums };
    })();

    // ======================================================================
    // 5. MÓDULO DE MANEJO DE FORMULARIOS (SUBIDA Y CONTACTO)
    // ======================================================================
    const FormHandler = (() => {
        const handleUpload = async (event) => {
            event.preventDefault();
            const token = AuthModule.getToken();
            if (!token) {
                Utils.showMessage(DOM.uploadMessage, 'Necesitas iniciar sesión para subir contenido.', true);
                return;
            }

            const formData = new FormData();
            if (DOM.albumTitle) formData.append('title', DOM.albumTitle.value);
            if (DOM.albumDescription) formData.append('description', DOM.albumDescription.value);
            if (DOM.albumTags) formData.append('tags', DOM.albumTags.value);

            if (!DOM.albumFiles || DOM.albumFiles.files.length === 0) {
                Utils.showMessage(DOM.uploadMessage, 'Por favor, selecciona al menos un archivo.', true);
                return;
            }
            for (let i = 0; i < DOM.albumFiles.files.length; i++) {
                formData.append('files', DOM.albumFiles.files[i]);
            }

            try {
                const response = await fetch(`${Utils.API_BASE_URL}/albums`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await response.json();

                if (response.ok) {
                    Utils.showMessage(DOM.uploadMessage, data.message || 'Álbum subido con éxito.', false);
                    if (DOM.uploadForm) DOM.uploadForm.reset();
                    ContentModule.fetchAlbums();
                } else {
                    Utils.showMessage(DOM.uploadMessage, data.message || 'Error al subir el álbum.', true);
                }
            } catch (error) {
                console.error('Error de red al subir álbum:', error);
                Utils.showMessage(DOM.uploadMessage, 'Error de conexión. Intente de nuevo más tarde.', true);
            }
        };

        const handleContact = async (event) => {
            event.preventDefault();
            const name = DOM.contactForm.name.value;
            const email = DOM.contactForm.email.value;
            const message = DOM.contactForm.message.value;

            try {
                const response = await fetch(`${Utils.API_BASE_URL}/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, message })
                });
                const data = await response.json();

                if (response.ok) {
                    Utils.showMessage(DOM.contactMessage, data.message || 'Mensaje enviado con éxito.', false);
                    if (DOM.contactForm) DOM.contactForm.reset();
                } else {
                    Utils.showMessage(DOM.contactMessage, data.message || 'Error al enviar el mensaje.', true);
                }
            } catch (error) {
                console.error('Error de red al enviar contacto:', error);
                Utils.showMessage(DOM.contactMessage, 'Error de conexión. Intente de nuevo más tarde.', true);
            }
        };

        const init = () => {
            if (DOM.uploadForm) DOM.uploadForm.addEventListener('submit', handleUpload);
            if (DOM.contactForm) DOM.contactForm.addEventListener('submit', handleContact);
        };

        return { init };
    })();

    // ======================================================================
    // 6. NAVEGACIÓN MÓVIL (MENU BURGER)
    // ======================================================================
    const MobileNav = (() => {
        const toggleMenu = () => {
            if (DOM.mainNav) DOM.mainNav.classList.toggle('active');
            
            if (DOM.menuToggle) {
                const icon = DOM.menuToggle.querySelector('i');
                if (icon) {
                    if (DOM.mainNav && DOM.mainNav.classList.contains('active')) {
                        icon.classList.remove('fa-bars');
                        icon.classList.add('fa-times');
                    } else {
                        icon.classList.remove('fa-times');
                        icon.classList.add('fa-bars');
                    }
                }
            }
        };

        const init = () => {
            if (DOM.menuToggle) {
                DOM.menuToggle.addEventListener('click', toggleMenu);

                if (DOM.mainNav) {
                    DOM.mainNav.querySelectorAll('a').forEach(link => {
                        link.addEventListener('click', () => {
                            if (DOM.mainNav.classList.contains('active')) {
                                toggleMenu();
                            }
                        });
                    });
                }
            }
        };

        return { init };
    })();

    // ======================================================================
    // 7. INICIALIZACIÓN DE TODOS LOS MÓDULOS
    // ======================================================================
    AuthModule.init();
    ContentModule.init();
    FormHandler.init();
    MobileNav.init();
});