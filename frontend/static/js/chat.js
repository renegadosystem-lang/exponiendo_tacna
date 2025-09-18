// /static/js/chat.js (Versión con Scroll Automático Corregido)

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }
    
    // --- Selectores del DOM ---
    const conversationsList = document.getElementById('conversations-list');
    const chatHeader = document.getElementById('chat-header');
    const chatPartnerAvatar = document.getElementById('chat-partner-avatar');
    const chatPartnerUsername = document.getElementById('chat-partner-username');
    const messagesArea = document.getElementById('messages-area');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const searchInput = document.getElementById('conversation-search-input');
    
    let currentUserId = null;
    let activeChatUserId = null;
    let allConversations = [];
    
    try {
        currentUserId = parseInt(JSON.parse(atob(token.split('.')[1])).sub, 10);
    } catch (e) {
        console.error("Token inválido, redirigiendo al inicio.", e);
        localStorage.clear();
        window.location.href = '/index.html';
        return;
    }

    // --- Lógica de Socket.IO ---
    const socket = io(window.backendUrl);

    socket.on('connect', () => {
        console.log('Conectado al servidor de sockets');
        socket.emit('authenticate', { token });
    });

    socket.on('new_message', (message) => {
        // Si el mensaje es para el chat activo, lo muestra
        if (message.sender_id === activeChatUserId && message.recipient_id === currentUserId) {
            appendMessage(message);
        }
        // Siempre se recargan las conversaciones para actualizar la lista y los contadores
        loadConversations();
    });

    // --- Carga y Renderizado de Datos ---
    const loadConversations = async () => {
        try {
            const response = await fetchWithAuth('/api/chats');
            if (!response.ok) throw new Error('No se pudieron cargar las conversaciones.');
            allConversations = await response.json();
            renderConversations(allConversations);
        } catch (error) {
            console.error('Error cargando conversaciones:', error);
            conversationsList.innerHTML = '<p class="error-message">No se pudieron cargar las conversaciones.</p>';
        }
    };
    
    const loadMessages = async (otherUser) => {
        if (!otherUser || !otherUser.id || activeChatUserId === otherUser.id) return;
        
        activeChatUserId = otherUser.id;
        messagesArea.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
        
        chatPartnerAvatar.src = otherUser.profile_picture_url || '/static/img/placeholder-default.jpg';
        chatPartnerUsername.textContent = otherUser.username;
        chatHeader.style.display = 'flex';
        messageForm.style.display = 'flex';
        
        document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active'));
        const partnerEl = document.querySelector(`.conversation-item[data-user-id="${otherUser.id}"]`);
        if (partnerEl) {
            partnerEl.classList.add('active');
            const badge = partnerEl.querySelector('.unread-badge');
            if (badge) badge.style.display = 'none';
        }

        try {
            const response = await fetchWithAuth(`/api/chats/${otherUser.id}`);
            const messages = await response.json();
            renderMessages(messages);
        } catch (error) {
            console.error('Error cargando mensajes:', error);
            messagesArea.innerHTML = '<p>No se pudieron cargar los mensajes.</p>';
        }
    };
    
    const renderConversations = (conversations) => {
        const query = searchInput.value.toLowerCase();
        const filteredConversations = conversations.filter(convo => 
            convo.other_user.username.toLowerCase().includes(query)
        );

        if (filteredConversations.length === 0) {
            conversationsList.innerHTML = '<p style="text-align:center; padding: 1rem; color: var(--text-muted);">No se encontraron conversaciones.</p>';
            return;
        }
        conversationsList.innerHTML = filteredConversations.map(convo => `
            <div class="conversation-item ${convo.other_user.id === activeChatUserId ? 'active' : ''}" data-user-id="${convo.other_user.id}">
                <img src="${convo.other_user.profile_picture_url || '/static/img/placeholder-default.jpg'}" alt="${convo.other_user.username}">
                <div class="conversation-info">
                    <h4>${convo.other_user.username}</h4>
                    <p class="last-message">${convo.last_message.sender_id === currentUserId ? 'Tú: ' : ''}${convo.last_message.content}</p>
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
        // Ocultar el mensaje de bienvenida si existe
        const welcomeMessage = messagesArea.querySelector('.chat-welcome');
        if (welcomeMessage) welcomeMessage.style.display = 'none';
        
        messagesArea.insertAdjacentHTML('beforeend', createMessageBubble(message));
        scrollToBottom();
    };

    const createMessageBubble = (msg) => {
        const isSent = msg.sender_id === currentUserId;
        return `
            <div class="message-bubble ${isSent ? 'sent' : 'received'}">
                ${msg.content}
                <div class="message-timestamp">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>`;
    };

    const scrollToBottom = () => { messagesArea.scrollTop = messagesArea.scrollHeight; };
    
    // --- Event Listeners ---
    conversationsList.addEventListener('click', (e) => {
        const target = e.target.closest('.conversation-item');
        if (target) {
            const otherUserId = parseInt(target.dataset.userId, 10);
            const convo = allConversations.find(c => c.other_user.id === otherUserId);
            if(convo) {
                loadMessages(convo.other_user);
            }
        }
    });

    searchInput.addEventListener('input', () => {
        renderConversations(allConversations);
    });

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (content && activeChatUserId) {
            const messagePayload = {
                token: token, recipient_id: activeChatUserId, content: content,
            };
            socket.emit('private_message', messagePayload);
            
            // --- INICIO DE LA CORRECCIÓN ---
            // Añade el mensaje a la UI inmediatamente para una respuesta instantánea (actualización optimista)
            appendMessage({
                sender_id: currentUserId,
                content: content,
                created_at: new Date().toISOString()
            });
            // --- FIN DE LA CORRECCIÓN ---

            messageInput.value = '';
            messageInput.focus();
        }
    });

    document.addEventListener('startChat', (e) => {
        const userInfo = e.detail;
        loadMessages(userInfo);
    });

    // --- Inicialización ---
    function checkDeepLink() {
        const userToChat = localStorage.getItem('chat_with_user');
        if (userToChat) {
            const userData = JSON.parse(userToChat);
            localStorage.removeItem('chat_with_user'); 
            loadMessages(userData);
        }
    }

    loadConversations();
    checkDeepLink();
});
