require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { User, MenuItem } = require('./models');

const bot = new Telegraf(process.env.BOT_TOKEN);
mongoose.connect(process.env.MONGO_URI);

// Load CSV menu data into MongoDB
fs.createReadStream('menu.csv')
  .pipe(csv())
  .on('data', async (row) => {
    try {
      const existingMenuItem = await MenuItem.findOne({
        itemName: row.item_name,
      });

      if (existingMenuItem) {
        existingMenuItem.price = row.price;
        await existingMenuItem.save();
      } else {
        const menuItem = new MenuItem({
          itemName: row.item_name,
          price: row.price,
        });
        await menuItem.save();
      }
    } catch (error) {
      console.error('Error saving/updating menu item:', error);
    }
  })
  .on('end', () => {
    console.log('Menu data loaded/updated into MongoDB');
  });

// Start the bot
bot.start(async (ctx) => {
  const existingUser = await User.findOne({ telegramId: ctx.from.id });

  if (!existingUser) {
    // If the user doesn't exist, prompt for details and create a new user
    ctx.reply(
      'Welcome! Please provide your details (name, matric number, email, hall, and room number) IN ORDER.'
    );

    // Listen for the user's response to the details prompt
    function userDetailsHandler(ctx) {
      const userDetails = ctx.message.text
        .split(',')
        .map((detail) => detail.trim());
      const [name, matricNumber, email, roomNumber] = userDetails;

      const newUser = new User({
        telegramId: ctx.from.id,
        name,
        matricNumber,
        email,
        roomNumber,
      });

      newUser
        .save()
        .then(() => {
          ctx.reply(
            'Thank you! Your details have been saved. What would you like to do today?'
          );
          displayMainMenu(ctx);
        })
        .catch((error) => {
          console.error('Error creating a new user:', error);
          ctx.reply(
            'There was an error processing your request. Please try again.'
          );
        });

      // Remove the event listener to avoid capturing other text messages
      bot.stop('text', userDetailsHandler);
    }

    // Listen for the user's response to the details prompt using filter utils
    ctx.on(
      'text',
      { text: 'Welcome! Please provide your details' },
      userDetailsHandler
    );
  } else {
    // If the user exists, display the main menu
    const text = `Welcome back, ${existingUser.name}! What would you like to do today?`;
    displayMainMenu(ctx, text);
  }
});

// Function to display the main menu options with buttons
function displayMainMenu(ctx, text) {
  ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Browsing Menu', callback_data: 'browsing_menu' }],
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
      const quantity = 1; // Automatically set quantity to 1

      // Update user's temporary cart
      updateUserCart(user, itemId, quantity);
      
            // Create an inline keyboard for the selected menu item
            const itemKeyboard = Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  `Increase Amount`,
                  `increase_amount_${itemId}`
                ),
                Markup.button.callback(
                  `Decrease Amount`,
                  `decrease_amount_${itemId}`
                ),
              ],
              [Markup.button.callback(`Add to Cart`, `add_to_cart_${itemId}`)],
            ]);

            // Send a message with the selected menu item and the new inline keyboard
            ctx.reply(
              `${selectedItem.itemName}: $${selectedItem.price}  -- Quantity: ${quantity}`,
              itemKeyboard
            );
          } else {
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
