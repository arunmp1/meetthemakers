const express = require('express')
const app = express()
const path = require('path')
const userModel = require('./models/user')
const requirementModel = require('./models/requirement')
const commentModel = require('./models/comment')
const postModel = require('./models/post')
const contactModel = require('./models/contact')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const multer = require('multer')
const productModel = require('./models/product')
const adminModel = require('./models/admin')
const cartModel = require('./models/cart')
const { allowedNodeEnvironmentFlags } = require('process')
const orderModel = require('./models/order')
const { profile } = require('console')
const { MongoClient, ServerApiVersion } = require('mongodb');
require("dotenv").config();


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
          cb(null, true);
      } else {
          cb(new Error('Only images are allowed'));
      }
  }
});

// const upload = multer({storage:storage})

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())
const secretKey = "@SDAIFSIA@#+!#)!@"
const JWT_SECRET_ADMIN = "ASAFWR@$!@!$!#";


app.set("view engine","ejs")
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname,'public')))

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

// Connect at startup
connectToDatabase().catch(err => console.error('Initial connection failed:', err));

app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

function authMiddleware(options = {}) {
  const {
    redirectPath = '/login',
    adminMode = false
  } = options;

  return function(request, response, next) {
    if (!request.cookies.token) {
      return response.redirect(redirectPath);
    }

    try {
      // Use the appropriate secret based on admin mode
      const secretToUse = adminMode ? JWT_SECRET_ADMIN : secretKey;
      
      const data = jwt.verify(request.cookies.token, secretToUse);
      request.user = data;
      next();
    } catch (error) {
      console.error("Invalid Token", error);
      response.clearCookie("token"); // Better than setting to empty string
      return response.redirect(redirectPath);
    }
  };
}


const profileMiddleWare = authMiddleware({
  redirectPath: '/login',
  adminMode: false
});

const adminMiddleWare = authMiddleware({
  redirectPath: '/Admin/login', // Fixed to match your route
  adminMode: true
});

function isLoggedIn(request,response,next){
  if(!request.cookies.token){
    return next();
  }else{
    let data = jwt.verify(request.cookies.token,secretKey)
     request.user = data;
    return next();
  } 
}   

app.get('/', isLoggedIn, async function (request, response) {
  try {
    if (!request.user) {
      response.render('index')
    } else {
      let user = await userModel.findOne({ _id: request.user.uid })
      response.render('index', { user })
    }
  } catch (error) {
    console.error("Error in home route:", error)
    response.status(500).send("Internal Server Error")
  }
})


app.get('/profile', profileMiddleWare, async function(request, response) {
  try {
      let user = await userModel.findOne({ _id: request.user.uid });
      const userRequirements = await requirementModel.find({ user: user._id });
      const userPosts = await postModel.find({ createdBy: user._id });
      const userOrders = await orderModel.find({ user: user._id }); // Added to fetch orders

      // Convert requirement cover images to base64 with proper checks
      const requirementsWithImages = userRequirements.map(requirement => ({
          ...requirement._doc,
          coverImageBase64: requirement.coverImage && requirement.coverImage.data && requirement.coverImage.contentType
              ? `data:${requirement.coverImage.contentType};base64,${requirement.coverImage.data.toString('base64')}`
              : null
      }));

      // Get IDs of all user's content
      const requirementIds = userRequirements.map(req => req._id);
      const postIds = userPosts.map(post => post._id);

      // Fetch recent comments on requirements
      const recentRequiredComments = await commentModel.find({
          requirementId: { $in: requirementIds }
      })
          .sort({ _id: -1 })
          .limit(5)
          .populate('createdBy', 'name')
          .populate('requirementId', 'heading');

      // Fetch recent comments on posts
      const recentPostComments = await commentModel.find({
          postId: { $in: postIds }
      })
          .sort({ _id: -1 })
          .limit(5)
          .populate('createdBy', 'name')
          .populate('postId', 'title');

      // Fetch recent likes on requirements
      const recentRequirementLikes = [];
      for (const req of userRequirements) {
          if (req.likes && req.likes.length > 0) {
              const likeData = {
                  type: 'requirement',
                  contentId: req._id,
                  title: req.heading,
                  date: req.date
              };
              recentRequirementLikes.push(likeData);
          }
      }

      // Fetch recent likes on posts
      const recentPostLikes = []; // Renamed for clarity
      for (const post of userPosts) { // Changed 'req' to 'post' for clarity
          if (post.likes && post.likes.length > 0) {
              const likeData = {
                  type: 'post',
                  contentId: post._id,
                  title: post.title,
                  date: post.date || post.createdAt // Fixed typo 'Date' to 'date', fallback to createdAt
              };
              recentPostLikes.push(likeData);
          }
      }

      // Fetch order-related activities
      const orderActivities = userOrders.map(order => {
          const activities = [{
              type: 'order_placed',
              amount: order.totalPrice,
              time: order.createdAt
          }];
          if (order.isDelivered) {
              activities.push({
                  type: 'order_status',
                  orderId: order._id,
                  status: 'delivered',
                  time: order.deliveredAt
              });
          } else if (order.isPaid) {
              activities.push({
                  type: 'order_status',
                  orderId: order._id,
                  status: 'paid',
                  time: order.paidAt
              });
          }
          return activities;
      }).flat();

      // Combine all activities
      const activities = [
          ...recentPostComments.map(comment => ({
              type: 'post_comments',
              user: comment.createdBy.name,
              title: comment.postId.title,
              time: comment._id.getTimestamp()
          })),
          ...recentRequiredComments.map(comment => ({
              type: 'requirement_comments',
              user: comment.createdBy.name,
              title: comment.requirementId.heading,
              time: comment._id.getTimestamp()
          })),
          ...recentPostLikes.map(like => ({
              type: like.type,
              title: like.title,
              time: like.date || new Date() // Fallback if date is missing
          })),
          ...recentRequirementLikes.map(like => ({
              type: like.type,
              title: like.title,
              time: like.date || new Date() // Fallback if date is missing
          })),
          ...orderActivities
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5); // Sort and limit to 5

      response.render('profile', {
          user,
          activities,
          requirements: requirementsWithImages // Included for potential future use
      });
  } catch (error) {
      console.error('Error fetching profile:', error);
      response.status(500).send('Internal Server Error');
  }
});

