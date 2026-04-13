# Social Media Management Tool - Deployment Guide (Ubuntu Home Server)

This guide helps you set up your tool on a Ubuntu server (like a Raspberry Pi or an old laptop) to keep it running 24/7.

## 1. Prerequisites
Ensure your Ubuntu server has Python 3.10+ and Node.js 18+ installed.

```bash
sudo apt update
sudo apt install python3-pip python3-venv nodejs npm git
```

## 2. GitHub Setup (Local Machine)
1. **Private Repo**: Create a new **PRIVATE** repository on GitHub.
2. **Push Code**:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```
*Note: Your `client_secret.json` and `.db` files will NOT be pushed because we added them to `.gitignore`.*

## 3. Server Setup (Ubuntu)
1. **Clone**:
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

2. **Backend Setup**:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. **Secrets**:
Manually copy your `client_secret.json` to the project root on the server (using SCP, SFTP, or a USB drive).

4. **Frontend Build**:
```bash
cd ../frontend
npm install
npm run build
```

## 4. Running the App
We recommend using `pm2` to keep the app alive.
```bash
sudo npm install -g pm2
pm2 start "python3 backend/main.py" --name "youtube-backend"
```
Or use a `systemd` service for a more robust setup.

## 5. Google Cloud Configuration
1. Go to **GCP Console > APIs & Services > Credentials**.
2. Create a **Web Application** OAuth ID.
3. Add your server's IP (e.g., `http://192.168.1.50:8000/auth/callback`) to **Authorized Redirect URIs**.
4. Update the `client_secret.json` on your server with these new credentials.
