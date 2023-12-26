require('dotenv').config();
const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
const { Markup } = require('telegraf');
const { Order, User, MenuItem, StoreItem, Store } = require('../../models');
const mongoose = require('mongoose');
const axios = require('axios')


async function checkout(ctx, userCarts, existingCarts, bot, confirmation, order_status, totalCharges) {
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
            // Fetch order details for both menu and store items
        const orderItemsPromises = Object.keys(existingCart).map(async (itemId) => {
            const menuDetails = await getItemDetails(itemId, MenuItem,existingCart);
            const storeDetails = await getItemDetails(itemId, StoreItem, existingCart);

            return menuDetails || storeDetails;
        });

        const orderItems = await Promise.all(orderItemsPromises);
                let totalAmount = calculateTotalAmount(orderItems)
            const order = new Order({
                user: userId,
                items: orderItems.filter((item) => item !== null),
                totalAmount: totalAmount,
                charges: totalCharges,
                status: order_status,
                createdAt: new Date(),
            });

            // Save the order to the database or perform any other necessary actions
            await order.save();

            const storex =[]

            const storeDetailsPromise = orderItems.map(async(item)=> {
                const storeItem = await StoreItem.findById(item._id)
                // storex.push(storeItem);

                const storeItemName= storeItem? storeItem.store : 'unknown'
                console.log('store item name '+storeItemName)
                const store = await Store.findOne({_id: storeItemName})
                console.log("store var -- "+store)
                const ownerId = store.ownerId;

                storex.push(ownerId)

            })

            const storeDetails = await Promise.all(storeDetailsPromise)

            console.log('this is storeDetailsx--'+storex)

            // Clear the user's cart
            userCarts.set(userId, {});
            existingCarts.set(userId, {});

            callbackss(ctx, userCarts, existingCarts, bot, totalAmount, totalCharges, userId)
            // sendOrderDetailsToGroup(order, user, orderItems, confirmation, bot,userCarts, existingCarts,telegramId, userId)
            
            sendOrderDetailsToOwner(order, user, orderItems, confirmation, bot, userCarts, existingCarts, telegramId, userId, storex );
            // Retrieve ownerId from the first non-null storeDetails
            // const ownerId = orderItems.find(item => item && item.store);
            // console.log("ownerId==>",ownerId)
            // if (ownerId && ownerId.ownerId) {
            //     sendOrderDetailsToOwner(order, user, orderItems, confirmation, bot, userCarts, existingCarts, telegramId, userId, ownerId.ownerId);
            // } else {
            //     console.error('Owner ID not found.');
            // }
            

            // Send a confirmation message to the user
            ctx.editMessageText('Your order has been placed! Thank you for shopping with us.\nPlease join our Telegram channel to get notified when we post any Updates @voom_official_channel', {
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

async function getItemDetails(itemId, model, existingCart) {
    // console.log('the model ->'+ model)
    // console.log('the existing cart ->'+ existingCart)
    const item = await model.findById(itemId);
    return item
        ? { _id: item._id, quantity: existingCart[itemId], price: item.price }
        : null;
}

async function sendOrderDetailsToOwner(order, user, orderItems, confirmation, bot, userCarts, existingCarts, telegramId, userId, storex) {
    try {
        const groupId = process.env.ORDERS_GROUP_ID;
        if (storex.length > 0) {
            let ownerUsernames = [];
            for (let ownerChatId of storex) {
                try {
                    const ownerChat = await bot.telegram.getChat(ownerChatId);
                    if (ownerChat && ownerChat.username) {
                        ownerUsernames.push(`@${ownerChat.username}`);
                    } else {
                        console.error(`Owner chat ID ${ownerChatId} not found or does not have a username.`);
                    }
                } catch (getChatError) {
                    console.error(`Error getting chat info for ID ${ownerChatId}:`, getChatError.message);
                    console.error('Error details:', getChatError.response);
                }
            }

            if (ownerUsernames.length > 0) {
                const itemDetailsPromises = orderItems.map(async (item) => {
                    const storeItem = await StoreItem.findById(item._id);
                    console.log("store ->", storeItem);

                    const itemName = storeItem ? storeItem.itemName : 'Unknown Item';
                    const itemPrice = storeItem ? storeItem.price : 'Unknown Item';

                    // Reduce the quantity for each item in the database
                    if (storeItem && storeItem.quantity >= item.quantity) {
                        storeItem.quantity -= item.quantity;
                        await storeItem.save();
                    } else {
                        console.error(`Error updating quantity for item: ${itemName}`);
                    }

                    return `${itemName} : #${itemPrice} (Qty: ${item.quantity || 1 })`;
                });

                const itemDetails = await Promise.all(itemDetailsPromises);

                const userName = user.name || 'Unknown User';
                const userRoomNumber = user.roomNumber || 'Unknown Room Number';

                const orderDetailsMessage = `
                    New Order:\n\nCustomer: ${userName}\nRoom Number: ${userRoomNumber}\nTotal Amount: #${order.totalAmount}\n\nItems:\n ${itemDetails.join('\n')}\n\nCreated At: ${order.createdAt}\nStatus: ${confirmation}\n\nOwners: ${ownerUsernames.join(', ')}
                `;

                // Send the order details message to the group
                bot.telegram.sendMessage(groupId, orderDetailsMessage);
            } else {
                console.error('No store orders');
            }
        }
    } catch (error) {
        console.error('Error sending order details to owner:', error);
    }
}




async function sendOrderDetailsToGroup(order, user, orderItems, confirmation, bot, userCarts, existingCarts,telegramId, userId) {
    const groupId = process.env.ORDERS_GROUP_ID;
    console.log("item id-->", orderItems)

    const itemDetailsPromises = orderItems.map(async (item) => {
        const menuItem = await MenuItem.findById(item._id);
        console.log("menu ->", menuItem);

        const itemName = menuItem ? menuItem.itemName : 'Unknown Item';
        const itemPrice = menuItem ? menuItem.price : 'Unknown Item';

        // Reduce the quantity for each item in the database
        if (menuItem && menuItem.quantity >= item.quantity) {
            menuItem.quantity -= item.quantity;
            await menuItem.save();
        } else {
            console.error(`Error updating quantity for item: ${itemName}`);
        }

        return `${itemName} : #${itemPrice} (Qty: ${item.quantity || 1 })`;
    });

    const itemDetails = await Promise.all(itemDetailsPromises);

    const userName = user.name || 'Unknown User';
    const userRoomNumber = user.roomNumber || 'Unknown Room Number';

    const orderDetailsMessage = `
        New Order:\n\nCustomer: ${userName}\nRoom Number: ${userRoomNumber}\nTotal Amount: #${order.totalAmount}\n\nItems:\n ${itemDetails.join('\n')}\n\nCreated At: ${order.createdAt}\nStatus: ${confirmation}
    `;

    // Send the order details message to the group
    bot.telegram.sendMessage(groupId, orderDetailsMessage);

    // // Clear the user's cart
    // userCarts.set(telegramId, {});
    // existingCarts.set(telegramId, {});
}


function calculateTotalAmount(orderItems) {
    // Sum up the prices of items with consideration to their quantities
    const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return totalAmount.toFixed(2); // Ensure totalAmount is rounded to two decimal places
}

function paymentOptions(ctx, userCarts, existingCarts, bot, totalAmount, totalCharges){
    ctx.editMessageText('Choose a payment option:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Bank Transfer', callback_data: 'bank_transfer' }],
            [{ text: 'Pay with PayStack', callback_data: 'pay_with_payStack' }],
            [{ text: 'Back', callback_data: 'browse_mainmenu' }],
          ],
        },
      });

      callbackss(ctx, userCarts, existingCarts, bot, totalAmount,totalCharges );
}

