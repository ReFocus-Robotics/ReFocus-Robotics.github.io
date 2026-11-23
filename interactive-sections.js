const button = (label, active, onClick) => {
  const item = document.createElement('button')
  item.type = 'button'
  item.textContent = label
  item.setAttribute('aria-pressed', String(active))
  item.addEventListener('click', onClick)
  return item
}
function setPressed(container, index) {
  Array.from(container.children).forEach((item, i) => item.setAttribute('aria-pressed', String(i === index)))
}
const motionToggle = document.querySelector('[data-motion-toggle]')
const animatedTiles = [...document.querySelectorAll('.rollout-wall source')]
motionToggle.hidden = false
motionToggle.addEventListener('click', () => {
  const paused = motionToggle.textContent === 'Pause background'
  animatedTiles.forEach(source => {
    source.dataset.animation ||= source.srcset
    source.srcset = paused ? source.nextElementSibling.getAttribute('src') : source.dataset.animation
  })
  motionToggle.textContent = paused ? 'Play background' : 'Pause background'
})

const methodMotion = document.querySelector('[data-method-motion]')
const methodClips = [...document.querySelectorAll('[data-method-clip]')].map(clip => ({
  clip,
  frames: [...clip.querySelectorAll('[data-method-frame]')],
  milestones: [...clip.querySelectorAll('[data-method-at]')],
  visible: !('IntersectionObserver' in window),
  phase: 0
}))
let methodPaused = window.matchMedia('(prefers-reduced-motion: reduce)').matches
let methodTimer = null

function showMethodPhase(illustration, phase) {
  illustration.phase = phase
  illustration.frames.forEach(frame => frame.classList.toggle('is-current', Number(frame.dataset.methodFrame) === phase))
  illustration.milestones.forEach(item => item.classList.toggle('is-reached', Number(item.dataset.methodAt) <= phase))
}

function updateMethodPlayback() {
  const active = !methodPaused && !document.hidden && methodClips.some(item => item.visible)
  if (active && methodTimer === null) {
    methodTimer = setInterval(() => {
      methodClips.filter(item => item.visible).forEach(item => showMethodPhase(item, (item.phase + 1) % 4))
    }, 1900)
  } else if (!active && methodTimer !== null) {
    clearInterval(methodTimer)
    methodTimer = null
  }
}

methodClips.forEach(item => showMethodPhase(item, methodPaused ? 3 : 0))
methodMotion.hidden = false
methodMotion.textContent = methodPaused ? 'Play illustrations' : 'Pause illustrations'
methodMotion.addEventListener('click', () => {
  methodPaused = !methodPaused
  methodMotion.textContent = methodPaused ? 'Play illustrations' : 'Pause illustrations'
  updateMethodPlayback()
})
document.addEventListener('visibilitychange', updateMethodPlayback)

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      methodClips.find(item => item.clip === entry.target).visible = entry.intersectionRatio >= .25
    })
    updateMethodPlayback()
  }, { threshold: .25 })
  methodClips.forEach(item => observer.observe(item.clip))
}
updateMethodPlayback()

const labStages = {
  reward: {
    title: 'Reward the progress the policy made.',
    description: 'Compare terminal success feedback with an equal reward budget for each DAG stage. Subtasks in the same stage share that stage’s budget.',
    options: ['Stage-balanced', 'Sparse terminal'],
    states: [
      {classes:['done','done','focus',''], notes:['Rewarded','Rewarded','Incomplete','Not reached'], summary:'Both completed placement subtasks earn credit, even though the overall task fails at transfer.'},
      {classes:['','', 'focus',''], notes:['No reward','No reward','Incomplete','Task failed'], summary:'The failed rollout receives no terminal success reward.'}
    ]
  },
  window: {
    title: 'Change where practice starts and ends.',
    description: 'The Scheduler selects a task segment. Local RL uses three rollout modes to link that segment to earlier preparation and later completion.',
    options: ['Normal', 'Prefix', 'Suffix'],
    states: [
      {classes:['','','focus',''], notes:['Outside rollout','Outside rollout','Practice target','Outside rollout'], summary:'Restore a valid entry state and practice through the target.'},
      {classes:['covered','covered','focus',''], notes:['Usual start','Covered','Practice target','Outside rollout'], summary:'Begin from the normal task state and continue through the target.'},
      {classes:['','','focus','covered'], notes:['Outside rollout','Outside rollout','Practice target','Covered'], summary:'Restore the entry state and continue beyond the target toward task completion.'}
    ]
  },
  history: {
    title: 'Evaluation & History Buffer',
    description: 'The history buffer records selected windows, their practice costs, and changes in full-task performance. These inform whether to retain, revise, or skip a window.',
    options: ['Transfer still stalls', 'Transfer improves'],
    states: [
      {classes:['done','done','focus',''], notes:['Completed','Completed','Still stalls','Inspect later'], summary:'If transfer remains the bottleneck, the Scheduler can retain or revise the current window.'},
      {classes:['done','done','done','focus'], notes:['Completed','Completed','Improved','Inspect next'], summary:'If transfer improves, examine the remaining failures before assigning the next round of practice.'}
    ]
  }
}
const track = document.querySelector('[data-lab-track]')
const labOptions = document.querySelector('[data-lab-options]')
const stages = [...document.querySelectorAll('[data-stage]')]
const subtaskNames = ['Place vegetables','Place chicken','Transfer bowl','Finish task']
let labStageIndex = 0
let labStateIndex = 0
const labCycle = createTabCycle(() => {
  const stage = labStages[stages[labStageIndex].dataset.stage]
  if (labStateIndex + 1 < stage.states.length) {
    showLabState(labStateIndex + 1)
  } else {
    showLab((labStageIndex + 1) % stages.length)
  }
})

