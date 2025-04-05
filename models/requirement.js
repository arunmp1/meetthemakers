// ./models/requirement.js
const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema({
    heading: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    }],
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'comment'
    }],
    coverImage: {
        data: {
            type: Buffer,
            required: false // Made optional
        },
        contentType: {
            type: String,
            required: false // Made optional
        }
    }
});

module.exports = mongoose.model('requirements', requirementSchema);