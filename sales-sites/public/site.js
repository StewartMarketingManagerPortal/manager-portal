// Small touches on top of the server-built page: phone menu, "see all", PDF first-page previews, contact form.
(function () {
  var top = document.querySelector('.top'), menu = document.querySelector('.menu');
  if (menu) {
    menu.addEventListener('click', function () { var o = top.classList.toggle('open'); menu.setAttribute('aria-expanded', o ? 'true' : 'false'); });
    top.querySelectorAll('nav a').forEach(function (a) { a.addEventListener('click', function () { top.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }); });
  }

  document.querySelectorAll('[data-more]').forEach(function (b) {
    b.addEventListener('click', function () {
      var row = document.getElementById(b.getAttribute('data-more'));
      var open = row.classList.toggle('open');
      b.textContent = open ? 'Show fewer' : b.getAttribute('data-label') || b.textContent;
      if (!b.getAttribute('data-label')) b.setAttribute('data-label', b.textContent);
    });
    b.setAttribute('data-label', b.textContent);
  });

  // first page of each PDF, drawn when it scrolls into view
  var pdfs = document.querySelectorAll('[data-pdf]');
  if (pdfs.length) {
    var lib = null;
    var load = function () {
      if (lib) return lib;
      lib = new Promise(function (ok, no) {
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; ok(window.pdfjsLib); };
        s.onerror = no; document.head.appendChild(s);
      });
      return lib;
    };
    var draw = function (el) {
      load().then(function (pdfjs) {
        return pdfjs.getDocument({ url: el.getAttribute('data-pdf'), disableAutoFetch: true, disableStream: true, rangeChunkSize: 262144 }).promise;
      }).then(function (doc) { return doc.getPage(1); }).then(function (page) {
        var w = el.clientWidth || 240, v = page.getViewport({ scale: 1 }), scale = (w * Math.min(window.devicePixelRatio || 1, 2)) / v.width;
        var vp = page.getViewport({ scale: scale }), c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () { el.insertBefore(c, el.firstChild); el.classList.add('ready'); });
      }).catch(function () { /* keep the plain page drawing */ });
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); draw(e.target); } }); }, { rootMargin: '300px' });
      pdfs.forEach(function (el) { io.observe(el); });
    } else pdfs.forEach(draw);
  }

  // contact form sends without leaving the page
  var form = document.querySelector('form.msg');
  if (form && window.fetch) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var st = form.querySelector('.status'), btn = form.querySelector('button[type=submit]');
      var d = {}; new FormData(form).forEach(function (v, k) { d[k] = v; });
      if (!d.name.trim() || !d.message.trim()) { st.className = 'status bad'; st.textContent = 'Please add your name and a message.'; return; }
      if (!d.phone.trim() && !d.email.trim()) { st.className = 'status bad'; st.textContent = 'Please add a phone number or email so we can reach you.'; return; }
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.ok) { st.className = 'status ok'; st.textContent = 'Thanks! Your message is on its way.'; form.reset(); form.querySelectorAll('input:not([type=hidden]),textarea').forEach(function (x) { x.blur(); }); }
          else { st.className = 'status bad'; st.textContent = j.error || 'Sorry, that didn’t send. Please call or email instead.'; }
        })
        .catch(function () { st.className = 'status bad'; st.textContent = 'Sorry, that didn’t send. Please call or email instead.'; })
        .then(function () { btn.disabled = false; btn.textContent = 'Send message'; });
    });
  }
})();
