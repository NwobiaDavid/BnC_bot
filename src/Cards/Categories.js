const mongoose = require('mongoose');
const { User, MenuItem , Category} = require('../../models');
const { Telegraf, Markup } = require('telegraf');

async function browse_categories(ctx, bot) {
    try {
        // Fetch categories from MongoDB
        const categories = await Category.find();
    
        if (categories.length > 0) {
          const itemsPerPage = 4; // Adjust this based on your preference
          const categoryPages = [];
    
          for (let i = 0; i < categories.length; i += itemsPerPage) {
            const pageCategories = categories.slice(i, i + itemsPerPage);
            categoryPages.push(pageCategories);
          }
    
          let currentPage = 0;
    
          // Create an inline keyboard with previous and next page buttons for categories
          const inlineCategoryKeyboard = () => {
            const buttons = categoryPages[currentPage].map((category) => [
              Markup.button.callback(`${category.category}`, `category_${category._id}_${category.category}`)
            ]);
          
            let navigationButtons = [];
    
            // Show "Next" button on all pages except the last page
            if (currentPage < categoryPages.length - 1) {
              navigationButtons.push([
                Markup.button.callback('Next', 'next_page'),
              ]);
            }
          
            // Show "Previous" button on all pages except the first page
            if (currentPage > 0) {
              navigationButtons.push([
                Markup.button.callback('Previous', 'prev_page'),
              ]);
            }
          
            return Markup.inlineKeyboard([...buttons, ...navigationButtons], {
              columns: 1,
            });
          };
          // Send the first page of categories
          ctx.reply('Select a category:', inlineCategoryKeyboard());
    
    
    
          // Handle button callbacks for category selection
          bot.action(/category_(.+)_([^ ]+)/, async (ctx) => {
            const categoryId = ctx.match[1];
            const categoryName = ctx.match[2];
            console.log(ctx.match)
            try {
              // Convert categoryId to a valid ObjectId
              const categoryObjectId = new mongoose.Types.ObjectId(categoryId);
              console.log(categoryObjectId)
    
              // Fetch items for the selected category from MongoDB
              const categoryItems = await MenuItem.find({ category: categoryObjectId });
    
              if (categoryItems.length > 0) {
                const itemsKeyboard = Markup.inlineKeyboard(
                  categoryItems.map((item) =>
                    Markup.button.callback(
                      `${item.itemName}: #${item.price}`,
                      `menu_item_${item._id}`
                    )
                  )
                );
    
                // Send the items for the selected category
                ctx.reply(`${categoryName} category:`, itemsKeyboard);
              } else {
                ctx.reply('No items found for the selected category.');
              }
            } catch (error) {
              console.error('Error fetching category items:', error);
              ctx.reply(
                'There was an error processing your request. Please try again.'
              );
            }
          });
    
          // Handle button callbacks for category navigation
          bot.action('prev_page', (ctx) => {
            // Show the previous page of categories
            if (currentPage > 0) {
              currentPage--;
              ctx.editMessageText('Select a category:', inlineCategoryKeyboard());
            }
          });
    
          bot.action('next_page', (ctx) => {
            // Show the next page of categories
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