app.get('/post/:id', profileMiddleWare, async function(request, response) {
  try {
    let user = await userModel.findById(request.user.uid);
    let posts = await postModel.find({ createdBy: request.user.uid });
    const postWithImages = posts.map(post => ({
      ...post._doc,
      coverImage: post.coverImage && post.coverImage.data
        ? `data:${post.coverImage.contentType};base64,${post.coverImage.data.toString('base64')}`
        : '/images/placeholder.jpg',
      Date: post.createdAt || new Date() // Ensure Date exists
    }));
    console.log('Posts with Images:', postWithImages);
    response.render('UserProfilePost', { post: postWithImages, user });
  } catch (error) {
    console.error('Error fetching posts:', error);
    response.status(500).send('Internal Server Error');
  }
});

// Profile Requirements
app.get('/profile/requirements', profileMiddleWare, async function(request, response) {
  try {
    const user = await userModel.findOne({ _id: request.user.uid });
    const userRequirements = await requirementModel.find({ user: user._id });
    console.log('User:', user);
    console.log('Requirements:', userRequirements);
    userRequirements.forEach(req => console.log(`Requirement ID: ${req._id}`));
    response.render('UserProfileRequirement', { user, post: userRequirements });
  } catch (error) {
    console.error('Error fetching user requirements:', error);
    response.status(500).send('Internal Server Error');
  }
});


// app.get('/ImageRead/:id',profileMiddleWare,async function(request,response){

//   // let user = await userModel.find({_id:request.user.uid})
//   // console.log(request.user.uid)
//   let user = await userModel.findOne({_id:request.user.uid})
//   let post = await postModel.findOne({_id:request.params.id}).populate('createdBy')
//   let comment = await commentModel.find({postId:request.params.id}).populate('createdBy','_id name email')


//   let userLiked = post.likes.indexOf(request.user.uid) !== -1
//   // console.log(user)
  
//   // console.log(user._id)
//   // console.log(comment.createdBy._id)
//   response.render('description',{post,user,userLiked,comment})
// })


app.get('/ImageRead/:id', profileMiddleWare, async function(request, response) {
  try {
      const post = await postModel.findById(request.params.id).populate('createdBy', 'name email');
      if (!post) {
          return response.status(404).send('Post not found');
      }
      const user = await userModel.findOne({ _id: request.user.uid });
      const comments = await commentModel.find({ postId: post._id }).populate('createdBy', 'name email');
      const coverImageBase64 = post.coverImage
          ? `data:${post.coverImage.contentType};base64,${post.coverImage.data.toString('base64')}`
          : null;
      const userLiked = post.likes.some(like => like.toString() === user._id.toString());
      response.render('description', {
          post,
          comment: comments,
          user,
          userLiked,
          coverImageBase64
      });
  } catch (error) {
      console.error('Error fetching post details:', error);
      response.status(500).send('Internal Server Error');
  }
});

app.get('/ImageRead/like/:id', profileMiddleWare, async function(request, response) {
  try {
      let post = await postModel.findOne({ _id: request.params.id });

      if (!post) {
          return response.status(404).send('Post not found');
      }

      // Toggle like: add if not present, remove if present
      const userId = request.user.uid;
      if (post.likes.indexOf(userId) === -1) {
          post.likes.push(userId);
      } else {
          post.likes.splice(post.likes.indexOf(userId), 1);
      }

      await post.save();
      response.redirect(`/ImageRead/${request.params.id}`);
  } catch (error) {
      console.error('Error liking post:', error);
      response.status(500).send('Internal Server Error');
  }
});

app.post('/ImageRead/comment/:id',profileMiddleWare,async function(request,response){
  // console.log(request.body)
try{

  let {content} = request.body  
  let post = await postModel.findOne({_id:request.params.id})
  // console.log(post)
  
  let comment = await commentModel.create({
    content,
    postId: request.params.id,
    createdBy:request.user.uid
  })

  post.comments.push(comment._id)
  
  await post.save();
  
  response.redirect(`/ImageRead/${request.params.id}`)
}catch(error){
  console.error('Error',error)
  response.status(400).send('Internal Server Error')
}
})

app.post('/ImageRead/delete-comment/:id',profileMiddleWare,async function(request,response){
  try{

    const comment = await commentModel.findById(request.params.id)
    
    if(!comment){
      return response.status(404).send('Comment Not Present')
    }
    
    await commentModel.findByIdAndDelete(request.params.id)
    
    response.redirect('/ImageRead/'+comment.postId);
  }catch(error){
    console.error('Error',error)
    response.status(400).send('Internal Server Error')
  }
})

app.get('/read/:id',profileMiddleWare,async function(request,response){
  // console.log('entered')
  try{

    let user = await userModel.findOne({_id:request.user.uid})
    let requirement = await requirementModel.findOne({_id:request.params.id}).populate('user')
    let comment = await commentModel.find({requirementId:request.params.id}).populate('createdBy','_id name email')
    let userLiked = requirement.likes.indexOf(request.user.uid) !== -1
    response.render('descriptionRequirement',{requirement,user,userLiked,comment})
  }catch(error){
    console.error('Error',error)
    response.status(400).send('Internal Server Error')
  }


 
})
  
