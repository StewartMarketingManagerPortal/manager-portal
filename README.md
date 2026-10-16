# Stewart West Marketing · Manager Portal

A private website for California and Arizona sales managers to add new hires and request marketing.
Everything they submit lands on the team's monday.com boards.

## How it fits together
- **Website:** a Cloudflare Worker publishes `public/` every time this repository changes (settings in `wrangler.toml`).
- **Server:** `src/worker.js` sends `/api/...` to `src/api.js`, which talks to monday.com with the token kept in Cloudflare. Shared helpers are in `lib/monday.js`.
- **Speed:** the big boards (Manager Contacts, Main Employee Sheet, Marketing Request, Market Areas, Newsletter) are kept for 30-60 seconds in one shared cache (`src/cache.js`, a Durable Object) that every copy of the server reads. When that copy is older, it is still shown once while a fresh one loads in the background. The website checks the page's lists again when you come back to it, change pages, or every 2 minutes, so changes from Marketing Tools show up within about a minute without reloading.
- **Sign-in:** Cloudflare Access emails a one-time code. The portal then checks the signed-in email against the **Manager Contacts** board:
  - *Managers* group → can submit for the people linked to their row (their team)
  - *Portal Admins* group → can see and submit for everyone
  - Set a row's Status to *Paused* to switch someone off without deleting them.
  - *Presidents* group → sees everyone on the teams of the managers typed in the **Managers** text column (names separated by commas, exactly as on their rows), plus those managers, and their requests, new hires and onboarding.
  - *Assistants* group → a manager's assistant. Type the manager's name (exactly as on their row) in the **Assistant To** text column. They sign in with the email in their row's Person column and see that manager's portal: same team, same lists. What they do is noted as "Jane for Vera". Pausing the manager pauses their assistants too.

## Boards it uses (found by name)
| Board | Used for |
|---|---|
| Manager Contacts | who may sign in, and each manager's team |
| Main Employee Sheet | new hires (Marketing Setup = Pending, photo in Image Upload) |
| Marketing Request | marketing requests, proofs and approvals |
| Manager Portal Recruiting | candidates for the Recruiting page (private board in Stewart Marketing West, made by the portal the first time it's used) |


**Recruiting:** a manager adds a candidate (photo, name, title, area, their own phone and email) and sees sample marketing drawn on screen from `public/samples.js` (the same file is in `my-marketing/public/`). "Show on My Marketing" opens `my-marketing/public/sample.html` with a 5-minute pass; the sample view then lasts 30 minutes, is read only and has no downloads. "Not hiring" deletes the candidate's row and photo, and rows older than 60 days are deleted the next time anyone opens Recruiting. Nothing goes to the marketing team or the Main Employee Sheet.

Optional columns the portal fills when they exist on the Main Employee Sheet: **Package Look**, **Requested By**, **Start Date**, **Market Areas**, **Notes for Marketing**. Anything without a column is written as an update on the item instead, so nothing is lost.

## Settings (Cloudflare → Workers & Pages → manager-portal → Settings → Variables and Secrets)
| Name | What |
|---|---|
| `MONDAY_TOKEN` (secret) | monday.com API token |
| `APPROVED_STATUS` | optional: Status label to set when a manager approves a proof |
| `CHANGES_STATUS` | optional: Status label when changes are requested (default "Working On It") |
| `SELF_SERVE` | `1` to show "Create the package now" after a new hire |
| `MANAGERS_BOARD_ID`, `EMPLOYEES_BOARD_ID`, `REQUESTS_BOARD_ID`, `RECRUITING_BOARD_ID` | optional board ids if a board is renamed |

## Third-party files
`public/vendor/selfie/` is MediaPipe Selfie Segmentation (Apache-2.0), used only to preview a headshot without its background in the browser. The final cutout is still made in Photoshop by the Marketing Tools app.
