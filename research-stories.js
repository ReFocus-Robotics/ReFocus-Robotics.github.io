const dagVideo = document.querySelector('[data-dag-video]')
const dagNodes = [...document.querySelectorAll('[data-dag-key]')]
// The source has one frame per step at 20 fps. currentTime uses source seconds.
const dagStepsPerSecond = 20
const dagEvents = { vegetable: 124, chicken: 360 }
const dagCounter = document.querySelector('[data-dag-count]')
function updateDag() {
  const finished = dagVideo.ended ||
    (Number.isFinite(dagVideo.duration) && dagVideo.currentTime >= dagVideo.duration)
  let verified = 0
  dagNodes.forEach(node => {
    const step = dagEvents[node.dataset.dagKey]
    const done = step !== undefined && dagVideo.currentTime >= step / dagStepsPerSecond
    const failed = node.dataset.dagKey === 'bowl' && finished
    if (done) verified += 1
    node.classList.toggle('verified', done)
    node.classList.toggle('failed', failed)
    node.querySelector('small').textContent = done ? 'Verified · step ' + step : failed ? 'Failed' : 'Not reached'
  })
  dagCounter.textContent = verified + ' / ' + dagNodes.length + ' verified'
}
for (const event of ['timeupdate', 'seeking', 'seeked', 'loadedmetadata', 'ended']) {
  dagVideo.addEventListener(event, updateDag)
}
dagNodes.filter(node => node.matches('button')).forEach(node => {
  const step = dagEvents[node.dataset.dagKey]
  node.title = 'Jump to verification at step ' + step
  node.addEventListener('click', () => {
    dagVideo.currentTime = (step + 1) / dagStepsPerSecond
    updateDag()
  })
})

const practice = document.querySelector('.practice-story')
const practiceVideo = practice.querySelector('video')
const seekPractice = practice.querySelector('input')
const practiceModes = practice.querySelector('[data-practice-modes]')
const practiceFrames = practice.querySelector('[data-practice-frames]')
const fullRolloutEnd = Number(seekPractice.max)
const practiceEntry = 18
const practiceTarget = 39
const modeSpecs = [
  {label:'Normal', clip:'full', from:0, to:fullRolloutEnd, description:'View the full rollout from the normal start to task completion. The orange segment marks the practice window.'},
  {label:'Prefix', clip:'prefix', from:0, to:practiceTarget, description:'Start from the normal initial state and stop at the end of the practice window.'},
  {label:'Suffix', clip:'suffix', from:practiceEntry, to:fullRolloutEnd, description:'Start at the practice window entry and continue through task completion.'}
]
const rolloutFrames = [0, 10, 20, 35, 55, 75, 94].map((second, i) => ({
  time: second,
  image: 'practice-' + i + '.jpg'
}))
const clockText = time => Math.floor(time / 60) + ':' + String(Math.floor(time % 60)).padStart(2, '0')
let selectedMode = 0
let visiblePracticeFrames = []
const practiceCycle = createTabCycle(() => setPracticeMode((selectedMode + 1) % modeSpecs.length))
practiceCycle?.watchVideo(practiceVideo)

