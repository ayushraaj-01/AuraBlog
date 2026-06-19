// ==========================================================================
// STATE MANAGEMENT & CONFIG
// ==========================================================================
const API_BASE = '/api';
let state = {
  token: localStorage.getItem('token') || null,
  currentUser: null,
  posts: [],
  currentFilter: 'all', // 'all' or 'mine'
  searchQuery: ''
};

// ==========================================================================
// TOAST NOTIFICATION SYSTEM
// ==========================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let borderIconSvg = '';
  if (type === 'success') {
    borderIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    borderIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  } else {
    borderIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `
    <span class="toast-msg">${message}</span>
    <button class="toast-close" aria-label="Close message">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  // Close event listener
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => toast.remove(), 200);
  });

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(() => toast.remove(), 200);
    }
  }, 4000);
}

// ==========================================================================
// API CLIENT WRAPPER
// ==========================================================================
async function apiCall(endpoint, method = 'GET', body = null, requiresAuth = false) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (requiresAuth && state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      // Handle JWT expiration
      if (requiresAuth && (response.status === 401 || response.status === 403)) {
        logout();
        showToast(data.error || 'Session expired. Please log in again.', 'error');
        window.location.hash = '#auth';
        throw new Error('Unauthorized');
      }
      throw new Error(data.error || 'Something went wrong.');
    }

    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err.message);
    throw err;
  }
}

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

// Estimate Read Time
function getReadTime(text) {
  const words = text ? text.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

// Format ISO Date to readable date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Get initials for user avatar
function getInitials(username) {
  return username ? username.substring(0, 2).toUpperCase() : 'U';
}

// Secure custom Markdown Parser
function parseMarkdown(text) {
  if (!text) return '';
  let html = text;
  
  // Escape HTML entities to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code Blocks
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^> (.*?)$/gm, '<blockquote>$1</blockquote>');

  // Lists (unordered)
  html = html.replace(/^\s*[-*]\s+(.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, ''); // merge consecutive <ul> tags

  // Bold and Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Paragraphs (split by double newlines)
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // If it starts with a block-level tag, don't wrap in <p>
    if (/^<(h[1-6]|pre|ul|ol|blockquote)/i.test(trimmed)) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

// ==========================================================================
// USER AUTHENTICATION ACTIONS
// ==========================================================================

// Parse JWT claims to read user profile
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Save authentication session
function login(token) {
  state.token = token;
  localStorage.setItem('token', token);
  
  const claims = parseJwt(token);
  if (claims) {
    state.currentUser = { id: claims.id, username: claims.username };
  }
  
  updateAuthUI();
}

// Clear authentication session
function logout() {
  state.token = null;
  state.currentUser = null;
  localStorage.removeItem('token');
  
  updateAuthUI();
  showToast('Logged out successfully.', 'success');
  window.location.hash = '#home';
}

// Update DOM elements matching auth states
function updateAuthUI() {
  const isAuth = !!state.token;
  
  // Show/Hide guest vs user controls
  const guestControls = document.getElementById('auth-controls-guest');
  const userControls = document.getElementById('auth-controls-user');
  
  if (isAuth && state.currentUser) {
    guestControls.classList.add('hidden');
    userControls.classList.remove('hidden');
    
    // Set user profile visuals
    document.getElementById('user-avatar').textContent = getInitials(state.currentUser.username);
    document.getElementById('user-display-name').textContent = state.currentUser.username;
    
    // Set avatars in comment inputs
    const commentAvatar = document.getElementById('comment-form-avatar');
    if (commentAvatar) {
      commentAvatar.textContent = getInitials(state.currentUser.username);
    }
  } else {
    guestControls.classList.remove('hidden');
    userControls.classList.add('hidden');
  }

  // Show/Hide page elements marked as auth-only or guest-only
  document.querySelectorAll('.auth-only').forEach(el => {
    if (isAuth) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  document.querySelectorAll('.guest-only').forEach(el => {
    if (!isAuth) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
}

// Handle login state validation on start
async function checkAuthStatus() {
  if (state.token) {
    try {
      const data = await apiCall('/auth/me', 'GET', null, true);
      state.currentUser = data.user;
      updateAuthUI();
    } catch (err) {
      // Session invalid, logout handled inside apiCall
      console.log('Session validation failed.');
    }
  } else {
    updateAuthUI();
  }
}

// ==========================================================================
// PAGE CONTROLLERS & VIEW RENDERING
// ==========================================================================

// Swap views by toggling hidden attribute
function showView(viewId) {
  document.querySelectorAll('.app-view').forEach(view => {
    view.classList.add('hidden');
  });
  
  const activeView = document.getElementById(viewId);
  if (activeView) {
    activeView.classList.remove('hidden');
  }
  
  // Scroll to top on view switch
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ROUTE 1: Home/Feed Controller
async function routeHome(params) {
  showView('view-home');
  
  // Handle filters from route state
  const filterTab = params.get('filter');
  state.currentFilter = filterTab === 'mine' ? 'mine' : 'all';
  
  // Update UI active filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    if (tab.getAttribute('data-filter') === state.currentFilter) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Load posts
  const postsGrid = document.getElementById('posts-grid');
  postsGrid.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Curating the latest articles for you...</p>
    </div>
  `;

  try {
    state.posts = await apiCall('/posts');
    renderPostsList();
  } catch (err) {
    postsGrid.innerHTML = `
      <div class="posts-grid-empty">
        <h3>Could not load stories</h3>
        <p>${err.message || 'Please verify that your database and server are active.'}</p>
      </div>
    `;
  }
}

