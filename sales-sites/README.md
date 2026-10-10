# Stewart Title West sales team websites

One public site with a page for each salesperson, built live from monday.com:

- `/<slug>` — their page (e.g. `/reuben-de-la-parra`)
- `/<slug>/team` — Meet my team (only for people with a row on the Manager Contacts board)
- `/<slug>/contact.vcf` — "Save my contact"
- `/` — list of everyone who has a page

Runs as its own Cloudflare Worker (`stewart-west`) from this folder of the `manager-portal` repo.

## Turning a page on
Add the person to `SITES` in `src/sites.js` (name exactly as on the Main Employee Sheet). For the pop-out header photo,
add a cut-out headshot (transparent background, about 520×600) as `public/people/<slug>.webp` and add the slug to `PHOTOS`.

## Where each part comes from
| Part | Board | How |
|---|---|---|
| Name, title, phone, email, company, office | Main Employee Sheet | row with the same name |
| Market update | Employee Marketing Portal-New | their rows (Person column), Category "Market Update", newest Date only; area chips come from the file names |
| Flyers, Title tips | Employee Marketing Portal-New | their rows, Category "Flyers" / "Title Tips", newest first (picture shown; PDF downloaded when the row has one) |
| Forms & documents | Employee Websites | "Stewart Documents" group, PDF in the Document column; the preview is the PDF's first page |
| Tools for agents | Employee Websites | "Stewart Tools" group, link in Template Link or Search Website; optional Description column |
| Who sees an Employee Websites row | | Employee column = All, All CA, All AZ or names; if Employee is empty, the people in the Person column. Status containing Hide/Draft/Inactive hides it. |
| Meet my team | Manager Contacts | the Main Employee Sheet rows linked to their manager row |
| Contact form | Website Leads (optional) | new row (Email, Phone, Message, Salesperson columns if present) + a monday notification to the salesperson |

Pages refresh from monday every 3 minutes (add `?refresh` to the address to refresh right away).
Files are streamed through the site, and only files shown on that person's page can be opened.

## Cloudflare settings (Workers & Pages → stewart-west → Settings)
- **Build:** root directory `sales-sites`, deploy command `npx wrangler deploy`.
- **Variables and Secrets:** `MONDAY_TOKEN` — **Secret** (same token as My Marketing). Never put it in GitHub.
- Optional board ids to skip looking boards up by name: `EMPLOYEES_BOARD_ID`, `MANAGERS_BOARD_ID`, `PORTAL_BOARD_ID`, `WEBSITES_BOARD_ID`, `LEADS_BOARD_ID`.

While this is a sample, every page sends `X-Robots-Tag: noindex` so Google doesn't list it (in `src/worker.js`).
Contact-form spam protection: hidden field, minimum fill time, link limit, and 5 messages per hour per network (Durable Object `Limits`, free plan).
