# ✍️ AuraBlog

A modern full-stack blogging platform built with **Node.js**, **Express.js**, **SQLite**, and **Vanilla JavaScript**. Users can create accounts, publish blog posts, manage content, and interact through comments in a clean and responsive interface.

---

## 🚀 Features

### 🔐 Authentication
- User Registration
- User Login
- Session Management
- Protected Routes

### 📝 Blog Management
- Create Posts
- Read Posts
- Update Posts
- Delete Posts
- View Individual Articles

### 💬 Comments System
- Add Comments
- View Comments
- User Interaction

### 🎨 User Interface
- Responsive Design
- Single Page Application (SPA)
- Modern UI
- Smooth Navigation
- Mobile Friendly

---

## 🛠️ Tech Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript

### Backend
- Node.js
- Express.js

### Database
- SQLite

### Tools
- Git
- GitHub
- npm

---

## 📂 Project Structure

```bash
AuraBlog/
│
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── database.js
├── server.js
├── blog.db
├── package.json
└── README.md
```

---

## ⚙️ Installation

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/AuraBlog.git
```

### 2️⃣ Navigate to Project Directory

```bash
cd AuraBlog
```

### 3️⃣ Install Dependencies

```bash
npm install
```

### 4️⃣ Start the Server

```bash
node server.js
```

or

```bash
npm run dev
```

---

## 🌐 API Endpoints

### Authentication

| Method | Endpoint | Description |
|----------|----------|-------------|
| POST | /api/register | Register User |
| POST | /api/login | Login User |

### Posts

| Method | Endpoint | Description |
|----------|----------|-------------|
| GET | /api/posts | Get All Posts |
| GET | /api/posts/:id | Get Single Post |
| POST | /api/posts | Create Post |
| PUT | /api/posts/:id | Update Post |
| DELETE | /api/posts/:id | Delete Post |

### Comments

| Method | Endpoint | Description |
|----------|----------|-------------|
| GET | /api/posts/:id/comments | Get Comments |
| POST | /api/posts/:id/comments | Add Comment |

---

## 📸 Screenshots

Add screenshots of:
- Home Page
- Login Page
- Dashboard
- Blog Editor
- Comment Section

---

## 🎯 Learning Outcomes

This project demonstrates:

- REST API Development
- Authentication & Authorization
- Database Design
- CRUD Operations
- Full-Stack Development
- SPA Architecture
- Client-Server Communication

---

## 🔮 Future Enhancements

- Rich Text Editor
- User Profiles
- Dark Mode
- Categories & Tags
- Search Functionality
- Image Uploads
- Like & Bookmark System
- JWT Authentication
- Deployment Support

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**Ayush Raj**

- GitHub: https://github.com/ayushraaj-01
- LinkedIn: https://linkedin.com/in/ayushraaj01

⭐ If you found this project useful, consider giving it a star!
