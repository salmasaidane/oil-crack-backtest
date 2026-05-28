# Fix Heroku: “No app.json located in the repo”

## What’s wrong

Your repo **exists** but is **empty** on GitHub:

https://github.com/salmasaidane/oil-crack-backtest

Heroku reads files from GitHub, not from your PC. Until you **push** the project, there is no `app.json` online.

### Check before deploying

Open this link — it must show the file, not 404:

**https://github.com/salmasaidane/oil-crack-backtest/blob/main/app.json**

You should also see at the repo root: `package.json`, `Procfile`, `server/`, `client/`.

---

## Push the full project (required)

### A) Git Bash or PowerShell (recommended)

1. Install **Git for Windows**: https://git-scm.com/download/win  
   Close and reopen the terminal after install.

2. Run:

```powershell
cd "C:\Users\Salma Saidane\Projects\oil-crack-backtest"

git init
git branch -M main
git add .
git status
```

`git status` must list `app.json`, `package.json`, `Procfile`, `server/`, `client/`.

```powershell
git commit -m "Initial commit: oil crack backtest app"

git remote remove origin 2>$null
git remote add origin https://github.com/salmasaidane/oil-crack-backtest.git

git push -u origin main
```

3. Refresh https://github.com/salmasaidane/oil-crack-backtest — you should see folders and files.

4. Deploy: https://heroku.com/deploy?template=https://github.com/salmasaidane/oil-crack-backtest

---

### B) GitHub Desktop (no command line)

1. Install https://desktop.github.com/ and sign in as **salmasaidane**
2. **File → Add local repository** → choose  
   `C:\Users\Salma Saidane\Projects\oil-crack-backtest`
3. If asked to create a repo, confirm
4. Summary should show many files including **app.json**
5. **Commit to main** → message: `Initial commit`
6. **Publish repository** → name: `oil-crack-backtest`  
   If it already exists on GitHub, use **Push origin** instead
7. Verify `app.json` on the website (link above)
8. Use the Heroku deploy button

---

### C) Do not do this

- Creating the repo with only a README and never uploading the rest  
- Pushing from a parent folder so files live in a subfolder (Heroku needs `app.json` at the **root**)

---

## Deploy without the button

```powershell
winget install Heroku.HerokuCLI
heroku login
cd "C:\Users\Salma Saidane\Projects\oil-crack-backtest"
git add . && git commit -m "Deploy"
heroku create salma-oil-crack-backtest
git push heroku main
heroku open
```

This deploys from your PC and does not require GitHub.
