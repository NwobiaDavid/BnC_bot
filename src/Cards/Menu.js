const { Telegraf, Markup } = require('telegraf');

function browse_menu(categoryItems,ctx,bot,currentPage,) {
    const itemsPerPage = 5;
    const startIdx = currentPage * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const currentItems = categoryItems.slice(startIdx, endIdx);

    const buttons = currentItems.map((item) => [
        Markup.button.callback(
            `${item.itemName}: #${item.price}`,
            `menu_item_${item._id}`
        ),
    ]);

    let navigationButtons = [];

    // Show "Next" button on all pages except the last page
    if (endIdx < categoryItems.length) {
        navigationButtons.push([Markup.button.callback('Next', 'next_menu_page')]);
    }

    // Show "Previous" button on all pages except the first page
    if (currentPage > 0) {
        navigationButtons.push([Markup.button.callback('Previous', 'prev_menu_page')]);
    }

    

    return Markup.inlineKeyboard([...buttons, ...navigationButtons], {
        columns: 1,
    });
}


module.exports = { browse_menu };
