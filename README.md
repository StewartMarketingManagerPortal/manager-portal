# Stewart West Marketing · Manager Portal

A private website for California and Arizona sales managers to add new hires and request marketing.
Everything they submit lands on the team's monday.com boards.

## How it fits together
- **Website:** a Cloudflare Worker publishes `public/` every time this repository changes (settings in `wrangler.toml`).
- **Server:** `src/worker.js` sends `/api/...` to `src/api.js`, which talks to monday.com with the token kept in Cloudflare. Shared helpers are in `lib/monday.js`.
- **Sign-in:** Cloudflare Access emails a one-time code. The portal then checks the signed-in email against the **Manager Contacts** board:
  - *Managers* group → can submit for the people linked to their row (their team)
  - *Portal Admins* group → can see and submit for everyone
  - Set a row's Status to *Paused* to switch someone off without deleting them.

## Boards it uses (found by name)
| Board | Used for |
|---|---|
| Manager Contacts | who may sign in, and each manager's team |
| Main Employee Sheet | new hires (Marketing Setup = Pending, photo in Image Upload) |
| Marketing Request | marketing requests, proofs and approvals |

Optional columns the portal fills when they exist on the Main Employee Sheet: **Package Look**, **Requested By**, **Start Date**, **Market Areas**, **Notes for Marketing**. Anything without a column is written as an update on the item instead, so nothing is lost.

## Settings (Cloudflare → Workers & Pages → manager-portal → Settings → Variables and Secrets)
| Name | What |
|---|---|
| `MONDAY_TOKEN` (secret) | monday.com API token |
| `APPROVED_STATUS` | optional: Status label to set when a manager approves a proof |
| `CHANGES_STATUS` | optional: Status label when changes are requested (default "Working On It") |
| `SELF_SERVE` | `1` to show "Create the package now" after a new hire |
| `MANAGERS_BOARD_ID`, `EMPLOYEES_BOARD_ID`, `REQUESTS_BOARD_ID` | optional board ids if a board is renamed |

## Third-party files
`public/vendor/selfie/` is MediaPipe Selfie Segmentation (Apache-2.0), used only to preview a headshot without its background in the browser. The final cutout is still made in Photoshop by the Marketing Tools app.
