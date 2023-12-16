const { Markup } = require('telegraf');
const { Order, User } = require('../../models');
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
            const order = new Order({
                user: userId,
                items: Object.keys(existingCart).map(itemId => ({ _id: itemId, quantity: existingCart[itemId] })),
                totalAmount: calculateTotalAmount(existingCart),
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

function calculateTotalAmount(cart) {
    // Assuming each item in the cart has a 'price' property
    const itemPrices = Object.values(cart).map(item => item.price || 0);

    // Sum up the item prices to calculate the total amount
    const totalAmount = itemPrices.reduce((sum, price) => sum + price, 0);

    return totalAmount;
}

module.exports = { checkout };
