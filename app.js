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


const axios = require('axios');

const ZALO_APP_ID = '4129188943061618341';
const ZALO_APP_SECRET = 'XKw094clAAs7BHU8dY3C';

app.get('/login/zalo', async (req, res) => {
    const { code, state } = req.query;

    if (!code) {
        return res.status(400).json({ message: 'Authorization code is missing' });
    }

    // Dynamically construct the redirect URI based on the request
    const ZALO_REDIRECT_URI = `${req.protocol}://${req.get('host')}/login/zalo`;

    try {
        // Step 1: Exchange authorization code for access token
        const tokenResponse = await axios.post(
            'https://oauth.zaloapp.com/v4/access_token',
            new URLSearchParams({
                app_id: ZALO_APP_ID,
                code: code,
                grant_type: 'authorization_code'
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded',"secret_key": `${ZALO_APP_SECRET}` }
            }
        );

        const { access_token } = tokenResponse.data;

        if (!access_token) {
            return res.status(400).json({ message: 'Failed to obtain access token' });
        }

        // Step 2: Use access token to retrieve user information
        const userInfoResponse = await axios.get(
            `https://graph.zalo.me/v2.0/me?access_token=${access_token}&fields=id,name,picture`
        );

        const userInfo = userInfoResponse.data;

        // Send user information as JSON response (or process it further as needed)
        res.json({
            message: 'User information retrieved successfully',
            userInfo
        });
    } catch (error) {
        console.error('Error during Zalo login callback:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});


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