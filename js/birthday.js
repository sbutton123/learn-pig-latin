(function () {
  'use strict';
  const canonical = 'https://learnpiglatin.com/happy-birthday-in-pig-latin.html';
  const play = document.getElementById('play-birthday');
  play.addEventListener('click', function () {
    const iframe = document.createElement('iframe');
    // Load the player only on request; playback uses YouTube's own controls.
    iframe.src = 'https://www.youtube.com/embed/STY_3OMTamk';
    iframe.title = 'Happy Birthday in Pig Latin — birthday greeting';
    iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    document.getElementById('birthday-video').replaceChildren(iframe);
    iframe.focus();
  });

  const share = document.getElementById('share-birthday');
  const status = document.getElementById('share-status');
  const fallback = document.getElementById('share-fallback');
  const link = document.getElementById('birthday-link');
  async function copyLink() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(canonical);
    } catch (_) {
      fallback.hidden = false;
      link.focus();
      link.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) {}
      if (!copied) {
        status.textContent = 'Select and copy the birthday link below.';
        return;
      }
    }
    fallback.hidden = true;
    share.focus();
    status.textContent = 'Birthday link copied!';
  }
  share.addEventListener('click', async function () {
    status.textContent = '';
    fallback.hidden = true;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Happy Birthday in Pig Latin!',
          text: "Appy-hay Irthday-bay! 🐷🎂 Here's a Pig Latin birthday greeting for you!",
          url: canonical
        });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    await copyLink();
  });

  // Keep the compact song choices from playing over one another.
  const songs = document.querySelectorAll('audio');
  songs.forEach(song => song.addEventListener('play', () => {
    songs.forEach(other => { if (other !== song) other.pause(); });
  }));
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();
