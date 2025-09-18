// /static/js/chat.js (Versión para Rediseño "Discord" Simplificado)

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { window.location.href = '/index.html'; return; }

    const conversationsList = document.getElementById('conversations-list');
    const chatPanel = document.getElementById('chat-panel');
    const chatHeader = document.getElementById('chat-header');
    const chatPartnerAvatar = document.getElementById('chat-partner-avatar');
    const chatPartnerUsername = document.getElementById('chat-partner-username');
    const messagesArea = document.getElementById('messages-area');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const backToConversationsBtn = document.getElementById('back-to-conversations');

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
        if (message.sender_id === activeChatUserId) appendMessage(message);
        loadConversations();
    });

    const loadConversations = async () => {
        try {
            const response = await fetchWithAuth('/api/chats');
            if (!response.ok) throw new Error('No se pudieron cargar las conversaciones.');
            allConversations = await response.json();
            renderConversations(allConversations);
        } catch (error) { console.error('Error cargando conversaciones:', error); }
    };
    
    const loadMessages = async (otherUser) => {
        activeChatUserId = otherUser.id;
        chatPanel.classList.add('active'); // Para vista en móviles
        messagesArea.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
        
        chatPartnerAvatar.src = otherUser.profile_picture_url || '/static/img/placeholder-default.jpg';
        chatPartnerUsername.textContent = otherUser.username;
        chatHeader.style.display = 'flex';
        messageForm.style.display = 'flex';
        
        document.querySelectorAll('.conversation-item-v3.active').forEach(el => el.classList.remove('active'));
        const partnerEl = document.querySelector(`.conversation-item-v3[data-user-id="${otherUser.id}"]`);
        if (partnerEl) partnerEl.classList.add('active');

        const response = await fetchWithAuth(`/api/chats/${otherUser.id}`);
        const messages = await response.json();
        renderMessages(messages);
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
        let lastSenderId = null;
        messages.forEach(msg => {
            const showHeader = msg.sender_id !== lastSenderId;
            appendMessage(msg, showHeader);
            lastSenderId = msg.sender_id;
        });
        scrollToBottom();
    };
    
    const appendMessage = (message, showHeader = true) => {
        const welcome = messagesArea.querySelector('.chat-welcome');
        if (welcome) welcome.remove();
        
        const isSent = message.sender_id === currentUserId;
        const sender = isSent ? null : allConversations.find(c => c.other_user.id === message.sender_id)?.other_user;
        const senderName = isSent ? 'Tú' : (sender?.username || 'Usuario');
        const senderAvatar = isSent ? '' : (sender?.profile_picture_url || '/static/img/placeholder-default.jpg');

        const lastMessage = messagesArea.lastElementChild;
        if (lastMessage && lastMessage.dataset.senderId == message.sender_id) {
            showHeader = false;
        }

        const messageEl = document.createElement('div');
        messageEl.classList.add('message-group');
        if (!showHeader) messageEl.classList.add('compact');
        messageEl.dataset.senderId = message.sender_id;

        if (showHeader) {
            messageEl.innerHTML = `
                <img src="${senderAvatar}" alt="avatar" class="message-avatar">
                <div class="message-body">
                    <div class="message-sender">${senderName}</div>
                    <div class="message-text">${message.content}</div>
                </div>
                <div class="message-actions"><i class="fas fa-ellipsis-h"></i></div>`;
        } else {
            messageEl.innerHTML = `<div class="message-body"><div class="message-text">${message.content}</div></div><div class="message-actions"><i class="fas fa-ellipsis-h"></i></div>`;
        }
        messagesArea.appendChild(messageEl);
        scrollToBottom();
    };

    const scrollToBottom = () => { messagesArea.scrollTop = messagesArea.scrollHeight; };
    
    const sendMessage = () => {
        const content = messageInput.innerText.trim();
        if (content && activeChatUserId) {
            socket.emit('private_message', { token, recipient_id: activeChatUserId, content });
            appendMessage({ sender_id: currentUserId, content, created_at: new Date().toISOString() });
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
        const target = e.target.closest('.conversation-item-v3');
        if (target) {
            const userId = parseInt(target.dataset.userId, 10);
            const convo = allConversations.find(c => c.other_user.id === userId);
            if(convo) loadMessages(convo.other_user);
        }
    });

    backToConversationsBtn.addEventListener('click', () => {
        chatPanel.classList.remove('active');
    });

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
