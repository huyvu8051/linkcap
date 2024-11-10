let shortenedUrl = ''; // To store the generated URL

function shortenUrl() {
    const url = document.getElementById('url').value;
    const cap = document.getElementById('cap').value || 99;

    if (!url || !cap) {
        alert("Please fill in the URL field");
        return;
    }

    fetch('/shorten', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ originalUrl: url, limit: cap })
    })
        .then(response => response.json().then(data => ({ data, ok: response.ok })))
        .then(({ data, ok }) => {
            if (ok) {
                let location = window.location
                shortenedUrl = location.href + data.shortenedUrl; // Store the URL
                document.getElementById('result').textContent = shortenedUrl;
                document.getElementById('result').href = shortenedUrl;
                document.getElementById('shareBtn').style.display = 'block'; // Show the Share button
                navigator.clipboard.writeText(shortenedUrl)
                    .then(() => {
                        document.getElementById('notification').textContent = `URL copied to clipboard: ${shortenedUrl}`;
                        document.getElementById('notification').style.color = '#28a745';
                    })
                    .catch(err => {
                        document.getElementById('notification').textContent = `Error copying to clipboard: ${err.message}`;
                        document.getElementById('notification').style.color = '#dc3545';
                    });
            } else {
                document.getElementById('notification').textContent = `Error: ${data.message}`;
                document.getElementById('notification').style.color = '#dc3545';
            }
        })
        .catch(error => {
            document.getElementById('notification').textContent = `Error: ${error.message}`;
            document.getElementById('notification').style.color = '#dc3545';
        });
}

function shareUrl() {
    if (navigator.share) { // Check if Web Share API is supported
        navigator.share({
            title: 'Check out this shortened URL!',
            text: 'Here is the shortened URL you requested:',
            url: shortenedUrl
        })
            .then(() => {
                document.getElementById('notification').textContent = 'URL shared successfully!';
                document.getElementById('notification').style.color = '#28a745';
            })
            .catch(error => {
                document.getElementById('notification').textContent = `Error sharing URL: ${error.message}`;
                document.getElementById('notification').style.color = '#dc3545';
            });
    } else {
        document.getElementById('notification').textContent = 'Sharing not supported on this browser';
        document.getElementById('notification').style.color = '#dc3545';
    }
}

function login(){
    // Gọi hàm này khi người dùng nhấn vào nút "Đăng nhập với Zalo"
    redirectToZaloLogin();

}

// Hàm tạo code verifier
function generateCodeVerifier(length = 43) {
    const possibleChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let verifier = "";
    for (let i = 0; i < length; i++) {
        verifier += possibleChars.charAt(Math.floor(Math.random() * possibleChars.length));
    }
    return verifier;
}

// Hàm tạo code challenge từ code verifier
async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


// Hàm chuyển hướng người dùng để lấy authorization code
async function redirectToZaloLogin() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const appId = "4129188943061618341";
    const redirectUri = "https://linkcap.onrender.com"; // URL đã cấu hình trong trang Zalo Developer
    const state = "random_state_string"; // Một chuỗi ngẫu nhiên để chống CSRF

    window.location.href = `https://oauth.zaloapp.com/v4/permission?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&state=${state}`;
}



