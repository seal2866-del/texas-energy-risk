# Texas Energy Risk — Claude Working Rules

These rules apply every session. Follow them without exception.

---

## Deployment Rules

### Frontend (Vercel)
**NEVER use `npx vercel --prod` or any Vercel CLI command from bash.**
Always deploy Vercel from **PowerShell** by giving the user this exact command:
```powershell
cd "C:\EngergyLens\texas-energy-risk"
npx vercel --prod
```
Vercel must always be run from the **repo root** (`texas-energy-risk/`), NOT from inside `frontend/`.
Running from `frontend/` causes "path frontend/frontend does not exist" because the Vercel project root is already set to `frontend`.

### Backend (Railway)
Railway auto-deploys on every `git push origin main`. No manual Railway command needed.
To force Railway to pick up a commit, push any change to `main` — Railway will build and deploy automatically.

---

## File Writing Rules (NTFS Truncation Bug)

**Never write files larger than ~7KB using bash heredoc or the bash `cat >` pattern.**
The bash sandbox writes to a Windows NTFS mount. Files silently truncate beyond ~7-8KB with no error.
This caused `main.py` to lose its closing brace and crash Railway on startup.

### Safe workflow for editing files:
1. Use the **Read / Edit / Write tools** (not bash) for all file edits
2. After every edit, run a syntax check before committing:
   - Python: `python3 -c "import ast; ast.parse(open('file.py').read()); print('OK')"`
   - TypeScript: `npx tsc --noEmit` from `frontend/`
3. Always `tail -10` any edited file to confirm it ends correctly
4. **Never stage a file in bash git** — always tell the user to run `git add / commit / push` from PowerShell

---

## Git Workflow

**Never run `git add`, `git commit`, or `git push` from bash.** The bash sandbox creates an
`index.lock` file on the NTFS mount that it cannot remove, blocking all subsequent git operations.

Always give the user PowerShell commands:
```powershell
cd "C:\EngergyLens\texas-energy-risk"
Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
git add <files>
git commit -m "message"
git push origin main
npx vercel --prod
```

If a lock appears, instruct the user to run:
```powershell
Remove-Item "C:\EngergyLens\texas-energy-risk\.git\index.lock" -Force
```

---

## Security

**NEVER paste the Supabase `service_role` key in chat.**
The `anon` key and Project URL are safe to share. The `service_role` key must only be entered
directly into files or Railway environment variables by the user.

---

## Data Sources

| Source | Freshness threshold | Notes |
|--------|-------------------|-------|
| ERCOT  | 15 min | Scraped from ercot.com CDR every 5 min by background poller |
| NOAA   | 60 min | Forecast demand risk, 3-day |
| EIA    | 15 days | Weekly gas storage — inherently 7-10 days old |

EIA staleness threshold is set to **21600 minutes (15 days)** in `signal_engine.py` line 106.
EIA data is fetched via `_eia_url()` in `external_apis.py` which builds raw query strings with
**literal brackets** — do NOT switch back to httpx `params={}` dict, which URL-encodes `[]` as
`%5B%5D` and causes EIA to return `rows=0` for every query.

---

## Backup

Run after any major stable milestone:
```powershell
# Tag in git
cd "C:\EngergyLens\texas-energy-risk"
git tag -a v1.x-stable -m "Description of stable state"
git push origin v1.x-stable
```
Zip backup is saved to `C:\EngergyLens\texas-energy-risk-backup-v1.0-stable.zip`.
