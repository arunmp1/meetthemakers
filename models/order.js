// ./models/order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    orderItems: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true,
            min: 0 // Ensure price isn’t negative
        }
    }],
    shippingAddress: {
        street: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        postalCode: {
            type: String,
            required: true
        },
        country: {
            type: String,
            required: true
        }
    },
    paymentMethod: {
        type: String,
        required: true
    },
    paymentResult: {
        id: {
            type: String,
            required: false // Optional, set only after payment
        },
        status: {
            type: String,
            required: false
        },
        update_time: {
            type: String,
            required: false
        },
        email_address: {
            type: String,
            required: false
        }
    },
    taxPrice: {
        type: Number,
        required: true,
        default: 0.0,
        min: 0 // Ensure non-negative
    },
    shippingPrice: {
        type: Number,
        required: true,
        default: 0.0,
        min: 0 // Ensure non-negative
    },
    totalPrice: {
        type: Number,
        required: true,
        default: 0.0,
        min: 0 // Ensure non-negative
    },
    isPaid: {
        type: Boolean,
        required: true,
        default: false
    },
    paidAt: {
        type: Date,
        required: false // Optional, set only when paid
    },
    isDelivered: {
        type: Boolean,
        required: true,
        default: false
    },
    deliveredAt: {
        type: Date,
        required: false // Optional, set only when delivered
    },
    createdAt: {
        type: Date,
        default: Date.now // Explicitly defined for clarity
    }
}, { timestamps: false }); // Set to false since we manually defined createdAt

module.exports = mongoose.model('order', orderSchema);