const mongoose = require('mongoose');
const { Markup } = require('telegraf');
const { MenuItem } = require('../../models');

async function manageCart(ctx, existingCarts) {
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
    
            const keyboard = Markup.inlineKeyboard([
              [Markup.button.callback('Checkout', 'checkout')],
            ]);
    
            ctx.editMessageText(`Your Cart:\n${cartMessage}`, keyboard);
          } else {
            ctx.reply('Some items in your cart could not be found.');
          }
    
          
        } else {
          ctx.reply('Your cart is empty.');
        }
}

module.exports = { manageCart }