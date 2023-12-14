// MenuActions.js
const mongoose = require('mongoose');
const { Markup } = require('telegraf');
const { MenuItem } = require('../../models');

 // Function to update user's temporary cart
 function updateUserCart(userId, itemId, quantityChange, userCarts) {
    // Get or initialize user's temporary cart
    const userCart = userCarts.get(userId) || {};
    const currentQuantity = userCart[itemId] || 0;

    // Update quantity
    const newQuantity = Math.max(0, currentQuantity + quantityChange);

    // Update user's temporary cart in the map
    if (newQuantity === 0) {
      delete userCart[itemId];
    } else {
      userCart[itemId] = newQuantity;
    }

    userCarts.set(userId, userCart);
  }

// Handle button callbacks
async function handleMenuItemAction(existingCarts,userCarts, ctx, itemId, user) {
    console.log(itemId);
    try {
      // Fetch the selected menu item from MongoDB
      const selectedItem = await MenuItem.findById(itemId);

      if (selectedItem) {
        

        // Check if the item is already in the temporary cart
        const userCart = userCarts.get(user) || {};
        const quantity = userCart[itemId] || 0;

        // Increase the quantity in the temporary cart
        updateUserCart(user, itemId, 1, userCarts);

        // Create an inline keyboard for the selected menu item
        const itemKeyboard = Markup.inlineKeyboard([
          [Markup.button.callback(`+1`, `increase_amount_${itemId}`),
           Markup.button.callback(`-1`, `decrease_amount_${itemId}`)],
          [Markup.button.callback(`Add to Cart`, `add_to_cart_${itemId}`)],
          [Markup.button.callback(`View Cart`, `manage_cart`)],
        ]);

        // Send a message with the selected menu item and the new inline keyboard
        ctx.reply(
          `${selectedItem.itemName}: $${selectedItem.price}  -- Quantity: ${quantity + 1}`,
          itemKeyboard
        );
      } else {
        ctx.reply('Sorry, the selected menu item was not found.');
      }
    } catch (error) {
      console.error('Error fetching menu item:', error);
      ctx.reply('There was an error processing your request. Please try again.');
    }
}

module.exports = { handleMenuItemAction , updateUserCart};
