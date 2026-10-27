// Lecture des témoignages uniquement quand la vidéo est visible.
export function initTestimonials(root = document) {
  const videos = [...root.querySelectorAll('.tems video')];
  if (!videos.length || !('IntersectionObserver' in window)) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const states = new Map();
  for (const video of videos) {
    video.muted = true;
    video.playsInline = true;
    const state = { visible: false, userPaused: false, automaticPause: false };
    states.set(video, state);
    video.addEventListener('pause', () => {
      if (state.automaticPause) state.automaticPause = false;
      else state.userPaused = true;
    });
    video.addEventListener('play', () => { state.userPaused = false; });
    // Un seul témoignage audible à la fois si le visiteur active le son.
    video.addEventListener('volumechange', () => {
      if (!video.muted && video.volume > 0) for (const other of videos) if (other !== video) other.muted = true;
    });
  }
  const pause = (video) => {
    if (video.paused) return;
    states.get(video).automaticPause = true;
    video.pause();
  };
  const resume = (video) => {
    const state = states.get(video);
    if (!state.visible || state.userPaused || reducedMotion.matches || document.hidden || video.ended) return;
    // Certains navigateurs bloquent l’autoplay : les contrôles manuels restent disponibles.
    video.play().catch(() => {});
  };
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target;
      states.get(video).visible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
      if (states.get(video).visible) resume(video);
      else pause(video);
    }
  }, { threshold: [0, 0.35] });
  videos.forEach((video) => observer.observe(video));
  document.addEventListener('visibilitychange', () => videos.forEach((video) => document.hidden ? pause(video) : resume(video)));
  reducedMotion.addEventListener('change', () => videos.forEach((video) => reducedMotion.matches ? pause(video) : resume(video)));
}
