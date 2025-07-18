// socket.js - Socket.io client setup

import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

// Socket.io connection URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Create socket instance
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Custom hook for using socket.io
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [rooms, setRooms] = useState(['general']);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [readReceipts, setReadReceipts] = useState({}); // { messageId: Set of userIds }
  const [reactions, setReactions] = useState({}); // { messageId: { emoji: [userIds] } }
  const [connectionError, setConnectionError] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);

  // Connect to socket server
  const connect = (username) => {
    socket.connect();
    if (username) {
      socket.emit('user_join', username);
    }
  };

  // Disconnect from socket server
  const disconnect = () => {
    socket.disconnect();
  };

  // Send a message
  const sendMessage = (message) => {
    socket.emit('send_message', { message });
  };

  // Send a private message
  const sendPrivateMessage = (to, message) => {
    socket.emit('private_message', { to, message });
  };

  // Set typing status
  const setTyping = (isTyping) => {
    socket.emit('typing', isTyping);
  };

  // Create a new room
  const createRoom = (roomName) => {
    socket.emit('create_room', roomName);
  };

  // Join a room
  const joinRoom = (roomName) => {
    setCurrentRoom(roomName);
    socket.emit('join_room', roomName);
  };

  // Emit message_read event
  const markMessageRead = (message, currentUserId, currentRoom, isPrivate, otherUserId) => {
    if (!message || !currentUserId) return;
    socket.emit('message_read', {
      messageId: message.id,
      room: currentRoom,
      isPrivate,
      otherUserId,
    });
  };

  // Add a reaction to a message
  const addReaction = (message, emoji, currentRoom, isPrivate, otherUserId) => {
    if (!message || !emoji) return;
    socket.emit('add_reaction', {
      messageId: message.id,
      emoji,
      room: currentRoom,
      isPrivate,
      otherUserId,
    });
  };

  // Fetch paginated messages for a room
  const fetchMessages = async (room, before, limit = 20) => {
    const params = new URLSearchParams({ room, limit });
    if (before) params.append('before', before);
    const res = await fetch(`/api/messages?${params.toString()}`);
    const data = await res.json();
    return data;
  };

  // Socket event listeners
  useEffect(() => {
    // Connection events
    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    // Message events
    const onReceiveMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
    };

    const onPrivateMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
    };

    // User events
    const onUserList = (userList) => {
      setUsers(userList);
    };

    const onUserJoined = (user) => {
      // You could add a system message here
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onUserLeft = (user) => {
      // You could add a system message here
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    // Typing events
    const onTypingUsers = (users) => {
      setTypingUsers(users);
    };

    // Room events
    const onRoomList = (roomList) => {
      setRooms(roomList);
    };

    // Read receipts
    const onMessageReadUpdate = ({ messageId, userId }) => {
      setReadReceipts(prev => {
        const set = new Set(prev[messageId] || []);
        set.add(userId);
        return { ...prev, [messageId]: set };
      });
    };

    // Reaction updates
    const onReactionUpdate = ({ messageId, reactions }) => {
      setReactions(prev => ({ ...prev, [messageId]: reactions }));
    };

    // Reconnection events
    const onReconnect = () => {
      setReconnecting(false);
      setConnectionError(null);
    };
    const onReconnectAttempt = () => {
      setReconnecting(true);
    };
    const onError = (err) => {
      setConnectionError(err.message || 'Connection error');
    };

    // Register event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receive_message', onReceiveMessage);
    socket.on('private_message', onPrivateMessage);
    socket.on('user_list', onUserList);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('typing_users', onTypingUsers);
    socket.on('room_list', onRoomList);
    socket.on('message_read_update', onMessageReadUpdate);
    socket.on('reaction_update', onReactionUpdate);
    socket.on('reconnect', onReconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('error', onError);

    // Clean up event listeners
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.off('private_message', onPrivateMessage);
      socket.off('user_list', onUserList);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('typing_users', onTypingUsers);
      socket.off('room_list', onRoomList);
      socket.off('message_read_update', onMessageReadUpdate);
      socket.off('reaction_update', onReactionUpdate);
      socket.off('reconnect', onReconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('error', onError);
    };
  }, []);

  return {
    socket,
    isConnected,
    lastMessage,
    messages,
    users,
    typingUsers,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    rooms,
    createRoom,
    joinRoom,
    currentRoom,
    readReceipts,
    markMessageRead,
    reactions,
    addReaction,
    fetchMessages,
    connectionError,
    reconnecting,
  };
};

export default socket; 