
const mongoose = require('mongoose');
const { Markup } = require('telegraf');
const { MenuItem } = require('../../models');
const { categoryAgent } = require('./Menu.actions');

let categoryIds;
let categoryNames;
let currentItems;

let categoryObjectId
let categoryItems

let botx;


let cp = 0;
async function handleCategoryAction(ctx, bot, categoryId, categoryName) {
    cp=0

    console.log("this is ctx " + ctx.match);
    categoryIds = ctx.match ? ctx.match[1] : categoryId;
    categoryNames = ctx.match ? ctx.match[2] : categoryName;

    botx = bot;
    console.log('entering ' + categoryNames + '...');
    categoryAgent(categoryIds, categoryNames);

    try {
        categoryObjectId = new mongoose.Types.ObjectId(categoryIds);
        categoryItems = await MenuItem.find({ category: categoryObjectId });

        if (categoryItems.length > 0) {
            const inlineKeyboard = () => {
                const itemsPerPage = 5;
                const startIdx = cp * itemsPerPage;
                const endIdx = startIdx + itemsPerPage;

                currentItems = categoryItems.slice(startIdx, endIdx);
                const buttons = currentItems.map((item) => [
                    Markup.button.callback(`${item.itemName}: #${item.price}`, `menu_item_${item._id}`),
                ]);

                let navigationButtons = [];

                if (endIdx < categoryItems.length) {
                    navigationButtons.push([Markup.button.callback('Next', `next_menu_page_${categoryIds}`)]);
                }

                if (cp > 0) {
                    navigationButtons.push([Markup.button.callback('Previous', 'prev_menu_page')]);
                }

                const Menus = [
                    [
                        Markup.button.callback('Back', `browsing_categories`),
                        Markup.button.callback('MainMenu', 'browse_mainmenu'),
                    ],
                ];

                return Markup.inlineKeyboard([...buttons, ...navigationButtons, ...Menus], {
                    columns: 1,
                });
            };

            // Define bot actions for page navigation
            call(bot, ctx, inlineKeyboard, categoryName);

            ctx.editMessageText(`${categoryNames} category:`, inlineKeyboard());
        } else {
            ctx.reply('No items found for the selected category.');
        }
    } catch (error) {
        console.error('Error fetching category items:', error);
        ctx.editMessageText('There was an error processing your request. Please try again.');
    }
}

function call(bot, ctx, inlineKeyboard, categoryName) {
    botx.action('prev_menu_page', (ctx) => {
        if (cp > 0) {
            cp--;
            ctx.editMessageText(`${categoryNames} category:`, inlineKeyboard());
        }
    });

    botx.action(/next_menu_page_(.+)/, (ctx) => {
        console.log(ctx);
        console.log('i am in ' + categoryName + '..., my ctx => ' + ctx.match[1]);

        if (cp < currentItems.length - 1) {
            cp++;
            categoryIds = ctx.match[1];
            botx = bot;
            spy(categoryIds, categoryNames, bot, ctx, inlineKeyboard);
            ctx.editMessageText(`${categoryNames} category:`, inlineKeyboard());
        }
    });
}


function spy(categoryIds, categoryNames, bot, ctx, inlineKeyboard) {
    handleAction(bot, ctx, categoryIds, categoryNames, inlineKeyboard);
}

async function handleAction(bot, ctx, categoryId, categoryName, inlineKeyboard) {

    botx = bot;
    console.log('entering ' + categoryNames + '...');

    try {
        categoryObjectId = new mongoose.Types.ObjectId(categoryIds);
        categoryItems = await MenuItem.find({ category: categoryObjectId });

    } catch (error) {
        console.error('Error fetching category items:', error);
        ctx.editMessageText('There was an error processing your request. Please try again.');
    }
}

module.exports = { handleCategoryAction };
