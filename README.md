# Real-Time Chat Application with Socket.io

A full-featured real-time chat application built with **Node.js**, **Express**, **Socket.io**, and **React**. Supports global and private messaging, multiple chat rooms, file/image sharing, read receipts, message reactions, real-time notifications, and more.

---

## 🚀 Project Overview

This app demonstrates a modern, scalable chat platform with:
- Real-time bidirectional communication using Socket.io
- User authentication (username-based)
- Multiple chat rooms/channels
- Private messaging
- File and image sharing
- Typing indicators, read receipts, and message reactions
- Real-time notifications (in-app, sound, browser)
- Message pagination, reconnection logic, and responsive design

---

## 🛠️ Setup Instructions

### Prerequisites
- Node.js v18+ and npm

### 1. Clone the Repository
```sh
git clone <your-repo-url>
cd week-5-web-sockets-assignment-BKiarie
```

### 2. Install Server Dependencies
```sh
cd server
npm install
```

### 3. Install Client Dependencies
```sh
cd ../client
npm install
```

### 4. Start the Development Servers

**In one terminal:**
```sh
cd server
npm run dev
```

**In another terminal:**
```sh
cd client
npm run dev
```

### 5. Open the App
- Visit `http://localhost:3000` (or the port shown in your terminal) in your browser.

---

## ✨ Features Implemented

- [x] **User authentication** (username-based)
- [x] **Global chat room** and **multiple chat rooms/channels**
- [x] **Private messaging** between users
- [x] **File and image sharing** in any chat
- [x] **Typing indicators** (per room)
- [x] **Online/offline user status**
- [x] **Read receipts** for messages
- [x] **Message reactions** (like, love, etc.)
- [x] **Real-time notifications** (in-app, sound, browser)
- [x] **Unread message count** for rooms and private chats
- [x] **Message pagination** (load older messages)
- [x] **Reconnection logic** and error handling
- [x] **Responsive design** (works on desktop and mobile)

---

## 🖼️ Screenshots / GIFs

> _Add screenshots or GIFs here to showcase your app!_

- ![Chat Room Screenshot](./screenshots/chat-room.png)
- ![Private Messaging Screenshot](./screenshots/private-message.png)
- ![File Sharing Screenshot](./screenshots/file-sharing.png)

---

## 🌐 (Optional) Deployment

> _If deployed, add your URLs here:_

- Live App: [https://your-app-url.com](https://your-app-url.com)
- API Server: [https://your-api-url.com](https://your-api-url.com)

---

## 📖 How to Use

1. **Enter a username** to join the chat.
2. **Join or create rooms** from the sidebar.
3. **Send messages, files, or images** in any room or private chat.
4. **See who is online**, who is typing, and who has read your messages.
5. **React to messages** and enjoy real-time notifications.
6. **Load older messages** by clicking "Load older messages" at the top of the chat.

---

## 📚 Resources

- [Socket.io Documentation](https://socket.io/docs/v4/)
- [React Documentation](https://react.dev/)
- [Express.js Documentation](https://expressjs.com/)

--- 