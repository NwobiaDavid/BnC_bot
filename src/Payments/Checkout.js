const { Markup } = require('telegraf');
const { Order, User, MenuItem } = require('../../models');
const mongoose = require('mongoose');

async function checkout(ctx, userCarts, existingCarts, bot) {
    try {
        const telegramId = ctx.from.id;
        console.log("the Telegram user's id-->", telegramId);

        // Fetch the user document from the User collection
        const user = await User.findOne({ telegramId });

        if (!user) {
            ctx.reply('User not found. Please make sure you are registered.');
            return;
        }

        const userId = user._id;

        const userCart = userCarts.get(telegramId) || {};
        const existingCart = existingCarts.get(telegramId) || {};

        console.log("existing cart--->", existingCart);

        // Check if the cart is not empty
        if (Object.keys(existingCart).length > 0) {
            const orderItems = await Promise.all(
                Object.keys(existingCart).map(async (itemId) => {
                    const item = await MenuItem.findById(itemId);
                    return item
                        ? { _id: item._id, quantity: existingCart[itemId], price: item.price }
                        : null;
                })
            );

            const order = new Order({
                user: userId,
                items: orderItems.filter((item) => item !== null), // Remove items that couldn't be found
                totalAmount: calculateTotalAmount(orderItems),
                status: 'Pending', // Default status
                createdAt: new Date(),
            });

            // Save the order to the database or perform any other necessary actions
            await order.save();

            // Clear the user's cart
            userCarts.set(userId, {});
            existingCarts.set(userId, {});

            // Send a confirmation message to the user
            ctx.reply('Your order has been placed! Thank you for shopping with us.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Main Menu', callback_data: 'browse_mainmenu' }],
                    ],
                }
            });
        } else {
            ctx.reply('Your cart is empty. Please add items to your cart before checking out.');
        }
    } catch (error) {
        console.error('Error during checkout:', error);
        ctx.reply('There was an error during checkout. Please try again.');
    }
}

function calculateTotalAmount(orderItems) {
    // Sum up the prices of items with consideration to their quantities
    const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return totalAmount.toFixed(2); // Ensure totalAmount is rounded to two decimal places
}

module.exports = { checkout };