function updatePractice() {
  const max = Number(seekPractice.max)
  const time = Math.min(practiceVideo.currentTime, max)
  const mode = modeSpecs[selectedMode]
  seekPractice.value = time
  seekPractice.setAttribute('aria-valuetext', clockText(time) + ' of ' + clockText(max))
  practice.querySelector('[data-practice-time]').textContent = clockText(time) + ' / ' + clockText(max)
  seekPractice.style.setProperty('--target-start', (practiceEntry - mode.from) / max * 100 + '%')
  seekPractice.style.setProperty('--target-end', Math.min(1, (practiceTarget - mode.from) / max) * 100 + '%')
  const activeFrame = visiblePracticeFrames.findLastIndex(frame => frame.time - mode.from <= time + .02)
  setPressed(practiceFrames, Math.max(0, activeFrame))
}
function setPracticeMode(index) {
  selectedMode = index
  const mode = modeSpecs[index]
  setPressed(practiceModes, index)
  practice.querySelector('[data-practice-title]').textContent = mode.label + ' window'
  practice.querySelector('[data-practice-description]').textContent = mode.description
  visiblePracticeFrames = rolloutFrames.filter(frame => frame.time >= mode.from && frame.time <= mode.to)
  if (mode.from === practiceEntry) visiblePracticeFrames.unshift({ time: practiceEntry, image: 'practice-entry.jpg' })
  if (mode.to === practiceTarget) visiblePracticeFrames.push({ time: practiceTarget, image: 'practice-target.jpg' })
  practiceFrames.replaceChildren(...visiblePracticeFrames.map((frame, i) => {
    const time = frame.time - mode.from
    const label = clockText(time)
    const keyframe = button(label, i === 0, () => {
      practiceVideo.currentTime = time
      updatePractice()
    })
    const thumbnail = document.createElement('img')
    thumbnail.src = 'assets/stories/' + frame.image
    thumbnail.alt = ''
    thumbnail.loading = 'lazy'
    const timestamp = document.createElement('span')
    timestamp.textContent = label
    keyframe.replaceChildren(thumbnail, timestamp)
    keyframe.setAttribute('aria-label', 'Jump to ' + label)
    return keyframe
  }))
  const source = 'assets/stories/leftovers-' + mode.clip + '.mp4'
  if (practiceVideo.getAttribute('src') !== source) {
    practiceVideo.pause()
    seekPractice.max = mode.to - mode.from
    practiceVideo.poster = 'assets/stories/' + visiblePracticeFrames[0].image
    practiceVideo.src = source
    practiceVideo.load()
  }
  practiceCycle?.reset([practiceVideo])
  if (practiceVideo.ended) practiceCycle?.finish(practiceVideo)
  updatePractice()
}
practiceModes.replaceChildren(...modeSpecs.map((mode, i) => button(mode.label, i === 0, () => setPracticeMode(i))))
seekPractice.addEventListener('input', () => {
  practiceVideo.currentTime = Number(seekPractice.value)
  updatePractice()
})
practiceVideo.addEventListener('loadedmetadata', () => {
  seekPractice.max = practiceVideo.duration
  updatePractice()
})
for (const event of ['timeupdate', 'seeking', 'seeked']) practiceVideo.addEventListener(event, updatePractice)
setPracticeMode(0)

// Task-level excerpts from round3_context.json's archived intervention_history.
// Bottleneck steps were counted from the archived training stage events.
// Evaluation counts use the recorded checkpoints at updates 75, 80, and 100.
const historyExamples = [
  {
    task: 'Store Leftovers in Bowl',
    archiveTask: 'StoreLeftoversInBowl',
    entry: 'Both foods in bowl',
    target: 'Bowl in Fridge',
    budget: 600,
    evidence: 'Vegetable in bowl at step 156 and chicken in bowl at step 708. The rollout reached its 2,900-step limit with the fridge placement still unverified.',
    interactions: [[84, 43266, 42437], [30, 43732, 41429], [39, 83798, 52914]],
    archivedReplaySteps: 57450,
    evaluations: [[3, 5], [1, 5], [1, 5]],
    delta: -40
  },
  {
    task: 'Load Dishwasher',
    archiveTask: 'LoadDishwasher',
    entry: 'Both dishes on rack',
    target: 'Dishwasher closed',
    budget: 500,
    evidence: 'The first dish reached the rack at step 422 and the second at step 675. The rollout reached its 2,900-step limit with the door closure still unverified.',
    interactions: [[120, 36209, 36003], [50, 39546, 24800], [58, 91678, 24118]],
    archivedReplaySteps: 108600,
    evaluations: [[4, 5], [5, 5], [5, 5]],
    delta: 20
  }
]
const historyOptions = document.querySelector('[data-history-options]')
const historyRecord = document.querySelector('[data-history-record]')
let selectedHistory = 0
const historyCycle = createTabCycle(() => renderHistory((selectedHistory + 1) % historyExamples.length))
const historyNumber = new Intl.NumberFormat('en-US')
const archivedModes = ['Normal Window', 'Suffix Window', 'Normal start']
const historyCheckpoints = [
  ['Before Local RL', 75],
  ['After 5 Local updates', 80],
  ['End of Local RL', 100]
]

function formatHistoryCount(value, sign = '') {
  return (value ? sign : '') + historyNumber.format(value)
}

