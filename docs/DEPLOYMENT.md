# Valvix — Production Deployment Guide

A complete guide to deploying **Valvix** on a **free / low-cost** stack:
- **Frontend**: **Vercel** (Free Hobby Plan)
- **Backend + Database**: **GCP Compute Engine `e2-micro` VM** (Always Free Tier) with **SQLite (`valvix.db`)**, **systemd**, **Nginx**, and **Certbot (Let's Encrypt HTTPS)**.

---

## Production Architecture

```text
Browser (HTTPS)
   │
   ├──► https://valvix.vercel.app          (Vercel CDN - React/Vite)
   │         │
   │         ▼  (VITE_API_BASE_URL)
   └──► https://api.yourdomain.com/api     (GCP VM - Nginx + Certbot SSL)
             │
             ▼  proxy_pass http://127.0.0.1:8000
        Uvicorn (FastAPI) ──► backend/valvix.db (SQLite WAL on Persistent Disk)
```

---

## Part 1: Deploy Backend to GCP VM (Ubuntu + Nginx + Certbot)

### 1. Create a VM in Google Cloud Console
1. Go to **Compute Engine → VM Instances → Create Instance**.
2. Select the **Always Free** configuration:
   - **Region**: `us-west1` (Oregon), `us-central1` (Iowa), or `us-east1` (South Carolina)
   - **Machine type**: `e2-micro` (2 vCPU shared, 1 GB RAM)
   - **Boot disk**: **Ubuntu 24.04 LTS** (or 22.04 LTS), **Standard persistent disk**, **30 GB**
   - **Firewall**: Check **Allow HTTP traffic** (`80`) and **Allow HTTPS traffic** (`443`).
3. Point your domain/subdomain (e.g. `api.yourdomain.com`) to the VM's **External IP** using an **A Record** (if using Cloudflare, temporarily set the proxy status to *DNS Only* while running Certbot).

---

### 2. Install Dependencies on the VM
SSH into your VM and run:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git nginx certbot python3-certbot-nginx
```

*(Optional, strongly recommended for 1 GB RAM VMs)*: Add **1 GB swap** so `pip install` never runs out of memory:
```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

### 3. Clone Repository & Set Up Backend
```bash
cd /var/www
sudo git clone https://github.com/USERNAME/Valvix.git
sudo chown -R $USER:$USER /var/www/Valvix

cd /var/www/Valvix/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Create `backend/.env`:
```bash
cp .env.example .env
nano .env
```
Fill in your production configuration:
```env
DATABASE_URL=sqlite+aiosqlite:///./valvix.db
STEAM_API_KEY=your_steam_web_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
FRONTEND_URL=https://your-project.vercel.app
ENVIRONMENT=production
```
*(Note: You can update `FRONTEND_URL` after deploying to Vercel if you don't know your Vercel URL yet).*

---

### 4. Create a `systemd` Service for Uvicorn
Run the backend in the background and auto-restart on VM reboot:

```bash
sudo nano /etc/systemd/system/valvix-backend.service
```
Paste the following configuration (adjust `User` if your VM username is not `ubuntu`):
```ini
[Unit]
Description=Valvix FastAPI Backend
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/var/www/Valvix/backend
EnvironmentFile=/var/www/Valvix/backend/.env
ExecStart=/var/www/Valvix/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips='*'
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
*(The `--proxy-headers` flag is required so FastAPI reads `X-Forwarded-Proto: https` from Nginx during Steam OpenID redirects).*

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable valvix-backend
sudo systemctl start valvix-backend
sudo systemctl status valvix-backend
```
Verify the backend responds locally:
```bash
curl http://127.0.0.1:8000/health
```

---

### 5. Configure Nginx Reverse Proxy
Create the Nginx site configuration:
```bash
sudo nano /etc/nginx/sites-available/valvix
```
Paste the following (replace `api.yourdomain.com` with your domain):
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        # Generous timeouts for large Steam library syncs & Gemini AI calls
        proxy_read_timeout 60s;
        proxy_connect_timeout 15s;
    }
}
```

Enable the site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/valvix /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### 6. Enable Free SSL/HTTPS with Certbot
Run Certbot to automatically issue a Let's Encrypt SSL certificate and configure HTTP → HTTPS redirects:
```bash
sudo certbot --nginx -d api.yourdomain.com
```
Follow the prompts (enter email, agree to ToS). Verify automatic renewal:
```bash
sudo certbot renew --dry-run
```
Your backend is now live at `https://api.yourdomain.com/health`.

---

## Part 2: Deploy Frontend to Vercel (Free)

1. Push the **Valvix** repository to GitHub.
2. Open [Vercel Dashboard](https://vercel.com/) → **Add New → Project** → import your **Valvix** GitHub repository.
3. Under **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variable**:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://api.yourdomain.com/api`
5. Click **Deploy**.

### Sync Backend CORS Origin
Once you have your Vercel URL (e.g. `https://valvix-hub.vercel.app`), ensure `backend/.env` on the VM has:
```env
FRONTEND_URL=https://valvix-hub.vercel.app
```
Then restart the backend service:
```bash
sudo systemctl restart valvix-backend
```

---

## Part 3: Updating Code & Backing Up SQLite

### Updating the Backend on the VM
```bash
cd /var/www/Valvix
git pull origin main
cd backend
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart valvix-backend
```

### Backing Up SQLite (`valvix.db`)
Because Valvix uses SQLite WAL mode, use `.backup` for safe online backups while the server is running:
```bash
sqlite3 /var/www/Valvix/backend/valvix.db ".backup '/home/ubuntu/valvix-backup-$(date +%F).db'"
```
