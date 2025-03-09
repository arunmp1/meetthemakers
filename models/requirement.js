const mongoose = require('mongoose')

const requirementSchema = mongoose.Schema({
  heading:String,
  content:String,
  date:{
    type:Date,
    default:Date.now
  },
  price:{
    type:Number,
  },
  quantity:{
    type:Number,
  },
  user:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'user'
  },
  likes:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:'user'
  }],
  comments:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:'comment'
  }]

})

module.exports = mongoose.model('requirements',requirementSchema)
