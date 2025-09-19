// /static/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('accessToken');
    const isAdmin = localStorage.getItem('is_admin') === 'true';
    const adminPanel = document.getElementById('admin-panel');

    // --- Verificación de Acceso ---
    if (!token || !isAdmin) {
        // Si no es admin, lo redirigimos
        showAlert('Acceso Denegado', 'No tienes permiso para ver esta página.').then(() => {
            window.location.href = '/dashboard.html';
        });
        return;
    }

    // Si es admin, mostramos el panel
    adminPanel.style.display = 'block';
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = '/index.html';
        });
    }

    const pendingUsersList = document.getElementById('pending-users-list');
    const allUsersList = document.getElementById('all-users-list');

    // --- Socket.IO para actualizaciones en tiempo real ---
    const socket = io(window.backendUrl);
    socket.on('connect', () => {
        socket.emit('authenticate', { token });
        socket.emit('join_admin_room'); // Unirse a la sala de administradores
    });

    socket.on('user_status_changed', (data) => {
        const statusDot = document.querySelector(`.status-dot[data-user-id="${data.user_id}"]`);
        if (statusDot) {
            statusDot.classList.toggle('active', data.is_active);
            statusDot.classList.toggle('inactive', !data.is_active);
            statusDot.title = data.is_active ? 'Online' : 'Offline';
        }
    });

    // --- Funciones del Panel ---
    const fetchAndRenderUsers = async () => {
        try {
            const response = await fetchWithAuth('/api/admin/users');
            if (!response.ok) throw new Error('No se pudo cargar la lista de usuarios.');
            
            const users = await response.json();
            
            const pendingUsers = users.filter(u => !u.is_approved);
            const approvedUsers = users.filter(u => u.is_approved);

            renderUserTable(pendingUsersList, pendingUsers, true);
            renderUserTable(allUsersList, approvedUsers, false);
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const renderUserTable = (container, users, isPendingTable) => {
        if (users.length === 0) {
            container.innerHTML = '<p>No hay usuarios en esta categoría.</p>';
            return;
        }

        const tableRows = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>
                    <span class="status-dot ${user.is_active ? 'active' : 'inactive'}" data-user-id="${user.id}" title="${user.is_active ? 'Online' : 'Offline'}"></span>
                    ${user.username}
                </td>
                <td>${user.email}</td>
                <td>
                    ${isPendingTable ? `<button class="btn btn-primary btn-sm approve-btn" data-id="${user.id}">Aprobar</button>` : ''}
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${user.id}" data-username="${user.username}">Eliminar</button>
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <table class="user-table">
                <thead>
                    <tr><th>ID</th><th>Usuario</th><th>Email</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;
    };

    // --- Event Listeners para Acciones ---
    document.body.addEventListener('click', async (e) => {
        // Aprobar Usuario
        if (e.target.classList.contains('approve-btn')) {
            const userId = e.target.dataset.id;
            const response = await fetchWithAuth(`/api/admin/users/${userId}/approve`, { method: 'POST' });
            if (response.ok) {
                showToast('Usuario aprobado con éxito.');
                fetchAndRenderUsers();
            } else {
                showToast('Error al aprobar el usuario.', 'error');
            }
        }

        // Eliminar Usuario
        if (e.target.classList.contains('delete-btn')) {
            const userId = e.target.dataset.id;
            const username = e.target.dataset.username;
            const confirmed = await showConfirm('Confirmar Eliminación', `¿Estás seguro de que quieres eliminar permanentemente a ${username}? Esta acción no se puede deshacer.`);
            if (confirmed) {
                const response = await fetchWithAuth(`/api/admin/users/${userId}`, { method: 'DELETE' });
                if (response.ok) {
                    showToast('Usuario eliminado con éxito.');
                    fetchAndRenderUsers();
                } else {
                    const data = await response.json();
                    showToast(data.error || 'Error al eliminar el usuario.', 'error');
                }
            }
        }
    });

    // Carga inicial de datos
    fetchAndRenderUsers();
});