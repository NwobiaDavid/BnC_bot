const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Parse JSON payloads
app.use(bodyParser.json());

// Handle PayStack callback
app.post('/paystack/callback', (req, res) => {
    // Process the PayStack callback here
    console.log('PayStack Callback Data:', req.body);
    res.status(200).send('Callback Received');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
