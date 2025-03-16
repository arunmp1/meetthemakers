const mongoose = require('mongoose');

const commentSchema = mongoose.Schema({
  content:{
    type:String,
    required:true
  },
  requirementId:{
    type: mongoose.Schema.Types.ObjectId,
    ref:"requirements"
  },
  postId:{
    type: mongoose.Schema.Types.ObjectId,
    ref:'post'
  },
  createdBy:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"user"
  }

})


module.exports = mongoose.model('comment',commentSchema)