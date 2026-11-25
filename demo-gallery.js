const simulationBenchmarks = [
  // Load Dishwasher, Pre-Soak Pan, and Boil the Kettle use 25 archived development trials per task (updates 105–125).
  { name: 'RoboCasa365', trials: 25,
    tasks: [
    ['Load Dishwasher', 'load-dishwasher', 16, 'rollouts/dishwasher-a.jpg'],
    ['Pre-Soak Pan', 'pre-soak-pan', 13, 'rollouts/soak-a.jpg'],
    ['Store Leftovers in Bowl', 'simulation/robocasa-leftovers', 24, undefined, 50],
    ['Prepare Coffee', 'simulation/robocasa-coffee', 13, undefined, 50],
    ['Scrub Cutting Board', 'simulation/robocasa-scrub', 33, undefined, 50],
    ['Boil the Kettle', 'simulation/robocasa-kettle', 11]
  ] },
  // Update-150 counts from the revised LIBERO-Long per-task results.
  { name: 'LIBERO-Long', trials: 50,
    tasks: [
    ['Soup & Sauce in Basket', 'simulation/libero-soup-sauce', 50],
    ['Heat Moka Pot', 'simulation/libero-heat-moka-pot', 48],
    ['Bowl in Drawer', 'simulation/libero-bowl-in-drawer', 50],
    ['Book in Caddy', 'simulation/libero-book-in-caddy', 50],
    ['Moka Pots on Stove', 'simulation/libero-moka-pots', 46],
    ['Mugs in Microwave', 'simulation/libero-mugs-in-microwave', 47]
  ] }
]

function addRolloutMark(video, container, outcome, label, finishAt) {
  const mark = document.createElement('span')
  mark.className = 'rollout-mark'
  mark.dataset.outcome = outcome.toLowerCase()
  mark.setAttribute('role', 'img')
  mark.setAttribute('aria-label', label)
  mark.textContent = outcome === 'Success' ? '✓' : '×'
  mark.hidden = true
  container.append(mark)
  const update = () => {
    const end = finishAt ?? video.duration
    mark.hidden = !video.ended && !(Number.isFinite(end) && video.currentTime >= end - .01)
  }
  for (const event of ['timeupdate', 'seeking', 'seeked', 'loadedmetadata', 'ended', 'emptied']) {
    video.addEventListener(event, update)
  }
}

const videoCaseTemplate = document.querySelector('#video-case-template')
function makeVideoCase(title, asset, options = {}) {
  const { context = '', poster = 'demos/' + asset + '.jpg', outcome, steps, successRate, successDenominator = 100, showOutcomeMark = true } = options
  const card = videoCaseTemplate.content.firstElementChild.cloneNode(true)
  const video = card.querySelector('video')
  const caption = card.querySelector('[data-case-outcome]')
  const name = context ? context + ' · ' + title : title
  video.src = 'assets/demos/' + asset + '.mp4'
  video.poster = 'assets/' + poster
  video.setAttribute('aria-label', name)
  card.querySelector('[data-case-title]').textContent = title
  if (outcome) {
    if (showOutcomeMark) video.dataset.rolloutOutcome = outcome
    caption.hidden = false
    caption.textContent = successRate === undefined ? outcome : 'Success rate ' + successRate + '/' + successDenominator
    if (steps !== undefined) caption.textContent += ' · ' + steps.toLocaleString('en-US') + ' steps'
    caption.dataset.outcome = outcome.toLowerCase()
  }
  return card
}

function makeCaseGroup(name, cards, note) {
  const section = document.createElement('section')
  section.className = 'video-case-group'
  const title = document.createElement('h4')
  title.textContent = name
  const grid = document.createElement('div')
  grid.className = 'video-case-grid'
  grid.append(...cards)
  section.append(title)
  if (note) {
    const caption = document.createElement('p')
    caption.className = 'video-case-note'
    caption.textContent = note
    section.append(caption)
  }
  section.append(grid)
  return section
}

document.querySelector('[data-simulation-cases]').append(...simulationBenchmarks.map(benchmark => {
  const cards = benchmark.tasks.map(([title, asset, successes, poster, trials = benchmark.trials]) => {
    const successRate = Math.round(100 * successes / trials)
    const successDenominator = benchmark.name === 'LIBERO-Long' ? trials : 100
    return makeVideoCase(title, asset, { context: benchmark.name, poster, outcome: 'Success', successRate, successDenominator, showOutcomeMark: false })
  })
  return makeCaseGroup(benchmark.name, cards, benchmark.note)
}))

const comparisonRounds = [
  ['π₀.₅ SFT', 'failure'],
  ['Round 1', 'round1', 2044, 1471],
  ['Round 2', 'round2', 1061, 1209],
  ['Round 3', 'round3', 585, 730]
]
const roundVideoOptions = document.querySelector('[data-round-video-options]')
let selectedVideoRound
const roundVideoCycle = createTabCycle(() => showVideoRound((selectedVideoRound + 1) % comparisonRounds.length), {
  waitForAll: true
})
const roundVideoGroups = comparisonRounds.map(
  ([title, suffix, dishwasherSteps, panSteps], index) => {
    const outcome = dishwasherSteps === undefined ? 'Failure' : 'Success'
    const panel = makeCaseGroup(title, [
      makeVideoCase('Load Dishwasher', 'rounds/dishwasher-' + suffix, { context: title, outcome, steps: dishwasherSteps }),
      makeVideoCase('Pre-Soak Pan', 'rounds/pan-' + suffix, { context: title, outcome, steps: panSteps })
    ])
    panel.id = 'rollout-videos-' + suffix
    panel.hidden = index !== 0
    return panel
  }
)
document.querySelector('[data-round-video-cases]').append(...roundVideoGroups)
const roundVideos = roundVideoGroups.map(panel => [...panel.querySelectorAll('video')])
roundVideos.flat().forEach(video => roundVideoCycle?.watchVideo(video))

function showVideoRound(index) {
  if (selectedVideoRound === index) return
  if (selectedVideoRound !== undefined) {
    roundVideos[selectedVideoRound].forEach(video => video.pause())
  }
  selectedVideoRound = index
  setPressed(roundVideoOptions, index)
  roundVideoGroups.forEach((panel, i) => { panel.hidden = i !== index })
  const videos = roundVideos[index]
  roundVideoCycle?.reset(videos)
  for (const video of videos) {
    if (video.currentTime > 0 || video.ended) video.load()
  }
}

roundVideoOptions.append(...comparisonRounds.map(([title], index) => {
  const option = button(title, index === 0, () => showVideoRound(index))
  option.setAttribute('aria-controls', roundVideoGroups[index].id)
  return option
}))
showVideoRound(0)

for (const comparison of document.querySelectorAll('[data-real-comparison]')) {
  const video = comparison.querySelector('video')
  for (const lane of comparison.querySelectorAll('[data-finish-at]')) {
    const { method, outcome, finishAt } = lane.dataset
    addRolloutMark(video, lane, outcome, method + ' rollout: ' + outcome, Number(finishAt))
  }
}

for (const video of document.querySelectorAll('video[data-rollout-outcome]')) {
  const container = document.createElement('div')
  container.className = 'rollout-media'
  video.before(container)
  container.append(video)
  addRolloutMark(video, container, video.dataset.rolloutOutcome, 'Rollout: ' + video.dataset.rolloutOutcome)
}
