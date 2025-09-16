// /static/js/chat.js (Versión Corregida y Completa)

document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'https://exponiendo-tacna-api2.onrender.com';
    const token = localStorage.getItem('accessToken');
    const myProfileLink = document.getElementById('my-profile-link');
    const logoutBtn = document.getElementById('logout-btn');

    if (!token) {
        window.location.href = '/index.html';
        return;
    }
    
    const username = localStorage.getItem('username');
    if (myProfileLink && username) myProfileLink.href = `/profile.html?user=${username}`;
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = '/index.html';
        });
    }

    const conversationsList = document.getElementById('conversations-list');
    const chatHeader = document.getElementById('chat-header');
    const chatPartnerAvatar = document.getElementById('chat-partner-avatar');
    const chatPartnerUsername = document.getElementById('chat-partner-username');
    const messagesArea = document.getElementById('messages-area');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    
    let currentUserId = null;
    let activeChatUserId = null;
    let allConversations = [];
    
    try {
        currentUserId = parseInt(JSON.parse(atob(token.split('.')[1])).sub, 10);
    } catch (e) {
        console.error("Token inválido", e);
        window.location.href = '/index.html';
    }

    const socket = io(backendUrl);
    socket.on('connect', () => {
        console.log('Conectado al servidor de sockets');
        socket.emit('authenticate', { token });
    });
    socket.on('new_message', (message) => {
        if (message.sender_id === activeChatUserId || (message.recipient_id === currentUserId && message.sender_id === activeChatUserId)) {
            appendMessage(message);
        }
        loadConversations();
    });
    socket.on('message_sent', (message) => {
        // Optimistic update for sender
        if (message.sender_id === currentUserId && message.recipient_id === activeChatUserId) {
            appendMessage(message);
        }
    });

    const fetchWithAuth = (url, options = {}) => {
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(`${backendUrl}${url}`, { ...options, headers });
    };

    const loadConversations = async () => {
        try {
            const response = await fetchWithAuth('/api/chats');
            allConversations = await response.json();
            renderConversations(allConversations);
        } catch (error) {
            console.error('Error cargando conversaciones:', error);
        }
    };
    
    const loadMessages = async (otherUser) => {
        if (!otherUser || !otherUser.id) return;
        if (activeChatUserId === otherUser.id) return;
        
        activeChatUserId = otherUser.id;
        messagesArea.innerHTML = '<p>Cargando mensajes...</p>';
        
        chatPartnerAvatar.src = otherUser.avatar || '/static/img/placeholder-default.jpg';
        chatPartnerUsername.textContent = otherUser.username;
        chatHeader.style.display = 'flex';
        messageForm.style.display = 'flex';
        
        // Actualizar UI para marcar la conversación activa
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
        if (!conversations.length) {
            conversationsList.innerHTML = '<p style="text-align:center; padding: 1rem; color: var(--text-muted);">No tienes conversaciones.</p>';
            return;
        }
        conversationsList.innerHTML = conversations.map(convo => `
            <div class="conversation-item ${convo.other_user.id === activeChatUserId ? 'active' : ''}" data-user-id="${convo.other_user.id}">
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
            </div>`;
    };

    const scrollToBottom = () => { messagesArea.scrollTop = messagesArea.scrollHeight; };
    
    conversationsList.addEventListener('click', (e) => {
        const target = e.target.closest('.conversation-item');
        if (target) {
            const otherUserId = parseInt(target.dataset.userId, 10);
            const convo = allConversations.find(c => c.other_user.id === otherUserId);
            if(convo) {
                loadMessages({id: convo.other_user.id, username: convo.other_user.username, avatar: convo.other_user.profile_picture_url});
            }
        }
    });

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (content && activeChatUserId) {
            const messagePayload = {
                token: token, recipient_id: activeChatUserId, content: content,
            };
            socket.emit('private_message', messagePayload);
            messageInput.value = '';
        }
    });

    function checkDeepLink() {
        const userToChat = localStorage.getItem('chat_with_user');
        if (userToChat) {
            const userData = JSON.parse(userToChat);
            localStorage.removeItem('chat_with_user'); 
            loadMessages(userData);
        }
    }

    document.addEventListener('startChat', (e) => {
        const userInfo = e.detail;
        loadMessages(userInfo);
    });

    loadConversations();
    checkDeepLink();
});