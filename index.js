require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { User, MenuItem , Category} = require('./models');
const { loadMenuData } = require('./src/Init');
const { handleUserDetails } = require('./src/User');

const { Types } = require('mongoose');

const bot = new Telegraf(process.env.BOT_TOKEN);
mongoose.connect(process.env.MONGO_URI);
console.log(`connected the the database successfully...`);

loadMenuData();

// Start the bot
bot.start(async (ctx) => {
 handleUserDetails(ctx, bot, displayMainMenu)
});

// Function to display the main menu options with buttons
function displayMainMenu(ctx, text) {
  ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'start shopping', callback_data: 'browsing_categories' }],
        [{ text: 'Customer Support', callback_data: 'customer_support' }],
        [{ text: 'Manage Cart', callback_data: 'manage_cart' }],
        [
          {
            text: 'Change Delivery Location/Room Number',
            callback_data: 'change_delivery_location',
          },
        ],
      ],
    },
  });
}


// Handling vendor button clicks
bot.action('browsing_categories', async (ctx) => {
  try {
    // Fetch categories from MongoDB
    const categories = await Category.find();

    if (categories.length > 0) {
      const itemsPerPage = 4; // Adjust this based on your preference
      const categoryPages = [];

      for (let i = 0; i < categories.length; i += itemsPerPage) {
        const pageCategories = categories.slice(i, i + itemsPerPage);
        categoryPages.push(pageCategories);
      }

      let currentPage = 0;

      // Create an inline keyboard with previous and next page buttons for categories
      const inlineCategoryKeyboard = () => {
        const buttons = categoryPages[currentPage].map((category) => [
          Markup.button.callback(`${category.category}`, `category_${category._id}_${category.category}`)
        ]);
      
        const navigationButtons = [
          [
            Markup.button.callback('Previous', 'prev_page'),
            Markup.button.callback('Next', 'next_page'),
          ],
        ];
      
        return Markup.inlineKeyboard([...buttons, ...navigationButtons], {
          columns: 2,
        });
      };
      // Send the first page of categories
      ctx.reply('Select a category:', inlineCategoryKeyboard());



      // Handle button callbacks for category selection
      bot.action(/category_(.+)_([^ ]+)/, async (ctx) => {
        const categoryId = ctx.match[1];
        const categoryName = ctx.match[2];
        console.log(ctx.match)
        try {
          // Convert categoryId to a valid ObjectId
          const categoryObjectId = new mongoose.Types.ObjectId(categoryId);
          console.log(categoryObjectId)

          // Fetch items for the selected category from MongoDB
          const categoryItems = await MenuItem.find({ category: categoryObjectId });

          if (categoryItems.length > 0) {
            const itemsKeyboard = Markup.inlineKeyboard(
              categoryItems.map((item) =>
                Markup.button.callback(
                  `${item.itemName}: #${item.price}`,
                  `menu_item_${item._id}`
                )
              )
            );

            // Send the items for the selected category
            ctx.reply(`${categoryName} category:`, itemsKeyboard);
          } else {
            ctx.reply('No items found for the selected category.');
          }
        } catch (error) {
          console.error('Error fetching category items:', error);
          ctx.reply(
            'There was an error processing your request. Please try again.'
          );
        }
      });

      // Handle button callbacks for category navigation
      bot.action('prev_page', (ctx) => {
        // Show the previous page of categories
        if (currentPage > 0) {
          currentPage--;
          ctx.editMessageText('Select a category:', inlineCategoryKeyboard());
        }
      });

      bot.action('next_page', (ctx) => {
        // Show the next page of categories
        if (currentPage < categoryPages.length - 1) {
          currentPage++;
          ctx.editMessageText('Select a category:', inlineCategoryKeyboard());
        }
      });
    } else {
      ctx.reply('No categories found.');
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    ctx.reply('There was an error processing your request. Please try again.');
  }
});

// Handling "browsing menu" action
bot.action('browsing_menu', async (ctx) => {
  try {
    // Fetch menu items from MongoDB
    const menuItems = await MenuItem.find();

    // Check if there are menu items
    if (menuItems.length > 0) {
      // Chunk the menu items into groups (e.g., 5 items per page)
      const itemsPerPage = 5;
      const menuPages = [];

      for (let i = 0; i < menuItems.length; i += itemsPerPage) {
        const pageItems = menuItems.slice(i, i + itemsPerPage);
        menuPages.push(pageItems);
      }

      let currentPage = 0;

      // Create an inline keyboard with previous and next page buttons
      const inlineKeyboard = () => {
        const buttons = menuPages[currentPage].map((item) => [
          Markup.button.callback(
            `${item.itemName}: $${item.price}`,
            `menu_item_${item._id}`
          ),
        ]);

        const navigationButtons = [
          [
            Markup.button.callback('Previous', 'prev_page'),
            Markup.button.callback('Next', 'next_page'),
          ],
        ];

        return Markup.inlineKeyboard([...buttons, ...navigationButtons], {
          columns: 2,
        });
      };

      // Send the first page of menu items
      ctx.reply('Menu:', inlineKeyboard());

      // Handle button callbacks
      bot.action(/menu_item_(.+)/, async (ctx) => {
        const itemId = ctx.match[1];
        try {
          // Fetch the selected menu item from MongoDB
          const selectedItem = await MenuItem.findById(itemId);

          if (selectedItem) {
             const user = ctx.from.id;

            // Check if the item is already in the temporary cart
            const userCart = userCarts.get(user) || {};
            const quantity = userCart[itemId] || 0;

            // Increase the quantity in the temporary cart
            updateUserCart(user, itemId, 1);

            // Create an inline keyboard for the selected menu item
            const itemKeyboard = Markup.inlineKeyboard([
                [
                    Markup.button.callback(`+1`, `increase_amount_${itemId}`),
                    Markup.button.callback(`-1`, `decrease_amount_${itemId}`),
                ],
                [Markup.button.callback(`Add to Cart`, `add_to_cart_${itemId}`)],
                [Markup.button.callback(`View Cart`, `manage_cart`)],
            ]);

            // Send a message with the selected menu item and the new inline keyboard
            ctx.reply(
                `${selectedItem.itemName}: $${selectedItem.price}  -- Quantity: ${quantity + 1}`,
                itemKeyboard
            );
        }else {
            ctx.reply('Sorry, the selected menu item was not found.');
          }
        } catch (error) {
          console.error('Error fetching menu item:', error);
          ctx.reply(
            'There was an error processing your request. Please try again.'
          );
        }
      });

      // Map to store user carts (user_id => { item_id: quantity })
      const existingCarts = new Map();
      const userCarts = new Map();

      // Handle button callbacks for increasing amount
      bot.action(/increase_amount_(.+)/, (ctx) => {
        const itemId = ctx.match[1];
        const userId = ctx.from.id;

        // Update user's temporary cart
        updateUserCart(userId, itemId, 1);

        // Respond to the user
        ctx.answerCbQuery(`Increased amount for item: ${itemId}.`);
      });

      // Handle button callbacks for decreasing amount
      bot.action(/decrease_amount_(.+)/, (ctx) => {
        const itemId = ctx.match[1];
        const userId = ctx.from.id;

        // Update user's temporary cart
        updateUserCart(userId, itemId, -1);

        // Respond to the user
        ctx.answerCbQuery(`Decreased amount for item: ${itemId}.`);
      });

      // Handle button callback for adding item to cart
      bot.action(/add_to_cart_(.+)/, (ctx) => {
        const itemId = ctx.match[1];
        const userId = ctx.from.id;

        // Move items from temporary cart to the actual cart
        moveItemsToCart(userId);

        // Respond to the user
        ctx.answerCbQuery(`Added item to cart: ${itemId}.`);
      });

      // Function to move items from temporary cart to the actual cart
      function moveItemsToCart(userId) {
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

      // Function to update user's temporary cart
      function updateUserCart(userId, itemId, quantityChange) {
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

      // Example: Display user's cart
      bot.action('manage_cart', async (ctx) => {
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
            ctx.reply(`Your Cart:\n${cartMessage}`, keyboard);
          } else {
            ctx.reply('Some items in your cart could not be found.');
          }

          
        } else {
          ctx.reply('Your cart is empty.');
        }
      });

      bot.action('prev_page', (ctx) => {
        // Show the previous page
        if (currentPage > 0) {
          currentPage--;
          ctx.editMessageText('Menu:', inlineKeyboard());
        }
      });

      bot.action('next_page', (ctx) => {
        // Show the next page
        if (currentPage < menuPages.length - 1) {
          currentPage++;
          ctx.editMessageText('Menu:', inlineKeyboard());
        }
      });
    } else {
      ctx.reply('Sorry, the menu is currently empty.');
    }
  } catch (error) {
    console.error('Error fetching menu items:', error);
  }
});

// Handling "customer support" action
bot.hears('Customer Support', (ctx) => {
  // Implement logic for customer support
  ctx.reply('Please contact our customer support at support@example.com');
});

// Handling "change delivery location/room number" action
bot.action('change_delivery_location', (ctx) => {
  ctx.reply('Please provide your new delivery information (room number).');

  // Define the handler function separately
  async function updateDeliveryInformationHandler(ctx) {
    const newRoomNumber = ctx.message.text.trim();
    // Update the user's room number in the database
    await User.updateOne(
      { telegramId: ctx.from.id },
      { roomNumber: newRoomNumber }
    );
    ctx.reply('Your delivery information has been updated successfully.');

    // Remove the event listener to avoid capturing other text messages
    bot.stop('text', updateDeliveryInformationHandler);
  }

  // Listen for the user's response and update the database
  bot.on('text', updateDeliveryInformationHandler);
});

// Start the bot
bot.launch();
