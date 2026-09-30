/*!
 * site-nav.js
 * Shared behavior for the main navigation on every page.
 *
 * Dropdown menus in the nav use this markup (add a new <li> to add a page):
 *
 *   <div class="nav-group" data-nav-menu>
 *     <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="learn-menu">Learn Pig Latin</button>
 *     <ul class="nav-menu" id="learn-menu">
 *       <li><a href="how-to-speak-pig-latin.html">How to Speak Pig Latin</a></li>
 *       ...
 *     </ul>
 *   </div>
 *
 * Without JavaScript, the menu links simply show as normal nav buttons.
 * With JavaScript, they become a click/tap/keyboard dropdown (no hover needed).
 */
(function () {
  'use strict';
  var nav = document.querySelector('.site-nav');
  if (!nav) return;
  nav.classList.add('js-ready');

  // Mark the link for the current page (works with and without ".html").
  function norm(path) { return path.replace(/\/index\.html$/, '/').replace(/\.html$/, ''); }
  var here = norm(location.pathname);
  nav.querySelectorAll('a[href]').forEach(function (a) {
    if (norm(new URL(a.getAttribute('href'), location.href).pathname) === here) {
      a.setAttribute('aria-current', 'page');
    }
  });

  var groups = [];
  nav.querySelectorAll('[data-nav-menu]').forEach(function (group) {
    var btn = group.querySelector('.nav-toggle');
    var menu = group.querySelector('.nav-menu');
    if (!btn || !menu) return;
    menu.hidden = true;

    function links() { return Array.prototype.slice.call(menu.querySelectorAll('a')); }

    // Keep the open menu fully on screen (important on narrow phones).
    function fit() {
      menu.style.setProperty('--nav-shift', '0px');
      var r = menu.getBoundingClientRect();
      var margin = 12, vw = document.documentElement.clientWidth, shift = 0;
      if (r.left < margin) shift = margin - r.left;
      else if (r.right > vw - margin) shift = (vw - margin) - r.right;
      menu.style.setProperty('--nav-shift', Math.round(shift) + 'px');
    }
    function open() {
      groups.forEach(function (g) { if (g !== api) g.close(); });
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      fit();
    }
    function close(returnFocus) {
      if (menu.hidden) return;
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (returnFocus) btn.focus();
    }
    var api = { close: close };
    groups.push(api);

    btn.addEventListener('click', function () { if (menu.hidden) open(); else close(); });

    group.addEventListener('keydown', function (e) {
      var items = links(), i = items.indexOf(document.activeElement);
      if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); close(true); }
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (menu.hidden) open();
        (items[i + 1] || items[0]).focus();
      } else if (e.key === 'ArrowUp' && !menu.hidden) {
        e.preventDefault();
        (i > 0 ? items[i - 1] : items[items.length - 1]).focus();
      }
    });

    // Close when clicking/tapping or tabbing anywhere outside the menu.
    document.addEventListener('click', function (e) { if (!group.contains(e.target)) close(); });
    document.addEventListener('focusin', function (e) { if (!group.contains(e.target)) close(); });
    window.addEventListener('resize', function () { if (!menu.hidden) fit(); });
  });
})();