app.get('/read/like/:id',profileMiddleWare,async function(request,response){
  // console.log('read')

  try{

    let requirement = await requirementModel.findOne({_id:request.params.id}).populate('user')
    
    if(requirement.likes.indexOf(request.user.uid) === -1){
      requirement.likes.push(request.user.uid)
    }else{
      requirement.likes.splice(requirement.likes.indexOf(request.user.uid),1)
    }
    
    await requirement.save();
    
    response.redirect(`/read/${request.params.id}`);
  }catch(error){
    console.error('Error',error)
    response.status(400).send('Internal Server Error')
  }
})

app.post('/read/comment/:id',profileMiddleWare,async function(request,response){
  
  try{

    let {content} = request.body;
    let requirement = await requirementModel.findOne({_id:request.params.id})
    
    let comment = await commentModel.create({
    content,
    requirementId:request.params.id,
    createdBy: request.user.uid
  })

  requirement.comments.push(comment._id)

  await requirement.save()
  
  response.redirect(`/read/${request.params.id}`)
  }catch(error){
    console.log('Error',error)
    response.status(400).send('Internal Server Error')
  } 

})

app.post('/read/delete-comment/:id',profileMiddleWare,async function(request,response){
  try{
    const comment = await commentModel.findById(request.params.id);    
    await commentModel.findByIdAndDelete(request.params.id)
    response.redirect('/read/'+comment.requirementId);
  }catch(error){
    console.error('Error',error)
    response.status(400).send('Internal Server Error')
  }
  

})


app.get('/signup',function(request,response){
  response.render('signup')
})

app.get('/login',function(request,response){
  response.render('login')
})
           
app.post('/signup', async function(request, response) {
  try {
      let { name, email, password, street, city, state, postalCode, country } = request.body;
      
      // Check for existing user with case-insensitive match
      let registered = await userModel.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
      if (registered) {
          return response.status(409).json({
              status: 'error',
              message: "User Already registered"
          });
      }

      bcrypt.genSalt(10, function(error, salt) {
          if (error) return response.status(500).json({ status: 'error', message: "Error generating salt" });
          bcrypt.hash(password, salt, async function(error, hash) {
              if (error) return response.status(500).json({ status: 'error', message: "Error hashing password" });
              try {
                  let user = await userModel.create({
                      name,
                      email, // Store email as entered
                      password: hash,
                      addresses: [{ street, city, state, postalCode, country }]
                  });
                  let token = jwt.sign({ email: user.email, uid: user._id }, secretKey);
                  response.cookie("token", token);
                  return response.status(200).json({ status: 'success', message: 'Registration successful' });
              } catch (createError) {
                  console.error("Error creating user:", createError);
                  return response.status(500).json({ status: 'error', message: 'Registration failed' });
              }
          });
      });
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
    const user = await userModel.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
    console.timeEnd('Login Query');

    if (!user) {
      console.timeEnd('Login Total');
      return response.status(401).json({
        status: 'error',
        message: 'Either Email-Id or Password is Incorrect'
      });
    }

    console.time('Password Compare');
    const result = await bcrypt.compare(password, user.password); // Use async version
    console.timeEnd('Password Compare');

    if (!result) {
      console.timeEnd('Login Total');
      return response.status(401).json({
        status: 'error',
        message: 'Either Email-Id or Password is Incorrect'
      });
    }

    const token = jwt.sign({ email: user.email, uid: user._id }, secretKey);
    response.cookie("token", token);
    console.timeEnd('Login Total');
    return response.status(200).json({
      status: 'success',
      message: 'Login Successful'
    });
  } catch (error) {
    console.error("Login error:", error);
    console.timeEnd('Login Total');
    response.status(500).json({
      status: 'error',
      message: 'Internal Server Error'
    });
  }
});
      
app.get('/logout',function(request,response){
  response.cookie('token','')
  response.redirect('/login');
})

