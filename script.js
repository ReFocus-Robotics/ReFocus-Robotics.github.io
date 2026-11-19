const scores = [
  {libero: 90.6, robocasa: 39.3},
  {libero: 92.4, robocasa: 42.5},
  {libero: 94.6, robocasa: 47.6},
  {libero: 97.8, robocasa: 51.3}
]
const xPositions = [70, 193, 317, 440]
const dataMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
// Keep the data clear of the fixed navigation before starting an animation.
const dataViewOptions = { threshold: 1, rootMargin: '-78px 0px 0px' }
let activeRound = 0

function selectRound(index) {
  activeRound = index
  const score = scores[index]
  for (const benchmark of ['libero', 'robocasa']) {
    document.getElementById(`value-${benchmark}`).textContent = `${score[benchmark].toFixed(1)}%`
    const point = document.querySelector(`.${benchmark}-current`)
    point.setAttribute('cx', xPositions[index])
    const y = benchmark === 'libero' ? 164 - (score[benchmark] - 90) / 10 * 134 : 164 - (score[benchmark] - 35) / 20 * 134
    point.setAttribute('cy', y)
  }
}

const roundPlots = document.querySelectorAll('#rounds-chart .plot-card')
if (!dataMotion.matches && 'IntersectionObserver' in window) {
  const visibleRoundPlots = new Set()
  let roundTimer
  function queueRoundAdvance() {
    if (!visibleRoundPlots.size) {
      clearTimeout(roundTimer)
      roundTimer = undefined
    } else if (roundTimer === undefined && activeRound < scores.length - 1) {
      roundTimer = setTimeout(() => {
        roundTimer = undefined
        selectRound(activeRound + 1)
        queueRoundAdvance()
      }, 1000)
    }
  }
  const revealChart = new IntersectionObserver(entries => {
    for (const { target, intersectionRatio } of entries) {
      if (intersectionRatio === 1) {
        visibleRoundPlots.add(target)
        target.classList.add('chart-visible')
      } else {
        visibleRoundPlots.delete(target)
      }
    }
    queueRoundAdvance()
  }, dataViewOptions)
  roundPlots.forEach(plot => revealChart.observe(plot))
} else {
  roundPlots.forEach(plot => plot.classList.add('chart-visible'))
  selectRound(scores.length - 1)
}

function animateDataValue(draw, duration = 1000) {
  let start
  function frame(now) {
    start ??= now
    const progress = dataMotion.matches ? 1 : Math.min((now - start) / duration, 1)
    const eased = 1 - (1 - progress) ** 3
    if (draw(eased) !== false && progress < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

function observeDataReveal(reveal) {
  if (dataMotion.matches || typeof IntersectionObserver !== 'function') return null
  const pending = new Map()
  const observer = new IntersectionObserver(entries => {
    for (const { target, intersectionRatio } of entries) {
      if (intersectionRatio < 1 || !target.isConnected) {
        clearTimeout(pending.get(target))
        pending.delete(target)
      } else if (!pending.has(target)) {
        pending.set(target, setTimeout(() => {
          pending.delete(target)
          if (!target.isConnected) return
          observer.unobserve(target)
          reveal(target)
        }, 700))
      }
    }
  }, dataViewOptions)
  return {
    observe: target => observer.observe(target),
    disconnect() {
      observer.disconnect()
      observer.takeRecords()
      pending.forEach(timer => clearTimeout(timer))
      pending.clear()
    }
  }
}

function createTabCycle(advance, { waitForAll = false } = {}) {
  if (dataMotion.matches || typeof IntersectionObserver !== 'function') return null
  const inView = new Set()
  const unfinished = new Set()
  let targets = new Set()
  let timer

  function cancel() {
    clearTimeout(timer)
    timer = undefined
  }

  function schedule() {
    const ready = inView.size > 0 && (waitForAll
      ? unfinished.size === 0
      : [...inView].every(target => !unfinished.has(target)))
    if (!ready || document.hidden || dataMotion.matches) {
      cancel()
    } else if (timer === undefined) {
      timer = setTimeout(() => {
        timer = undefined
        advance()
      }, 5000)
    }
  }

  const observer = new IntersectionObserver(entries => {
    for (const { target, intersectionRatio } of entries) {
      if (!targets.has(target)) continue
      if (intersectionRatio >= .5) inView.add(target)
      else inView.delete(target)
    }
    schedule()
  }, { threshold: .5, rootMargin: dataViewOptions.rootMargin })
  document.addEventListener('visibilitychange', schedule)
  dataMotion.addEventListener('change', schedule)

  return {
    reset(nextTargets) {
      cancel()
      observer.disconnect()
      observer.takeRecords()
      inView.clear()
      unfinished.clear()
      targets = new Set(nextTargets)
      for (const target of targets) {
        unfinished.add(target)
        observer.observe(target)
      }
    },
    finish(target) {
      if (unfinished.delete(target)) schedule()
    },
    watchVideo(video) {
      video.addEventListener('ended', () => {
        if (unfinished.delete(video)) schedule()
      })
      for (const event of ['play', 'seeking']) {
        video.addEventListener(event, () => {
          if (!targets.has(video) || video.ended) return
          unfinished.add(video)
          schedule()
        })
      }
    }
  }
}

if (!dataMotion.matches && 'IntersectionObserver' in window) {
  const heroCounters = new Map()
  const heroObserver = new IntersectionObserver((entries, observer) => {
    for (const { target, intersectionRatio } of entries) {
      if (intersectionRatio < 1) continue
      observer.unobserve(target)
      animateDataValue(heroCounters.get(target), 1200)
    }
  }, dataViewOptions)
  for (const metric of document.querySelectorAll('[data-hero-count]')) {
    const value = metric.firstChild
    const endpoints = value.data.split('–')
    const draw = fraction => {
      value.data = endpoints.map(endpoint => (Number(endpoint) * fraction).toFixed(endpoint.includes('.') ? 1 : 0)).join('–')
    }
    heroCounters.set(metric, draw)
    draw(0)
    heroObserver.observe(metric)
  }
}

const themeButton = document.querySelector('.theme-toggle')
themeButton.addEventListener('click', () => {
  const dark = document.documentElement.classList.toggle('dark')
  themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme')
  themeButton.textContent = dark ? '☼' : '◐'
})
const progress = document.getElementById('progress')
addEventListener('scroll', () => {
  const extent = document.documentElement.scrollHeight - innerHeight
  progress.style.transform = `scaleX(${extent > 0 ? scrollY / extent : 0})`
}, { passive: true })
