const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const { User, StoreItem, Store } = require('../../models');
const { handleStoreItemAction, storeAgent } = require('./Store.actions');

let storeIds;
let storeNames;
let currentItems;

let storeObjectId
let storeItems

let botx;

let cp=0

async function handleStoreItem(ctx,bot,storeId,storeName){
    
    cp=0
    console.log('store id 1st =>'+storeId+"        "+storeName+"<= store name 1st")
    console.log("this is ctx " + ctx.match);

    storeIds = ctx.match ? ctx.match[1] : storeId;
    storeNames = ctx.match ? ctx.match[2] : storeName;

    botx = bot;
    // Ensure storeAgent is correctly imported and exists
    if (typeof storeAgent === 'function') {
        storeAgent(storeIds, storeNames);
      } else {
        console.error('storeAgent is not a function.');
      }
  
    try {

        if (!mongoose.Types.ObjectId.isValid(storeId)) {
            console.log("storeid=> "+storeId)
            throw new Error('Invalid storeId');
        }

       storeObjectId = new mongoose.Types.ObjectId(storeIds);
       storeItems = await StoreItem.find({ store: storeObjectId });
      
      console.log(storeItems.length+"<--store items and store obj id-->"+storeObjectId);

      if (storeItems.length > 0) {
        
        console.log('passed----')

        const inlineKeyboards = () => {
            const itemsPerPage = 5;
            const startIdx = cp * itemsPerPage;
            const endIdx = startIdx + itemsPerPage;
            currentItems = storeItems.slice(startIdx, endIdx);

          const buttons = currentItems.map((item) => [
            Markup.button.callback(
              `${item.itemName}: #${item.price}`,
              `storeItem_${item._id}`
            ),
          ]);

          let navigationButtons = [];

          if (endIdx < storeItems.length) {
            navigationButtons.push([Markup.button.callback('Next', `nextStore_page_${storeIds}`)]);
          }

          if (cp > 0) {
            navigationButtons.push([Markup.button.callback('Previous', 'prev_store_page')]);
          }

          const Menus = [
            [Markup.button.callback('Back', `browsing_stores`),
            Markup.button.callback('MainMenu', 'browse_mainmenu')]
          ]

          return Markup.inlineKeyboard([...buttons, ...navigationButtons, ...Menus], {
            columns: 1,
          });
        };

        // Define bot actions for page navigation
        callss(bot, ctx, inlineKeyboards, storeName);

        ctx.editMessageText(`${storeNames} store:`, inlineKeyboards());

      } else {
        ctx.reply('No items found for the selected store.');
      }
    } catch (error) {
      console.error('Error fetching store items:', error);
      ctx.editMessageText('There was an error processing your request. Please try again.');
    }
}

function callss(bot, ctx, inlineKeyboards, storeName){
       // Define bot actions for page navigation
       botx.action('prev_store_page', (ctx) => {
        if (cp > 0) {
        cp--;
        ctx.editMessageText(`${storeNames} store:`, inlineKeyboards());
        }
    });

    botx.action(/nextStore_page_(.+)/, (ctx) => {
        if (cp < currentItems.length - 1) {
            cp++;
            storeIds = ctx.match[1];
            botx = bot;
            spyy(storeIds, storeNames, bot, ctx, inlineKeyboards);
        ctx.editMessageText(`${storeNames} store:`, inlineKeyboards());
        }
    });
}

function spyy(storeIds, storeNames, bot, ctx, inlineKeyboards) {
    handleActions(bot, ctx, storeIds, storeNames, inlineKeyboards);
}

async function handleActions(bot, ctx, storeId, storeName, inlineKeyboards) {

    botx = bot;
    console.log('entering ' + storeNames + '...');

    try {
        storeObjectId = new mongoose.Types.ObjectId(storeIds);
        storeItems = await StoreItem.find({ store: storeObjectId });

    } catch (error) {
        console.error('Error fetching store items:', error);
        ctx.editMessageText('There was an error processing your request. Please try again.');
    }
}

module.exports = { handleStoreItem };
