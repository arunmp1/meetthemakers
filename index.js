const express = require('express')
const app = express()
const path = require('path')
const userModel = require('./models/user')
const requirementModel = require('./models/requirement')
const commentModel = require('./models/comment')
const postModel = require('./models/post')
const contactModel = require('./models/contact')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const multer = require('multer')


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve(`./public/uploads/`))
  },
  filename: function (req, file, cb) {
    const fileName = `${Date.now()} - ${file.originalname}`;
    cb(null,fileName);
  }
})

const upload = multer({storage:storage})

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())
const secretKey = "@SDAIFSIA@#+!#)!@"

app.set("view engine","ejs")
app.use(express.static(path.join(__dirname,'public')))


app.get('/',isLoggedIn,async function(request,response){
  if(!request.user){
    response.render('index')
  }else{
    let user = await userModel.findOne({_id:request.user.uid})
    response.render('index',{user})
  }
  
})

app.get('/profile',profileMiddleWare,async function(request,response){

  let user = await userModel.findOne({_id:request.user.uid})
  const userRequirements = await requirementModel.find({user:user._id})
  const userPosts = await postModel.find({createdBy:user._id})
  // console.log("userRequirements");
  // console.log(userRequirements)

  // Get ID of all user's content
  const requirementIds = userRequirements.map(req=>req._id)
  // console.log(requirementIds)
  const postIds = userPosts.map(post => post._id)  

  const recentRequiredComments = await commentModel.find({
    requirementId:{$in:requirementIds}
  }).sort({_id:-1})
  .limit(5)
  .populate('createdBy','name')
  .populate('requirementId','heading')

  // console.log(recentRequiredComments)
  const recentPostComments = await commentModel.find({
    postId:{$in:postIds}
  }).sort({_id:-1})
  .limit(5)
  .populate('createdBy','name')
  .populate('postId','title')

  const recentRequirementLikes = [];
  for(const req of userRequirements){
    if(req.likes && req.likes.length>0){
      const likeData = {
        type: 'requirement',
        contentId: req._id,
        title:req.heading,
        date:req.date
      }
      recentRequirementLikes.push(likeData)
    }
  }

  const recentPostRequirementsLikes = []
  for(const req of userPosts){
    // console.log(req)
    if(req.likes && req.likes.length>0){
      const likeData = {
        type:'post',
        contentId:req._id,
        title:req.title,
        date:req.Date
      }
      recentPostRequirementsLikes.push(likeData)
    }
  }

  console.log(recentRequirementLikes)
  console.log(recentPostRequirementsLikes)
  // console.log(recentRequirementComments)
  // console.log(recentPostComments)
  

  const activities = [
    ...recentPostComments.map(comment=>({
      type:'post_comments',
      user:comment.createdBy.name,
      title:comment.postId.title,
      time:comment._id.getTimestamp()
    })),
    ...recentRequiredComments.map(comment=>({
      type:'requirement_comments',
      user:comment.createdBy.name,
      title:comment.requirementId.heading,
      time:comment._id.getTimestamp()
    })),
    ...recentPostRequirementsLikes.map(like=>({
      type:like.type,
      title:like.title,
      date:like.date,
      time: like.date || new Date() 
    })),
    ...recentRequirementLikes.map(like=>({
      type:like.type,
      title:like.title,
      date:like.date,
      time: like.date || new Date() 
    }))
  ].sort((a, b) => b.time - a.time).slice(0, 5);
  // console.log(activities)



  response.render('profile',{user,activities})
})

app.get('/post/:id',profileMiddleWare,async function(request,response){
  console.log('HERE')
  // console.log(request.user);
  // let use = request.user;
  console.log(request.user)
  let post = await postModel.find({createdBy:request.user.uid});
  let user = await userModel.find({_id:request.user.uid})
  
  // let user = await userModel.findOne({request.user.uid});
  // response.send(post);
  response.render('UserProfilePost',{post,user});
})

app.get('/requirement/:id',profileMiddleWare,async function(request,response){
  // console.log(request.user);
  // let use = request.user;
  console.log(request.user)
  let post = await requirementModel.find({createdBy:request.user.user});
  let user = await userModel.find({_id:request.user.uid})
  let comment = await commentModel.find({requirementId:request.params.id})

  console.log(user);
  // let user = await userModel.findOne({request.user.uid});
  // response.send(post);
  response.render('UserProfileRequirement',{post,user,comment});    
})

app.get('/ImageRead/:id',profileMiddleWare,async function(request,response){

  let user = await userModel.find({_id:request.user.uid})
  let post = await postModel.findOne({_id:request.params.id}).populate('createdBy','name email')
  let comment = await commentModel.find({postId:request.params.id}).populate('createdBy')

  console.log(comment)

  let userLiked = post.likes.indexOf(request.user.uid) !== -1


  response.render('description',{post,user,userLiked,comment})
})

