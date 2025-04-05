const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
  name:{
    type:String,
    required:true
  },
  email:{
    type:String,
    required:true,
    unique:true,
    lowecase:true,
    trim:true
  },
  password:{
    type:String,
    require:true
  },
  role:{
    type:String,
    enum:['user','admin'],
    default:'user'
  },
  post:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:"post"
  }],
  createdAt:{
    type:Date,
    default:Date.now
  },
  isActive:{
    type:Boolean,
    default:true
  },
  requirements:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:"requirement"
  }],
  comment:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:"comment"
  }],
  addresses:[{
    street:String,
    city:String,
    state:String,
    postalCode:String,
    country:String
  }],
  orders:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Order'
  }],
  wishlist:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Product'
  }]
})



module.exports = mongoose.model('user',userSchema)