const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const { MenuItem, StoreItem } = require('../../models');
const { paymentOptions } = require('../Payments/Checkout');

var botx;
let currentItemIndex = 0;
let currentMessageId;
let currentCartMessage;

let totalAmount;

async function manageCart(ctx, bot, existingCarts, userCarts) {
    if(botx==undefined){
        botx = bot;
    }
    
    // currentItemIndex = 0;
    let totalCharges = 0; 

    const userId = ctx.from.id;
    const existingCart = existingCarts.get(userId) || {};

    if (Object.keys(existingCart).length > 0) {
        const itemDetails = await Promise.all(
            Object.keys(existingCart).map(async (itemId) => {
                const item = await MenuItem.findById(itemId) || await StoreItem.findById(itemId);
                return item
                    ? { name: item.itemName, quantity: existingCart[itemId], price: item.price }
                    : null;
            })
        );

        // Filter out items that couldn't be found
        const validItemDetails = itemDetails.filter((item) => item !== null);

        if (validItemDetails.length > 0) {
            const cartMessage = validItemDetails
                .map((item) => {
                    const itemName = item.name;
                    const itemQuantity = item.quantity;
                    const itemPrice = item.price;
                    const itemTotal = itemPrice * itemQuantity;

                    // Calculate charges based on both item price and quantity
                    let charges = 0;
                    if (itemPrice < 200) {
                        charges = itemQuantity * 50;
                    } else if (itemPrice >= 200 && itemPrice <= 800) {
                        charges = itemQuantity * 100;
                    } else if (itemPrice>800 && itemPrice<=1500){
                        charges = itemQuantity * 200;
                    }else if (itemPrice>1500 && itemPrice<=3000){
                        charges = itemQuantity * 300;
                    }else if (itemPrice>3000){
                        charges = itemQuantity * 500;
                    }

                    // Sum up charges for each item
                    totalCharges += charges;

                    return `${itemName} (Qty: ${itemQuantity}) - $${itemTotal} (+ Charges: $${charges})`;
                })
                .join('\n');
                // console.log('item', validItemDetails)
                totalAmount = calculateTotalAmount(validItemDetails);

                // Calculate charges based on both item price and quantity
                let charges = 0;
                if (totalAmount < 200) {
                    charges += 50;
                } else if (totalAmount >= 200 && totalAmount <= 800) {
                    charges += 100;
                } else if (totalAmount>800 && totalAmount<=1500){
                    charges += 200;
                }else if (totalAmount>1500 && totalAmount<=3000){
                    charges += 300;
                }else if (totalAmount>3000){
                    charges += 500;
                }

                // Sum up charges for each item
                totalCharges += charges;

                    const keyboard = Markup.inlineKeyboard([
                        [Markup.button.callback('Edit Cart', 'edit_cart'), Markup.button.callback('Checkout', 'checkout')],
                        [Markup.button.callback('Back to Categories', 'browsing_categories') , Markup.button.callback('Back to Stores', 'browsing_stores')],
                    ]);

                    // Send a new message with the updated content
                    const editedMessage = await ctx.editMessageText(`Your Cart:\n${cartMessage}\n\nTotal Amount: #${totalAmount}\nTotal Charges: #${totalCharges}`, keyboard);
                    currentMessageId = editedMessage.message_id; // Update the current message ID
                    currentCartMessage = cartMessage; // Update the current cart message

                   callbackss(ctx,userCarts, existingCarts, bot, totalCharges);
        } else {
            ctx.reply('Some items in your cart could not be found.');
        }
    } else {
        ctx.reply('Your cart is empty.');
    }
}

function calculateTotalAmount(itemDetails) {
    const totalAmount = itemDetails.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return totalAmount.toFixed(2); // Ensure totalAmount is rounded to two decimal places
}

async function editCart(ctx, userCarts, existingCarts, bot) {
    try {
        const userId = ctx.from.id;
        const userCart = userCarts.get(userId) || {};
        const existingCart = existingCarts.get(userId) || {};

        const itemsInCart = [];

        for (const itemId in existingCart) {
            const quantityInExistingCart = existingCart[itemId];
            const quantityInUserCart = userCart[itemId] || 0;

            const itemDetails = await MenuItem.findById(itemId) || await StoreItem.findById(itemId);
            if (itemDetails) {
                itemsInCart.push({
                    id: itemId,
                    name: itemDetails.itemName,
                    existingQuantity: quantityInExistingCart,
                    userQuantity: quantityInUserCart,
                });
            }
        }

        if (itemsInCart.length > 0 ) {
            // console.log("this is currentItemIndex",currentItemIndex)
            // console.log("this is itemsInCart.length",itemsInCart.length )
            if(currentItemIndex == itemsInCart.length) currentItemIndex--;
           if(currentItemIndex < itemsInCart.length){

            const currentCartItem = itemsInCart[currentItemIndex];
            const cartEditMessage = `Editing: ${currentCartItem.name}: ${currentCartItem.existingQuantity}`;

            if (cartEditMessage !== currentCartMessage) {
                const keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback('Increase Quantity', `increase_quantity_${currentCartItem.id}`), Markup.button.callback('Decrease Quantity', `decrease_quantity_${currentCartItem.id}`)],
                    [Markup.button.callback('Remove Item', `remove_item_${currentCartItem.id}`)],
                    // [Markup.button.callback('Remove All Items', 'remove_all_items')],
                    [Markup.button.callback('Back to Cart', 'back_to_cart')],
                    // Show 'Previous' and 'Next' buttons on the same line
        ...(currentItemIndex > 0 || currentItemIndex < itemsInCart.length - 1
            ? [
                  [
                      ...(currentItemIndex > 0
                          ? [Markup.button.callback('Previous', 'previous_item')]
                          : []),
                      ...(currentItemIndex < itemsInCart.length - 1
                          ? [Markup.button.callback('Next', 'next_item')]
                          : []),
                  ],
              ]
            : []),
                    [Markup.button.callback('Back to Home', 'browsing_categories')],
                ]);

                await ctx.editMessageText(`Edit Cart:\n${cartEditMessage}`, keyboard);
                currentCartMessage = cartEditMessage;

                registerItemCallbacks(ctx, userCarts, existingCarts, itemsInCart[currentItemIndex], bot, itemsInCart);
            } 
            }
        }else {
            ctx.editMessageText('Your cart is empty.', Markup.button.callback('Back to home', 'browsing_categories'));  // Say "cart is empty" only if all items are removed
        }
    } catch (error) {
        console.error('Error editing cart:', error);
        ctx.reply('There was an error editing your cart. Please try again.');
    }
}

