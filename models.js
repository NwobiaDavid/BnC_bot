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
  itemName: { type: String, required: true },
  price: { type: Number, required: true },
});

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// Order Model
const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
  totalAmount: { type: Number, required: true },
  status: { type: String, default: 'Pending' },
});

const Order = mongoose.model('Order', orderSchema);

module.exports = { User, MenuItem, Order };
