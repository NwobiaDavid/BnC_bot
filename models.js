const mongoose = require('mongoose');

// User Model
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  matricNumber: { type: String, required: true },
  email: { type: String, required: true },
  roomNumber: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Menu Item Model
const menuItemSchema = new mongoose.Schema({
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true},
  itemName: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: {type: Number, required: true},
  imageOne: { type: String },
  imageTwo: { type: String },
});

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// Category Model
const categorySchema = new mongoose.Schema({
  category: { type: String, required: true },
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
})

const Category = mongoose.model('Category', categorySchema);

// Order Model
const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
  totalAmount: { type: Number, required: true },
  charges: { type: Number, required: true },
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now },
});

const Order = mongoose.model('Order', orderSchema);

module.exports = { User, MenuItem, Order, Category};
