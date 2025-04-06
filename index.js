const express = require('express');
const app = express();
const path = require('path');
const userModel = require('./models/user');
const requirementModel = require('./models/requirement');
const commentModel = require('./models/comment');
const postModel = require('./models/post');
const contactModel = require('./models/contact');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const productModel = require('./models/product');
const adminModel = require('./models/admin');
const cartModel = require('./models/cart');
const orderModel = require('./models/order');
const { setTimeout } = require('timers/promises'); // For retry delays
require("dotenv").config();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'));
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const secretKey = "@SDAIFSIA@#+!#)!@";
const JWT_SECRET_ADMIN = "ASAFWR@$!@!$!#";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, 'public')));

const mongoURI = process.env.COSMOSDB_CONNECTION_STRING;
let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('Using cached MongoDB connection');
    return cachedConnection;
  }

  try {
    console.log('Establishing new MongoDB connection...', mongoURI.replace(/:([^:@]+)@/, ':****@'));
    cachedConnection = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5s timeout
      socketTimeoutMS: 10000, // 10s socket timeout
      ssl: true,
      directConnection: true // No replica set for Cosmos DB
    });
    console.log('✅ MongoDB connected successfully');
    return cachedConnection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

connectToDatabase().catch(err => console.error('Initial connection failed:', err));
app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

// Retry Logic for 429 Errors
async function withRetry(operation, maxRetries = 3, baseDelay = 500) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      if (error.code === 16500 && error.errorResponse?.codeName === 'RequestRateTooLarge') {
        const retryAfterMs = error.errorResponse?.RetryAfterMs || baseDelay;
        console.log(`Rate limited, retrying after ${retryAfterMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await setTimeout(retryAfterMs);
        attempt++;
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Failed after ${maxRetries} retries due to rate limiting`);
}

function authMiddleware(options = {}) {
  const { redirectPath = '/login', adminMode = false } = options;
  return function(request, response, next) {
    if (!request.cookies.token) return response.redirect(redirectPath);
    try {
      const secretToUse = adminMode ? JWT_SECRET_ADMIN : secretKey;
      const data = jwt.verify(request.cookies.token, secretToUse);
      request.user = data;
      next();
    } catch (error) {
      console.error("Invalid Token", error);
      response.clearCookie("token");
      return response.redirect(redirectPath);
    }
  };
}

const profileMiddleWare = authMiddleware({ redirectPath: '/login', adminMode: false });
const adminMiddleWare = authMiddleware({ redirectPath: '/admin/login', adminMode: true });

function isLoggedIn(request, response, next) {
  if (!request.cookies.token) return next();
  try {
    let data = jwt.verify(request.cookies.token, secretKey);
    request.user = data;
    next();
  } catch (error) {
    console.error('Error in isLoggedIn:', error);
    next();
  }
}

app.get('/', isLoggedIn, async function(request, response) {
  try {
    if (!request.user) response.render('index');
    else {
      let user = await userModel.findOne({ _id: request.user.uid }, 'name email'); // Select only needed fields
      response.render('index', { user });
    }
  } catch (error) {
    console.error("Error in home route:", error);
    response.status(500).send("Internal Server Error");
  }
});