app.get('/discovers', isLoggedIn, async function(request, response) {
  try {
      let requirement = await requirementModel.find({}).populate('user', 'name');
      if (!request.user) {
          response.render('marketPlace', { requirement });
      } else {
          let user = await userModel.findOne({ _id: request.user.uid });
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

      // Validate required fields (excluding coverImage)
      if (!heading || !content || !price || !quantity) {
          return res.status(400).send('All fields (heading, content, price, quantity) are required');
      }

      // Create requirement object, conditionally include coverImage if provided
      const requirementData = {
          heading,
          content,
          price: Number(price),
          quantity: Number(quantity),
          user: req.user.uid
      };

      if (req.file) {
          requirementData.coverImage = {
              data: req.file.buffer,
              contentType: req.file.mimetype
          };
      }

      const requirement = await requirementModel.create(requirementData);
      res.redirect('/discovers');
  } catch (error) {
      console.error('Error creating requirement:', error);
      res.status(500).send('Internal Server Error');
  }
});

app.get('/creation', isLoggedIn, async function(request, response) {
  try {
    console.log('Entering /creation route');
    const posts = await postModel.find({}).populate('createdBy', 'name');
    console.log('Posts fetched:', posts.length);
    const postsWithImages = posts.map(post => ({
      ...post._doc,
      coverImageBase64: post.coverImage && post.coverImage.data && post.coverImage.contentType
        ? `data:${post.coverImage.contentType};base64,${post.coverImage.data.toString('base64')}`
        : null
    }));
    let user = null;
    if (request.user && request.user.email) {
      user = await userModel.findOne({ email: request.user.email });
      console.log('Authenticated User:', user ? user.name : 'No user found');
    } else {
      console.log('No authenticated user');
    }
    console.log('Rendering makers.ejs with posts:', postsWithImages.length);
    response.render('makers', { user, post: postsWithImages });
  } catch (error) {
    console.error('Error fetching posts in /creation:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.post('/creation', isLoggedIn, upload.single('coverImage'), async function(request, response) {
  try {
      let who = await userModel.findOne({ email: request.user.email });
      if (!who) {
          return response.status(404).send('User not found');
      }

      let { title, body } = request.body;

      // Process the uploaded image
      if (!request.file) {
          return response.status(400).send('Cover image is required');
      }

      const coverImage = {
          data: request.file.buffer, // Binary data from memory
          contentType: request.file.mimetype // MIME type (e.g., 'image/jpeg')
      };

      let post = await postModel.create({
          createdBy: who._id,
          title: title,
          body: body,
          coverImage: coverImage // Store image in MongoDB
      });

      who.post.push(post._id);
      await who.save();

      response.redirect('/creation');
  } catch (error) {
      console.error('Error creating post:', error);
      response.status(500).send('Internal Server Error');
  }
});
     
app.get('/about',isLoggedIn,async function(request,response){
  if(!request.user){
    response.render('about')
  }else{
    let user = await userModel.findOne({_id:request.user.uid})
    response.render('about',{user})
  }
})

app.get('/contactUs',isLoggedIn,async function(request,response){
  if(!request.user){
    response.render('contact')
  }else{
    let user = await userModel.findOne({_id:request.user.uid})
    response.render('contact',{user})
  }

})

app.post('/contactus',async function(request,response){
  let {name,email,content} = request.body;
  let user = await contactModel.create({
    name,email,content
  })
  response.redirect('/');
})

app.get('/DeleteImage/:id',profileMiddleWare,async function(request,response){
  // console.log(request.params.id);
  const postId = request.params.id
  const user = await userModel.findById(request.user.uid)
  console.log(user.post)
  

  user.post = user.post.filter(post => post.toString() !== postId);
  await user.save();

  await postModel.findByIdAndDelete(request.params.id)
  response.redirect(`/post/${request.user.uid}`)
})


app.get('/DeleteRequirement/:id', profileMiddleWare, async function(request, response) {
  try {
      const requirementId = request.params.id;
      await requirementModel.findByIdAndDelete(requirementId);
      response.redirect('/profile/requirements');
  } catch (error) {
      console.error('Error deleting requirement:', error);
      response.status(500).send('Internal Server Error');
  }
});


// Edit Requirement (GET)
app.get('/EditRequirement/:id', profileMiddleWare, async function(request, response) {
  try {
    const user = await userModel.findById(request.user.uid);
    const requirement = await requirementModel.findById(request.params.id);
    console.log('User:', user);
    console.log('Requirement:', requirement);
    if (!requirement) {
      console.log(`No requirement found for ID: ${request.params.id}`);
      return response.status(404).send('Requirement not found');
    }
    response.render('Edit', { post: requirement, user }); // 'edit.ejs' for requirements
  } catch (error) {
    console.error('Error fetching requirement for edit:', error);
    response.status(500).send('Internal Server Error');
  }
});
  
app.post('/Requirement/update/:id', profileMiddleWare, async function(request, response) {
  try {
    const { heading, content, price, quantity } = request.body;
    const updatedRequirement = await requirementModel.findOneAndUpdate(
      { _id: request.params.id },
      { heading, content, price: Number(price), quantity: Number(quantity) },
      { new: true }
    );
    console.log('Updated Requirement:', updatedRequirement);
    if (!updatedRequirement) {
      console.log(`No requirement found to update for ID: ${request.params.id}`);
      return response.status(404).send('Requirement not found');
    }
    response.redirect('/profile/requirements');
  } catch (error) {
    console.error('Error updating requirement:', error);
    response.status(500).send('Internal Server Error');
  }
});

// Edit Post (GET)
app.get('/EditPost/:id', profileMiddleWare, async function(request, response) {
  try {
    let user = await userModel.findById(request.user.uid);
    let post = await postModel.findById(request.params.id);
    console.log('User:', user);
    console.log('Post:', post);
    if (!post) {
      console.log(`No post found for ID: ${request.params.id}`);
      return response.status(404).send('Post not found');
    }
    response.render('EditPhoto', { post, user });
  } catch (error) {
    console.error('Error fetching post for edit:', error);
    response.status(500).send('Internal Server Error');
  }
});

// Update Post (POST)
app.post('/EditPost/update/:id', profileMiddleWare, async function(request, response) {
  try {
    let { body, title } = request.body;
    const updatedPost = await postModel.findOneAndUpdate(
      { _id: request.params.id },
      { title, body },
      { new: true }
    );
    console.log('Updated Post:', updatedPost);
    if (!updatedPost) {
      console.log(`No post found to update for ID: ${request.params.id}`);
      return response.status(404).send('Post not found');
    }
    response.redirect(`/post/${request.user.uid}`);
  } catch (error) {
    console.error('Error updating post:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.get('/Admin', adminMiddleWare, async function(request, response) {
  try {
      const userCount = await userModel.countDocuments();
      const postCount = await postModel.countDocuments();
      const requirementCount = await requirementModel.countDocuments();
      const commentCount = await commentModel.countDocuments();
      const orderCount = await orderModel.countDocuments();
      const productCount = await productModel.countDocuments();
      const contactMessage = await contactModel.countDocuments();
      const users = await userModel.find().sort({_id:-1}).limit(5);
      const posts = await postModel.find().sort({_id:-1}).limit(5).populate('createdBy','name email');
      const requirements = await requirementModel.find().sort({_id:-1}).limit(5).populate('user','name email');
      
      // Get the current admin user
      const adminUser = await userModel.findById(request.user.uid);

      response.render(`./Admin/dashboard`, {
          userCount,
          postCount,
          requirementCount,
          commentCount,
          contactMessage,
          users,
          posts,
          requirements,
          orderCount,
          productCount,
          adminUser  // Add adminUser to the rendered data
      });
  } catch (error) {
      console.error('Error in admin dashboard:', error);
      response.status(500).send('Internal Server Error');
  }
});
app.get('/Admin/users',adminMiddleWare,async function(request,response){
  
  const users = await userModel.find().sort({_id:-1})
  const adminUser = await userModel.findById(request.user.uid);
  response.render(`./Admin/users`, { users, adminUser });
});


app.get('/Admin/users/:id/delete',adminMiddleWare,async function(request,response){
  const userId = request.params.id;

  await postModel.deleteMany({createdBy:userId})
  await requirementModel.deleteMany({user:userId})
  await commentModel.deleteMany({createdBy:userId})

  await postModel.updateMany(
    {$or :[{likes:userId},{comments:userId}]},
    {$pull :{likes:userId,comments:userId}}
  )

  await requirementModel.updateMany(
    {$or:[{likes:userId},{comments:userId}]},
    {$pull:{likes:userId,comment:userId}}
  )

  await userModel.findByIdAndDelete(userId)

  response.redirect('/Admin/users')
  
})


app.get('/Admin/posts',adminMiddleWare,async function(request,response){
  const posts = await postModel.find().sort({_id:-1}).populate('createdBy','name email')
  console.log(posts);
  const adminUser = await userModel.findById(request.user.uid);
    response.render(`./Admin/post`, { posts, adminUser });
});

app.get('/Admin/post/:id/delete',adminMiddleWare,async function(request,response){
  const postId = request.params.id;
  const post = await postModel.findById(postId)

  if(!post){
    return response.status(404).send('Post Not Found')
  }
  
  // 1. Remove the post from the user's post array
  await userModel.updateOne(
    {_id:post.createdBy}, // Finds the user by Id
    {$pull:{post:postId}} // Update Part - removes postId from the postArray
  )

  
  // 2. Delete Comments 
  await commentModel.deleteMany({
    requirementId:postId
  })

  // 3. Delete the posts
  await postModel.findByIdAndDelete(postId)

  response.redirect('/Admin/posts')

})


app.get('/Admin/requirements',adminMiddleWare,async function(request,response){
  const requirements = await requirementModel.find().sort({_id:-1}).populate('user','name email')
  const adminUser = await userModel.findById(request.user.uid);
  response.render(`./Admin/requirement`, { requirements, adminUser });
});


app.get('/Admin/requirement/:id/delete',adminMiddleWare,async function (request,response) {
  const requirementID = request.params.id;
  const requirement = await requirementModel.findById(requirementID)  

  await userModel.updateOne(
    {_id:requirement.user},
    {$pull:{requirement:requirementID}}
  )

  await commentModel.deleteMany(
    {requirementId:requirementID}
  )

  await requirementModel.findByIdAndDelete(requirementID)
  response.redirect('/Admin/requirements')

})


app.get('/Admin/comments',adminMiddleWare,async function(request,response){
  const comments = await commentModel.find().sort({_id:-1}).populate('createdBy','name email')
  const adminUser = await userModel.findById(request.user.uid);
    response.render('./Admin/comments', { comments, adminUser });
});

app.get('/Admin/comments/:id/delete',adminMiddleWare,async function(request,response){
  const commentId = request.params.id;
  const comment = await commentModel.findById(commentId)

  await postModel.updateOne(
    {comments:commentId},{$pull:{comments:commentId}}
  )

  await requirementModel.updateOne(
    {comments:commentId},{$pull:{comments:commentId}}
  )

  await commentModel.findByIdAndDelete(commentId);

  response.redirect('/Admin/comments');
})

app.get('/Admin/contacts',adminMiddleWare,async function(request,response){
  const contacts = await contactModel.find().sort({_id:-1})
  const adminUser = await userModel.findById(request.user.uid);
  response.render('./Admin/contact', { contacts, adminUser });
});


app.get('/Admin/orders', adminMiddleWare, async function(request, response) {
  try {
      const { paymentStatus, deliveryStatus, paymentMethod, dateFrom, dateTo, minAmount, maxAmount } = request.query;
      const filter = {};
      if (paymentStatus) filter.isPaid = paymentStatus === 'paid';
      if (deliveryStatus) filter.isDelivered = deliveryStatus === 'delivered';
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (dateFrom || dateTo) {
          filter.createdAt = {};
          if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
          if (dateTo) {
              const toDate = new Date(dateTo);
              toDate.setHours(23, 59, 59, 999);
              filter.createdAt.$lte = toDate;
          }
      }
      if (minAmount || maxAmount) {
          filter.totalPrice = {};
          if (minAmount) filter.totalPrice.$gte = parseFloat(minAmount);
          if (maxAmount) filter.totalPrice.$lte = parseFloat(maxAmount);
      }
      const orders = await orderModel.find(filter).populate('user', 'name email').sort({_id: -1});
      const totalOrders = orders.length;
      const totalAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0);
      const paidOrders = orders.filter(order => order.isPaid).length;
      const deliveredOrders = orders.filter(order => order.isDelivered).length;
      const adminUser = await userModel.findById(request.user.uid);
      response.render('./Admin/orders', {
          orders,
          stats: { totalOrders, totalAmount, paidOrders, deliveredOrders },
          filters: { paymentStatus, deliveryStatus, paymentMethod, dateFrom, dateTo, minAmount, maxAmount },
          adminUser
      });
  } catch (error) {
      console.error('Error fetching orders:', error);
      response.status(500).send('Server Error');
  }
});


app.post('/Admin/orders/:id/delete', adminMiddleWare, async (req, res) => {
  try {
      const orderId = req.params.id;
      const order = await orderModel.findById(orderId);
      
      if (!order) {
          return res.status(404).send('Order not found');
      }

      await orderModel.deleteOne({ _id: orderId });
      res.redirect('/Admin/orders');
  } catch (error) {
      console.error('Error deleting order:', error);
      res.status(500).send('Internal Server Error');
  }
});


app.get('/Admin/contacts/:id/delete',adminMiddleWare,async function(request,response){
  await contactModel.findByIdAndDelete(request.params.id)
  response.redirect('/Admin/contacts')
})

// Admin Login Route
app.post('/Admin/login', async function(request, response) {
  try {
      let { email, password } = request.body;
      
      if (!email || !password) {
          return response.status(400).json({
              success: false,
              message: 'Email and password are required'
          });
      }
      
      // Use case-insensitive regex to find the admin user
      const admin = await userModel.findOne({ 
          email: { $regex: new RegExp(`^${email}$`, 'i') }, 
          role: 'admin' 
      });
      
      if (!admin) {
          return response.status(401).json({
              success: false,
              message: 'Invalid credentials or not an admin account'
          });
      }
      
      let isPasswordValid = password === admin.password; // Replace with bcrypt.compare if hashed
      if (isPasswordValid) {
          let token = jwt.sign({ email: admin.email, uid: admin._id }, JWT_SECRET_ADMIN, { expiresIn: '24h' });
          response.cookie("token", token);
          return response.redirect('/Admin');
      } else {
          return response.status(401).json({
              success: false,
              message: 'Invalid credentials'
          });
      }
  } catch (error) {
      console.error('Admin login error:', error);
      return response.status(500).json({
          success: false,
          message: 'Internal server error',
          error: error.message
      });
  }
});

app.get('/Admin/products', adminMiddleWare, async function(request, response) {
  try {
    const products = await productModel.find().populate('createdBy', 'name');
    const adminUser = await userModel.findById(request.user.uid);
    response.render('./Admin/products', { products, adminUser });
  } catch (error) {
    console.error('Error Fetching Products:', error);
    response.status(500).send('Internal Server Error');
  }
});

app.get('/Admin/products/:id/delete', adminMiddleWare, async function(request, response) {
  try {
    const productId = request.params.id;
    
    // First, delete the product
    await productModel.findByIdAndDelete(productId);
    
    // Then, find all carts containing this product and remove it from them
    await cartModel.updateMany(
      { "cartItems.products": productId }, 
      { $pull: { cartItems: { products: productId } } }
    );
    
    // Optionally, log how many carts were affected
    response.redirect('/Admin/products');
  } catch (error) {
    console.error("Error deleting product:", error);
    response.status(500).send("Error deleting product");
  }
});


app.get('/Admin/createproduct',adminMiddleWare,async function(request,response){
  console.log(request.user)
  response.render('./Admin/create-product')
})

app.post('/Admin/product/create', adminMiddleWare, upload.array('images', 5), async (req, res) => {
  try {
    const { name, description, price, category, stock, createdByEmail } = req.body;
    const adminUser = await userModel.findById(req.user.uid);

    if (!name || !price || !category || !stock || !createdByEmail) {
      return res.status(400).render('Admin/create-product', { 
        error: 'All fields are required', 
        name, description, price, category, stock, createdByEmail, adminUser 
      });
    }

    const user = await userModel.findOne({ email: createdByEmail });
    if (!user) {
      return res.status(400).render('Admin/create-product', { 
        error: 'User not found', 
        name, description, price, category, stock, createdByEmail, adminUser 
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).render('Admin/create-product', { 
        error: 'At least one image is required', 
        name, description, price, category, stock, createdByEmail, adminUser 
      });
    }
    const images = req.files.map(file => ({
      data: file.buffer,
      contentType: file.mimetype
    }));

    const product = await productModel.create({
      name,
      description,
      price: parseFloat(price),
      category,
      stock: parseInt(stock),
      images,
      createdBy: user._id
    });

    res.redirect('/Admin/products'); // Updated to lowercase
  } catch (error) {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).render('Admin/create-product', { 
        error: "You can't upload more than 5 images. Only 5 are allowed.", 
        name: req.body.name, 
        description: req.body.description, 
        price: req.body.price, 
        category: req.body.category, 
        stock: req.body.stock, 
        createdByEmail: req.body.createdByEmail, 
        adminUser 
      });
    }
    console.error('Error creating product:', error);
    res.status(500).render('Admin/create-product', { 
      error: 'Internal Server Error', 
      name: req.body.name, 
      description: req.body.description, 
      price: req.body.price, 
      category: req.body.category, 
      stock: req.body.stock, 
      createdByEmail: req.body.createdByEmail, 
      adminUser 
    });
  }
});



app.post('/Admin/create', async function(request, response) {
  try {
    // You might want to add authorization middleware to ensure only superadmins can create admins
    
    // Create a new admin user
    const newAdmin = new userModel({
      name: request.body.name, // You can make this dynamic if needed
      email: request.body.email,
      password: request.body.password, // In a real app, hash this password
      role: 'admin',
      // Other fields will use their default values
    });
    
    // Save the admin to the database
    await newAdmin.save();
    
    return response.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: {
        _id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });
    
  } catch (error) {
    console.error('Admin creation error:', error);
    
    // Handle duplicate email error
    if (error.code === 11000) {
      return response.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    return response.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});


app.get('/Admin/login',async function(request,response){
  response.render('./Admin/AdminLogin')
})


app.get('/products', isLoggedIn, async function(request, response) {
  try {
      const { category, minPrice, maxPrice, search, sort } = request.query;
      let query = {};
      let sortOption = {};

      if (category) query.category = category;
      if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
      if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };
      if (search) {
          query.$or = [
              { name: { $regex: search, $options: 'i' } },
              { description: { $regex: search, $options: 'i' } }
          ];
      }
      if (sort === 'price_asc') sortOption = { price: 1 };
      else if (sort === 'price_desc') sortOption = { price: -1 };
      else if (sort === 'newest') sortOption = { createdAt: -1 };

      const products = await productModel.find(query).sort(sortOption);
      const user = request.user ? await userModel.findById(request.user.uid) : null;

      response.render('./Ecommerce/product', { products, user });
  } catch (error) {
      console.error("Error fetching products", error);
      response.status(500).send('Internal Server Error');
  }
});

app.get('/product/:id', profileMiddleWare, async function(request, response) {
  try {
      const product = await productModel.findById(request.params.id).populate('createdBy', 'name');
      const user = await userModel.findById(request.user.uid);

      // Convert images to base64 for rendering
      const imagesBase64 = product.images.map(image => ({
          data: image.data.toString('base64'),
          contentType: image.contentType
      }));

      response.render('./Ecommerce/product-details', { product, user, imagesBase64 });
  } catch (error) {
      console.error('Error fetching product details:', error);
      response.status(500).send('Internal Server Error');
  }
});

app.get('/cart',profileMiddleWare,async function(request,response){
  try{
    const cart = await cartModel.findOne({
      user:request.user.uid
    }).populate('cartItems.products');
    const user = await userModel.findById(request.user.uid)
    response.render('./Ecommerce/carts',{cart,user})
  }catch(error){
    console.error('Error',error)
    response.status(500).send('Internal Server Error')
  }
})


app.post('/cart/add/:productId',profileMiddleWare,async function(request,response){
  try{
    const productId = request.params.productId;
    const quantity = request.body.quantity || 1;


    const product = await productModel.findById(productId);

    if(!product){
      return response.status(404).send('Product Not Found')
    }

    if(product.stock<quantity){
      return response.status(400).send(`Sorry, only ${product.stock} units available in stock`)
    }


    let cart = await cartModel.findOne({user:request.user.uid})

    if(!cart){
      cart = new cartModel({
        user:request.user.uid,
        cartItems:[{
          products:productId,
          quantity:quantity
        }]
      })
    }else{
      const existingItem = cart.cartItems.find(
        item => item.products.toString() === productId
      );

      if(existingItem){
        if(existingItem.quantity + quantity > product.stock){
          return response.status(400).send(`Cannot add more items. Stock limit is ${product.stock}`)
        }
        existingItem.quantity += quantity
      }else{
        cart.cartItems.push({
          products:productId,
          quantity:quantity
        })
      }
    }

    await cart.save();
    response.redirect('/cart')
  }catch(error){
    console.error('Error Adding to Cart',error)
    response.status(500).send('Internal Server Error');
  }
})

app.post('/cart/update',profileMiddleWare,async function(request,response){
  try{
    const {productId,action} = request.body;

    const cart = await cartModel.findOne({user:request.user.uid},)
  
    if(!cart){
      return response.redirect('/cart')
    }

    const cartItem = cart.cartItems.find(
      item => item.products.toString() === productId
    )

    if(!cartItem){
      return response.redirect('/cart')
    }
   
    if(action == 'increment'){
      const product = await productModel.findById(productId)
      if(!product){
        return response.status(404).send('Product not Found')
      }

      if(cartItem.quantity + 1 > product.stock){
        return response.status(400).send(`Cannot Add More Items`)
      }
      cartItem.quantity = cartItem.quantity + 1
    }else if (action == 'decrement'){
      if(cartItem.quantity > 1){
        cartItem.quantity = cartItem.quantity - 1;
      }else{
        cart.cartItems = cart.cartItems.filter(
          item => item.products.toString() !== productId
        )
      }
    }
   
    await cart.save();
    response.redirect('/cart')

  }catch(error){
    console.error('Error',error)
    response.status(500).send('Internal Server Error')
  }
})

app.post('/cart/remove',profileMiddleWare,async function(request,response){
  try{
    const {productId} = request.body;
    await cartModel.findOneAndUpdate(
      {user:request.user.uid},
      {$pull:{cartItems :{products:productId}}}
    )
    response.redirect('/cart')

  }catch(error){
    console.error('Error',error)
    response.status(500).send('Internal Server Error')
  }
})

app.post('/products/create', profileMiddleWare, upload.array('images', 5), async function(request, response) {
  try {
      // Use request body fields if provided, otherwise use defaults
      const {
          name = "Product P1",
          description = "Used for XYZ purpose",
          price = 350,
          category = "Sweets",
          stock = 10
      } = request.body;

      // Process uploaded images (if any)
      const images = request.files && request.files.length > 0
          ? request.files.map(file => ({
              data: file.buffer, // Raw binary data
              contentType: file.mimetype // MIME type
          }))
          : []; // Empty array if no images uploaded

      const product = await productModel.create({
          name,
          description,
          price,
          category,
          stock,
          images, // Array of image objects
          createdBy: request.user.uid
      });

      response.send(product); // Keep the original response behavior
  } catch (error) {
      console.error('Error creating product:', error);
      response.status(500).send('Internal Server Error');
  }
});

app.get('/products/create', profileMiddleWare, async (request, response) => {
  const user = await userModel.findById(request.user.uid);
  response.render('./Ecommerce/product-create', { user });
});

app.post('/order/create', profileMiddleWare, async function(request, response) {
  try {
      const { shippingAddress, paymentMethod } = request.body;
      const cart = await cartModel.findOne({ user: request.user.uid }).populate('cartItems.products');

      if (!cart || cart.cartItems.length === 0) {
          return response.status(400).send('Cart is Empty');
      }

      for (const item of cart.cartItems) {
          const product = item.products;
          if (product.stock < item.quantity) {
              return response.status(400).send(`Sorry, only ${product.stock} units of ${product.name} available`);
          }
      }

      const subtotal = cart.cartItems.reduce((total, item) => 
          total + (item.products.price * item.quantity), 0);
      const shippingPrice = subtotal > 0 ? 100 : 0;
      const taxPrice = Math.round(subtotal * 0.18);
      const totalPrice = subtotal + shippingPrice + taxPrice;

      const orderItems = cart.cartItems.map(item => ({
          product: item.products._id,
          quantity: item.quantity,
          price: item.products.price
      }));

      const order = new orderModel({
          user: request.user.uid,
          orderItems,
          shippingAddress,
          taxPrice,
          shippingPrice,
          paymentMethod,
          totalPrice
      });

      const stockUpdatePromises = cart.cartItems.map(async (item) => {
          const product = await productModel.findById(item.products._id);
          product.stock -= item.quantity;
          return product.save();
      });

      await Promise.all(stockUpdatePromises);
      await order.save();

      await userModel.findByIdAndUpdate(request.user.uid, {
          $push: { orders: order._id }
      });
      await cartModel.findOneAndDelete({ user: request.user.uid });

      response.redirect(`/orders/${order._id}`);
  } catch (error) {
      console.error('Error creating order:', error);
      response.status(500).send('Internal Server Error');
  }
});


app.get('/orders',profileMiddleWare,async function(request,response){
  try{
    const orders = await orderModel.find({user:request.user.uid}).populate('orderItems.product')
    const user = await userModel.findById(request.user.uid)
    const cart = await cartModel.findOne({user: request.user.uid}).populate('cartItems.products');
    

    response.render('./Ecommerce/orders',{orders,user,cart})
  }catch(error){
    console.error('Error Fetching Orders:',error)
    response.status(500).send('Internal Server Errors')
  }   
})


app.get('/orders/:id',profileMiddleWare,async function(request,response){
  try{
    const orderId = request.params.id;
    const order = await orderModel.findById(orderId).populate('orderItems.product')

    if(!order){
      return response.status(404).send('Order not Found')
    }

    if(order.user.toString() !== request.user.uid){
      return response.status(403).send('Unauthorized')
    }

    const user = await userModel.findById(request.user.uid);
    const cart = await cartModel.findOne({user:request.user.uid}).populate('cartItems.products')

    response.render('./Ecommerce/orderConfirmation',{order,user,cart})

  }catch(error){
    console.log('Error',error)
    response.status(500).send('Internal server Error');
  }
})


app.get('/ordersList', profileMiddleWare, async function(request, response) {
  try {
    const userId = request.user.uid;
    const orders = await orderModel.find({ user: userId })
      .populate('user', 'user email')
      .populate('orderItems.product', 'name');
    response.render('./Ecommerce/orderList', {
      orders: orders,
      user: request.user
    });
  } catch (error) {
    console.error('Error', error);
    response.status(500).send('Internal Server Error');
  }
});


app.post('/products/:id/review',profileMiddleWare,async function(request,response){
  try{
    const productId = request.params.id

    const {rating,comment} = request.body;

    const ratingValue = parseInt(rating)

    if(isNaN(ratingValue)  || ratingValue < 1 || ratingValue > 5){
      return response.status(400).send('Invalid Rating Value')
    }


    const product = await productModel.findById(productId)

    if(!product){
      return response.status(404).send('Product Not Found')
    }

    const existingReviewIndex = product.ratings.findIndex(
      r => r.user.toString() === request.user.uid
    );
  
  if(existingReviewIndex >= 0) {
    product.ratings[existingReviewIndex].rating = ratingValue;
    product.ratings[existingReviewIndex].comment = comment;
  }else{
      product.ratings.push({
      user: request.user.uid,
      rating: ratingValue,
      comment
    });
  }
  
  // Update average rating
  product.averageRating = product.ratings.reduce((acc, item) => acc + item.rating, 0) / product.ratings.length;
  await product.save();

  response.redirect(`/product/${productId}`);
  }catch(error){
    console.error('Error',error)
    response.status(500).send('Internal Server Error')
  }
})


app.get('/Admin/orders/:id/mark-delivered',adminMiddleWare,async function(request,response){
  try{
    const order = await orderModel.findById(request.params.id)
    
    if(!order){
      return response.status(404).send('Order not found')
    }

    order.isDelivered = true;
    order.deliveredAt = Date.now();


    await order.save();

    response.redirect(`/Admin/orders/${order._id}`)
  }catch(error){
    console.error('Error marking order as delivered:',error);
    res.status(500).send('Server error occurred while updating delivery status');
  }
})

app.get('/Admin/product/create', adminMiddleWare, async function(request, response) {
  try {
    const adminUser = await userModel.findById(request.user.uid);
    response.render('Admin/create-product', { 
      error: null, 
      name: '', 
      description: '', 
      price: '', 
      category: '', 
      stock: '', 
      createdByEmail: '', 
      adminUser 
    });
  } catch (error) {
    console.error('Error rendering create product form:', error);
    response.status(500).send('Internal Server Error');
  }
});

// MiddleWare

// function profileMiddleWare(request,response,next){
//   if(!request.cookies.token){   
//     return response.redirect('/login') 
//   }
//   try{
//     let data = jwt.verify(request.cookies.token,secretKey);
//     request.user = data;
//     next();
//   }catch(error){
//     console.error("Invalid Token ",error);
//     response.cookie('token',"");
//     return response.redirect('/login')
//   }
// }

// function adminMiddleWare(request,response,next){
//   if(!request.cookies.token){
//     return response.redirect('/AdminLogin')
//   }
//   try{
//     let data = jwt.verify(request.cookies.token,"ASAFWR@$!@!$!#")
//     request.user = data
//     next();
//   }catch(error){
//     console.error("Invalud Token ",error)
//     response.cookie("token","");
//     response.redirect('/AdminLogin')
//   }
// }


app.use(express.static('public'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
