const mongoose = require('mongoose')

const postSchema = mongoose.Schema({
  title:{
    type:String,
    required:true,
  },
  body:{
    type:String,
    required:true
  },
  coverImage:{
    type:String,
    required:true
  },
  Date:{
    type:Date,
    default:Date.now
  },
  createdBy:
  {
    type:mongoose.Schema.Types.ObjectId,
    ref:"user"
  },
  likes:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:"user"
  }],
  comments:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:'comment'
  }]
})

module.exports = mongoose.model("post",postSchema)

