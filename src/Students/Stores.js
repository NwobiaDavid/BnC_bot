const mongoose = require('mongoose');
const { User, StoreItem, Store } = require('../../models');
const { Telegraf, Markup } = require('telegraf');
const { handleStoreItemAction, storeAgent } = require('./Store.actions');
const { handleStoreItem } = require('./Store.items');

let text='Main Menu!';

async function browse_stores(ctx, bot, displayMainMenu, existingCarts,userCarts) {
  let currentPage = 0; // Move this declaration outside

  try {
    const stores = await Store.find();

    if (stores.length > 0) {
      const itemsPerPage = 4;
      const storePages = [];

      for (let i = 0; i < stores.length; i += itemsPerPage) {
        const pageStore = stores.slice(i, i + itemsPerPage);
        storePages.push(pageStore);
      }

      const inlineStoreKeyboard = () => {
        const buttons = storePages[currentPage].map((store) => [
          Markup.button.callback(`${store.store}`, `store_${store._id}_${store.store}`)
        ]);
        // console.log(buttons)

        let navigationButtons = [];

        if (currentPage < storePages.length - 1) {
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
      
      ctx.editMessageText('Select a Store:', inlineStoreKeyboard());

      bot.action('browse_mainmenu', (ctx) => {
       
        ctx.editMessageText(text, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Start Shopping', callback_data: 'browsing_categories' }],
              [{ text: 'Student Vendors', callback_data: 'browsing_store' }],
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

      // Define bot actions for store selection
      bot.action(/store_(.+)_([^ ]+)/, async (ctx) => {
        const storeId = ctx.match[1];
        const storeName = ctx.match[2];

        console.log("ctx--<>"+ctx.match)
        console.log('store id 1st =>'+storeId+"        "+storeName+"<= store name 1st")
       handleStoreItem(ctx,bot, storeId,storeName)
      });
      
      bot.action(/storeItem_(.+)/, async (ctx) => {
        console.log('inside+++++')
        const itemId = ctx.match[1];
        const user = ctx.from.id;
        console.log(itemId+ "<-- item id and userid-->"+user)
        handleStoreItemAction(existingCarts,userCarts, ctx, itemId, user, bot )
       });

      bot.action('prev_page', (ctx) => {
        if (currentPage > 0) {
          currentPage--;
          ctx.editMessageText('Select a store:', inlineStoreKeyboard());
        }
      });

      bot.action('next_page', (ctx) => {
        if (currentPage < storePages.length - 1) {
          currentPage++;
          ctx.editMessageText('Select a store:', inlineStoreKeyboard());
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
      ctx.reply('No stores found.');
    }
  } catch (error) {
    console.error('Error fetching stores:', error);
    ctx.reply('There was an error processing your request. Please try again.');
  }
}




module.exports = { browse_stores };
