const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { User, StoreItem, Store } = require('../models');

async function loadStoreData() {
  fs.createReadStream('store.csv')
    .pipe(csv())
    .on('data', async (row) => {
      try {
        const existingStoreItem = await StoreItem.findOne({
          itemName: row.Item,
        });

        // Find or create the category based on the category name in the CSV
        const store = await Store.findOneAndUpdate(
          { store: row.store },
          { store: row.store ,owner: row.owner},
          { upsert: true, new: true }
        );

        if (existingStoreItem) {
            existingStoreItem.price = row.price;
            existingStoreItem.store = store._id;
            existingStoreItem.quantity = row.quantity;
            existingStoreItem.imageOne = row.imageOne; 
            existingStoreItem.imageTwo = row.imageTwo;

          await existingStoreItem.save();

          // Update the category's items array
          if (!store.items.includes(existingStoreItem._id)) {
            store.items.push(existingStoreItem._id);
            await store.save();
          }
        } else {
          const storeItem = new StoreItem({
            itemName: row.Item,
            price: row.price,
            store: store._id,
            quantity: row.quantity,
            imageOne: row.imageOne,
            imageTwo: row.imageTwo,
          });
          await storeItem.save();

          // Update the category's items array
          if (!store.items.includes(storeItem._id)) {
            store.items.push(storeItem._id);
            await store.save();
          }
        }
      } catch (error) {
        console.error('Error saving/updating menu item:', error);
      }
    })
    .on('end', () => {
      console.log('Store data loaded/updated into MongoDB');
    });
}

module.exports = { loadStoreData };
