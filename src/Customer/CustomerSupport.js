const { Markup } = require('telegraf');
const { User } = require('../../models');

// Function to initiate customer support
function initiateCustomerSupport(ctx, bot) {
  ctx.editMessageText('Choose a customer support option:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Payments', callback_data: 'customer_support_payments' }],
        [{ text: 'Delivery', callback_data: 'customer_support_delivery' }],
        [{ text: 'Platform', callback_data: 'customer_support_platform' }],
        [{ text: 'Others', callback_data: 'customer_support_others' }],
        [{ text: 'Back', callback_data: 'browse_mainmenu' }],
      ],
    },
  });
}

// Function to collect user's email and issue
async function collectEmail(ctx, bot, supportOption) {
  ctx.editMessageText('Please provide your email address and your issue in this FORMAT: (email address) your issue');

  // Attach the 'text' event listener
  bot.on('text', handleText);

  // Define the 'text' event handler
  async function handleText(ctx) {
    const userEmailIssue = ctx.message.text.trim();

    // Use regex to separate email from the issue
    const regex = /\(([^)]+)\)\s*(.+)/;
    const match = userEmailIssue.match(regex);

    if (match && match.length === 3) {
      const email = match[1];
      const userIssue = match[2];

      // Check if the email contains "@"
      if (email.includes('@')) {
        await describeIssueHandler(ctx, email, userIssue, supportOption, bot);

      } else {
        ctx.reply('Invalid email address. Please provide a valid email address.');
      }
    } else {
      ctx.reply('Invalid format. Please provide your email address and your issue in the specified format.');
    }
  }
}

// Define the handler function for describing the issue
async function describeIssueHandler(ctx, email, userIssue, supportOption, bot) {
  const chat = ctx.update.message.from;
  const user = await User.findOne({telegramId:ctx.from.id})
  const userInformation = `Name: ${chat.first_name} ${chat.last_name}\nMatric Number: ${user.matricNumber}\nEmail: ${email}\nRoom number: ${user.roomNumber} `;
  const messageToSend = `Customer Support Issue:\n\n${userInformation}\n\nIssue regarding #${supportOption}:\n${userIssue}`;

  // Send the issue details to a Telegram group or channel
  const supportGroupChatId = process.env.CUSTOMER_SERVICE_GROUP_ID; 
  if (supportGroupChatId) {
    await bot.telegram.sendMessage(supportGroupChatId, messageToSend);
    
    ctx.reply('Thank you for reaching out. Our support team will get back to you soon.',{
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Main Menu', callback_data: 'browse_mainmenu' }],
          ],
        }
    });

    // bot.action('main_menu', (ctx) => {
       
    //     ctx.editMessageText("Main Menu", {
    //       reply_markup: {
    //         inline_keyboard: [
    //           [{ text: 'Start Shopping', callback_data: 'browsing_categories' }],
    //           [{ text: 'Customer Support', callback_data: 'customer_support' }],
    //           [{ text: 'Manage Cart', callback_data: 'manage_cart' }],
    //           [
    //             {
    //               text: 'Change Delivery Location/Room Number',
    //               callback_data: 'change_delivery_location',
    //             },
    //           ],
    //         ],
    //       },
    //     });

    //   });

  } else {
    ctx.reply('Error: Support group chat ID is not configured.');
  }
}

module.exports = { initiateCustomerSupport, collectEmail };
