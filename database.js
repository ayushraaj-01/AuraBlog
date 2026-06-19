const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

// Initialize SQLite database stored in 'blog.db'
const dbPath = path.join(__dirname, 'blog.db');
const db = new DatabaseSync(dbPath);

// Enable foreign key constraints
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
function initDatabase() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create posts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Check if we need to seed the database (if no users exist)
  const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const userCount = userCountStmt.get().count;

  if (userCount === 0) {
    console.log('Seeding initial data into database...');
    
    // Create seed users
    const saltRounds = 10;
    const adminHash = bcrypt.hashSync('admin123', saltRounds);
    const janeHash = bcrypt.hashSync('jane123', saltRounds);

    const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    insertUser.run('admin', adminHash);
    insertUser.run('jane_doe', janeHash);

    // Get the generated user IDs
    const adminId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;
    const janeId = db.prepare('SELECT id FROM users WHERE username = ?').get('jane_doe').id;

    // Create seed posts
    const insertPost = db.prepare('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)');
    
    insertPost.run(
      adminId,
      'Welcome to our new Blog Platform! 🎉',
      `Welcome to our brand new **Blog Platform**. This is a full-stack web application designed to demonstrate a modern blogging experience with real-time comments, user registration, and a premium glassmorphic user interface.

### Features Included:
1. **User Authentication**: Secure registration and login using JWT (JSON Web Tokens) and bcrypt password hashing.
2. **Post Management**: Create, edit, and delete posts (with authorization checks ensuring only the author can modify them).
3. **Interactive Comments**: Engage with others via the commenting section.
4. **Markdown Support**: Render headings, bold text, lists, and code blocks inside posts for rich content formatting.
5. **Modern Theme**: Fluid dark/light theme switching with custom CSS properties.

Feel free to browse around, sign up, and leave a comment!`
    );

    insertPost.run(
      janeId,
      'Designing Beautiful & Premium User Interfaces 🎨',
      `Great design isn't just about how it looks, but how it works and feels. To make a web application feel truly premium, we should prioritize several visual details:

* **Tailored HSL Color Palettes**: Avoid generic browser primary colors. Instead, curate modern palettes with subtle variations.
* **Glassmorphism & Depth**: Combine \`backdrop-filter\`, semi-transparent backgrounds, and soft drop shadows to create a layered aesthetic.
* **Micro-animations**: Small details, like a scale transition on button hover or a glow ring around active inputs, draw users in.
* **Typography**: Import modern fonts like *Outfit* or *Inter* rather than standard system sans-serif.

What are your favorite UI/UX techniques? Let me know in the comments below!`
    );

    // Get post IDs
    const posts = db.prepare('SELECT id, user_id FROM posts').all();
    const post1 = posts.find(p => p.user_id === adminId);
    const post2 = posts.find(p => p.user_id === janeId);

    // Create seed comments
    const insertComment = db.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)');
    if (post1) {
      insertComment.run(post1.id, janeId, 'This is awesome! Love the glassmorphic style and transitions. 🌟');
      insertComment.run(post1.id, adminId, 'Thank you Jane! Glad you like the platform. Feel free to write some articles.');
    }
    if (post2) {
      insertComment.run(post2.id, adminId, 'Excellent design tips. HSL colors and custom transitions make a huge difference in feel!');
    }
    
    console.log('Database seeded successfully.');
  }
}

// Initialize tables and seed data
initDatabase();

// Export helper query methods
module.exports = {
  db,
  // Helper to query all (returns array)
  query(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },
  // Helper to query single row
  queryOne(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  },
  // Helper to run query (insert, update, delete)
  run(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  }
};
