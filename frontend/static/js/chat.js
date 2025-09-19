// /static/js/chat.js (Versión Final con Avatar Propio Corregido)

document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZACIÓN GLOBAL ---
    // Le decimos al motor principal que se active en esta página.
    const token = localStorage.getItem('accessToken');
    if (!token) { window.location.href = '/index.html'; return; }

    // --- Selectores del DOM ---
    const conversationsView = document.getElementById('conversations-view');
    const messagesView = document.getElementById('messages-view');
    const conversationsList = document.getElementById('conversations-list');
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

    // --- NUEVA LÓGICA DE USABILIDAD ---
    const deselectAllConversations = () => {
        document.querySelectorAll('.conversation-item-v3.active').forEach(el => {
            el.classList.remove('active');
        });
    };

    // Listener para deseleccionar al hacer clic afuera
    document.body.addEventListener('click', (e) => {
        // Si el clic NO fue dentro de la lista de conversaciones NI en el header del chat
        if (!e.target.closest('.conversations-panel-v3') && !e.target.closest('.chat-header-v3')) {
            deselectAllConversations();
        }
    });

    // Listener para deseleccionar con la tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            deselectAllConversations();
        }
    });
    
    const socket = io(window.backendUrl);
    socket.on('connect', () => socket.emit('authenticate', { token }));
    socket.on('new_message', (message) => {
        if (message.sender_id === activeChatUserId) appendMessage(message);
        loadConversations();
    });

    const showView = (viewName) => {
        if (viewName === 'messages') {
            conversationsView.classList.remove('active');
            messagesView.classList.add('active');
        } else {
            messagesView.classList.remove('active');
            conversationsView.classList.add('active');
        }
    };

    const loadConversations = async () => {
        try {
            const response = await fetchWithAuth('/api/chats');
            if (!response.ok) throw new Error('No se pudieron cargar las conversaciones.');
            allConversations = await response.json();
            renderConversations(allConversations);
        } catch (error) {
            console.error('Error cargando conversaciones:', error);
            conversationsList.innerHTML = '<p class="no-conversations">Error al cargar chats</p>';
        }
    };
    
    const loadMessages = async (otherUser) => {
        activeChatUserId = otherUser.id;
        showView('messages');
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
        if (conversations.length === 0) {
            conversationsList.innerHTML = '<p class="no-conversations">Inicia un nuevo chat</p>';
            return;
        }
        conversationsList.innerHTML = conversations.map(convo => {
            const lastMsg = convo.last_message;
            const lastMessageText = lastMsg.sender_id === currentUserId ? 'Tú: ' : '';
            return `
            <div class="conversation-item-v3 ${convo.other_user.id === activeChatUserId ? 'active' : ''}" data-user-id="${convo.other_user.id}">
                <img src="${convo.other_user.profile_picture_url || '/static/img/placeholder-default.jpg'}" alt="${convo.other_user.username}">
                <div class="conversation-info">
                    <h4>${convo.other_user.username}</h4>
                    <p class="last-message">${lastMessageText}${lastMsg.content}</p>
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
        
        // --- INICIO DE LA CORRECCIÓN ---
        let sender, senderName, senderAvatar;
        if (isSent) {
            senderName = 'Tú';
            // Leemos la URL de nuestra propia foto desde el localStorage
            senderAvatar = localStorage.getItem('profile_picture_url') || '/static/img/placeholder-default.jpg';
        } else {
            sender = allConversations.find(c => c.other_user.id === message.sender_id)?.other_user;
            senderName = sender?.username || 'Usuario';
            senderAvatar = sender?.profile_picture_url || '/static/img/placeholder-default.jpg';
        }
        // --- FIN DE LA CORRECCIÓN ---

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
                </div>`;
        } else {
            messageEl.innerHTML = `<div class="message-body compact-body"><div class="message-text">${message.content}</div></div>`;
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

    // --- Event Listeners ---
    if (sendMessageBtn) sendMessageBtn.addEventListener('click', sendMessage);
    if (messageInput) messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    if (conversationsList) conversationsList.addEventListener('click', (e) => {
        const target = e.target.closest('.conversation-item-v3');
        if (target) {
            const userId = parseInt(target.dataset.userId, 10);
            const convo = allConversations.find(c => c.other_user.id === userId);
            if(convo) {
                history.pushState(null, '', `/chat.html?with=${convo.other_user.id}`);
                loadMessages(convo.other_user);
            }
        }
    });

    if (backToConversationsBtn) backToConversationsBtn.addEventListener('click', () => {
        activeChatUserId = null;
        history.pushState(null, '', '/chat.html');
        showView('conversations');
    });

    document.addEventListener('startChat', (e) => loadMessages(e.detail));

    const checkUrl = () => {
        const params = new URLSearchParams(window.location.search);
        const userId = params.get('with');
        if (userId) {
            const findUserAndLoad = () => {
                const convo = allConversations.find(c => c.other_user.id == userId);
                if (convo) {
                    loadMessages(convo.other_user);
                } else {
                    showView('conversations');
                }
            };

            if (allConversations.length > 0) findUserAndLoad();
            else setTimeout(findUserAndLoad, 500);
        } else {
            showView('conversations');
        }
    };
    
    loadConversations().then(() => checkUrl());

});
