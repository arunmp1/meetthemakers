const mongoose = require('mongoose')

const cartSchema = new mongoose.Schema({
  user:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'user',
    required:true
  },
  cartItems:[{
    products:{
      type:mongoose.Schema.Types.ObjectId,
      ref:'product',
      required:true
    },
    quantity:{
      type:Number,
      required:true,
      min:1,
      default:1
    }
  }]
})

module.exports = mongoose.model('cart',cartSchema)