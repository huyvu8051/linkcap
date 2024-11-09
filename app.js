const express = require('express');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

const urlDatabase = {}; // In-memory storage

// Function to get client IP address
const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
};

// Route to shorten URL
app.post('/shorten', (req, res) => {
    const { originalUrl, limit } = req.body;
    if (!originalUrl || !limit) {
        return res.status(400).json({ message: 'Please provide both originalUrl and limit.' });
    }

    const id = Math.random().toString(36).substr(2, 8);
    urlDatabase[id] = {
        originalUrl,
        limit: parseInt(limit),
        accessedIps: new Set() // Store unique IPs here
    };

    const shortenedUrl = `${limit}/${id}`;
    res.json({ shortenedUrl });
});

// Route to handle redirect with IP check
app.get('/:limit/:id', (req, res) => {
    const { id } = req.params;
    const urlData = urlDatabase[id];
    const clientIp = getClientIp(req);

    if (!urlData) {
        return res.status(404).json({ message: 'URL not found' });
    }

    // Check the number of unique IPs accessing the URL
    if (urlData.accessedIps.size > urlData.limit) {
        return res.status(403).send(`Access limit of ${urlData.limit} reached`);
    }

    // Add IP to accessedIps if not already present
    urlData.accessedIps.add(clientIp);
    res.redirect(urlData.originalUrl);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
