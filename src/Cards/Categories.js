const mongoose = require('mongoose');
const { User, MenuItem, Category } = require('../../models');
const { Telegraf, Markup } = require('telegraf');
const { browse_menu } = require('./Menu');
const { handleMenuItemAction, categoryAgent } = require('./Menu.actions');
const { handleCategoryAction } = require('./Categories.action');

let text='Main Menu!';

async function browse_categories(ctx, bot, displayMainMenu, existingCarts,userCarts) {
  let currentPage = 0; // Move this declaration outside

  try {
    const categories = await Category.find();

    if (categories.length > 0) {
      const itemsPerPage = 4;
      const categoryPages = [];

      for (let i = 0; i < categories.length; i += itemsPerPage) {
        const pageCategories = categories.slice(i, i + itemsPerPage);
        categoryPages.push(pageCategories);
      }

      const inlineCategoryKeyboard = () => {
        const buttons = categoryPages[currentPage].map((category) => [
          Markup.button.callback(`${category.category}`, `category_${category._id}_${category.category}`)
        ]);

        let navigationButtons = [];

        if (currentPage < categoryPages.length - 1) {
          navigationButtons.push([
            Markup.button.callback('Next', 'next_page'),
          ]);
        }

        if (currentPage > 0) {
          navigationButtons.push([
            Markup.button.callback('Previous', 'prev_page'),
          ]);
        }

        const customOrder = [Markup.button.callback('Custom Order', 'custom_order')]
        const mainMenu = [
          Markup.button.callback('Back to MainMenu', 'browse_mainmenu'),
        ]

        return Markup.inlineKeyboard([...buttons, ...navigationButtons,customOrder, mainMenu], {
          columns: 1,
        });
      };

      ctx.editMessageText('Select a category:', inlineCategoryKeyboard());

      bot.action('browse_mainmenu', (ctx) => {
       
        ctx.editMessageText(text, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Start Shopping', callback_data: 'browsing_categories' }],
              [{ text: 'Student Vendors', callback_data: 'browsing_stores' }],
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

      });

      // Define bot actions for category selection
      bot.action(/category_(.+)_([^ ]+)/, async (ctx) => {
        const categoryId = ctx.match[1];
        const categoryName = ctx.match[2];

        console.log('clothings here==> '+ctx.match)
       
        handleCategoryAction(ctx, bot,categoryId,categoryName)
      });

      
      bot.action(/menu_item_(.+)/, async (ctx) => {
        const itemId = ctx.match[1];
        const user = ctx.from.id;
        handleMenuItemAction(existingCarts,userCarts, ctx, itemId, user, bot )
       });

      bot.action('prev_page', (ctx) => {
        if (currentPage > 0) {
          currentPage--;
          ctx.editMessageText('Select a category:', inlineCategoryKeyboard());
        }
      });

      bot.action('next_page', (ctx) => {
        if (currentPage < categoryPages.length - 1) {
          currentPage++;
          ctx.editMessageText('Select a category:', inlineCategoryKeyboard());
        }
      });

      bot.action('custom_order', (ctx) => {
        ctx.editMessageText('please message @iamnwobiadavid and give him your list',{
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Main Menu', callback_data: 'browse_mainmenu' }],
            ],
          }
      })
    });

    } else {
      ctx.reply('No categories found.');
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    ctx.reply('There was an error processing your request. Please try again.');
  }
}




module.exports = { browse_categories };
