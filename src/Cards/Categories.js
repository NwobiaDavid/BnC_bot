const mongoose = require('mongoose');
const { User, MenuItem, Category } = require('../../models');
const { Telegraf, Markup } = require('telegraf');
const { browse_menu } = require('./Menu');
const { handleMenuItemAction, categoryAgent } = require('./Menu.actions');

let text='Main Menu!';

async function browse_categories(ctx, bot, displayMainMenu) {
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

        const mainMenu = [
          Markup.button.callback('Back to MainMenu!', 'browse_mainmenu'),
        ]

        return Markup.inlineKeyboard([...buttons, ...navigationButtons, mainMenu], {
          columns: 1,
        });
      };

      ctx.editMessageText('Select a category:', inlineCategoryKeyboard());

      bot.action('browse_mainmenu', (ctx) => {
       
        ctx.editMessageText(text, {
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

      });

      // Define bot actions for category selection
      bot.action(/category_(.+)_([^ ]+)/, async (ctx) => {
        const categoryId = ctx.match[1];
        const categoryName = ctx.match[2];

        categoryAgent(categoryId, categoryName);

        try {
          const categoryObjectId = new mongoose.Types.ObjectId(categoryId);
          const categoryItems = await MenuItem.find({ category: categoryObjectId });

          if (categoryItems.length > 0) {
            let cp = 0; 
           let currentItems;

            const inlineKeyboard = () => {
                const itemsPerPage = 5;
                const startIdx = cp * itemsPerPage;
                const endIdx = startIdx + itemsPerPage;
                currentItems = categoryItems.slice(startIdx, endIdx);

              const buttons = currentItems.map((item) => [
                Markup.button.callback(
                  `${item.itemName}: #${item.price}`,
                  `menu_item_${item._id}`
                ),
              ]);

              let navigationButtons = [];

              if (endIdx < categoryItems.length) {
                navigationButtons.push([Markup.button.callback('Next', 'next_menu_page')]);
              }

              if (cp > 0) {
                navigationButtons.push([Markup.button.callback('Previous', 'prev_menu_page')]);
              }

              const Menus = [
                [Markup.button.callback('Back', `browsing_categories`),
                Markup.button.callback('MainMenu!', 'browse_mainmenu')]
              ]

              return Markup.inlineKeyboard([...buttons, ...navigationButtons, ...Menus], {
                columns: 1,
              });
            };

            ctx.editMessageText(`${categoryName} category:`, inlineKeyboard());

              // Define bot actions for page navigation
            bot.action('prev_menu_page', (ctx) => {
                if (cp > 0) {
                cp--;
                ctx.editMessageText(`${categoryName} category:`, inlineKeyboard());
                }
            });

            bot.action('next_menu_page', (ctx) => {
                if (cp < currentItems.length - 1) {
                cp++;
                ctx.editMessageText(`${categoryName} category:`, inlineKeyboard());
                }
            });

          } else {
            ctx.reply('No items found for the selected category.');
          }
        } catch (error) {
          console.error('Error fetching category items:', error);
          ctx.editMessageText('There was an error processing your request. Please try again.');
        }
      });

    
      // Map to store user carts (user_id => { item_id: quantity })
      const existingCarts = new Map();
      const userCarts = new Map();

      
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

    } else {
      ctx.reply('No categories found.');
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    ctx.reply('There was an error processing your request. Please try again.');
  }
}




module.exports = { browse_categories };
