const mongoose = require('mongoose');
const { User, MenuItem } = require('../models');



async function handleUserDetails (ctx, bot, displayMainMenu){
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
  }

module.exports = { handleUserDetails };