require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { User, MenuItem , Category} = require('./models');
const { loadMenuData } = require('./src/Init');
const { handleUserDetails } = require('./src/User');

const { Types } = require('mongoose');
const { browse_categories, callbackk } = require('./src/Cards/Categories');

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
      browse_categories(ctx, bot, displayMainMenu);
      // callbackk(ctx, bot, displayMainMenu);
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
