const assert = require('assert');

const BASE_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('Starting automated API tests...');

  const timestamp = Date.now();
  const testUser = {
    username: `test_user_${timestamp}`,
    password: `password_${timestamp}`
  };

  let token = '';
  let userId = null;
  let testPostId = null;
  let testCommentId = null;

  // 1. Test User Registration
  console.log('Testing user registration...');
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  
  assert.strictEqual(regRes.status, 201, `Registration failed with status ${regRes.status}`);
  const regData = await regRes.json();
  assert.ok(regData.token, 'Token not received during registration');
  assert.strictEqual(regData.user.username, testUser.username);
  userId = regData.user.id;
  console.log('✔ Registration successful.');

  // 2. Test User Login
  console.log('Testing user login...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  
  assert.strictEqual(loginRes.status, 200, `Login failed with status ${loginRes.status}`);
  const loginData = await loginRes.json();
  assert.ok(loginData.token, 'Token not received during login');
  token = loginData.token;
  console.log('✔ Login successful.');

  // 3. Test GET Posts (loads seeded posts)
  console.log('Testing fetch posts...');
  const getPostsRes = await fetch(`${BASE_URL}/posts`);
  assert.strictEqual(getPostsRes.status, 200);
  const posts = await getPostsRes.json();
  assert.ok(Array.isArray(posts));
  assert.ok(posts.length >= 2, 'Seed posts missing');
  console.log(`✔ Fetched ${posts.length} posts successfully.`);

  // 4. Test Create Post (Auth required)
  console.log('Testing create post...');
  const postPayload = {
    title: 'Testing Automated Scripts',
    content: 'This post is created by a test script to check backend compliance.'
  };

  const createPostRes = await fetch(`${BASE_URL}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(postPayload)
  });

  assert.strictEqual(createPostRes.status, 201, `Create post failed with status ${createPostRes.status}`);
  const postData = await createPostRes.json();
  assert.ok(postData.post.id);
  assert.strictEqual(postData.post.title, postPayload.title);
  assert.strictEqual(postData.post.user_id, userId);
  testPostId = postData.post.id;
  console.log(`✔ Create post successful. Post ID: ${testPostId}`);

  // 5. Test GET Single Post with Comments
  console.log('Testing fetch single post...');
  const getPostRes = await fetch(`${BASE_URL}/posts/${testPostId}`);
  assert.strictEqual(getPostRes.status, 200);
  const singlePostData = await getPostRes.json();
  assert.strictEqual(singlePostData.post.title, postPayload.title);
  assert.ok(Array.isArray(singlePostData.comments));
  console.log('✔ Fetch single post successful.');

  // 6. Test Add Comment (Auth required)
  console.log('Testing add comment...');
  const commentPayload = {
    content: 'Awesome automated post, testing comments!'
  };

  const createCommentRes = await fetch(`${BASE_URL}/posts/${testPostId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(commentPayload)
  });

  assert.strictEqual(createCommentRes.status, 201);
  const commentData = await createCommentRes.json();
  assert.ok(commentData.comment.id);
  assert.strictEqual(commentData.comment.content, commentPayload.content);
  assert.strictEqual(commentData.comment.user_id, userId);
  testCommentId = commentData.comment.id;
  console.log(`✔ Add comment successful. Comment ID: ${testCommentId}`);

  // 7. Test Delete Comment (Auth required)
  console.log('Testing delete comment...');
  const deleteCommentRes = await fetch(`${BASE_URL}/comments/${testCommentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  assert.strictEqual(deleteCommentRes.status, 200);
  console.log('✔ Delete comment successful.');

  // 8. Test Delete Post (Auth required)
  console.log('Testing delete post...');
  const deletePostRes = await fetch(`${BASE_URL}/posts/${testPostId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  assert.strictEqual(deletePostRes.status, 200);
  console.log('✔ Delete post successful.');

  // Verify deletion
  const getPostAfterDelRes = await fetch(`${BASE_URL}/posts/${testPostId}`);
  assert.strictEqual(getPostAfterDelRes.status, 404, 'Post was not deleted successfully');
  console.log('✔ Verified post deletion returns 404.');

  console.log('====================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('====================================');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
