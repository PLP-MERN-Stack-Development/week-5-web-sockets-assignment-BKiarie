import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from './socket/socket';

// Notification sound
const notificationSound = new Audio('https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa1b82.mp3');

function App() {
  const [username, setUsername] = useState('');
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeChat, setActiveChat] = useState({ type: 'global' }); // {type: 'global'} or {type: 'private', user: {id, username}}
  const [newRoom, setNewRoom] = useState('');
  const [file, setFile] = useState(null);
  const messageEndRef = useRef(null);
  const [unreadCounts, setUnreadCounts] = useState({}); // { roomOrUserId: count }
  const [windowFocused, setWindowFocused] = useState(true);
  const [showBanner, setShowBanner] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const {
    isConnected,
    connect,
    disconnect,
    messages,
    users,
    typingUsers,
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
  } = useSocket();

  useEffect(() => {
    if (username) {
      connect(username);
      return () => disconnect();
    }
    // eslint-disable-next-line
  }, [username]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeChat]);

  // Typing indicator logic
  useEffect(() => {
    if (!username) return;
    if (isTyping) {
      setTyping(true);
      const timeout = setTimeout(() => {
        setTyping(false);
        setTyping(false);
      }, 1500);
      return () => clearTimeout(timeout);
    } else {
      setTyping(false);
    }
    // eslint-disable-next-line
  }, [isTyping]);

  // Helper to get userId (socket.id) for this client
  const [userId, setUserId] = useState(null);
  useEffect(() => {
    if (window && window.localStorage) {
      setUserId(socket.id);
    }
  }, [isConnected]);

  // Mark messages as read when displayed
  useEffect(() => {
    filteredMessages.forEach(msg => {
      if (!msg.isPrivate && activeChat.type === 'global') {
        markMessageRead(msg, socket.id, currentRoom, false, null);
      } else if (msg.isPrivate && activeChat.type === 'private') {
        const otherUserId = activeChat.user.id;
        markMessageRead(msg, socket.id, null, true, otherUserId);
      }
    });
    // eslint-disable-next-line
  }, [filteredMessages, activeChat, currentRoom]);

  // Handle new message notifications
  useEffect(() => {
    if (!messages.length) return;
    const lastMsg = messages[messages.length - 1];
    // Only notify if not from self
    if (lastMsg.sender === username) return;
    // Determine chat key
    let key = 'global';
    if (lastMsg.isPrivate) {
      key = lastMsg.senderId;
    } else if (lastMsg.room) {
      key = lastMsg.room;
    }
    // If not in active chat or window not focused, notify
    const isActive = (activeChat.type === 'global' && !lastMsg.isPrivate && currentRoom === (lastMsg.room || 'general')) ||
      (activeChat.type === 'private' && lastMsg.isPrivate && activeChat.user.id === lastMsg.senderId);
    if (!isActive || !windowFocused) {
      // In-app banner
      setShowBanner({
        text: lastMsg.isPrivate ? `New private message from ${lastMsg.sender}` : `New message in #${lastMsg.room || 'general'} from ${lastMsg.sender}`,
      });
      setTimeout(() => setShowBanner(null), 3000);
      // Sound
      notificationSound.play();
      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New message', {
          body: lastMsg.isPrivate ? `From ${lastMsg.sender}` : `In #${lastMsg.room || 'general'}: ${lastMsg.sender}: ${lastMsg.message}`,
        });
      }
      // Unread count
      setUnreadCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    }
    // Reset unread count if user is viewing
    if (isActive && windowFocused) {
      setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
    }
    // eslint-disable-next-line
  }, [messages]);

  // Reset unread count when switching chats
  useEffect(() => {
    let key = 'global';
    if (activeChat.type === 'private') {
      key = activeChat.user.id;
    } else if (activeChat.type === 'global') {
      key = currentRoom;
    }
    setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
    // eslint-disable-next-line
  }, [activeChat, currentRoom, windowFocused]);

  // Load latest messages on room entry
  useEffect(() => {
    if (activeChat.type === 'global') {
      (async () => {
        setLoadingOlder(true);
        const msgs = await fetchMessages(currentRoom, null, 20);
        setMessages(msgs);
        setHasMore(msgs.length === 20);
        setLoadingOlder(false);
      })();
    }
    // eslint-disable-next-line
  }, [currentRoom]);

  // Load older messages
  const loadOlderMessages = async () => {
    if (filteredMessages.length === 0) return;
    setLoadingOlder(true);
    const oldest = filteredMessages[0];
    const older = await fetchMessages(currentRoom, oldest.timestamp, 20);
    if (older.length > 0) {
      setMessages(prev => [...older, ...prev]);
    }
    setHasMore(older.length === 20);
    setLoadingOlder(false);
  };

  // Helper to display read receipts
  function ReadReceipt({ msg }) {
    const readers = readReceipts[msg.id] ? Array.from(readReceipts[msg.id]) : [];
    const otherUsers = users.filter(u => u.id !== socket.id);
    const seenBy = readers.filter(id => id !== socket.id && otherUsers.some(u => u.id === id));
    if (seenBy.length === 0) return null;
    if (seenBy.length === 1) {
      const user = users.find(u => u.id === seenBy[0]);
      return <span style={{ color: '#1976d2', fontSize: 12, marginLeft: 8 }}>✓ Seen by {user?.username || 'user'}</span>;
    }
    return <span style={{ color: '#1976d2', fontSize: 12, marginLeft: 8 }}>✓ Seen by {seenBy.length} users</span>;
  }

  // Reaction emojis
  const reactionEmojis = ['👍', '❤️', '😂', '🎉', '😮', '😢'];

  // Helper to handle reaction click
  const handleReaction = (msg, emoji) => {
    if (activeChat.type === 'global') {
      addReaction(msg, emoji, currentRoom, false, null);
    } else if (activeChat.type === 'private') {
      addReaction(msg, emoji, null, true, activeChat.user.id);
    }
  };

  // Helper to display reactions for a message
  function MessageReactions({ msg }) {
    const msgReactions = reactions[msg.id] || {};
    return (
      <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
        {Object.entries(msgReactions).map(([emoji, userIds]) => (
          <span key={emoji} style={{ fontSize: 18, cursor: 'pointer', background: '#eee', borderRadius: 8, padding: '2px 6px' }}>
            {emoji} {userIds.length}
          </span>
        ))}
        {reactionEmojis.map(emoji => (
          <button
            key={emoji}
            type="button"
            style={{ fontSize: 16, marginLeft: 2, background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', padding: '2px 6px' }}
            onClick={() => handleReaction(msg, emoji)}
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  }

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      setUsername(input.trim());
    }
  };

  const handleMessageChange = (e) => {
    setMessage(e.target.value);
    setIsTyping(true);
  };

  // Handle file input change
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // Handle file upload and send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('senderId', socket.id);
      if (activeChat.type === 'global') {
        formData.append('room', currentRoom);
        formData.append('isPrivate', 'false');
      } else if (activeChat.type === 'private') {
        formData.append('to', activeChat.user.id);
        formData.append('isPrivate', 'true');
      }
      try {
        await fetch('/upload', {
          method: 'POST',
          body: formData,
        });
      } catch (err) {
        alert('File upload failed');
      }
      setFile(null);
      return;
    }
    if (!message.trim()) return;
    if (activeChat.type === 'global') {
      sendMessage({ message: message.trim(), sender: username });
    } else if (activeChat.type === 'private') {
      sendPrivateMessage(activeChat.user.id, message.trim());
    }
    setMessage('');
    setIsTyping(false);
  };

  // Filter messages for the current chat
  const filteredMessages = messages.filter(msg => {
    if (activeChat.type === 'global') {
      return !msg.isPrivate && (msg.room === currentRoom || (!msg.room && currentRoom === 'general'));
    } else if (activeChat.type === 'private') {
      return (
        msg.isPrivate &&
        ((msg.senderId === activeChat.user.id && msg.sender === activeChat.user.username && msg.receiverId === username) ||
         (msg.sender === username && msg.receiverId === activeChat.user.id))
      );
    }
    return false;
  });

  // Handle room creation
  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (newRoom.trim() && !rooms.includes(newRoom.trim())) {
      createRoom(newRoom.trim());
      setNewRoom('');
    }
  };

  // Handle room join
  const handleJoinRoom = (room) => {
    setActiveChat({ type: 'global' });
    joinRoom(room);
  };

  // Track window focus
  useEffect(() => {
    const onFocus = () => setWindowFocused(true);
    const onBlur = () => setWindowFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      {(showBanner || reconnecting || connectionError) && (
        <div style={{ background: reconnecting ? '#ffa726' : connectionError ? '#d32f2f' : '#1976d2', color: 'white', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'center', fontWeight: 'bold' }}>
          {showBanner?.text}
          {reconnecting && <span>Reconnecting to server...</span>}
          {connectionError && <span>{connectionError}</span>}
        </div>
      )}
      <h1>Socket.io Chat App</h1>
      {!username ? (
        <form onSubmit={handleUsernameSubmit} style={{ marginBottom: 24 }}>
          <label>
            Enter your username:{' '}
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              autoFocus
              required
            />
          </label>
          <button type="submit" style={{ marginLeft: 8 }}>Join</button>
        </form>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <span>Username: <strong>{username}</strong></span>
        </div>
      )}
      <p>Status: <strong style={{ color: isConnected ? 'green' : 'red' }}>{isConnected ? 'Connected' : 'Disconnected'}</strong></p>
      {username && (
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Rooms List */}
          <div style={{ minWidth: 180, marginRight: 16 }}>
            <h3>Rooms</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {rooms.map(room => (
                <li
                  key={room}
                  style={{ fontWeight: currentRoom === room ? 'bold' : 'normal', cursor: 'pointer', marginBottom: 8, position: 'relative' }}
                  onClick={() => handleJoinRoom(room)}
                >
                  {room === 'general' ? '🌐 General' : `# ${room}`}
                  {unreadCounts[room] > 0 && (
                    <span style={{ background: 'red', color: 'white', borderRadius: '50%', fontSize: 12, padding: '2px 6px', marginLeft: 8, position: 'absolute', right: -30, top: 0 }}>{unreadCounts[room]}</span>
                  )}
                </li>
              ))}
            </ul>
            <form onSubmit={handleCreateRoom} style={{ marginTop: 12 }}>
              <input
                type="text"
                value={newRoom}
                onChange={e => setNewRoom(e.target.value)}
                placeholder="New room name"
                style={{ width: '100%', padding: 4 }}
                disabled={!isConnected}
              />
              <button type="submit" style={{ width: '100%', marginTop: 4 }} disabled={!isConnected || !newRoom.trim() || rooms.includes(newRoom.trim())}>
                Create Room
              </button>
            </form>
          </div>
          {/* Online Users */}
          <div style={{ minWidth: 160 }}>
            <h3>Online Users</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li
                style={{ fontWeight: activeChat.type === 'global' ? 'bold' : 'normal', cursor: 'pointer', marginBottom: 8 }}
                onClick={() => setActiveChat({ type: 'global' })}
              >
                🌐 Global Chat
                {unreadCounts['global'] > 0 && (
                  <span style={{ background: 'red', color: 'white', borderRadius: '50%', fontSize: 12, padding: '2px 6px', marginLeft: 8 }}>{unreadCounts['global']}</span>
                )}
              </li>
              {users.filter(u => u.username !== username).map((user) => (
                <li
                  key={user.id}
                  style={{ fontWeight: activeChat.type === 'private' && activeChat.user.id === user.id ? 'bold' : 'normal', cursor: 'pointer', marginBottom: 8, position: 'relative' }}
                  onClick={() => setActiveChat({ type: 'private', user })}
                >
                  💬 {user.username}
                  {unreadCounts[user.id] > 0 && (
                    <span style={{ background: 'red', color: 'white', borderRadius: '50%', fontSize: 12, padding: '2px 6px', marginLeft: 8, position: 'absolute', right: -30, top: 0 }}>{unreadCounts[user.id]}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {/* Chat Area */}
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 8 }}>
              <strong>
                {activeChat.type === 'global'
                  ? (currentRoom === 'general' ? '🌐 General Room' : `# ${currentRoom}`)
                  : `💬 Private Chat with ${activeChat.user.username}`}
              </strong>
            </div>
            <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, height: 350, overflowY: 'auto', background: '#fafafa', position: 'relative' }}>
              {activeChat.type === 'global' && hasMore && (
                <button onClick={loadOlderMessages} disabled={loadingOlder} style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 1 }}>
                  {loadingOlder ? 'Loading...' : 'Load older messages'}
                </button>
              )}
              {filteredMessages.length === 0 && (
                <div style={{ color: '#888', fontStyle: 'italic' }}>No messages yet.</div>
              )}
              {filteredMessages.map((msg) => (
                <div key={msg.id || Math.random()} style={{ marginBottom: 12 }}>
                  {msg.system ? (
                    <div style={{ color: '#888', fontStyle: 'italic' }}>{msg.message}</div>
                  ) : (
                    <>
                      <span style={{ fontWeight: 'bold', color: msg.sender === username ? '#1976d2' : '#333' }}>{msg.sender}</span>
                      <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
                      </span>
                      <ReadReceipt msg={msg} />
                      <div style={{ marginLeft: 8 }}>{msg.message}</div>
                      {msg.fileUrl && <FileMessage fileUrl={msg.fileUrl} fileName={msg.fileName} />}
                      <MessageReactions msg={msg} />
                    </>
                  )}
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>
            {/* Typing Indicator */}
            <div style={{ minHeight: 24, margin: '8px 0', color: '#888', fontStyle: 'italic' }}>
              {typingUsers.length > 0 && (
                <span>
                  {typingUsers.filter(u => u !== username).join(', ')}
                  {typingUsers.length === 1 ? ' is typing...' : ' are typing...'}
                </span>
              )}
            </div>
            {/* Message Input */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={message}
                onChange={handleMessageChange}
                onBlur={() => setIsTyping(false)}
                placeholder={activeChat.type === 'global' ? `Message #${currentRoom}` : `Message @${activeChat.user.username}`}
                style={{ flex: 1, padding: 8 }}
                disabled={!isConnected || !!file}
                required={!file}
              />
              <input
                type="file"
                onChange={handleFileChange}
                style={{ width: 140 }}
                disabled={!isConnected}
              />
              <button type="submit" disabled={!isConnected || (!message.trim() && !file)} style={{ padding: '0 16px' }}>
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to display file or image
function FileMessage({ fileUrl, fileName }) {
  const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName);
  if (isImage) {
    return <img src={fileUrl} alt={fileName} style={{ maxWidth: 200, maxHeight: 200, display: 'block', marginTop: 4 }} />;
  }
  return <a href={fileUrl} download={fileName} style={{ display: 'block', marginTop: 4 }}>{fileName}</a>;
}

export default App; 