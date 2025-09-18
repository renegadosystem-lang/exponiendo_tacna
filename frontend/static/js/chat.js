// /static/js/chat.js (Versión para Navegación de 2 Vistas)

document.addEventListener('DOMContentLoaded', () => {
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

    const socket = io(window.backendUrl);
    socket.on('connect', () => socket.emit('authenticate', { token }));
    socket.on('new_message', (message) => {
        if (message.sender_id === activeChatUserId) {
            appendMessage(message);
        }
        loadConversations();
    });

    // --- Lógica de Navegación entre Vistas ---
    const showView = (viewName) => {
        conversationsView.classList.remove('active');
        messagesView.classList.remove('active');
        if (viewName === 'messages') {
            messagesView.classList.add('active');
        } else {
            conversationsView.classList.add('active');
        }
    };

    const loadConversations = async () => { /* ... (igual que antes) ... */ };
    
    const loadMessages = async (otherUser) => {
        activeChatUserId = otherUser.id;
        showView('messages'); // <-- Cambia a la vista de mensajes
        
        // ... (resto de la lógica de carga de mensajes es igual) ...
    };
    
    const renderConversations = (conversations) => { /* ... (igual que antes) ... */ };
    const renderMessages = (messages) => { /* ... (igual que antes) ... */ };
    const appendMessage = (message) => { /* ... (igual que antes) ... */ };
    const createMessageBubble = (msg, isGrouped) => { /* ... (igual que antes) ... */ };
    const scrollToBottom = () => { /* ... (igual que antes) ... */ };
    const sendMessage = () => { /* ... (igual que antes) ... */ };

    // --- Event Listeners ---
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
            if(convo) {
                // Actualiza la URL para poder recargar la página en un chat
                history.pushState(null, '', `/chat.html?with=${convo.other_user.id}`);
                loadMessages(convo.other_user);
            }
        }
    });

    backToConversationsBtn.addEventListener('click', () => {
        activeChatUserId = null;
        history.pushState(null, '', '/chat.html');
        showView('conversations');
    });

    document.addEventListener('startChat', (e) => loadMessages(e.detail));

    // --- Inicialización ---
    const checkUrlForChat = () => {
        const params = new URLSearchParams(window.location.search);
        const userId = params.get('with');
        if (userId) {
            // Necesitamos los datos del usuario. La forma más robusta es buscarlos en la lista de conversaciones.
            // Si la lista no ha cargado, esperamos un poco.
            const findUserAndLoad = () => {
                const convo = allConversations.find(c => c.other_user.id == userId);
                if (convo) {
                    loadMessages(convo.other_user);
                } else {
                    // Si vienes de un "deep link" (ej. desde un perfil), la conversación puede no existir aún
                    // Aquí se necesitaría una llamada a /api/profiles/<username> para obtener los datos.
                    // Por ahora, lo dejamos simple y solo funciona para chats existentes.
                }
            };

            if (allConversations.length > 0) {
                findUserAndLoad();
            } else {
                setTimeout(findUserAndLoad, 500); // Esperar a que carguen las conversaciones
            }
        } else {
            showView('conversations');
        }
    };

    loadConversations().then(() => {
        checkUrlForChat();
    });
});
