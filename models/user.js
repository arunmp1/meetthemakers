const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
  name:{
    type:String
  },
  email:{
    type:String
  },
  password:{
    type:String,
    require:true
  },
  post:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:"post"
  }],
  requirements:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:"requirement"
  }],
  comment:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:"comment"
  }]
})



module.exports = mongoose.model('user',userSchema)