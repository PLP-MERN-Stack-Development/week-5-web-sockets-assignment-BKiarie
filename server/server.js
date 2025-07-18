// server.js - Main server file for Socket.io chat application

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For development only; restrict in production
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Store connected users, typing users, rooms, and message reads
const users = {};
const typingUsers = {};
const rooms = { general: { name: 'general', users: [] } };
const messageReads = {}; // { messageId: Set of userIds }
const messageReactions = {}; // { messageId: { emoji: Set of userIds } }
const messagesByRoom = { general: [] }; // { room: [message, ...] }
const MAX_MESSAGES = 100;

// Set up multer for file uploads
const uploadDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Ensure uploads directory exists
const fs = require('fs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  const { room, to, senderId, isPrivate } = req.body;
  const fileUrl = `/uploads/${req.file.filename}`;
  const fileMessage = {
    id: Date.now(),
    sender: users[senderId]?.username || 'Anonymous',
    senderId,
    message: '',
    fileUrl,
    fileName: req.file.originalname,
    timestamp: new Date().toISOString(),
    room,
    isPrivate: isPrivate === 'true',
    receiverId: to || null,
  };
  if (isPrivate && to) {
    // Private file message
    io.to(to).emit('private_message', fileMessage);
    io.to(senderId).emit('private_message', fileMessage);
  } else if (room) {
    // Room file message
    io.to(room).emit('receive_message', fileMessage);
  }
  res.json({ success: true, fileUrl, fileMessage });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining
  socket.on('user_join', (username) => {
    users[socket.id] = { username, id: socket.id, room: 'general' };
    socket.join('general');
    rooms['general'].users.push(socket.id);
    io.emit('user_list', Object.values(users));
    io.emit('user_joined', { username, id: socket.id });
    io.emit('room_list', Object.keys(rooms));
    console.log(`${username} joined the chat`);
  });

  // Handle room creation
  socket.on('create_room', (roomName) => {
    if (!rooms[roomName]) {
      rooms[roomName] = { name: roomName, users: [] };
      io.emit('room_list', Object.keys(rooms));
    }
  });

  // Handle joining a room
  socket.on('join_room', (roomName) => {
    const user = users[socket.id];
    if (!user) return;
    const prevRoom = user.room;
    if (prevRoom && rooms[prevRoom]) {
      socket.leave(prevRoom);
      rooms[prevRoom].users = rooms[prevRoom].users.filter(id => id !== socket.id);
    }
    user.room = roomName;
    socket.join(roomName);
    if (!rooms[roomName]) rooms[roomName] = { name: roomName, users: [] };
    rooms[roomName].users.push(socket.id);
    io.emit('user_list', Object.values(users));
    io.emit('room_list', Object.keys(rooms));
  });

  // Handle chat messages (room-specific)
  socket.on('send_message', (data) => {
    const user = users[socket.id];
    const room = user?.room || 'general';
    const message = {
      id: Date.now(),
      sender: user?.username || 'Anonymous',
      senderId: socket.id,
      message: data.message,
      timestamp: new Date().toISOString(),
      room,
    };
    if (!messagesByRoom[room]) messagesByRoom[room] = [];
    messagesByRoom[room].push(message);
    if (messagesByRoom[room].length > MAX_MESSAGES) {
      messagesByRoom[room].shift();
    }
    io.to(room).emit('receive_message', message);
  });

  // Handle private messages (unchanged)
  socket.on('private_message', ({ to, message }) => {
    const senderUser = users[socket.id];
    const receiverUser = users[to];
    if (!senderUser || !receiverUser) return;
    const messageData = {
      id: Date.now(),
      sender: senderUser.username,
      senderId: socket.id,
      receiver: receiverUser.username,
      receiverId: to,
      message,
      timestamp: new Date().toISOString(),
      isPrivate: true,
    };
    socket.to(to).emit('private_message', messageData);
    socket.emit('private_message', messageData);
  });

  // Handle typing indicator (room-specific)
  socket.on('typing', (isTyping) => {
    const user = users[socket.id];
    if (user) {
      const room = user.room || 'general';
      const username = user.username;
      if (isTyping) {
        if (!typingUsers[room]) typingUsers[room] = {};
        typingUsers[room][socket.id] = username;
      } else if (typingUsers[room]) {
        delete typingUsers[room][socket.id];
      }
      io.to(room).emit('typing_users', Object.values(typingUsers[room] || {}));
    }
  });

  // Handle message read receipts
  socket.on('message_read', ({ messageId, room, isPrivate, otherUserId }) => {
    if (!messageId) return;
    if (!messageReads[messageId]) messageReads[messageId] = new Set();
    messageReads[messageId].add(socket.id);
    // Broadcast read status to room or private user
    if (isPrivate && otherUserId) {
      // Notify both users
      io.to(otherUserId).emit('message_read_update', { messageId, userId: socket.id });
      socket.emit('message_read_update', { messageId, userId: socket.id });
    } else if (room) {
      io.to(room).emit('message_read_update', { messageId, userId: socket.id });
    }
  });

  // Handle message reactions
  socket.on('add_reaction', ({ messageId, emoji, room, isPrivate, otherUserId }) => {
    if (!messageId || !emoji) return;
    if (!messageReactions[messageId]) messageReactions[messageId] = {};
    if (!messageReactions[messageId][emoji]) messageReactions[messageId][emoji] = new Set();
    messageReactions[messageId][emoji].add(socket.id);
    // Broadcast reaction update
    const reactionData = {
      messageId,
      emoji,
      userId: socket.id,
      reactions: Object.fromEntries(
        Object.entries(messageReactions[messageId]).map(([k, v]) => [k, Array.from(v)])
      ),
    };
    if (isPrivate && otherUserId) {
      io.to(otherUserId).emit('reaction_update', reactionData);
      socket.emit('reaction_update', reactionData);
    } else if (room) {
      io.to(room).emit('reaction_update', reactionData);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      const { username, room } = user;
      io.emit('user_left', { username, id: socket.id });
      if (room && rooms[room]) {
        rooms[room].users = rooms[room].users.filter(id => id !== socket.id);
      }
      if (room && typingUsers[room]) {
        delete typingUsers[room][socket.id];
        io.to(room).emit('typing_users', Object.values(typingUsers[room] || {}));
      }
    }
    delete users[socket.id];
    io.emit('user_list', Object.values(users));
    io.emit('room_list', Object.keys(rooms));
    console.log(`User disconnected: ${socket.id}`);
  });
});

// API endpoint for message pagination
app.get('/api/messages', (req, res) => {
  const { room = 'general', before, limit = 20 } = req.query;
  let msgs = messagesByRoom[room] || [];
  if (before) {
    msgs = msgs.filter(m => new Date(m.timestamp) < new Date(before));
  }
  msgs = msgs.slice(-limit);
  res.json(msgs);
});

app.get('/', (req, res) => {
  res.send('Server is running');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
}); 