async function callbackss(ctx, userCarts, existingCarts, bot, totalCharges){
    const inst =botx
    // console.log(inst)

    inst.action('edit_cart', async (ctx) => {
        // Call the editCart function to handle the 'edit_cart' callback
    editCart(ctx, userCarts, existingCarts, bot);
    });

    inst.action('checkout', async(ctx) => {
        // console.log('totalAmount==>', totalAmount)
        await paymentOptions(ctx, userCarts, existingCarts, bot, totalAmount, totalCharges);
    });
}



async function registerItemCallbacks(ctx, userCarts, existingCarts, item, bot, itemsInCart) {
    const { id } = item;
    // console.log(botx)
    botx.action(/increase_quantity_(.+)/, (ctx) => {
        const itemId = ctx.match[1];
        updateCartItemQuantity(ctx, userCarts, existingCarts, itemId, 1, bot);
    });

    botx.action(/decrease_quantity_(.+)/, (ctx) => {
        const itemId = ctx.match[1];
        updateCartItemQuantity(ctx, userCarts, existingCarts, itemId, -1, bot);
    });

    botx.action(/remove_item_(.+)/, (ctx) => {
        const itemId = ctx.match[1];
        // currentItemIndex = Math.max(0, currentItemIndex - 1);

        removeCartItem(ctx, userCarts, existingCarts, itemId, bot);
    });

    botx.action('previous_item', (ctx) => {
        // Decrement the current item index and handle bounds
        currentItemIndex = Math.max(0, currentItemIndex - 1);
        editCart(ctx, userCarts, existingCarts, bot);
    });

    botx.action('back_to_cart', (ctx) => { 
        manageCart(ctx, userCarts, existingCarts, bot); 
    });

    botx.action('next_item', (ctx) => {
        // Increment the current item index and handle bounds
        currentItemIndex = Math.min(itemsInCart.length - 1, currentItemIndex + 1);
        editCart(ctx, userCarts, existingCarts, bot);
    });
}

async function updateCartItemQuantity(ctx, userCarts, existingCarts, itemId, quantityChange, bot) {
    try {
        const userId = ctx.from.id;
        const userCart = userCarts.get(userId) || {};
        const existingCart = existingCarts.get(userId) || {};

        const currentQuantityInUserCart = userCart[itemId] || 0;
        const currentQuantityInExistingCart = existingCart[itemId] || 0;

        const newQuantityInUserCart = Math.max(0, currentQuantityInUserCart - currentQuantityInExistingCart + quantityChange);
        const newQuantityInExistingCart = Math.max(0, currentQuantityInExistingCart + quantityChange);

        // Update the existing cart
        userCart[itemId] = newQuantityInUserCart;
        userCarts.set(userId, userCart);

        // Update the existing cart
        existingCart[itemId] = newQuantityInExistingCart;
        existingCarts.set(userId, existingCart);

        // Refresh the cart edit message
        await editCart(ctx, userCarts, existingCarts, bot);
    } catch (error) {
        console.error('Error updating cart item quantity:', error);
        ctx.reply('There was an error updating the cart item quantity. Please try again.');
    }
}

async function removeCartItem(ctx, userCarts, existingCarts, itemId, bot) {
    try {
        const userId = ctx.from.id;
        const userCart = userCarts.get(userId) || {};
        const existingCart = existingCarts.get(userId) || {};

        // Remove the item from both user and existing carts
        delete userCart[itemId];
        delete existingCart[itemId];

        // Update the user cart
        userCarts.set(userId, userCart);

        // Update the existing cart
        existingCarts.set(userId, existingCart);

        // Refresh the cart edit message
        await editCart(ctx, userCarts, existingCarts, bot);
    } catch (error) {
        console.error('Error removing cart item:', error);
        ctx.reply('There was an error removing the cart item. Please try again.');
    }
}

module.exports = { manageCart };
