// MenuActions.js
const mongoose = require('mongoose');
const { Markup } = require('telegraf');
const { MenuItem } = require('../../models');
const { manageCart } = require('./Menu.cart')

// Function to update user's temporary cart
async function updateUserCart(userId, itemId, quantityChange, userCarts, ctx, inlineKeyboard) {
  const userCart = userCarts.get(userId) || {};
  const currentQuantity = userCart[itemId] || 1;

  try {
    const selectedItem = await MenuItem.findById(itemId);

    if (!selectedItem || typeof selectedItem.quantity !== 'number') {
      console.error(`Item with ID ${itemId} not found or has an invalid quantity.`);
      return currentQuantity;
    }

    const availableQuantity = selectedItem.quantity;
    const newQuantity = Math.min(availableQuantity, Math.max(0, currentQuantity + quantityChange));

    if (newQuantity === 0) {
      delete userCart[itemId];
    } else {
      userCart[itemId] = newQuantity;
    }

    userCarts.set(userId, userCart);

    return newQuantity;
  } catch (error) {
    console.error(`Error fetching menu item for ID ${itemId}:`, error);
    return currentQuantity;
  }
}

let id;
let name;

// Register button callbacks
function registerButtonCallbacks(bot, itemId, userCarts, updateUserCart, selectedItem, quantity, ctx, user, existingCarts) {
  bot.action(`increase_amount_${itemId}`, async (ctx) => {
    try {
      quantity = await updateUserCart(user, itemId, 1, userCarts, ctx);
      updateInlineKeyboard(itemId, quantity, selectedItem, ctx);
    } catch (error) {
      handleQuantityUpdateError(error, ctx);
    }
  });

  bot.action(`decrease_amount_${itemId}`, async (ctx) => {
    try {
      quantity = await updateUserCart(user, itemId, -1, userCarts, ctx);
      updateInlineKeyboard(itemId, quantity, selectedItem, ctx);
    } catch (error) {
      handleQuantityUpdateError(error, ctx);
    }
  });

  bot.action(/add_to_cart_(.+)/, async(ctx) => {
    const itemId = ctx.match[1];
    const userId = ctx.from.id;
  
    const userCart = userCarts.get(userId) || {};
    
    // Check if the item is already in the cart
    if (userCart[itemId]) {
      ctx.answerCbQuery(`Item ${itemId} is already in the cart.`);
    } else {
         const selectedItem = await MenuItem.findById(itemId);
        const availableQuantity = selectedItem.quantity; 
        const newQuantity = Math.min(availableQuantity, Math.max(0, 1));
      userCart[itemId] = newQuantity;
      userCarts.set(userId, userCart);
    }
      // Move items from temporary cart to the actual cart
      moveItemsToCart(userId, userCarts, existingCarts);
        
      const menu_keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('view cart', 'manage_cart')],
        [Markup.button.callback('back', `category_${id}_${name}`)],
        [Markup.button.callback('return to home', 'browsing_categories')],
      ])
    // Respond to the user
    ctx.answerCbQuery(`Added item to cart: ${itemId}.`);
    ctx.editMessageText('what would you like to do next',menu_keyboard )
    
  });

  bot.action('manage_cart', async (ctx) => {
    manageCart(ctx, bot, existingCarts, userCarts)
  });
}

function categoryAgent(categoryId, categoryName){
 id = categoryId;
 name = categoryName;
}

function updateInlineKeyboard(itemId, quantity, selectedItem, ctx) {
    let keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(`+1`, `increase_amount_${itemId}`),
       Markup.button.callback(`-1`, `decrease_amount_${itemId}`)],
      [Markup.button.callback(`Add to Cart`, `add_to_cart_${itemId}`)],
    ]);
  
    if (quantity === 0) {
      // Use map and filter to remove the "-1" button if quantity is 0
      keyboard.reply_markup.inline_keyboard = keyboard.reply_markup.inline_keyboard.map(row =>
        row.filter(btn => btn.callback_data !== `decrease_amount_${itemId}`)
      ).filter(row => row.length > 0);
    }
  
    ctx.editMessageText(`${selectedItem.itemName}: $${selectedItem.price}  -- Quantity: ${quantity}`, keyboard);
  }
  

// Function to move items from temporary cart to the actual cart
function moveItemsToCart(userId, userCarts, existingCarts) {
    const userCart = userCarts.get(userId) || {};
    const existingCart = existingCarts.get(userId) || {};

    Object.keys(userCart).forEach((itemId) => {
      const quantity = userCart[itemId];
      existingCart[itemId] = (existingCart[itemId] || 0) + quantity;
    });
    // Update the existingCart in the map
    existingCarts.set(userId, existingCart);

    // Clear the temporary cart
    userCarts.delete(userId);
  }


function handleQuantityUpdateError(error, ctx) {
  console.error('Error updating quantity:', error);
  ctx.reply('There was an error processing your request. Please try again.');
}

// Handle button callbacks
async function handleMenuItemAction(existingCarts, userCarts, ctx, itemId, user, bot) {
  try {
    const selectedItem = await MenuItem.findById(itemId);

    if (selectedItem) {
      const userCart = userCarts.get(user) || {};
      let quantity = userCart[itemId] || 1;

      const initialKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`+1`, `increase_amount_${itemId}`)],
        [Markup.button.callback(`Add to Cart`, `add_to_cart_${itemId}`)],
        [Markup.button.callback(`back`, `category_${id}_${name}`)],
      ]);

      const message = await ctx.editMessageText(
        `${selectedItem.itemName}: $${selectedItem.price}  -- Quantity: ${quantity}`,
        initialKeyboard
      );

      // Pass the 'user' variable to registerButtonCallbacks function
      registerButtonCallbacks(bot, itemId, userCarts, updateUserCart, selectedItem, quantity, ctx, user, existingCarts);
    } else {
      ctx.reply('Sorry, the selected menu item was not found.');
    }
  } catch (error) {
    console.error(`Error fetching menu item for ID ${itemId}:`, error);
    ctx.reply('There was an error processing your request. Please try again.');
  }
}

module.exports = { handleMenuItemAction, updateUserCart , categoryAgent};
