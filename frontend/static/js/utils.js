// /static/js/utils.js (Versión Final, Corregida y Completa)

window.backendUrl = 'https://exponiendo-tacna-api2.onrender.com';

/**
 * Muestra una alerta modal.
 * @param {string} title - El título de la alerta.
 * @param {string} message - El mensaje de la alerta.
 * @returns {Promise<void>}
 */
function showAlert(title, message) {
    return new Promise(resolve => {
        const modal = document.getElementById('alert-modal');
        if (!modal) {
            alert(message);
            resolve();
            return;
        }
        const modalTitle = document.getElementById('alert-title');
        const modalMessage = document.getElementById('alert-message');
        const okBtn = document.getElementById('alert-ok-btn');
        
        if(modalTitle) modalTitle.textContent = title;
        if(modalMessage) modalMessage.textContent = message;

        const close = () => {
            modal.classList.remove('is-visible');
            okBtn.replaceWith(okBtn.cloneNode(true)); 
            resolve();
        };
        
        modal.querySelector('#alert-ok-btn').onclick = close;
        modal.classList.add('is-visible');
    });
}

/**
 * Muestra una notificación toast (mensaje emergente).
 * @param {string} message - El mensaje a mostrar.
 * @param {string} [type='success'] - El tipo de toast ('success' o 'error').
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
}

/**
 * Muestra un modal de confirmación.
 * @param {string} title - El título del modal.
 * @param {string} message - El mensaje de confirmación.
 * @returns {Promise<boolean>} - Resuelve a true si el usuario confirma, false si cancela.
 */
function showConfirm(title, message) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        if (!modal) {
            resolve(window.confirm(message));
            return;
        }
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        if(titleEl) titleEl.textContent = title;
        if(messageEl) messageEl.textContent = message;

        const close = (decision) => {
            modal.classList.remove('is-visible');
            okBtn.replaceWith(okBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            resolve(decision);
        };

        modal.querySelector('#confirm-ok-btn').onclick = () => close(true);
        modal.querySelector('#confirm-cancel-btn').onclick = () => close(false);
        modal.onclick = (e) => { if (e.target === modal) close(false); };

        modal.classList.add('is-visible');
    });
}

/**
 * Realiza una petición fetch a la API añadiendo el token de autorización.
 * @param {string} url - La URL del endpoint (ej. '/api/albums').
 * @param {object} [options={}] - Las opciones de configuración de fetch.
 * @returns {Promise<Response>}
 */
function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const headers = { ...options.headers };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    return fetch(`${window.backendUrl}${url}`, { ...options, headers });
}

/**
 * Formatea una fecha ISO a un formato de tiempo relativo (ej. "hace 5 min").
 * @param {string} dateString - La fecha en formato ISO.
 * @returns {string} El tiempo relativo formateado.
 */
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `hace instantes`;
    if (minutes < 60) return `hace ${minutes} min`;
    if (hours < 24) return `hace ${hours} h`;
    return `hace ${days} d`;
}
