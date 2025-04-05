// ./models/product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    images: [{
        data: {
            type: Buffer,
            required: true
        },
        contentType: {
            type: String,
            required: true
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true // Made required since admin route depends on it
    },
    ratings: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user'
        },
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String
    }],
    averageRating: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now // Explicitly defined instead of relying on timestamps
    }
}, { timestamps: false }); // Set to false since we defined createdAt manually

module.exports = mongoose.model('product', productSchema);