app.get('/ImageRead/like/:id',profileMiddleWare,async function(request,response){
  console.log('entered')
  let post = await postModel.findOne({_id:request.params.id}).populate('createdBy')
 
  if(post.likes.indexOf(request.user.uid) === -1){
    post.likes.push(request.user.uid)
  }else{
    post.likes.splice(post.likes.indexOf(request.user.uid),1)
  }

  console.log(request.user.uid)
  await post.save()

  response.redirect(`/ImageRead/${request.params.id}`)
})

app.post('/ImageRead/comment/:id',profileMiddleWare,async function(request,response){
  console.log(request.body)

  let {content} = request.body  
  let post = await postModel.findOne({_id:request.params.id})
  console.log(post)

  let comment = await commentModel.create({
    content,
    postId: request.params.id,
    createdBy:request.user.uid
  })

  post.comments.push(comment._id)
  
  await post.save();

  response.redirect(`/ImageRead/${request.params.id}`)
})

app.get('/read/:id',profileMiddleWare,async function(request,response){
  // console.log('entered')
  let requirement = await requirementModel.findOne({_id:request.params.id}).populate('user')
  let user = await userModel.findOne({_id:request.user.uid})
  let comment = await commentModel.find({requirementId:request.params.id}).populate('createdBy','_id name email')
  // console.log(comment.createdBy.name);
  let userLiked = requirement.likes.indexOf(request.user.uid) !== -1

 
  response.render('descriptionRequirement',{requirement,user,userLiked,comment})
})
  
app.get('/read/like/:id',profileMiddleWare,async function(request,response){
  console.log('read')
  let requirement = await requirementModel.findOne({_id:request.params.id}).populate('user')

  if(requirement.likes.indexOf(request.user.uid) === -1){
    requirement.likes.push(request.user.uid)
  }else{
    requirement.likes.splice(requirement.likes.indexOf(request.user.uid),1)
  }

  await requirement.save();

  response.redirect(`/read/${request.params.id}`);
})

app.post('/read/comment/:id',profileMiddleWare,async function(request,response){
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

})

app.post('/read/delete-comment/:id',profileMiddleWare,async function(request,response){
  const comment = await commentModel.findById(request.params.id);

  await commentModel.findByIdAndDelete(request.params.id)

  response.redirect('/read/'+comment.requirementId);

})


app.get('/signup',function(request,response){
  response.render('signup')
})

app.get('/login',function(request,response){
  response.render('login')
})
           
app.post('/signup', async function(request,response){
  let {name,email,password} = request.body;
  let registered = await userModel.findOne({email});
  console.log(registered)
  if(registered){
    return response.status(409).json({
      status:'error',
      message:"User Already registered"
    })
  }else{
    bcrypt.genSalt(10,function(error,salt){
      bcrypt.hash(password,salt,async function(error,hash){
        let user = await userModel.create({
          name,
          email,
          password:hash,
        })
        let token = jwt.sign({email:email,uid:user._id},secretKey)
        response.cookie("token",token)
        return response.status(200).json({
          status:'success',
          message:'Registration successfull'
        })
    
      })
    })
  }
})

app.post('/login',async function(request,response){
  let {email,password} = request.body;
  let user = await userModel.findOne({email})
  if(!user){
    return response.status(401).json({
      status:'error',
      message:'Either Email-Id or Password is Incorrect'
    })
  }else{
    console.log("User does exist")
    bcrypt.compare(password,user.password,function(error,result){
      if(result){
        console.log("Correct")
        let token = jwt.sign({email:email,uid:user._id},secretKey)
        response.cookie("token",token)
        response.status(200).json({
          status:'success',
          message:'Login Successful'
        })
      }else{
       return response.status(401).json({
        status:'error',
        message:'Either Email-Id or Password is Incorrect'
       })
      }
    })
  }

})
      
app.get('/logout',function(request,response){
  response.cookie('token','')
  response.redirect('/login');
})

app.get('/discovers',isLoggedIn,async function(request,response){
  let requirement = await requirementModel.find({}).populate('user','name');

  if(!request.user){
    response.render('marketPlace',{requirement});
  }else{
    let user = await userModel.findOne({_id:request.user.uid})
    response.render('marketPlace',{user,requirement})
  }

})

app.post('/requirement',isLoggedIn,async function(request,response){
  let who = await userModel.findOne({email:request.user.email})

  let {heading,content,price,quantity} = request.body;
  let reqPost = await requirementModel.create({
    user:who._id,
    heading:heading,
    content:content,
    price:price,
    quantity:quantity
  })
  who.requirements.push(reqPost._id)
  await who.save()

  response.redirect('/discovers');
})

app.get('/creation',isLoggedIn,async function(request,response){
  let post = await postModel.find({}).populate('createdBy','name')
  console.log(post)
  if(!request.user){
    response.render('makers',{post});
  }else{
    let user = await userModel.findOne({_id:request.user.uid})
    response.render('makers',{user,post})
  }
})

app.post('/creation',isLoggedIn,upload.single("coverImage"),async function(request,response){
  let who = await userModel.findOne({email:request.user.email})

  let {title,body} = request.body;
  let post = await postModel.create({
    createdBy:who._id,
    title:title,
    body:body,
    coverImage:`/uploads/${request.file.filename}`
  })

  who.post.push(post._id)
  await who.save();

  response.redirect('/creation')
})
     
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


