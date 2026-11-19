const defaultVideoRate = 3
const allCaseVideos = document.querySelectorAll('video')
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const visibleVideos = new WeakSet()
const autoStartedVideos = new WeakSet()
const resumeVideos = new WeakSet()
const motivationIntro = document.querySelector('[data-motivation-intro]')
const motivationGrid = motivationIntro.closest('.motivation-grid')
const motivationPracticeVideos = new Set(motivationGrid.querySelectorAll('[data-motivation-practice] video'))
let motivationIntroFinished = motivationIntro.ended

function startVisibleVideo(video) {
  if (motivationPracticeVideos.has(video) && !motivationIntroFinished) return
  if (video.ended || (autoStartedVideos.has(video) && !resumeVideos.has(video))) return
  autoStartedVideos.add(video)
  resumeVideos.delete(video)
  video.play().catch(() => {}) // The native play control is available if autoplay is blocked.
}

const isPlaying = video => !video.paused && !video.ended

function updateMotivationFocus() {
  if (isPlaying(motivationIntro)) {
    motivationGrid.dataset.playingSide = 'intro'
  } else if ([...motivationPracticeVideos].some(isPlaying)) {
    motivationGrid.dataset.playingSide = 'practice'
  } else {
    delete motivationGrid.dataset.playingSide
  }
}

for (const video of [motivationIntro, ...motivationPracticeVideos]) {
  video.addEventListener('play', () => {
    if (!isPlaying(video)) return
    if (video === motivationIntro) {
      motivationIntroFinished = false
      for (const clip of motivationPracticeVideos) {
        if (!isPlaying(clip)) continue
        resumeVideos.add(clip)
        clip.pause()
      }
    } else if (isPlaying(motivationIntro)) {
      motivationIntro.pause()
    }
    updateMotivationFocus()
  })
  for (const event of ['pause', 'ended', 'emptied']) {
    video.addEventListener(event, updateMotivationFocus)
  }
}

motivationIntro.addEventListener('ended', () => {
  motivationIntroFinished = true
  for (const video of motivationPracticeVideos) {
    if (visibleVideos.has(video)) startVisibleVideo(video)
  }
})

const videoObserver = !prefersReducedMotion && 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const video = entry.target
      if (entry.isIntersecting && entry.intersectionRatio >= .5) {
        visibleVideos.add(video)
        startVisibleVideo(video)
      } else {
        visibleVideos.delete(video)
        if (!video.paused && !video.ended) {
          resumeVideos.add(video)
          video.pause()
        }
      }
    }
  }, { threshold: .5 })
  : null

for (const video of allCaseVideos) {
  const playbackRate = Number(video.dataset.playbackRate ?? defaultVideoRate)
  video.defaultMuted = true
  video.muted = true
  video.defaultPlaybackRate = playbackRate
  video.playbackRate = playbackRate
  video.addEventListener('emptied', () => {
    autoStartedVideos.delete(video)
    resumeVideos.delete(video)
  })
  video.addEventListener('loadedmetadata', () => {
    video.playbackRate = playbackRate
    if (visibleVideos.has(video)) startVisibleVideo(video)
  })
  videoObserver?.observe(video)
}
