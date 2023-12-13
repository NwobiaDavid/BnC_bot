const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { User, MenuItem, Category } = require('../models');

async function loadMenuData() {
  fs.createReadStream('menu.csv')
    .pipe(csv())
    .on('data', async (row) => {
      try {
        const existingMenuItem = await MenuItem.findOne({
          itemName: row.Item,
        });

        // Find or create the category based on the category name in the CSV
        const category = await Category.findOneAndUpdate(
          { category: row.category },
          { category: row.category },
          { upsert: true, new: true }
        );

        if (existingMenuItem) {
          existingMenuItem.price = row.price;
          existingMenuItem.category = category._id;
          existingMenuItem.quantity = row.quantity;
          await existingMenuItem.save();

          // Update the category's items array
          if (!category.items.includes(existingMenuItem._id)) {
            category.items.push(existingMenuItem._id);
            await category.save();
          }
        } else {
          const menuItem = new MenuItem({
            itemName: row.Item,
            price: row.price,
            category: category._id,
            quantity: row.quantity,
          });
          await menuItem.save();

          // Update the category's items array
          if (!category.items.includes(menuItem._id)) {
            category.items.push(menuItem._id);
            await category.save();
          }
        }
      } catch (error) {
        console.error('Error saving/updating menu item:', error);
      }
    })
    .on('end', () => {
      console.log('Menu data loaded/updated into MongoDB');
    });
}

module.exports = { loadMenuData };
