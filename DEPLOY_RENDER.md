# Deploy free on Render (no Heroku Eco subscription)

Heroku requires a paid **Eco** plan (~$5/month) to run dynos. Render offers a **free** web tier (app sleeps after ~15 min idle; first load may take ~30s).

## Steps

1. Push latest code to GitHub (includes `render.yaml`):
   ```powershell
   cd "C:\Users\Salma Saidane\Projects\oil-crack-backtest"
   git add .
   git commit -m "Add Render deploy config"
   git push origin main
   ```

2. Open **https://render.com** → sign up / log in with **GitHub**.

3. **New +** → **Blueprint** (or **Web Service**).

4. Connect repository **`salmasaidane/oil-crack-backtest`**.

5. If using **Blueprint**, Render reads `render.yaml` automatically.  
   If using **Web Service** manually:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Plan:** Free

6. Add environment variable (optional):
   - `EIA_API_KEY` = your EIA key

7. Click **Create Web Service** / **Apply**.

8. When deploy finishes, open the URL Render gives you (e.g. `https://oil-crack-backtest.onrender.com`).

## Notes

- Free tier spins down when idle; wake it by opening the URL.
- Same app as Heroku: crack backtest + US–Iran overlay.
