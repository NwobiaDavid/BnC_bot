const mongoose = require('mongoose');
const { User, MenuItem, Store } = require('../models');



async function handleUserDetails (ctx, bot, displayMainMenu,existingCarts,userCarts){
    const existingUser = await User.findOne({ telegramId: ctx.from.id });
  
    if (!existingUser) {
      // If the user doesn't exist, prompt for details and create a new user
      ctx.reply(
        `Welcome! Please provide your details (name, matric number, email, hall and roomnumber) IN ORDER.\neg:john doe, 21ce202200, johndoe@gmail.com, Joseph Hall D208`
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
            // ctx.reply(
              
            // );
            displayMainMenu(ctx, 'Thank you! Your details have been saved. What would you like to do today?');
          })
          .catch((error) => {
            console.error('Error creating a new user:', error);
            ctx.reply(
              'There was an error processing your request. Please try again.'
            );
          });
  
        // Remove the event listener to avoid capturing other text messages
        // bot.stop('text', userDetailsHandler);
      }
  
      // Listen for the user's response to the details prompt using filter utils
      bot.on(
        'text', userDetailsHandler
      );
    } else {
      // If the user exists, display the main menu
      const text = `Welcome back, ${existingUser.name}! What would you like to do today?`;
      displayMainMenu(ctx, text);
    }
  }

  async function handleStart(ctx) {
    console.log('owner started -------------------')
    const existingUser = await User.findOne({ telegramId: ctx.from.id });
    // const ownerName = await User.findOne({ name: ctx.from.id });
    console.log('the existing user==>', existingUser)
    if (existingUser) {
        try {
            // Find the store by owner's name
            const stores = await Store.find({ owner: existingUser.name });

            // if (store) {
            //     // Update the owner's chat ID
            //     store.ownerId = ctx.from.id;
            //     await store.save();

            //     // Inform the owner that their chat ID has been saved
            //     console.log('Your chat ID has been saved as the owner\'s chat ID.');
            // }else {
            //   console.log('store not found')
            // }

            if (stores.length > 0) {
              // Update the owner's chat ID for each store
              for (const store of stores) {
                  store.ownerId = ctx.from.id;
                  await store.save();
              }

              // Inform the owner that their chat ID has been saved
              console.log('Your chat ID has been saved as the owner\'s chat ID for all your stores.');
          } else {
              console.log('No stores found for the user.');
          }

        } catch (error) {
            console.error('Error saving owner\'s chat ID:', error);
            // ctx.reply('There was an error processing your request. Please try again.');
        }
    }else{
      console.log('the user not found')
    }
}

module.exports = { handleUserDetails ,handleStart};