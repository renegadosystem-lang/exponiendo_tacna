// /static/js/chat.js (Versión para Rediseño Minimalista)

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { window.location.href = '/index.html'; return; }

    // --- Selectores del DOM ---
    const conversationsList = document.getElementById('conversations-list');
    const chatHeader = document.getElementById('chat-header');
    const chatPartnerAvatar = document.getElementById('chat-partner-avatar');
    const chatPartnerUsername = document.getElementById('chat-partner-username');
    const messagesArea = document.getElementById('messages-area');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    
    let currentUserId = null;
    let activeChatUserId = null;
    let allConversations = [];
    
    try {
        currentUserId = parseInt(JSON.parse(atob(token.split('.')[1])).sub, 10);
    } catch (e) {
        window.location.href = '/index.html';
        return;
    }

    const socket = io(window.backendUrl);
    socket.on('connect', () => socket.emit('authenticate', { token }));

    socket.on('new_message', (message) => {
        if (message.sender_id === activeChatUserId) {
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
        }
    };
    
    const loadMessages = async (otherUser) => {
        activeChatUserId = otherUser.id;
        messagesArea.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
        
        chatPartnerAvatar.src = otherUser.profile_picture_url || '/static/img/placeholder-default.jpg';
        chatPartnerUsername.textContent = otherUser.username;
        chatHeader.style.display = 'flex';
        messageForm.style.display = 'flex';
        
        document.querySelectorAll('.conversation-item-v3.active').forEach(el => el.classList.remove('active'));
        const partnerEl = document.querySelector(`.conversation-item-v3[data-user-id="${otherUser.id}"]`);
        if (partnerEl) partnerEl.classList.add('active');

        try {
            const response = await fetchWithAuth(`/api/chats/${otherUser.id}`);
            const messages = await response.json();
            renderMessages(messages);
        } catch (error) {
            messagesArea.innerHTML = '<p>Error al cargar mensajes.</p>';
        }
    };
    
    const renderConversations = (conversations) => {
        if (!conversationsList) return;
        if (conversations.length === 0) {
            conversationsList.innerHTML = '<p class="no-conversations">Inicia un nuevo chat</p>';
            return;
        }
        conversationsList.innerHTML = conversations.map(convo => {
            const lastMsg = convo.last_message;
            return `
            <div class="conversation-item-v3 ${convo.other_user.id === activeChatUserId ? 'active' : ''}" data-user-id="${convo.other_user.id}">
                <img src="${convo.other_user.profile_picture_url || '/static/img/placeholder-default.jpg'}" alt="${convo.other_user.username}">
                <div class="conversation-info">
                    <h4>${convo.other_user.username}</h4>
                    <p class="last-message">${lastMsg.sender_id === currentUserId ? 'Tú: ' : ''}${lastMsg.content}</p>
                </div>
                ${convo.unread_count > 0 ? `<span class="unread-badge">${convo.unread_count}</span>` : ''}
            </div>`;
        }).join('');
    };

    const renderMessages = (messages) => {
        messagesArea.innerHTML = '';
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    };
    
    const appendMessage = (message) => {
        const welcome = messagesArea.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${message.sender_id === currentUserId ? 'sent' : 'received'}`;
        messageRow.innerHTML = `<div class="message-text">${message.content}</div>`;
        messagesArea.appendChild(messageRow);
        scrollToBottom();
    };

    const scrollToBottom = () => { messagesArea.scrollTop = messagesArea.scrollHeight; };
    
    const sendMessage = () => {
        const content = messageInput.innerText.trim();
        if (content && activeChatUserId) {
            socket.emit('private_message', { token, recipient_id: activeChatUserId, content });
            appendMessage({ sender_id: currentUserId, content });
            messageInput.innerHTML = '';
            messageInput.focus();
        }
    };

    if (sendMessageBtn) sendMessageBtn.addEventListener('click', sendMessage);
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (conversationsList) {
        conversationsList.addEventListener('click', (e) => {
            const target = e.target.closest('.conversation-item-v3');
            if (target) {
                const userId = parseInt(target.dataset.userId, 10);
                const convo = allConversations.find(c => c.other_user.id === userId);
                if(convo) loadMessages(convo.other_user);
            }
        });
    }

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
