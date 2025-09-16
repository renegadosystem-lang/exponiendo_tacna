// /static/js/chat.js

document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');
    const myProfileLink = document.getElementById('my-profile-link');
    const logoutBtn = document.getElementById('logout-btn');

    if (!token) {
        window.location.href = '/index.html';
        return;
    }
    
    // --- Configuración de perfil y logout ---
    const username = localStorage.getItem('username');
    if (myProfileLink && username) myProfileLink.href = `/profile.html?user=${username}`;
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = '/index.html';
        });
    }

    // --- Selectores del DOM de Chat ---
    const conversationsList = document.getElementById('conversations-list');
    const chatHeader = document.getElementById('chat-header');
    const chatPartnerAvatar = document.getElementById('chat-partner-avatar');
    const chatPartnerUsername = document.getElementById('chat-partner-username');
    const messagesArea = document.getElementById('messages-area');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    
    let currentUserId = null;
    let activeChatUserId = null;
    
    try {
        currentUserId = parseInt(JSON.parse(atob(token.split('.')[1])).sub, 10);
    } catch (e) {
        console.error("Token inválido", e);
        localStorage.clear();
        window.location.href = '/index.html';
    }

    // --- Conexión con Socket.IO ---
    const socket = io(backendUrl);

    socket.on('connect', () => {
        console.log('Conectado al servidor de sockets');
        socket.emit('authenticate', { token });
    });

    socket.on('new_message', (message) => {
        // Si estamos en la conversación activa, añade el mensaje. Si no, actualiza la lista de chats.
        if (message.sender_id === activeChatUserId || message.recipient_id === activeChatUserId) {
            appendMessage(message);
        }
        loadConversations(); // Recargar la lista para que aparezca arriba y se actualice el estado
    });

    // --- Funciones de la API (Fetch) ---
    const fetchWithAuth = (url, options = {}) => {
        const headers = { ...options.headers };
        headers['Authorization'] = `Bearer ${token}`;
        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
    };

    const loadConversations = async () => {
        try {
            const response = await fetchWithAuth('/api/chats');
            const conversations = await response.json();
            renderConversations(conversations);
        } catch (error) {
            console.error('Error cargando conversaciones:', error);
        }
    };
    
    const loadMessages = async (otherUserId) => {
        if (activeChatUserId === otherUserId) return;
        activeChatUserId = otherUserId;
        messagesArea.innerHTML = '<p>Cargando mensajes...</p>';
        try {
            const response = await fetchWithAuth(`/api/chats/${otherUserId}`);
            const messages = await response.json();
            const partner = document.querySelector(`.conversation-item[data-user-id="${otherUserId}"]`);
            if (partner) {
                // Actualizar UI de la conversación activa
                document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active'));
                partner.classList.add('active');
                if (partner.querySelector('.unread-badge')) {
                     partner.querySelector('.unread-badge').style.display = 'none';
                }

                chatPartnerAvatar.src = partner.querySelector('img').src;
                chatPartnerUsername.textContent = partner.querySelector('h4').textContent;
                chatHeader.style.display = 'flex';
                messageForm.style.display = 'flex';
            }
            renderMessages(messages);
        } catch (error) {
            console.error('Error cargando mensajes:', error);
        }
    };

    // --- Funciones de Renderizado ---
    const renderConversations = (conversations) => {
        if (!conversations.length) {
            conversationsList.innerHTML = '<p style="text-align:center; padding: 1rem; color: var(--text-muted);">No tienes conversaciones.</p>';
            return;
        }
        conversationsList.innerHTML = conversations.map(convo => `
            <div class="conversation-item" data-user-id="${convo.other_user.id}">
                <img src="${convo.other_user.profile_picture_url || '/static/img/placeholder-default.jpg'}" alt="${convo.other_user.username}">
                <div class="conversation-info">
                    <h4>${convo.other_user.username}</h4>
                    <p class="last-message">${convo.last_message.content}</p>
                </div>
                ${convo.unread_count > 0 ? `<span class="unread-badge">${convo.unread_count}</span>` : ''}
            </div>
        `).join('');
    };

    const renderMessages = (messages) => {
        messagesArea.innerHTML = messages.map(msg => createMessageBubble(msg)).join('');
        scrollToBottom();
    };
    
    const appendMessage = (message) => {
        messagesArea.insertAdjacentHTML('beforeend', createMessageBubble(message));
        scrollToBottom();
    };

    const createMessageBubble = (msg) => {
        const isSent = msg.sender_id === currentUserId;
        return `
            <div class="message-bubble ${isSent ? 'sent' : 'received'}">
                ${msg.content}
                <div class="message-timestamp">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `;
    };

    const scrollToBottom = () => {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    };
    
    // --- Event Listeners de Chat ---
    conversationsList.addEventListener('click', (e) => {
        const target = e.target.closest('.conversation-item');
        if (target) {
            const otherUserId = target.dataset.userId;
            loadMessages(parseInt(otherUserId, 10));
        }
    });

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (content && activeChatUserId) {
            const messagePayload = {
                token: token,
                recipient_id: activeChatUserId,
                content: content,
                auto_delete: false // Aún no implementamos esta opción en la UI
            };
            socket.emit('private_message', messagePayload);
            appendMessage({
                sender_id: currentUserId,
                content: content,
                created_at: new Date().toISOString()
            });
            messageInput.value = '';
        }
    });

    // --- Carga Inicial ---
    loadConversations();
});