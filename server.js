const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'blog-platform-secret-key-12345';

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Session expired or invalid token. Please log in again.' });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Register User
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  // Check if username already exists
  const existingUser = db.queryOne('SELECT id FROM users WHERE username = ?', [trimmedUsername]);
  if (existingUser) {
    return res.status(400).json({ error: 'Username is already taken.' });
  }

  try {
    const saltRounds = 10;
    const passwordHash = bcrypt.hashSync(password, saltRounds);

    const result = db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [
      trimmedUsername,
      passwordHash
    ]);

    const userId = result.lastInsertRowid;
    const token = jwt.sign({ id: userId, username: trimmedUsername }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'Registration successful.',
      token,
      user: { id: userId, username: trimmedUsername }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'An error occurred during registration.' });
  }
});

// Login User
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = db.queryOne('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An error occurred during login.' });
  }
});

// Get Current User (token verification)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ==========================================
// BLOG POST ENDPOINTS
// ==========================================

// Get All Posts (with author username and comment counts)
app.get('/api/posts', (req, res) => {
  try {
    const posts = db.query(`
      SELECT p.id, p.title, p.content, p.created_at, p.updated_at, p.user_id, u.username as author,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    res.json(posts);
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.status(500).json({ error: 'An error occurred while fetching posts.' });
  }
});

// Get Single Post (with comments and author details)
app.get('/api/posts/:id', (req, res) => {
  const { id } = req.params;

  try {
    const post = db.queryOne(`
      SELECT p.id, p.title, p.content, p.created_at, p.updated_at, p.user_id, u.username as author
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [id]);

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    // Fetch comments
    const comments = db.query(`
      SELECT c.id, c.content, c.created_at, c.user_id, u.username as author
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `, [id]);

    res.json({
      post,
      comments
    });
  } catch (err) {
    console.error('Error fetching post:', err);
    res.status(500).json({ error: 'An error occurred while fetching the post.' });
  }
});

// Create Post (Requires Auth)
app.post('/api/posts', authenticateToken, (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  if (title.trim().length === 0 || content.trim().length === 0) {
    return res.status(400).json({ error: 'Title and content cannot be empty.' });
  }

  try {
    const result = db.run('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)', [
      req.user.id,
      title.trim(),
      content.trim()
    ]);

    const newPostId = result.lastInsertRowid;
    const post = db.queryOne(`
      SELECT p.id, p.title, p.content, p.created_at, p.updated_at, p.user_id, u.username as author
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [newPostId]);

    res.status(201).json({
      message: 'Post created successfully.',
      post
    });
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ error: 'An error occurred while creating the post.' });
  }
});

// Update Post (Requires Auth + Ownership)
app.put('/api/posts/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  try {
    const post = db.queryOne('SELECT * FROM posts WHERE id = ?', [id]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized. You can only edit your own posts.' });
    }

    db.run(
      'UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title.trim(), content.trim(), id]
    );

    const updatedPost = db.queryOne(`
      SELECT p.id, p.title, p.content, p.created_at, p.updated_at, p.user_id, u.username as author
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [id]);

    res.json({
      message: 'Post updated successfully.',
      post: updatedPost
    });
  } catch (err) {
    console.error('Error updating post:', err);
    res.status(500).json({ error: 'An error occurred while updating the post.' });
  }
});

// Delete Post (Requires Auth + Ownership)
app.delete('/api/posts/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    const post = db.queryOne('SELECT * FROM posts WHERE id = ?', [id]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized. You can only delete your own posts.' });
    }

    db.run('DELETE FROM posts WHERE id = ?', [id]);

    res.json({ message: 'Post deleted successfully.' });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ error: 'An error occurred while deleting the post.' });
  }
});

// ==========================================
// COMMENT ENDPOINTS
// ==========================================

// Add Comment (Requires Auth)
app.post('/api/posts/:id/comments', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Comment content is required.' });
  }

  try {
    // Check if post exists
    const post = db.queryOne('SELECT id FROM posts WHERE id = ?', [id]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const result = db.run('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [
      id,
      req.user.id,
      content.trim()
    ]);

    const newCommentId = result.lastInsertRowid;
    const comment = db.queryOne(`
      SELECT c.id, c.content, c.created_at, c.user_id, u.username as author
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [newCommentId]);

    res.status(201).json({
      message: 'Comment added successfully.',
      comment
    });
  } catch (err) {
    console.error('Error creating comment:', err);
    res.status(500).json({ error: 'An error occurred while adding the comment.' });
  }
});

// Delete Comment (Requires Auth + Comment Author or Post Author)
app.delete('/api/comments/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    const comment = db.queryOne('SELECT * FROM comments WHERE id = ?', [id]);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Retrieve post details to verify post owner status
    const post = db.queryOne('SELECT user_id FROM posts WHERE id = ?', [comment.post_id]);

    // Check if requester is comment author OR post author
    const isCommentOwner = comment.user_id === req.user.id;
    const isPostOwner = post && post.user_id === req.user.id;

    if (!isCommentOwner && !isPostOwner) {
      return res.status(403).json({ error: 'Unauthorized. You can only delete your own comments or comments on your own posts.' });
    }

    db.run('DELETE FROM comments WHERE id = ?', [id]);

    res.json({ message: 'Comment deleted successfully.' });
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ error: 'An error occurred while deleting the comment.' });
  }
});

// ==========================================
// START SERVER
// ==========================================

// Handle wildcard routing for frontend SPA structure (serves index.html for all non-API GET requests)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