function showLabState(index) {
  labStateIndex = index
  const state = labStages[stages[labStageIndex].dataset.stage].states[index]
  setPressed(labOptions, index)
  track.replaceChildren(...subtaskNames.map((name, i) => {
    const node = document.createElement('div')
    node.className = 'lab-node ' + state.classes[i]
    node.innerHTML = '<strong>' + name + '</strong><small>' + state.notes[i] + '</small>'
    return node
  }))
  document.querySelector('[data-lab-observation]').textContent = state.summary
  labCycle?.reset([track])
  labCycle?.finish(track)
}

function showLab(index) {
  labStageIndex = index
  const key = stages[index].dataset.stage
  const stage = labStages[key]
  stages.forEach((item, i) => item.setAttribute('aria-pressed', String(i === index)))
  document.querySelector('[data-lab-title]').textContent = stage.title
  document.querySelector('[data-lab-description]').textContent = stage.description
  document.querySelector('[data-lab-history-link]').hidden = key !== 'history'
  labOptions.replaceChildren(...stage.options.map((label, i) => button(label, i === 0, () => showLabState(i))))
  showLabState(0)
}
stages.forEach((item, i) => item.addEventListener('click', () => showLab(i)))
showLab(0)

// Values transcribed from the paper. Arrays follow overall, then horizon groups.
const simulationMethods = ['π₀.₅ SFT', 'Sparse-RL', 'SimpleVLA-RL', 'PolicyTrim', 'StructRL', 'ReFocus']
const realMethods = ['π₀.₅ SFT', 'RECAP', 'ReFocus']
const mainData = [
  {title:'LIBERO-Long', axis:[80, 100], horizons:['Overall','250–340 steps','340–400 steps','400–550 steps'], labels:simulationMethods,
    rows:[[90.6,94,96,74],[92.6,97.6,94.7,77],[94,97.2,96.7,82],[91.6,95.6,90.7,83],[96.2,98,98,89],[97.8,99.2,98.7,93]]},
  {title:'RoboCasa365 Composite-Seen', axis:[35, 55], horizons:['Overall','800–1000 steps','1000–1400 steps','1400–2900 steps'], labels:simulationMethods,
    rows:[[39.3,41,46.4,32.9],[41.1,43,48.4,35.8],[41.9,50.7,46.8,35.6],[40.3,48.7,46,33.5],[45.8,54,51.2,39.4],[51.3,59.7,54.2,46.4]]},
  {title:'StackBowl', labels:realMethods, rows:[[80],[90],[100]]},
  {title:'PickFruit', labels:realMethods, rows:[[75],[85],[100]]},
  {title:'BreadBaker', labels:realMethods, rows:[[30],[70],[95]]}
]
const liberoHorizons = mainData[0].horizons
const ablationData = [
  {title:'Progress Reward & Practice Window', benchmark:'LIBERO-Long', horizons:liberoHorizons, labels:['Neither','Reward only','Window only','Both'],
    rows:[[92.6,97.6,94.7,77],[96.8,98,98.7,91],[93.4,98,95.3,79],[97.8,99.2,98.7,93]]},
  {title:'Local RL rollout modes', benchmark:'LIBERO-Long', horizons:liberoHorizons, labels:['Normal','+ Suffix','+ Prefix','All three'],
    rows:[[95.4,98,96,88],[96.4,98,96.7,92],[96.8,98.8,98,90],[97.8,99.2,98.7,93]]},
  {title:'Global RL reward feedback', benchmark:'LIBERO-Long', horizons:liberoHorizons, labels:['Sparse','Structured','Stage-balanced'],
    rows:[[93.4,98,95.3,79],[95.2,98.4,97.3,84],[97.8,99.2,98.7,93]]},
  {title:'Scheduler model', benchmark:'RoboCasa365', horizons:mainData[1].horizons,
    labels:['Qwen3.8-27B','Opus 5.5','Fable 5.1','GPT-6 Astra'],
    rows:[[48.8,56,52.6,43.8],[49.3,58.3,52.4,44],[50.7,59.3,53.4,45.8],[51.3,59.7,54.2,46.4]],
    costs:['$0.05 per task','$0.51 per task','$1.28 per task','$1.28 per task']}
]
const valueText = value => value.toFixed(1) + '%'
function chartExplorer(prefix, data) {
  const group = document.querySelector('[data-' + prefix + '-options]')
  const gallery = document.querySelector('[data-' + prefix + '-charts]')
  const detail = document.querySelector('[data-' + prefix + '-detail]')
  const labels = ['Overall','Shorter horizon','Middle horizon','Longer horizon']
  let activeIndex = 0
  const cycle = group ? createTabCycle(() => render((activeIndex + 1) % labels.length)) : null
  const barObserver = observeDataReveal(plot => {
    if (cycle) {
      const lastBar = plot.querySelector('.bar-button:last-child .bar-fill')
      lastBar.addEventListener('animationend', event => {
        if (event.animationName === 'bar-rise') cycle.finish(plot)
      })
    }
    plot.classList.add('chart-visible')
  })
  function render(index) {
    activeIndex = index
    if (group) setPressed(group, index)
    detail.textContent = 'Select any bar to inspect its result.'
    const cards = data.map(item => {
      const column = item.horizons ? index : 0
      const values = item.rows.map(row => row[column])
      const max = Math.max(...values)
      const [preferredMin, preferredMax] = item.axis ?? [0, 100]
      const step = item.axis ? 5 : 50
      const min = Math.min(preferredMin, Math.floor(Math.min(...values) / step) * step)
      const upper = Math.max(preferredMax, Math.ceil(max / step) * step)
      const intervals = (upper - min) / step
      const ticks = Array.from({length: intervals + 1}, (_, i) =>
        '<span style="top:' + (i * 100 / intervals) + '%">' + (upper - i * step) + '</span>').join('')
      const groupLabel = item.horizons ? item.horizons[column] : 'Real robot'
      const context = item.benchmark ? item.benchmark + ' · ' + groupLabel : groupLabel
      const card = document.createElement('div')
      card.className = 'mini-chart'
      card.innerHTML = '<h4>' + item.title + '</h4><p>' + context + ' · Success rate (%)</p>' +
        '<div class="bar-chart" role="group" aria-label="Success rate scale from ' + min + ' to ' + upper + ' percent">' +
        '<div class="bar-scale" aria-hidden="true">' + ticks + '</div><div class="bar-plots"></div></div>'
      const bars = card.querySelector('.bar-plots')
      if (barObserver) bars.parentElement.classList.add('bar-reveal')
      bars.style.setProperty('--grid-step', (100 / intervals) + '%')
      item.labels.forEach((label, i) => {
        const value = values[i]
        const show = () => {
          gallery.querySelectorAll('button[aria-pressed="true"]').forEach(active => active.setAttribute('aria-pressed', 'false'))
          bar.setAttribute('aria-pressed','true')
          detail.textContent = item.title + ' · ' + context + ' · ' + label + ' · ' + valueText(value) + (item.costs ? ' · ' + item.costs[i] : '')
        }
        const bar = button(label, false, show)
        bar.className = 'bar-button' + (value === max && i === item.labels.length - 1 ? ' bar-best' : '')
        bar.setAttribute('aria-label', label + ' ' + valueText(value))
        bar.style.setProperty('--value', ((value - min) / (upper - min) * 100) + '%')
        if (barObserver) bar.style.setProperty('--bar-delay', i * 90 + 'ms')
        bar.innerHTML = '<span class="bar-extent"><span class="bar-fill"><b>' + valueText(value) + '</b></span></span><span class="bar-label">' + label + '</span>'
        bars.append(bar)
      })
      return card
    })
    barObserver?.disconnect()
    gallery.replaceChildren(...cards)
    const plots = cards.map(card => card.querySelector('.bar-chart'))
    cycle?.reset(plots)
    if (barObserver) plots.forEach(plot => barObserver.observe(plot))
  }
  if (group) group.replaceChildren(...labels.map((label, i) => button(label, i === 0, () => render(i))))
  render(0)
}
chartExplorer('result', mainData.filter(item => item.horizons))
chartExplorer('physical', mainData.filter(item => !item.horizons))
chartExplorer('ablation', ablationData)
