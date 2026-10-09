# My Marketing (employee app)


A phone-friendly site where each Stewart Title sales and escrow member sees **only their own** marketing
(market update, title tips, flyers…) from the monday.com **Employee Marketing Portal-New** board, and can
share or download it in a tap. It also works on computers and installs to a phone home screen.

It runs as its own Cloudflare Worker (`my-marketing`) from this folder of the `manager-portal` repo.
Nothing changes in the Mac app: it keeps uploading to the same board.

## How sign-in works
1. The person types the email on their monday.com guest account.
2. The site checks that monday user is **active** and **a member of the portal board**.
3. It sends a 6-digit code as a **monday notification** (it comes from the account that owns the API token).
4. Code is good for 10 minutes; 5 wrong tries and it stops working; at most 5 codes an hour per email.
5. They stay signed in for 90 days on that device. Access is re-checked every couple of minutes, so
   **removing someone from the board, or deactivating them in monday, ends their access**.

## What they see
Rows on the portal board whose **Person** column is them. Columns are matched by title, like the Mac app:
`Person` (people), `Document` (file), `Category`, `Date`, `Employee`, `Don't Touch!!`.
- Each file in a row is one piece. Category comes from the Category column (or the group name).
- "NEW" = row created in the last 14 days; for Market Update, the Date column in the last 7 days.
- Files are streamed through the site, so a person can only open files on their own rows.

## Cloudflare settings (Workers & Pages → my-marketing → Settings)
- **Build:** root directory `my-marketing`, deploy command `npx wrangler deploy`.
- **Variables and Secrets (runtime):**
  - `MONDAY_TOKEN` — **Secret**. The monday API token (same one as the Manager Portal). Never put it in GitHub.
  - `PORTAL_BOARD_ID` — optional, the board's number, to skip looking it up by name.
  - `PORTAL_BOARD_NAME` — optional, if the board is renamed.
  - `SESSION_SECRET` — optional Secret; changing it signs everyone out.

Sign-in codes and rate limits are kept in a Durable Object (`Gate`), included in the Workers Free plan.

## Look and layout rules (keep for anything new)
- **Every piece** is shown as a card with the red pill **Download** button under it (plus Share on phones): `cardWithDownload()` in `public/app.js`.
- **All buttons** use `.btn` — red pill (`.btn.primary` solid red, plain `.btn` white with red outline). Don't add other button styles.
- **Categories split into sections** (sideways rows with jump buttons at the top) using `SECTION_RULES` in `public/app.js`:
  Photos & Personal Branding, Flyers, Title Tips and Market Update have rules. A section shows only once it has
  something in it; unmatched pieces go in the last "More …" section. A brand-new category with no rules shows as a grid
  of the same cards — add a rule there to give it sections.
- Names lose underscores automatically (`tidy()` in `src/worker.js`).
