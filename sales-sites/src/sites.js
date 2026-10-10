// Who has a website. Add a person here to turn their page on (the name must match the Main Employee Sheet).
// slug = the web address: stewart-west.keving-stewart.workers.dev/<slug>
// mondayIds (optional) = their monday user id(s), only needed if their monday name doesn't match the sheet
export const SITES = [
  { slug: 'reuben-de-la-parra', name: 'Reuben De La Parra' },
];

// Headshots cut out from the background (for the pop-out circle), in public/people/<slug>.webp.
// Anyone not listed gets a red circle with their initials until a cut-out photo is added.
export const PHOTOS = new Set([
  'reuben-de-la-parra', 'julie-putjenter', 'katie-smith', 'andrea-petritz',
  'patti-mathews', 'jennifer-gault', 'ashley-obert', 'bianca-garcia',
]);

export const slugify = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