function historyCount(value, sign = '') {
  const count = Math.abs(value)
  return `<span class="history-count"><span class="history-count-total">${formatHistoryCount(count, sign)}</span><span aria-hidden="true" data-history-count="${count}" data-history-sign="${sign}">0</span></span>`
}

function animateHistoryField(field) {
  const counters = Array.from(field.querySelectorAll('[data-history-count]'), node => ({
    node, total: Number(node.dataset.historyCount), sign: node.dataset.historySign
  }))
  const meters = Array.from(field.querySelectorAll('[data-history-meter]'), node => ({
    node, total: Number(node.dataset.historyMeter)
  }))
  animateDataValue(eased => {
    if (!field.isConnected) return false
    for (const { node, total, sign } of counters) {
      const text = formatHistoryCount(Math.round(total * eased), sign)
      if (node.textContent !== text) node.textContent = text
    }
    for (const { node, total } of meters) node.value = total * eased
    if (eased === 1) historyCycle?.finish(field)
  }, 1400)
}

const historyObserver = observeDataReveal(animateHistoryField)

function renderHistory(index) {
  selectedHistory = index
  setPressed(historyOptions, index)
  historyObserver?.disconnect()
  const animate = historyObserver && !dataMotion.matches
  const count = animate ? historyCount : (value, sign) => formatHistoryCount(Math.abs(value), sign)
  const { archiveTask, entry, target, budget, evidence, interactions, archivedReplaySteps, evaluations, delta } = historyExamples[index]
  historyRecord.innerHTML = `
    <p class="history-record-id"><code>${archiveTask}</code><code>round_01</code></p>
    <div class="history-record-grid">
      <section class="history-field">
        <h4>Bottleneck diagnosis</h4>
        <strong>${target}</strong>
        <p>${evidence}</p>
        <small>Validation update 55 · episode 01</small>
      </section>
      <section class="history-field" data-history-animate>
        <h4>Selected practice window</h4>
        <div class="history-window">
          <div><small>Entry condition</small><strong>${entry}</strong></div>
          <span aria-hidden="true">→</span>
          <div><small>Target · stage 1</small><strong>${target}</strong></div>
        </div>
        <p><strong>${count(budget)} steps</strong> max per window · Milestones unlisted in this record</p>
      </section>
      <section class="history-field" data-history-animate>
        <h4>Training interactions by rollout mode</h4>
        <table aria-label="Archived rollout counts and new controls spent in the target stage">
          <thead><tr><th scope="col">Mode</th><th scope="col">Rollouts</th><th scope="col">Fresh steps</th><th scope="col">Bottleneck steps</th></tr></thead>
          <tbody>${interactions.map((row, i) => `
            <tr><th scope="row">${archivedModes[i]}</th>${row.map(value => `<td>${count(value)}</td>`).join('')}</tr>
          `).join('')}</tbody>
        </table>
        <p>The archived run also used ${historyNumber.format(archivedReplaySteps)} prefix-replay steps. The current release restores snapshots directly.</p>
      </section>
      <section class="history-field" data-history-animate>
        <h4>Normal-start full-task success</h4>
        <dl class="history-eval">
          ${evaluations.map(([successes, total], i) => `
            <div>
              <dt>${historyCheckpoints[i][0]} <small>Update ${historyCheckpoints[i][1]}</small></dt>
              <dd><meter aria-hidden="true" min="0" max="${total}" value="${animate ? 0 : successes}" data-history-meter="${successes}"></meter><strong>${count(successes)}/${total}</strong></dd>
            </div>`).join('')}
        </dl>
        <p class="history-delta ${delta < 0 ? 'history-delta-negative' : ''}">Stored change <strong>${count(delta, delta < 0 ? '−' : '+')} pp</strong> <small>End vs. before Local RL</small></p>
      </section>
    </div>`
  if (animate) {
    const fields = historyRecord.querySelectorAll('[data-history-animate]')
    historyCycle?.reset(fields)
    fields.forEach(field => historyObserver.observe(field))
  }
}

historyOptions.append(...historyExamples.map(({ task }, i) => button(task, i === 0, () => renderHistory(i))))
renderHistory(0)
