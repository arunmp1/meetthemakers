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
            ref: 'products', // Changed from 'product' to 'products'
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
            min: 0
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
            required: false
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
        min: 0
    },
    shippingPrice: {
        type: Number,
        required: true,
        default: 0.0,
        min: 0
    },
    totalPrice: {
        type: Number,
        required: true,
        default: 0.0,
        min: 0
    },
    isPaid: {
        type: Boolean,
        required: true,
        default: false
    },
    paidAt: {
        type: Date,
        required: false
    },
    isDelivered: {
        type: Boolean,
        required: true,
        default: false
    },
    deliveredAt: {
        type: Date,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: false });

module.exports = mongoose.model('order', orderSchema);
