const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const { MenuItem } = require('../../models');

var botx;
let currentItemIndex = 0;
let currentMessageId;
let currentCartMessage;
async function manageCart(ctx, bot, existingCarts, userCarts) {
    if(botx==undefined){
        botx = bot;
    }
    
    // currentItemIndex = 0;

    const userId = ctx.from.id;
    const existingCart = existingCarts.get(userId) || {};

    if (Object.keys(existingCart).length > 0) {
        const itemDetails = await Promise.all(
            Object.keys(existingCart).map(async (itemId) => {
                const item = await MenuItem.findById(itemId);
                return item
                    ? { name: item.itemName, quantity: existingCart[itemId] }
                    : null;
            })
        );

        // Filter out items that couldn't be found
        const validItemDetails = itemDetails.filter((item) => item !== null);

        if (validItemDetails.length > 0) {
            const cartMessage = validItemDetails
                .map((item) => `${item.name}: ${item.quantity}`)
                .join('\n');

               // Check if the message ID has changed before editing
            // if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message.message_id !== currentMessageId) {
            //     // Check if the content has changed before editing
            //     if (cartMessage !== currentCartMessage) {

                    const keyboard = Markup.inlineKeyboard([
                        [Markup.button.callback('edit cart', 'edit_cart'), Markup.button.callback('Checkout', 'checkout')],
                        [Markup.button.callback('back to home', 'browsing_categories')],
                    ]);

                    // Send a new message with the updated content
                    const editedMessage = await ctx.editMessageText(`Your Cart:\n${cartMessage}`, keyboard);
                    currentMessageId = editedMessage.message_id; // Update the current message ID
                    currentCartMessage = cartMessage; // Update the current cart message

                   callbackss(ctx,userCarts, existingCarts, bot);
            //     }
            // }
            
        } else {
            ctx.reply('Some items in your cart could not be found.');
        }
    } else {
        ctx.reply('Your cart is empty.');
    }
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

            const itemDetails = await MenuItem.findById(itemId);
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
            console.log("this is currentItemIndex",currentItemIndex)
            console.log("this is itemsInCart.length",itemsInCart.length )
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
                    // Show 'Previous' button only if there are items before the current one
                    ...(currentItemIndex > 0 ? [[Markup.button.callback('Previous', 'previous_item')]] : []),
                    // Show 'Next' button only if there are items after the current one
                    ...(currentItemIndex < itemsInCart.length - 1 ? [[Markup.button.callback('Next', 'next_item')]] : []),
                    [Markup.button.callback('Back to home', 'browsing_categories')],
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

async function callbackss(ctx, userCarts, existingCarts, bot){
    const inst =botx
    console.log(inst)
    inst.action('edit_cart', async (ctx) => {
        // Call the editCart function to handle the 'edit_cart' callback
    editCart(ctx, userCarts, existingCarts, bot);
    });
}

async function registerItemCallbacks(ctx, userCarts, existingCarts, item, bot, itemsInCart) {
    const { id } = item;
    console.log(botx)
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

    botx.action('back_to_cart', (ctx) => { // Update the action name
        manageCart(ctx, userCarts, existingCarts, bot); // Use the correct function
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

        const newQuantityInUserCart = Math.max(0, currentQuantityInUserCart + quantityChange);
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