app.get('/profile', profileMiddleWare, async function(request, response) {
  try {
    let user = await userModel.findOne({ _id: request.user.uid }, 'name email post');
    const userRequirements = await requirementModel.find({ user: user._id }, 'heading likes date');
    const userPosts = await postModel.find({ createdBy: user._id }, 'title likes createdAt');
    const userOrders = await orderModel.find({ user: user._id }, 'totalPrice createdAt isDelivered isPaid');

    const requirementsWithImages = userRequirements.map(requirement => ({
      ...requirement._doc,
      coverImageBase64: requirement.coverImage?.data
        ? `data:${requirement.coverImage.contentType};base64,${requirement.coverImage.data.toString('base64')}`
        : null
    }));

    const requirementIds = userRequirements.map(req => req._id);
    const postIds = userPosts.map(post => post._id);

    const recentRequiredComments = await commentModel.find({ requirementId: { $in: requirementIds } })
      .sort({ _id: -1 }).limit(5).populate('createdBy', 'name').populate('requirementId', 'heading');
    const recentPostComments = await commentModel.find({ postId: { $in: postIds } })
      .sort({ _id: -1 }).limit(5).populate('createdBy', 'name').populate('postId', 'title');

    const recentRequirementLikes = userRequirements.flatMap(req => req.likes.length > 0 ? [{ type: 'requirement', contentId: req._id, title: req.heading, date: req.date }] : []);
    const recentPostLikes = userPosts.flatMap(post => post.likes.length > 0 ? [{ type: 'post', contentId: post._id, title: post.title, date: post.createdAt }] : []);

    const orderActivities = userOrders.flatMap(order => {
      const activities = [{ type: 'order_placed', amount: order.totalPrice, time: order.createdAt }];
      if (order.isDelivered) activities.push({ type: 'order_status', orderId: order._id, status: 'delivered', time: order.deliveredAt });
      else if (order.isPaid) activities.push({ type: 'order_status', orderId: order._id, status: 'paid', time: order.paidAt });
      return activities;
    });

    const activities = [
      ...recentPostComments.map(comment => ({ type: 'post_comments', user: comment.createdBy.name, title: comment.postId.title, time: comment._id.getTimestamp() })),
      ...recentRequiredComments.map(comment => ({ type: 'requirement_comments', user: comment.createdBy.name, title: comment.requirementId.heading, time: comment._id.getTimestamp() })),
      ...recentPostLikes, ...recentRequirementLikes, ...orderActivities
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

    response.render('profile', { user, activities, requirements: requirementsWithImages });
  } catch (error) {
    console.error('Error fetching profile:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.get('/post/:id', profileMiddleWare, async function(request, response) {
  try {
    let user = await userModel.findById(request.user.uid, 'name email');
    let posts = await postModel.find({ createdBy: request.user.uid }, 'title body coverImage createdAt');
    const postWithImages = posts.map(post => ({
      ...post._doc,
      coverImage: post.coverImage?.data
        ? `data:${post.coverImage.contentType};base64,${post.coverImage.data.toString('base64')}`
        : '/images/placeholder.jpg',
      Date: post.createdAt || new Date()
    }));
    response.render('UserProfilePost', { post: postWithImages, user });
  } catch (error) {
    console.error('Error fetching posts:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.get('/profile/requirements', profileMiddleWare, async function(request, response) {
  try {
    const user = await userModel.findOne({ _id: request.user.uid }, 'name email');
    // Include 'date' in the selected fields
    const userRequirements = await requirementModel.find({ user: user._id }, 'heading content price quantity likes date');
    response.render('UserProfileRequirement', { user, post: userRequirements });
  } catch (error) {
    console.error('Error fetching user requirements:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.get('/ImageRead/:id', profileMiddleWare, async function(request, response) {
  try {
    const post = await postModel.findById(request.params.id, 'title body coverImage likes comments createdBy').populate('createdBy', 'name email');
    if (!post) return response.status(404).send('Post not found');
    const user = await userModel.findOne({ _id: request.user.uid }, 'name email');
    const comments = await commentModel.find({ postId: post._id }, 'content createdBy').populate('createdBy', 'name email');
    const coverImageBase64 = post.coverImage?.data
      ? `data:${post.coverImage.contentType};base64,${post.coverImage.data.toString('base64')}`
      : null;
    const userLiked = post.likes.some(like => like.toString() === user._id.toString());
    response.render('description', { post, comment: comments, user, userLiked, coverImageBase64 });
  } catch (error) {
    console.error('Error fetching post details:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.get('/ImageRead/like/:id', profileMiddleWare, async function(request, response) {
  try {
    let post = await postModel.findOne({ _id: request.params.id }, 'likes');
    if (!post) return response.status(404).send('Post not found');
    const userId = request.user.uid;
    const liked = post.likes.indexOf(userId) !== -1;
    await withRetry(async () => {
      if (!liked) post.likes.push(userId);
      else post.likes = post.likes.filter(id => id.toString() !== userId);
      await post.save();
    });
    response.redirect(`/ImageRead/${request.params.id}`);
  } catch (error) {
    console.error('Error liking post:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.post('/ImageRead/comment/:id', profileMiddleWare, async function(request, response) {
  try {
    let { content } = request.body;
    let post = await postModel.findOne({ _id: request.params.id }, 'comments');
    const comment = await withRetry(async () => {
      const newComment = await commentModel.create({ content, postId: request.params.id, createdBy: request.user.uid });
      post.comments.push(newComment._id);
      await post.save();
      return newComment;
    });
    response.redirect(`/ImageRead/${request.params.id}`);
  } catch (error) {
    console.error('Error', error);
    response.status(400).send('Internal Server Error');
  }
});

app.post('/ImageRead/delete-comment/:id', profileMiddleWare, async function(request, response) {
  try {
    const comment = await commentModel.findById(request.params.id, 'postId');
    if (!comment) return response.status(404).send('Comment Not Present');
    await withRetry(async () => {
      await commentModel.findByIdAndDelete(request.params.id);
      await postModel.updateOne({ _id: comment.postId }, { $pull: { comments: comment._id } });
    });
    response.redirect('/ImageRead/' + comment.postId);
  } catch (error) {
    console.error('Error', error);
    response.status(400).send('Internal Server Error');
  }
});

app.get('/read/:id', profileMiddleWare, async function(request, response) {
  try {
    let user = await userModel.findOne({ _id: request.user.uid }, 'name email');
    let requirement = await requirementModel.findOne({ _id: request.params.id }, 'heading content price quantity likes comments').populate('user', 'name');
    let comment = await commentModel.find({ requirementId: request.params.id }, 'content createdBy').populate('createdBy', 'name email');
    let userLiked = requirement.likes.indexOf(request.user.uid) !== -1;
    response.render('descriptionRequirement', { requirement, user, userLiked, comment });
  } catch (error) {
    console.error('Error', error);
    response.status(400).send('Internal Server Error');
  }
});

app.get('/read/like/:id', profileMiddleWare, async function(request, response) {
  try {
    let requirement = await requirementModel.findOne({ _id: request.params.id }, 'likes');
    if (!requirement) return response.status(404).send('Requirement not found');
    const userId = request.user.uid;
    const liked = requirement.likes.indexOf(userId) !== -1;
    await withRetry(async () => {
      if (!liked) requirement.likes.push(userId);
      else requirement.likes.splice(requirement.likes.indexOf(userId), 1);
      await requirement.save();
    });
    response.redirect(`/read/${request.params.id}`);
  } catch (error) {
    console.error('Error', error);
    response.status(400).send('Internal Server Error');
  }
});

app.post('/read/comment/:id', profileMiddleWare, async function(request, response) {
  try {
    let { content } = request.body;
    let requirement = await requirementModel.findOne({ _id: request.params.id }, 'comments');
    const comment = await withRetry(async () => {
      const newComment = await commentModel.create({ content, requirementId: request.params.id, createdBy: request.user.uid });
      requirement.comments.push(newComment._id);
      await requirement.save();
      return newComment;
    });
    response.redirect(`/read/${request.params.id}`);
  } catch (error) {
    console.error('Error', error);
    response.status(400).send('Internal Server Error');
  }
});

app.post('/read/delete-comment/:id', profileMiddleWare, async function(request, response) {
  try {
    const comment = await commentModel.findById(request.params.id, 'requirementId');
    await withRetry(async () => {
      await commentModel.findByIdAndDelete(request.params.id);
      await requirementModel.updateOne({ _id: comment.requirementId }, { $pull: { comments: comment._id } });
    });
    response.redirect('/read/' + comment.requirementId);
  } catch (error) {
    console.error('Error', error);
    response.status(400).send('Internal Server Error');
  }
});

app.get('/signup', function(request, response) {
  response.render('signup');
});

app.get('/login', function(request, response) {
  response.render('login');
});

app.post('/signup', async function(request, response) {
  try {
    let { name, email, password, street, city, state, postalCode, country } = request.body;
    let registered = await userModel.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } }, 'email');
    if (registered) return response.status(409).json({ status: 'error', message: "User Already registered" });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const user = await withRetry(async () => {
      return await userModel.create({
        name, email, password: hash, addresses: [{ street, city, state, postalCode, country }]
      });
    });
    let token = jwt.sign({ email: user.email, uid: user._id }, secretKey);
    response.cookie("token", token);
    return response.status(200).json({ status: 'success', message: 'Registration successful' });
  } catch (error) {
    console.error("Signup error:", error);
    response.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

app.post('/login', async function(request, response) {
  console.time('Login Total');
  try {
    const { email, password } = request.body;
    console.time('Login Query');
    const user = await userModel.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } }, 'email password');
    console.timeEnd('Login Query');
    if (!user) {
      console.timeEnd('Login Total');
      return response.status(401).json({ status: 'error', message: 'Either Email-Id or Password is Incorrect' });
    }
    console.time('Password Compare');
    const result = await bcrypt.compare(password, user.password);
    console.timeEnd('Password Compare');
    if (!result) {
      console.timeEnd('Login Total');
      return response.status(401).json({ status: 'error', message: 'Either Email-Id or Password is Incorrect' });
    }
    const token = jwt.sign({ email: user.email, uid: user._id }, secretKey);
    response.cookie("token", token);
    console.timeEnd('Login Total');
    return response.status(200).json({ status: 'success', message: 'Login Successful' });
  } catch (error) {
    console.error("Login error:", error);
    console.timeEnd('Login Total');
    response.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

app.get('/logout', function(request, response) {
  response.clearCookie('token');
  response.redirect('/login');
});

app.get('/discovers', isLoggedIn, async function(request, response) {
  try {
    // Include 'likes' in the selected fields
    let requirement = await requirementModel.find({}, 'heading content price quantity likes')
      .populate('user', 'name')
      .limit(10);
    if (!request.user) {
      response.render('marketPlace', { requirement });
    } else {
      let user = await userModel.findOne({ _id: request.user.uid }, 'name email');
      response.render('marketPlace', { user, requirement });
    }
  } catch (error) {
    console.error("Error in discovers route:", error);
    response.status(500).send("Internal Server Error");
  }
});

app.post('/requirement', isLoggedIn, upload.single('coverImage'), async (req, res) => {
  try {
    const { heading, content, price, quantity } = req.body;
    if (!heading || !content || !price || !quantity) return res.status(400).send('All fields are required');
    const requirementData = { heading, content, price: Number(price), quantity: Number(quantity), user: req.user.uid };
    if (req.file) requirementData.coverImage = { data: req.file.buffer, contentType: req.file.mimetype };
    await withRetry(async () => await requirementModel.create(requirementData));
    res.redirect('/discovers');
  } catch (error) {
    console.error('Error creating requirement:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/creation', isLoggedIn, async function(request, response) {
  try {
    console.log('Entering /creation route');
    const posts = await postModel.find({}, 'title body coverImage createdAt').populate('createdBy', 'name').limit(10);
    console.log('Posts fetched:', posts.length);
    const postsWithImages = posts.map(post => ({
      ...post._doc,
      coverImageBase64: post.coverImage?.data
        ? `data:${post.coverImage.contentType};base64,${post.coverImage.data.toString('base64')}`
        : null
    }));
    let user = null;
    if (request.user?.email) {
      user = await userModel.findOne({ email: request.user.email }, 'name email');
      console.log('Authenticated User:', user?.name || 'No user found');
    }
    console.log('Rendering makers.ejs with posts:', postsWithImages.length);
    response.render('makers', { user, post: postsWithImages });
  } catch (error) {
    console.error('Error fetching posts in /creation:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.get('/creation', isLoggedIn, async function(request, response) {
  try {
    console.log('Entering /creation route');
    const posts = await postModel.find({}, 'title body coverImage createdAt likes').populate('createdBy', 'name').limit(10);
    console.log('Posts fetched:', posts.length);
    const postsWithImages = posts.map(post => ({
      ...post._doc,
      date: post.createdAt, // Map createdAt to date for the template
      coverImageBase64: post.coverImage?.data
        ? `data:${post.coverImage.contentType};base64,${post.coverImage.data.toString('base64')}`
        : null
    }));
    let user = null;
    if (request.user?.email) {
      user = await userModel.findOne({ email: request.user.email }, 'name email');
      console.log('Authenticated User:', user?.name || 'No user found');
    }
    console.log('Rendering makers.ejs with posts:', postsWithImages.length);
    response.render('makers', { user, post: postsWithImages });
  } catch (error) {
    console.error('Error fetching posts in /creation:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.get('/about', isLoggedIn, async function(request, response) {
  if (!request.user) response.render('about');
  else {
    let user = await userModel.findOne({ _id: request.user.uid }, 'name email');
    response.render('about', { user });
  }
});

app.get('/contactUs', isLoggedIn, async function(request, response) {
  if (!request.user) response.render('contact');
  else {
    let user = await userModel.findOne({ _id: request.user.uid }, 'name email');
    response.render('contact', { user });
  }
});

app.post('/contactus', async function(request, response) {
  let { name, email, content } = request.body;
  await withRetry(async () => await contactModel.create({ name, email, content }));
  response.redirect('/');
});

app.get('/DeleteImage/:id', profileMiddleWare, async function(request, response) {
  const postId = request.params.id;
  await withRetry(async () => {
    await userModel.updateOne({ _id: request.user.uid }, { $pull: { post: postId } });
    await postModel.findByIdAndDelete(postId);
  });
  response.redirect(`/post/${request.user.uid}`);
});

app.get('/DeleteRequirement/:id', profileMiddleWare, async function(request, response) {
  try {
    const requirementId = request.params.id;
    await withRetry(async () => await requirementModel.findByIdAndDelete(requirementId));
    response.redirect('/profile/requirements');
  } catch (error) {
    console.error('Error deleting requirement:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.get('/EditRequirement/:id', profileMiddleWare, async function(request, response) {
  try {
    const user = await userModel.findById(request.user.uid, 'name email');
    const requirement = await requirementModel.findById(request.params.id, 'heading content price quantity');
    if (!requirement) return response.status(404).send('Requirement not found');
    response.render('Edit', { post: requirement, user });
  } catch (error) {
    console.error('Error fetching requirement for edit:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.post('/Requirement/update/:id', profileMiddleWare, async function(request, response) {
  try {
    const { heading, content, price, quantity } = request.body;
    const updatedRequirement = await withRetry(async () => {
      return await requirementModel.findOneAndUpdate(
        { _id: request.params.id },
        { heading, content, price: Number(price), quantity: Number(quantity) },
        { new: true, select: 'heading content price quantity' }
      );
    });
    if (!updatedRequirement) return response.status(404).send('Requirement not found');
    response.redirect('/profile/requirements');
  } catch (error) {
    console.error('Error updating requirement:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.get('/EditPost/:id', profileMiddleWare, async function(request, response) {
  try {
    let user = await userModel.findById(request.user.uid, 'name email');
    let post = await postModel.findById(request.params.id, 'title body');
    if (!post) return response.status(404).send('Post not found');
    response.render('EditPhoto', { post, user });
  } catch (error) {
    console.error('Error fetching post for edit:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.post('/EditPost/update/:id', profileMiddleWare, async function(request, response) {
  try {
    let { body, title } = request.body;
    const updatedPost = await withRetry(async () => {
      return await postModel.findOneAndUpdate(
        { _id: request.params.id },
        { title, body },
        { new: true, select: 'title body' } // Return only updated fields
      );
    });
    if (!updatedPost) return response.status(404).send('Post not found');
    response.redirect(`/post/${request.user.uid}`);
  } catch (error) {
    console.error('Error updating post:', error);
    response.status(500).send('Internal Server Error');
  }
});

// Admin routes (optimized similarly, abbreviated for brevity)
app.get('/admin', adminMiddleWare, async function(request, response) {
  try {
    const userCount = await userModel.countDocuments();
    const postCount = await postModel.countDocuments();
    const requirementCount = await requirementModel.countDocuments();
    const commentCount = await commentModel.countDocuments();
    const orderCount = await orderModel.countDocuments();
    const productCount = await productModel.countDocuments();
    const contactMessage = await contactModel.countDocuments();
    const users = await userModel.find({}, 'name email').sort({ _id: -1 }).limit(5);
    const posts = await postModel.find({}, 'title createdBy').sort({ _id: -1 }).limit(5).populate('createdBy', 'name email');
    const requirements = await requirementModel.find({}, 'heading user').sort({ _id: -1 }).limit(5).populate('user', 'name email');
    const adminUser = await userModel.findById(request.user.uid, 'name email');
    response.render('./Admin/dashboard', {
      userCount, postCount, requirementCount, commentCount, contactMessage, users, posts, requirements, orderCount, productCount, adminUser
    });
  } catch (error) {
    console.error('Error in admin dashboard:', error);
    response.status(500).send('Internal Server Error');
  }
});

// Add similar optimizations to other admin routes (e.g., /admin/users, /admin/posts) by selecting specific fields and using withRetry for writes.

// Remaining routes (optimized similarly, abbreviated)
app.get('/products', isLoggedIn, async function(request, response) {
  try {
    const { category, minPrice, maxPrice, search, sort } = request.query;
    let query = {};
    let sortOption = {};
    if (category) query.category = category;
    if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
    if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
    if (sort === 'price_asc') sortOption = { price: 1 };
    else if (sort === 'price_desc') sortOption = { price: -1 };
    else if (sort === 'newest') sortOption = { createdAt: -1 };
    const products = await productModel.find(query, 'name price category stock').sort(sortOption).limit(10);
    const user = request.user ? await userModel.findById(request.user.uid, 'name email') : null;
    response.render('./Ecommerce/product', { products, user });
  } catch (error) {
    console.error("Error fetching products", error);
    response.status(500).send('Internal Server Error');
  }
});

// Add remaining routes with similar optimizations (select fields, limit results, use withRetry for writes).

app.use(express.static('public'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