app.get('/DeleteRequirement/:id',profileMiddleWare,async function(request,response){
  const requirementId = request.params.id;
  const user = await userModel.findById(request.user.uid)

  user.requirements = user.requirements.filter(requirements => requirements.toString() !== requirementId)
  await user.save();

  await requirementModel.findByIdAndDelete(request.params.id)
  response.redirect(`/requirement/${request.user.uid}`)
})


app.get('/EditRequirement/:id',profileMiddleWare,async function(request,response){

  let user = await userModel.findById(request.user.uid)
  let post = await requirementModel.findById(request.params.id);
  console.log(post)

  response.render('Edit',{post,user});
})

app.post('/Requirement/update/:id',profileMiddleWare,async function (request,response) {
  // console.log('Entered')
  let {heading,content,price,quantity} = request.body;

  const post = await requirementModel.findOneAndUpdate({_id:request.params.id},{heading,content,price,quantity})
  console.log(post)
  const updatedPost = await requirementModel.findById(request.params.id)
  console.log(updatedPost)  
  
  response.redirect(`/requirement/${request.user.uid}`)


})


app.get('/EditPost/:id',profileMiddleWare,async function (request,response) {
  let user = await userModel.findById(request.user.uid)
  let post = await postModel.findById(request.params.id)
  response.render('EditPhoto',{post,user})
})

app.post('/EditPost/update/:id',profileMiddleWare,async function(request,response){
  let {body,title} = request.body;

  const post = await postModel.findOneAndUpdate({_id:request.params.id},{title:title,body:body})

  response.redirect(`/post/${request.user.uid}`)
})

app.get('/admin',async function(request,response){
    const userCount = await userModel.countDocuments();
    const postCount = await postModel.countDocuments();
    const requirementCount = await requirementModel.countDocuments();
    const commentCount = await commentModel.countDocuments();
    const contactMessage = await contactModel.countDocuments();
    const users = await userModel.find().sort({_id:-1}).limit(5)
    const posts = await postModel.find().sort({_id:-1}).limit(5).populate('createdBy','name email')
    const requirements = await requirementModel.find().sort({_id:-1}).limit(5).populate('user','name email')
    response.render(`./Admin/dashboard`,{
      userCount,postCount,requirementCount,commentCount,contactMessage,users,posts,requirements
    })
})

app.get('/admin/users',async function(request,response){
  
  const users = await userModel.find().sort({_id:-1})

  response.render(`./Admin/users`,{users})
})

app.get('/admin/users/:id/delete',async function(request,response){
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

  response.redirect('/admin/users')
  
})


app.get('/admin/posts',async function(request,response){
  const posts = await postModel.find().sort({_id:-1}).populate('createdBy','name email')
  console.log(posts);
  response.render(`./Admin/post`,{posts})
})

app.get('/admin/post/:id/delete', async function(request,response){
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

  response.redirect('/admin/posts')

})


app.get('/admin/requirements',async function(request,response){
  const requirements = await requirementModel.find().sort({_id:-1}).populate('user','name email')

  response.render(`./admin/requirement`,{requirements})
})


app.get('/admin/requirement/:id/delete',async function (request,response) {
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
  response.redirect('/admin/requirements')

})


app.get('/admin/comments',async function(request,response){
  const comments = await commentModel.find().sort({_id:-1}).populate('createdBy','name email')
  response.render('./admin/comments',{comments})
})

app.get('/admin/comments/:id/delete',async function(request,response){
  const commentId = request.params.id;
  const comment = await commentModel.findById(commentId)

  await postModel.updateOne(
    {comments:commentId},{$pull:{comments:commentId}}
  )

  await requirementModel.updateOne(
    {comments:commentId},{$pull:{comments:commentId}}
  )

  await commentModel.findByIdAndDelete(commentId);

  response.redirect('/admin/comments');
})

app.get('/admin/contacts',async function(request,response){
  const contacts = await contactModel.find().sort({_id:-1})
  response.render('./admin/contact',{contacts})
})

app.get('/admin/contacts/:id/delete',async function(request,response){
  await contactModel.findByIdAndDelete(request.params.id)
  response.redirect('/admin/contacts')
})

// MiddleWare
function isLoggedIn(request,response,next){
  if(!request.cookies.token){
    return next();
  }else{
    let data = jwt.verify(request.cookies.token,secretKey)
     request.user = data;
    return next();
  } 
}   

function profileMiddleWare(request,response,next){
  if(!request.cookies.token){
    return response.redirect('/login')
  }
  try{
    let data = jwt.verify(request.cookies.token,secretKey);
    request.user = data;
    next();
  }catch(error){
    console.error("Invalid Token ",error);
    response.cookie('token',"");
    return response.redirect('/login')
  }
}

mongoose.connect('mongodb://localhost:27017/newProject')

app.listen(8000,console.log("Server is Running")) 