// /static/js/chat.js (Versión con Búsqueda Integrada)

document.addEventListener('DOMContentLoaded', () => {
    // Activamos los listeners globales de main.js
    window.initializeGlobalEventListeners();
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
    const newChatBtn = document.getElementById('new-chat-btn'); // El botón del lápiz

    let currentUserId = null;
    let activeChatUserId = null;
    let allConversations = [];
    
    try {
        currentUserId = parseInt(JSON.parse(atob(token.split('.')[1])).sub, 10);
    } catch (e) {
        window.location.href = '/index.html';
        return;
    }

    // --- NUEVA LÓGICA PARA BÚSQUEDA DE USUARIOS ---

    // HTML para la nueva vista de búsqueda
    const userSearchHTML = `
        <div id="user-search-view">
            <div class="user-search-header">
                <button id="back-to-convos-from-search" class="btn-back"><i class="fas fa-arrow-left"></i></button>
                <input type="text" id="user-search-input" placeholder="Buscar usuario para chatear..." autocomplete="off">
            </div>
            <div id="user-search-results">
                <p style="text-align:center; color: var(--text-muted); padding: 2rem;">Escribe un nombre para buscar.</p>
            </div>
        </div>
    `;
    // Inyectamos el HTML de la búsqueda dentro del panel de conversaciones
    conversationsView.insertAdjacentHTML('beforeend', userSearchHTML);

    const userSearchView = document.getElementById('user-search-view');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResults = document.getElementById('user-search-results');
    const backFromSearchBtn = document.getElementById('back-to-convos-from-search');
    let searchTimeout;

    // El lápiz ahora activa/desactiva la vista de búsqueda
    newChatBtn.addEventListener('click', () => {
        conversationsView.classList.add('is-searching');
        userSearchInput.focus();
    });

    // El botón de regreso en la búsqueda nos devuelve a la lista de chats
    backFromSearchBtn.addEventListener('click', () => {
        conversationsView.classList.remove('is-searching');
        userSearchInput.value = '';
        userSearchResults.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 2rem;">Escribe un nombre para buscar.</p>';
    });

    // Lógica de búsqueda en tiempo real
    userSearchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const query = userSearchInput.value.trim();
            if (query.length < 2) {
                userSearchResults.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 2rem;">Escribe al menos 2 letras.</p>';
                return;
            }
            const response = await fetchWithAuth(`/api/search?q=${query}`);
            const results = await response.json();
            renderUserSearchResults(results.users);
        }, 300);
    });

    function renderUserSearchResults(users) {
        if (!users || users.length === 0) {
            userSearchResults.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 2rem;">No se encontraron usuarios.</p>';
            return;
        }
        userSearchResults.innerHTML = users.map(user => `
            <div class="user-search-item" data-user-info='${JSON.stringify(user)}'>
                <img src="${user.profile_picture_url || '/static/img/placeholder-default.jpg'}" alt="${user.username}">
                <span>${user.username}</span>
            </div>
        `).join('');
    }

    // Event listener para iniciar chat desde los resultados de búsqueda
    userSearchResults.addEventListener('click', e => {
        const userItem = e.target.closest('.user-search-item');
        if (!userItem) return;

        const userInfo = JSON.parse(userItem.dataset.userInfo);
        
        // Ocultar la vista de búsqueda
        conversationsView.classList.remove('is-searching');
        userSearchInput.value = '';

        // Comprobar si ya existe una conversación con este usuario
        const existingConvo = allConversations.find(c => c.other_user.id === userInfo.id);

        if (existingConvo) {
            // Si ya existe, simplemente la abrimos
            loadMessages(existingConvo.other_user);
        } else {
            // Si no existe, creamos un objeto 'other_user' y abrimos un chat nuevo
            const newUserChat = {
                id: userInfo.id,
                username: userInfo.username,
                profile_picture_url: userInfo.profile_picture_url
            };
            loadMessages(newUserChat);
        }
    });


    // --- LÓGICA DE CHAT EXISTENTE (sin cambios) ---

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
        
        let sender, senderName, senderAvatar;
        if (isSent) {
            senderName = 'Tú';
            senderAvatar = localStorage.getItem('profile_picture_url') || '/static/img/placeholder-default.jpg';
        } else {
            sender = allConversations.find(c => c.other_user.id === message.sender_id)?.other_user;
            senderName = sender?.username || 'Usuario';
            senderAvatar = sender?.profile_picture_url || '/static/img/placeholder-default.jpg';
        }

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
