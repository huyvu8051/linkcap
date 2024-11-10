const express = require('express')
const app = express()
const path = require('path')
const session = require('express-session')
const PORT = process.env.PORT || 3000
app.use(session({
    secret: 'your_secret_key', // Khóa bí mật để mã hóa session ID
    resave: false, // Không lưu lại session nếu không có thay đổi
    saveUninitialized: true, // Lưu session mới ngay cả khi nó chưa được khởi tạo
    cookie: {secure: false, maxAge: 60000} // Cấu hình cookie, maxAge tính bằng ms (60s ở đây)
}))

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public'))) // Serve static files

const urlDatabase = {} // In-memory storage

// Function to get client IP address
const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress
}


const axios = require('axios')

const ZALO_APP_ID = '4129188943061618341'
const ZALO_APP_SECRET = 'XKw094clAAs7BHU8dY3C'
app.get('/login/zalo', async (req, res) => {
    const {code, state} = req.query

    if (!code) {
        return res.status(400).json({message: 'Authorization code is missing'})
    }

    // Dynamically construct the redirect URI based on the request
    const ZALO_REDIRECT_URI = `${req.protocol}://${req.get('host')}/login/zalo`

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
                headers: {'Content-Type': 'application/x-www-form-urlencoded', 'secret_key': ZALO_APP_SECRET}
            }
        )

        const {access_token} = tokenResponse.data

        if (!access_token) {
            return res.status(400).json({message: 'Failed to obtain access token'})
        }

        // Step 2: Use access token to retrieve user information
        const userInfoResponse = await axios.get(
            `https://graph.zalo.me/v2.0/me?fields=id,name,picture`
            , {
                headers: {
                    'access_token': access_token
                }
            })

        const userInfo = userInfoResponse.data

        // Store user information in session
        req.session.user = userInfo

        // Optionally, redirect to a different page after login
        /*res.json({
            message: 'User information retrieved successfully and saved to session',
            userInfo
        })*/

        const { id, limit } = req.query;

        res.redirect(`/redirect?limit=${limit}&id=${id}`);

    } catch (error) {
        console.error('Error during Zalo login callback:', error)
        res.status(500).json({message: 'Internal server error', error: error.message})
    }
})
app.get('/profile', (req, res) => {
    if (req.session.user) {
        res.json({
            message: 'User is logged in',
            user: req.session.user
        })
    } else {
        res.status(401).json({message: 'Please log in to view this page'})
    }
})
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({message: 'Failed to log out'})
        }
        res.json({message: 'Logged out successfully'})
    })
})


// Route to shorten URL
app.post('/shorten', (req, res) => {
    const {originalUrl, limit} = req.body
    if (!originalUrl || !limit) {
        return res.status(400).json({message: 'Please provide both originalUrl and limit.'})
    }

    const id = Math.random().toString(36).substr(2, 8)
    urlDatabase[id] = {
        originalUrl,
        limit: parseInt(limit),
        accessedIps: new Set() // Store unique IPs here
    }

    const shortenedUrl = `redirect?limit=${limit}&id=${id}`
    res.json({shortenedUrl})
})
// Route to handle redirect with user session check
app.get('/redirect', (req, res) => {
    // Check if the user is logged in
    if (!req.session.user) {
        // If not logged in, display signing.html
        return res.sendFile(path.join(__dirname, 'public', 'signing.html'));
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ message: 'Please provide the id in the query parameters' });
    }

    const urlData = urlDatabase[id];
    const userId = req.session.user.id;
    const userName = req.session.user.name;

    if (!urlData) {
        return res.status(404).json({ message: 'URL not found' });
    }

    // Retrieve the limit directly from urlData
    const limit = urlData.limit;

    // Initialize accessedUsers map if it doesn't exist
    if (!urlData.accessedUsers) {
        urlData.accessedUsers = new Map();
    }

    // Check if the number of unique users has reached the limit
    if (urlData.accessedUsers.size >= limit) {
        // Convert accessedUsers Map to an array of objects with id and name
        const accessedUsersList = Array.from(urlData.accessedUsers.entries()).map(([id, name]) => ({ id, name }));
        return res.status(403).json({
            message: `Access limit of ${limit} unique users reached`,
            accessedUsers: accessedUsersList
        });
    }

    // Add user to accessedUsers map if not already present
    if (!urlData.accessedUsers.has(userId)) {
        urlData.accessedUsers.set(userId, userName);
    }

    // Redirect to the original URL
    res.redirect(urlData.originalUrl);
});



app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})