// Render dynamic post list onto feed
function renderPostsList() {
  const postsGrid = document.getElementById('posts-grid');
  
  // Apply filtering (Mine vs All) and search parameters
  let filtered = state.posts;

  if (state.currentFilter === 'mine' && state.currentUser) {
    filtered = filtered.filter(p => p.user_id === state.currentUser.id);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.content.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    postsGrid.innerHTML = `
      <div class="posts-grid-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="color: var(--text-muted); margin-bottom: 12px;">
          <rect x="2" y="3" width="20" height="18" rx="2" ry="2"></rect>
          <line x1="6" y1="8" x2="18" y2="8"></line>
          <line x1="6" y1="12" x2="18" y2="12"></line>
          <line x1="6" y1="16" x2="12" y2="16"></line>
        </svg>
        <h3>No articles found</h3>
        <p>${state.searchQuery ? 'Try matching different keywords.' : 'Be the first to share an article!'}</p>
      </div>
    `;
    return;
  }

  postsGrid.innerHTML = filtered.map(post => {
    const readTime = getReadTime(post.content);
    const dateStr = formatDate(post.created_at);
    // Strip markdown formatting for text excerpt rendering
    const cleanExcerpt = post.content
      .replace(/[\*#`>_\-]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    return `
      <article class="post-card" onclick="window.location.hash = '#post/${post.id}'">
        <div class="post-card-meta">
          <span class="post-card-author">${post.author}</span>
          <span>•</span>
          <span>${dateStr}</span>
        </div>
        <h3 class="post-card-title">${post.title}</h3>
        <p class="post-card-excerpt">${cleanExcerpt}</p>
        <div class="post-card-footer">
          <span class="post-card-readmore">
            Read story
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </span>
          <span class="comment-indicator">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="comment-indicator-icon">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            ${post.comment_count}
          </span>
        </div>
      </article>
    `;
  }).join('');
}

// ROUTE 2: Post Details Controller
async function routePostDetail(postId) {
  showView('view-post-detail');
  
  // Set placeholder loading indicators
  document.getElementById('detail-post-title').textContent = 'Loading Story...';
  document.getElementById('detail-post-author').textContent = 'Author';
  document.getElementById('detail-post-content').innerHTML = '<div class="spinner"></div>';
  document.getElementById('comments-list').innerHTML = '';
  document.getElementById('comments-count').textContent = '0';
  document.getElementById('post-author-actions').classList.add('hidden');

  try {
    const data = await apiCall(`/posts/${postId}`);
    const post = data.post;
    const comments = data.comments;

    // Save details to state
    state.activePostId = post.id;

    // Fill post elements
    document.getElementById('detail-post-title').textContent = post.title;
    document.getElementById('detail-post-author').textContent = post.author;
    document.getElementById('detail-author-avatar').textContent = getInitials(post.author);
    document.getElementById('detail-post-date').textContent = formatDate(post.created_at);
    document.getElementById('detail-post-readtime').textContent = getReadTime(post.content);
    document.getElementById('detail-post-content').innerHTML = parseMarkdown(post.content);

    // Show action controls if the logged-in user matches the post author
    const postActions = document.getElementById('post-author-actions');
    if (state.currentUser && state.currentUser.id === post.user_id) {
      postActions.classList.remove('hidden');
    } else {
      postActions.classList.add('hidden');
    }

    // Render Comments lists
    document.getElementById('comments-count').textContent = comments.length;
    renderComments(comments, post.user_id);

    // Swap comment input or login warning depending on user auth status
    const commentForm = document.getElementById('comment-form-container');
    const guestPrompt = document.getElementById('comment-guest-prompt');

    if (state.token) {
      commentForm.classList.remove('hidden');
      guestPrompt.classList.add('hidden');
    } else {
      commentForm.classList.add('hidden');
      guestPrompt.classList.remove('hidden');
    }

  } catch (err) {
    showToast(err.message || 'Post could not be retrieved.', 'error');
    window.location.hash = '#home';
  }
}

// Render post comments lists
function renderComments(comments, postAuthorId) {
  const container = document.getElementById('comments-list');

  if (comments.length === 0) {
    container.innerHTML = `
      <div class="comments-empty">
        <p>No comments yet. Start the conversation!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = comments.map(comment => {
    // Determine comment deletion rights: comment owner OR post owner
    const canDelete = state.currentUser && 
      (state.currentUser.id === comment.user_id || state.currentUser.id === postAuthorId);
    
    const deleteButton = canDelete ? `
      <div class="comment-actions">
        <button class="btn-comment-delete" onclick="handleDeleteComment(${comment.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
          </svg>
          Delete
        </button>
      </div>
    ` : '';

    return `
      <div class="comment-item" id="comment-${comment.id}">
        <div class="comment-user-avatar">${getInitials(comment.author)}</div>
        <div class="comment-content-wrap">
          <div class="comment-meta">
            <span class="comment-author">${comment.author}</span>
            <span class="comment-date">${formatDate(comment.created_at)}</span>
          </div>
          <div class="comment-body">${parseMarkdown(comment.content)}</div>
          ${deleteButton}
        </div>
      </div>
    `;
  }).join('');
}

// Delete a comment
window.handleDeleteComment = async function(commentId) {
  if (!confirm('Are you sure you want to delete this comment?')) return;

  try {
    await apiCall(`/comments/${commentId}`, 'DELETE', null, true);
    showToast('Comment deleted.', 'success');
    
    // Reload active post details
    if (state.activePostId) {
      routePostDetail(state.activePostId);
    }
  } catch (err) {
    showToast(err.message || 'Could not delete comment.', 'error');
  }
};

// ROUTE 3: Post Editor Controller (Create/Edit)
async function routeEditor(postId = null) {
  if (!state.token) {
    showToast('Please sign in to write or edit stories.', 'warning');
    window.location.hash = '#auth';
    return;
  }

  showView('view-editor');
  
  const titleInput = document.getElementById('post-title-input');
  const contentInput = document.getElementById('post-content-input');
  const viewTitle = document.getElementById('editor-title');
  const submitBtn = document.getElementById('editor-submit-btn');

  // Clear inputs
  titleInput.value = '';
  contentInput.value = '';

  if (postId) {
    // Edit Post Mode
    viewTitle.textContent = 'Refine Your Story';
    submitBtn.textContent = 'Publish Updates';
    state.activePostId = postId;

    try {
      const data = await apiCall(`/posts/${postId}`);
      const post = data.post;

      if (state.currentUser.id !== post.user_id) {
        showToast('You are not authorized to edit this story.', 'error');
        window.location.hash = `#post/${postId}`;
        return;
      }

      titleInput.value = post.title;
      contentInput.value = post.content;
    } catch (err) {
      showToast('Could not retrieve post data.', 'error');
      window.location.hash = '#home';
    }
  } else {
    // New Post Mode
    viewTitle.textContent = 'Draft a New Story';
    submitBtn.textContent = 'Publish Story';
    state.activePostId = null;
  }
}

// ROUTE 4: Authentication Controller (Login/Register)
function routeAuth(params) {
  if (state.token) {
    window.location.hash = '#home';
    return;
  }

  showView('view-auth');

  // Activate appropriate tab based on search query params
  const activeTab = params.get('tab') === 'register' ? 'register' : 'login';
  switchAuthTab(activeTab);
}

// Switch Login/Register Tabs inside Auth Panel
function switchAuthTab(tabName) {
  const loginTabBtn = document.getElementById('tab-login');
  const registerTabBtn = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (tabName === 'register') {
    registerTabBtn.classList.add('active');
    loginTabBtn.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  } else {
    loginTabBtn.classList.add('active');
    registerTabBtn.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  }
}

// ==========================================
// ROUTER ROUTING SYSTEM
// ==========================================
function handleRouting() {
  const hash = window.location.hash || '#home';
  
  // Extract path and parameters
  const parts = hash.split('?');
  const path = parts[0];
  const queryParams = new URLSearchParams(parts[1] || '');

  // Route matches
  if (path === '#home' || path === '') {
    routeHome(queryParams);
  } else if (path.startsWith('#post/')) {
    const postId = path.replace('#post/', '');
    routePostDetail(postId);
  } else if (path === '#editor') {
    routeEditor();
  } else if (path.startsWith('#editor/')) {
    const postId = path.replace('#editor/', '');
    routeEditor(postId);
  } else if (path === '#auth') {
    routeAuth(queryParams);
  } else {
    // 404 Route handling fallback
    window.location.hash = '#home';
  }

  // Update navbar visual states
  updateNavState(path);
}

function updateNavState(currentPath) {
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// ==========================================
// EVENT LISTENERS & SETUP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Check auth cookie session
  checkAuthStatus();

  // Load Routing
  window.addEventListener('hashchange', handleRouting);
  handleRouting();

  // Dark/Light Mode Theme Toggle
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
  }

  document.getElementById('theme-toggle').addEventListener('click', () => {
    if (document.body.classList.contains('dark-mode')) {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    }
  });

  // Search filter typing handler
  const searchInput = document.getElementById('feed-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderPostsList();
    });
  }

  // Filter tabs click handlers
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const filterVal = e.target.getAttribute('data-filter');
      window.location.hash = `#home?filter=${filterVal}`;
    });
  });

  // Auth View switches
  document.querySelectorAll('.link-switch').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = e.target.getAttribute('data-target');
      switchAuthTab(target);
    });
  });

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.target.getAttribute('data-tab');
      switchAuthTab(target);
    });
  });

  // Login Submit Event
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');

    try {
      const data = await apiCall('/auth/login', 'POST', {
        username: usernameInput.value,
        password: passwordInput.value
      });

      login(data.token);
      showToast('Logged in successfully. Welcome back!', 'success');
      
      // Reset inputs
      usernameInput.value = '';
      passwordInput.value = '';
      
      window.location.hash = '#home';
    } catch (err) {
      showToast(err.message || 'Login failed.', 'error');
    }
  });

  // Register Submit Event
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('register-username');
    const passwordInput = document.getElementById('register-password');
    const confirmInput = document.getElementById('register-password-confirm');

    if (passwordInput.value !== confirmInput.value) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    try {
      const data = await apiCall('/auth/register', 'POST', {
        username: usernameInput.value,
        password: passwordInput.value
      });

      login(data.token);
      showToast('Account created successfully. Welcome!', 'success');
      
      // Reset inputs
      usernameInput.value = '';
      passwordInput.value = '';
      confirmInput.value = '';
      
      window.location.hash = '#home';
    } catch (err) {
      showToast(err.message || 'Registration failed.', 'error');
    }
  });

  // Logout Click Event
  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  // Editor Helper Buttons Actions (Markdown formatting shortcuts)
  document.querySelectorAll('.btn-helper').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const textarea = document.getElementById('post-content-input');
      const prefix = e.target.getAttribute('data-prefix');
      const suffix = e.target.getAttribute('data-suffix');

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const selected = text.substring(start, end);

      const replacement = prefix + selected + suffix;
      textarea.value = text.substring(0, start) + replacement + text.substring(end);
      
      // Put cursor back inside formatting boundary
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  });

  // Editor Form Submit Event
  document.getElementById('editor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('post-title-input');
    const contentInput = document.getElementById('post-content-input');

    const payload = {
      title: titleInput.value,
      content: contentInput.value
    };

    try {
      let data;
      if (state.activePostId) {
        // Edit Mode
        data = await apiCall(`/posts/${state.activePostId}`, 'PUT', payload, true);
        showToast('Story updated successfully.', 'success');
        window.location.hash = `#post/${state.activePostId}`;
      } else {
        // Create Mode
        data = await apiCall('/posts', 'POST', payload, true);
        showToast('Story published successfully.', 'success');
        window.location.hash = `#post/${data.post.id}`;
      }
    } catch (err) {
      showToast(err.message || 'Failed to publish story.', 'error');
    }
  });

  // Detail Post - Edit Click
  document.getElementById('post-edit-btn').addEventListener('click', () => {
    if (state.activePostId) {
      window.location.hash = `#editor/${state.activePostId}`;
    }
  });

  // Detail Post - Delete Click
  document.getElementById('post-delete-btn').addEventListener('click', async () => {
    if (!state.activePostId) return;
    if (!confirm('Are you sure you want to delete this story? This action cannot be undone.')) return;

    try {
      await apiCall(`/posts/${state.activePostId}`, 'DELETE', null, true);
      showToast('Story deleted successfully.', 'success');
      window.location.hash = '#home';
    } catch (err) {
      showToast(err.message || 'Could not delete story.', 'error');
    }
  });

  // Comment Submit Form
  document.getElementById('comment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const commentInput = document.getElementById('comment-content');

    if (!commentInput.value.trim()) return;

    try {
      await apiCall(`/posts/${state.activePostId}/comments`, 'POST', {
        content: commentInput.value
      }, true);

      showToast('Comment added.', 'success');
      commentInput.value = '';

      // Reload post details to show comment
      routePostDetail(state.activePostId);
    } catch (err) {
      showToast(err.message || 'Failed to add comment.', 'error');
    }
  });
});
