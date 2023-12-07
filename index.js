require('dotenv').config()
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { User, MenuItem, Order } = require('./models'); // Assuming the models file is in the same directory

const bot = new Telegraf(process.env.BOT_TOKEN);
mongoose.connect(process.env.MONGO_URI , { useNewUrlParser: true, useUnifiedTopology: true });

// Load CSV menu data into MongoDB
fs.createReadStream('menu.csv')
  .pipe(csv())
  .on('data', async (row) => {
    try {
      // Check if the menu item already exists in the collection
      const existingMenuItem = await MenuItem.findOne({ itemName: row.item_name });

      if (existingMenuItem) {
        // If it exists, update the price
        existingMenuItem.price = row.price;
        await existingMenuItem.save();
      } else {
        // If it doesn't exist, save a new menu item
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
  // Check if the user exists in the database
  const existingUser = await User.findOne({ telegramId: ctx.from.id });

  if (!existingUser) {
    // If not, prompt for details and create a new user
    ctx.reply('Welcome! Please provide your details (name, matric number, email, hall and room number) IN ORDER.');

    // Listen for the user's response to the details prompt
    bot.on('text', async (ctx) => {
      const userDetails = ctx.message.text.split(','); // Assuming the user provides details separated by commas
      const [name, matricNumber, email, roomNumber] = userDetails.map((detail) => detail.trim());

      try {
        // Create a new User in the database
        const newUser = new User({
          telegramId: ctx.from.id,
          name,
          matricNumber,
          email,
          roomNumber,
        });

        await newUser.save();
        let text = 'Thank you! Your details have been saved. What would you like to do today?';
        // Implement logic for displaying the main menu options
        displayMainMenu(ctx,text);
      } catch (error) {
        console.error('Error creating a new user:', error);
        ctx.reply('There was an error processing your request. Please try again.');
      }

      // Remove the event listener to avoid capturing other text messages
      bot.telegram.off('text');
    });
  }else {
    // If yes, display the main menu
    let text = 'Welcome back, ' + existingUser.name + '! What would you like to do today?';
    // Implement logic for displaying the main menu options
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
                [ { text: 'Change Delivery Location/Room Number', callback_data: 'change_delivery_location' }]
            ]
        }
    });
  }


// Handling "browsing menu" action
bot.action('browsing_menu', async (ctx) => {
    try {
      // Fetch menu items from MongoDB
      const menuItems = await MenuItem.find();
  
      // Check if there are menu items
      if (menuItems.length > 0) {
        // Create a message with the menu items
        const menuMessage = menuItems.map((item) => `${item.itemName}: $${item.price}`).join('\n');
  
        // Send the message to the user
        ctx.reply('Menu:\n' + menuMessage);
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
  
  // Handling "manage cart" action
  bot.hears('Manage Cart', (ctx) => {
    // Display and manage the user's shopping cart
    // Implement logic for increasing/decreasing quantities, removing items, etc.
    ctx.reply('Your shopping cart is currently empty.');
  });
  
  // Handling "change delivery location/room number" action
  bot.action('Change Delivery Location/Room Number', (ctx) => {
    // Allow the user to update their delivery information
    ctx.reply('Please provide your new delivery information (room number).');
    // Listen for the user's response and update the database
    bot.on('text', async (ctx) => {
      const newRoomNumber = ctx.message.text.trim();
      // Update the user's room number in the database
      await User.updateOne({ telegramId: ctx.from.id }, { roomNumber: newRoomNumber });
      ctx.reply('Your delivery information has been updated successfully.');
      // Remove the event listener to avoid capturing other text messages
      bot.telegram.off('text');
    });
  });

// Start the bot
bot.launch();
