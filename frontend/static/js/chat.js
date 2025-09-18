// /static/js/chat.js (Versión para el Nuevo Rediseño)

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
        localStorage.clear();
        window.location.href = '/index.html';
        return;
    }

    const socket = io(window.backendUrl);

    socket.on('connect', () => {
        socket.emit('authenticate', { token });
    });

    socket.on('new_message', (message) => {
        if (message.sender_id === activeChatUserId && message.recipient_id === currentUserId) {
            appendMessage(message, false); // false = no es un mensaje propio
        }
        loadConversations();
    });

    const loadConversations = async () => { /* ... (Sin cambios significativos) ... */ };
    const loadMessages = async (otherUser) => { /* ... (Sin cambios significativos) ... */ };
    const renderConversations = (conversations) => { /* ... (Sin cambios significativos) ... */ };

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
    
    const appendMessage = (message, isOwnMessage) => {
        const welcomeMessage = messagesArea.querySelector('.chat-welcome');
        if (welcomeMessage) welcomeMessage.remove();

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
        const content = messageInput.innerHTML.trim(); // Usamos innerHTML para el div editable
        if (content && activeChatUserId) {
            const messagePayload = { token, recipient_id: activeChatUserId, content };
            socket.emit('private_message', messagePayload);
            appendMessage({
                sender_id: currentUserId,
                content: content,
                created_at: new Date().toISOString()
            }, true);
            messageInput.innerHTML = '';
            messageInput.focus();
        }
    };

    // Event Listeners para el nuevo diseño
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    conversationsList.addEventListener('click', (e) => { /* ... (Sin cambios significativos) ... */ });
    searchInput.addEventListener('input', () => renderConversations(allConversations));
    document.addEventListener('startChat', (e) => loadMessages(e.detail));

    function checkDeepLink() { /* ... (Sin cambios) ... */ }

    loadConversations();
    checkDeepLink();
});
