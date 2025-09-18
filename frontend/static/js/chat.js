// /static/js/chat.js (Versión con bug crítico corregido)

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }
    
    // Selectores para el nuevo diseño
    const conversationsList = document.getElementById('conversations-list');
    const chatHeader = document.getElementById('chat-header');
    const chatPartnerAvatar = document.getElementById('chat-partner-avatar');
    const chatPartnerUsername = document.getElementById('chat-partner-username');
    const messagesArea = document.getElementById('messages-area');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const searchInput = document.getElementById('conversation-search-input');
    
    let currentUserId = null;
    let activeChatUserId = null;
    let allConversations = [];
    
    try {
        currentUserId = parseInt(JSON.parse(atob(token.split('.')[1])).sub, 10);
    } catch (e) {
        console.error("Token inválido o expirado, redirigiendo al inicio.", e);
        // --- INICIO DE LA CORRECCIÓN ---
        // No borramos localStorage aquí para no romper otras funciones.
        // Simplemente redirigimos.
        // localStorage.clear(); // ESTA LÍNEA ERA EL ERROR Y HA SIDO ELIMINADA.
        // --- FIN DE LA CORRECCIÓN ---
        window.location.href = '/index.html';
        return;
    }

    const socket = io(window.backendUrl);

    socket.on('connect', () => {
        socket.emit('authenticate', { token });
    });

    socket.on('new_message', (message) => {
        if (message.sender_id === activeChatUserId && message.recipient_id === currentUserId) {
            appendMessage(message);
        }
        loadConversations();
    });

    const loadConversations = async () => {
        try {
            const response = await fetchWithAuth('/api/chats');
            if (!response.ok) throw new Error('No se pudieron cargar las conversaciones.');
            allConversations = await response.json();
            renderConversations(allConversations);
        } catch (error) {
            console.error('Error cargando conversaciones:', error);
            conversationsList.innerHTML = '<p>Error al cargar conversaciones.</p>';
        }
    };
    
    const loadMessages = async (otherUser) => {
        if (!otherUser || !otherUser.id) return;
        
        activeChatUserId = otherUser.id;
        messagesArea.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
        
        chatPartnerAvatar.src = otherUser.profile_picture_url || otherUser.avatar || '/static/img/placeholder-default.jpg';
        chatPartnerUsername.textContent = otherUser.username;
        chatHeader.style.display = 'flex';
        messageForm.style.display = 'flex';
        
        document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active'));
        const partnerEl = document.querySelector(`.conversation-item[data-user-id="${otherUser.id}"]`);
        if (partnerEl) partnerEl.classList.add('active');

        try {
            const response = await fetchWithAuth(`/api/chats/${otherUser.id}`);
            const messages = await response.json();
            renderMessages(messages);
        } catch (error) {
            messagesArea.innerHTML = '<p>No se pudieron cargar los mensajes.</p>';
        }
    };
    
    const renderConversations = (conversations) => {
        const query = searchInput.value.toLowerCase();
        const filtered = conversations.filter(c => c.other_user.username.toLowerCase().includes(query));

        if (filtered.length === 0) {
            conversationsList.innerHTML = '<p style="text-align:center; padding:1rem; color: var(--text-muted);">No tienes conversaciones.</p>';
            return;
        }

        conversationsList.innerHTML = filtered.map(convo => {
            const lastMessageText = convo.last_message.sender_id === currentUserId ? 'Tú: ' : '';
            return `
            <div class="conversation-item ${convo.other_user.id === activeChatUserId ? 'active' : ''}" data-user-id="${convo.other_user.id}">
                <img src="${convo.other_user.profile_picture_url || '/static/img/placeholder-default.jpg'}" alt="${convo.other_user.username}">
                <div class="conversation-info">
                    <h4>${convo.other_user.username}</h4>
                    <p class="last-message">${lastMessageText}${convo.last_message.content}</p>
                </div>
                ${convo.unread_count > 0 ? `<span class="unread-badge">${convo.unread_count}</span>` : ''}
            </div>
        `}).join('');
    };

    const renderMessages = (messages) => {
        messagesArea.innerHTML = '';
        let lastSenderId = null;
        messages.forEach(msg => {
            const isGrouped = msg.sender_id === lastSenderId;
            messagesArea.insertAdjacentHTML('beforeend', createMessageBubble(msg, isGrouped));
            lastSenderId = msg.sender_id;
        });
        scrollToBottom();
    };
    
    const appendMessage = (message) => {
        const welcome = messagesArea.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        const allBubbles = messagesArea.querySelectorAll('.message-bubble');
        const lastBubble = allBubbles[allBubbles.length - 1];
        const lastSenderId = lastBubble ? parseInt(lastBubble.dataset.senderId, 10) : null;
        const isGrouped = message.sender_id === lastSenderId;

        messagesArea.insertAdjacentHTML('beforeend', createMessageBubble(message, isGrouped));
        scrollToBottom();
    };

    const createMessageBubble = (msg, isGrouped) => {
        const isSent = msg.sender_id === currentUserId;
        const groupClass = isGrouped ? 'grouped' : '';
        return `
            <div class="message-bubble ${isSent ? 'sent' : 'received'} ${groupClass}" data-sender-id="${msg.sender_id}">
                <div class="message-content">${msg.content}</div>
                <div class="message-timestamp">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>`;
    };

    const scrollToBottom = () => { messagesArea.scrollTop = messagesArea.scrollHeight; };
    
    const sendMessage = () => {
        const content = messageInput.innerHTML.trim();
        if (content && activeChatUserId) {
            const payload = { token, recipient_id: activeChatUserId, content };
            socket.emit('private_message', payload);
            appendMessage({
                sender_id: currentUserId,
                content: content,
                created_at: new Date().toISOString()
            });
            messageInput.innerHTML = '';
            messageInput.focus();
        }
    };

    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    conversationsList.addEventListener('click', (e) => {
        const target = e.target.closest('.conversation-item');
        if (target) {
            const userId = parseInt(target.dataset.userId, 10);
            const convo = allConversations.find(c => c.other_user.id === userId);
            if(convo) loadMessages(convo.other_user);
        }
    });

    searchInput.addEventListener('input', () => renderConversations(allConversations));
    document.addEventListener('startChat', (e) => loadMessages(e.detail));

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