let order_status = 'Pending'

function callbackss(ctx, userCarts, existingCarts, bot, totalAmount, totalCharges, userId){
    bot.action('payment_option', (ctx)=>{
        ctx.editMessageText('Choose a payment option:', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Bank Transfer', callback_data: 'bank_transfer' }],
                [{ text: 'Pay with PayStack', callback_data: 'pay_with_payStack' }],
                [{ text: 'Back', callback_data: 'browse_mainmenu' }],
              ],
            },
          });
    })
    
    bot.action('bank_transfer',(ctx)=>{
        let total = Number(totalAmount)+Number(totalCharges);
        ctx.editMessageText(`Pay to this account\n\nAccount Number: 22113290\nBank: UBA\nAccount Name: Nwobia David Uchechi \n\nand send a screenshot of the receipt to this contact @iamnwobiadavid \n Total Amount: #${total}(charges included) `, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Confirm', callback_data: 'confirmation' }],
              [{text: 'Back', callback_data: 'payment_option'}]
            ],
          },
        });
      } );

    bot.action('confirmation', (ctx) => {
        let confirmation = '#yet_to_be_confirmed';
        checkout(ctx, userCarts, existingCarts, bot, confirmation, order_status, totalCharges)
    })

    let transactionReference;
    let confirmation_paystack
    bot.action('pay_with_payStack', async(ctx) => {
        try {
            // Fetch the user document from the User collection
            const telegramId = ctx.from.id;
            const user = await User.findOne({ telegramId });

            if (!user) {
                ctx.reply('User not found. Please make sure you are registered.');
                return;
            }

            confirmation_paystack = '#yet_to_be_confirmed';

            // TODO: fix/update the database from dollars to naira
            const userEmail = user.email;
            const integerAmount = Math.ceil((Number(totalAmount) +Number(totalCharges)))*100; // Amount in kobo
            
            console.log("*****integer amount*****", integerAmount);
            console.log("total charges==>",totalCharges);
            // Initiate PayStack payment with the user's email
            const paystackResponse = await paystack.transaction.initialize({
                email: userEmail,
                amount: integerAmount,
                ref: '' + Math.floor((Math.random() * 1000000000) + 1),
            });

            // Extract transaction reference from the PayStack response
            console.log('PayStack Response:--->', paystackResponse);
            transactionReference = paystackResponse.data.reference;
            const transactionUrl = paystackResponse.data.authorization_url;

            if (transactionReference) {
                // Verify the transaction
            const verifyResponse = await paystack.transaction.verify(transactionReference);

            console.log("verify response-->", verifyResponse)
            if (verifyResponse && verifyResponse.data) {
                // Provide a payment link for the user
                
                const paymentLink = transactionUrl;

                // Send the payment link to the user
                ctx.editMessageText(
                    `Click the link below to make payment:\n${paymentLink}`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Confirm', callback_data: 'paystack_confirmation' },
                                    { text: 'Cancel', callback_data: 'cancel_payment' },
                                ],
                                [{text: 'Back', callback_data: 'payment_option'}]
                            ],
                        },
                    }
                );
            } else {
                ctx.reply('Error retrieving payment information. Please try again.');
            }
        } else {
            ctx.reply('Error initiating PayStack payment. Please try again.');
        }
        } catch (error) {
            console.error('Error initiating PayStack payment:', error);
            ctx.reply('There was an error initiating PayStack payment. Please try again.');
        }
    });

    bot.action('paystack_confirmation', async (ctx) => {
        try {
            // if (!userId) {
            //     ctx.reply('User information not found. Please try again.');
            //     return;
            // }

            // const transactionReference = ctx.callbackQuery.data;
            console.log("this is the callback => ", transactionReference)

            // Verify the transaction
            const verifyResponse = await paystack.transaction.verify(transactionReference);

            console.log("verify response 222 -->", verifyResponse);

            if (verifyResponse && verifyResponse.data && verifyResponse.data.status === 'success') {
               
                order_status='Completed';
                   // Transaction was successful
                    confirmation_paystack="#confirmed"
                    // ctx.editMessageText('Payment successful! Thank you for your purchase.');
                    checkout(ctx, userCarts, existingCarts, bot, confirmation_paystack, order_status, totalCharges)
               
                
                
            } else {
                // Transaction was not successful
                ctx.reply('Payment failed. Please try again or contact support.');
            }
        } catch (error) {
            console.error('Error verifying PayStack transaction:', error);
            ctx.reply('There was an error verifying the PayStack transaction. Please try again or contact support.');
        }
    });


    bot.action('cancel_payment', (ctx) => {
        ctx.editMessageText('Payment canceled. If you have any questions, please contact support. @iamnwobiadavid');
    });
}

module.exports = { paymentOptions};
