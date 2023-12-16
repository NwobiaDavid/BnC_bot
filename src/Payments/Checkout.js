require('dotenv').config();
const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
const { Markup } = require('telegraf');
const { Order, User, MenuItem } = require('../../models');
const mongoose = require('mongoose');
const axios = require('axios')


async function checkout(ctx, userCarts, existingCarts, bot, confirmation) {
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
                items: orderItems.filter((item) => item !== null),
                totalAmount: calculateTotalAmount(orderItems),
                status: 'Pending', // Default status
                createdAt: new Date(),
            });

            // Save the order to the database or perform any other necessary actions
            await order.save();

            // Clear the user's cart
            userCarts.set(userId, {});
            existingCarts.set(userId, {});

            sendOrderDetailsToGroup(order, user, orderItems, confirmation, bot)

            // Send a confirmation message to the user
            ctx.editMessageText('Your order has been placed! Thank you for shopping with us.', {
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

async function sendOrderDetailsToGroup(order, user, orderItems, confirmation, bot) {
    const groupId = process.env.ORDERS_GROUP_ID;
    console.log("item id-->", orderItems)

    const itemDetailsPromises = orderItems.map(async item => {

        const menuItem = await MenuItem.findById(item._id);
        console.log("menu ->", menuItem);
        const itemName = menuItem ? menuItem.itemName : 'Unknown Item';
        const itemPrice = menuItem ? menuItem.price : 'Unknown Item';
        return `${itemName} : #${itemPrice} (Qty: ${item.quantity || 1 })`;

    });

    const itemDetails = await Promise.all(itemDetailsPromises);

    const userName = user.name || 'Unknown User';
    const userRoomNumber = user.roomNumber || 'Unknown Room Number';
    console.log("this is the user ==>", user);

    const orderDetailsMessage = `
        New Order:\n\nCustomer: ${userName}\nRoom Number: ${userRoomNumber}\nTotal Amount: #${order.totalAmount}\n\nItems:\n ${itemDetails.join('\n')}\n\nCreated At: ${order.createdAt}\nStatus: ${confirmation}
    `;

    // Send the order details message to the group
    bot.telegram.sendMessage(groupId, orderDetailsMessage);
}


function calculateTotalAmount(orderItems) {
    // Sum up the prices of items with consideration to their quantities
    const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return totalAmount.toFixed(2); // Ensure totalAmount is rounded to two decimal places
}

function paymentOptions(ctx, userCarts, existingCarts, bot, totalAmount){
    ctx.editMessageText('Choose a payment option:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Bank Transfer', callback_data: 'bank_transfer' }],
            [{ text: 'Pay with PayStack', callback_data: 'pay_with_payStack' }],
          ],
        },
      });

      callbackss(ctx, userCarts, existingCarts, bot, totalAmount);
}

function callbackss(ctx, userCarts, existingCarts, bot, totalAmount){
    bot.action('bank_transfer',(ctx)=>{
        ctx.editMessageText(`Pay to this account \n and send a screenshot of the receipt to this contact @iamnwobiadavid \n Total Amount: #${totalAmount} `, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Confirm', callback_data: 'confirmation' }],
            ],
          },
        });
      } );

    bot.action('confirmation', (ctx) => {
        let confirmation = '#yet_to_be_confirmed';
        checkout(ctx, userCarts, existingCarts, bot, confirmation)
    })

    bot.action('pay_with_payStack', async(ctx) => {
        try {
            // Fetch the user document from the User collection
            const telegramId = ctx.from.id;
            const user = await User.findOne({ telegramId });

            if (!user) {
                ctx.reply('User not found. Please make sure you are registered.');
                return;
            }

            let confirmation = '#yet_to_be_confirmed';

            // TODO:fix/update the database from dollars to naira
            const userEmail = user.email;
            let integerNumber = Math.ceil(totalAmount);

           // Initiate PayStack payment with the user's email
        const paystackResponse = await paystack.transaction.initialize({
            email: userEmail,
            amount: integerNumber,
            ref: ''+Math.floor((Math.random() * 1000000000) + 1),
        });

        // Extract transaction reference from the PayStack response
        console.log('Transaction reference:--->', paystackResponse);
        const transactionReference = paystackResponse.data.reference; //boolean

        ctx.editMessageText('Payment initiated. Check your email for payment instructions...');

        // Now, wait for the payment to be confirmed
            try {
                const paymentStatus = await checkPaymentStatus(transactionReference);

                if (transactionReference) {

                    confirmation = '#confirmed';
                    ctx.editMessageText('Payment confirmed. Proceeding with order placement...');
                    checkout(ctx, userCarts, existingCarts, bot, confirmation);
                
                } else {
                    ctx.reply('Payment is pending. Please wait for confirmation.');
                }
            } catch (error) {
                console.error('Error checking payment status:', error);
                ctx.reply('There was an error checking the payment status. Please contact support.');
            }

        } catch (error) {
            console.error('Error initiating PayStack payment:', error);
            ctx.reply('There was an error initiating PayStack payment. Please try again.');
        }
    })

    // Function to check the payment status using the PayStack API
    async function checkPaymentStatus(reference) {
        try {
            const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                },
            });

            if (!response || !response.data || !response.data.data || !response.data.data.status) {
                throw new Error('Invalid PayStack response');
            }

            const status = response.status;
            return status === 'success' ? 'success' : 'pending';
        } catch (error) {
            console.error('Error checking payment status:', error);
            throw new Error('Error checking payment status');
        }
    }
}

module.exports = { paymentOptions};
