require('dotenv').config();
const { Telegraf, Markup , session, Scenes} = require('telegraf');
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { User, MenuItem , Category} = require('./models');
const { loadMenuData } = require('./src/Init');
const { handleUserDetails } = require('./src/User');
// const {session} = require('telegraf/session');
const { Types } = require('mongoose');
const { browse_categories, callbackk } = require('./src/Cards/Categories');
const { manageCart } = require('./src/Cards/Menu.cart');
const { initiateCustomerSupport, collectEmail } = require('./src/Customer/CustomerSupport');


const bot = new Telegraf(process.env.BOT_TOKEN);
mongoose.connect(process.env.MONGO_URI);
console.log(`connected the the database successfully...`);

bot.use(session());

const existingCarts = new Map();
const userCarts = new Map();

// const preMiddleware = async (ctx, next) => {
//   ctx.session.existingCarts = new Map();
//   ctx.session.userCarts = new Map();
//   next();
// };

// bot.use(preMiddleware)

loadMenuData();

// Start the bot
bot.start(async (ctx) => {
 handleUserDetails(ctx, bot, displayMainMenu, existingCarts,userCarts)
});

function areOrdersAccepted() {
  const currentDate = new Date();
  const cutoffTime = new Date();
  cutoffTime.setHours(23, 30, 0); // Set the cutoff time to 6:30 pm

  return currentDate < cutoffTime;
}


// Function to display the main menu options with buttons
function displayMainMenu(ctx, text) {
   if (!areOrdersAccepted()) {
    ctx.reply('Sorry, we are no longer accepting orders for today. Please come back tomorrow.');
    return;
  }
  
  ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Start Shopping', callback_data: 'browsing_categories' }],
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
      browse_categories(ctx, bot, displayMainMenu,existingCarts,userCarts);
      // callbackk(ctx, bot, displayMainMenu);
});

bot.action('manage_cart', async (ctx) => {
  manageCart(ctx, bot, existingCarts, userCarts)
});

// Handling "customer support" action
bot.action('customer_support', (ctx) => {
  initiateCustomerSupport(ctx, bot);
});

// Handling customer support options
bot.action('customer_support_payments', (ctx) => {
  collectEmail(ctx, bot, 'Payments');
});

bot.action('customer_support_delivery', (ctx) => {
  collectEmail(ctx, bot, 'Delivery');
});

bot.action('customer_support_platform', (ctx) => {
  collectEmail(ctx, bot, 'Platform');
});

bot.action('customer_support_others', (ctx) => {
  collectEmail(ctx, bot, 'Others');
});

// Handling "change delivery location/room number" action
bot.action('change_delivery_location', (ctx) => {
  ctx.reply('Please provide your new delivery information (Hall and Room number).');

  async function updateDeliveryInformationHandler(ctx) {
    const newRoomNumber = ctx.message.text.trim();
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
