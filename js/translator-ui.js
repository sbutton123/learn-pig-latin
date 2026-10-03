/*!
 * translator-ui.js
 * Shared behavior for the translator box (homepage and /translator.html).
 * Requires /js/piglatin.js to be loaded first.
 *
 * Expected page elements (same IDs on every page that has a translator):
 *   #mode    <select> with values "enToPig" / "pigToEn"
 *   input[name="dialect"]  optional radio buttons, values "yay" (default) / "way"
 *   #input   text field
 *   #output  translation output
 *   #sentBy  optional "sent from LearnPigLatin.com" line
 *   #shareBtn, #share-chooser  optional share button and dropdown
 * Buttons call the global functions clearFields(), copyOutput(), shareOutput().
 */
(function () {
  'use strict';

  var inputEl = document.getElementById('input');
  var outEl = document.getElementById('output');
  var modeEl = document.getElementById('mode');
  if (!inputEl || !outEl || !modeEl || !window.PigLatin) return;

  // ---------- Translate as you type ----------
  // Northern (YAY) unless the Southern (WAY) dialect radio is selected.
  function currentDialect() {
    var picked = document.querySelector('input[name="dialect"]:checked');
    return picked && picked.value === 'way' ? 'way' : 'yay';
  }
  function runTranslation() {
    var raw = inputEl.value;
    if (!raw.trim()) { outEl.innerText = ''; updateSentByVisibility(); return; }
    outEl.innerText = window.PigLatin.translate(raw.trim(), modeEl.value, { dialect: currentDialect() });
    updateSentByVisibility();
  }
  inputEl.addEventListener('input', runTranslation);
  modeEl.addEventListener('change', runTranslation);
  document.querySelectorAll('input[name="dialect"]').forEach(function (r) {
    r.addEventListener('change', runTranslation);
  });

  function updateSentByVisibility() {
    var sentBy = document.getElementById('sentBy');
    if (!sentBy) return;
    var hasText = (outEl.innerText || '').trim().length > 0;
    sentBy.hidden = !hasText;
  }

  window.clearFields = function () {
    inputEl.value = '';
    outEl.innerText = '';
    updateSentByVisibility();
  };

  window.copyOutput = function () {
    var t = (outEl.innerText || '').trim();
    if (!t) { alert('Nothing to copy yet\u2014type something first!'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t)
        .then(function () { alert('Translation copied!'); })
        .catch(function () { alert('Failed to copy.'); });
    } else {
      var ta = document.createElement('textarea'); ta.value = t;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); alert('Translation copied!'); } catch (e) {}
      document.body.removeChild(ta);
    }
  };

  // ---------- Share ----------
  var chooserEl = document.getElementById('share-chooser');
  var outsideDownHandler = null, escHandler = null, scrollHandler = null, resizeHandler = null;

  function isMobile() { return /(android|iphone|ipad|ipod)/i.test(navigator.userAgent); }
  function positionChooser(anchorEl) {
    var rect = anchorEl.getBoundingClientRect();
    chooserEl.style.left = (rect.left + window.scrollX) + 'px';
    chooserEl.style.top = (rect.bottom + window.scrollY) + 'px';
  }
  function safeCopy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    var ta = document.createElement('textarea'); ta.value = text;
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return Promise.resolve();
  }
  function hideChooser() {
    if (!chooserEl) return;
    chooserEl.style.display = 'none';
    if (outsideDownHandler) {
      document.removeEventListener('mousedown', outsideDownHandler, true);
      document.removeEventListener('touchstart', outsideDownHandler, true);
      outsideDownHandler = null;
    }
    if (escHandler) { document.removeEventListener('keydown', escHandler, true); escHandler = null; }
    if (scrollHandler) { window.removeEventListener('scroll', scrollHandler); scrollHandler = null; }
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
  }
  function showChooser(anchorEl) {
    chooserEl.style.display = 'block';
    positionChooser(anchorEl);
    setTimeout(function () {
      outsideDownHandler = function (e) {
        var shareBtn = document.getElementById('shareBtn');
        if (chooserEl.contains(e.target) || e.target === shareBtn) return;
        hideChooser();
      };
      escHandler = function (e) { if (e.key === 'Escape') hideChooser(); };
      scrollHandler = function () { hideChooser(); };
      resizeHandler = function () { hideChooser(); };

      document.addEventListener('mousedown', outsideDownHandler, true);
      document.addEventListener('touchstart', outsideDownHandler, true);
      document.addEventListener('keydown', escHandler, true);
      window.addEventListener('scroll', scrollHandler, { once: true });
      window.addEventListener('resize', resizeHandler, { once: true });
    }, 0);
  }
  function buildChooser(message, subject) {
    chooserEl.innerHTML = '';
    function add(label, handler) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label; b.onclick = handler;
      chooserEl.appendChild(b);
    }
    add('WhatsApp', function () {
      window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
      hideChooser();
    });
    add('Telegram', function () {
      window.open('https://t.me/share/url?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
      hideChooser();
    });
    add('X (Twitter)', function () {
      window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
      hideChooser();
    });
    add('Facebook (paste text)', function () {
      safeCopy(message).then(function () {
        alert('Your translation is copied. Facebook will open \u2014 paste it into your post.');
        var pageUrl = encodeURIComponent(location.href.split('#')[0]);
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + pageUrl, '_blank', 'noopener,noreferrer');
        hideChooser();
      });
    });
    add('Email via Gmail (web)', function () {
      window.open('https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
      hideChooser();
    });
    add('Email via Outlook Web', function () {
      window.open('https://outlook.live.com/owa/?path=/mail/action/compose&subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
      hideChooser();
    });
    add('Email via default mail app', function () {
      location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(message);
      hideChooser();
    });
  }

  window.shareOutput = function () {
    var textOnly = (outEl.innerText || '').trim();
    if (!textOnly) { alert('Nothing to share yet\u2014type something first!'); return; }

    var pigs = '\uD83D\uDC37';
    var subject = pigs + ' Pig Latin Translation ' + pigs;
    var message = pigs + ' ' + textOnly + ' ' + pigs + '\n\n\u2014 sent from LearnPigLatin.com ' + pigs;

    if (isMobile() && navigator.share) {
      navigator.share({ title: subject, text: message }).catch(function () {});
      return;
    }

    // Pages without the dropdown fall back to copying.
    if (!chooserEl) {
      safeCopy(message).then(function () { alert('Sharing isn\'t supported here, so your translation was copied instead!'); });
      return;
    }
    var shareBtn = document.getElementById('shareBtn');
    if (chooserEl.style.display === 'block') { hideChooser(); return; }
    buildChooser(message, subject);
    showChooser(shareBtn);
  };
})();
