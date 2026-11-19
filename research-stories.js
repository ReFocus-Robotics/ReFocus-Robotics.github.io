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

function renderTrajectory(content, trace) {
  const { x, series, frames } = trace
  const video = content.querySelector('video')
  const stepsPerSecond = trace.stepped ? dagStepsPerSecond : 1
  const allY = series.flatMap(line => line.values)
  const yMin = Math.floor(Math.min(...allY) * 5) / 5
  const yMax = Math.ceil(Math.max(...allY) * 5) / 5
  const displayEnd = trace.end
  const playbackEnd = trace.stepped ? displayEnd : x.at(-1)
  const left = 12
  const right = 792
  const top = 12
  const bottom = 190
  const chartX = t => left + t / displayEnd * (right - left)
  const chartY = v => bottom - (v - yMin) / (yMax - yMin) * (bottom - top)
  const coordinates = line => {
    const dataEnd = trace.stepped ? [...x, displayEnd] : x
    const points = dataEnd.map((time, i) => {
      const xx = chartX(time), yy = chartY(line.values[Math.min(i, x.length - 1)])
      if (trace.stepped && i) return 'H' + xx + 'V' + yy
      return (i ? 'L' : 'M') + xx + ' ' + yy
    })
    return points.join('')
  }
  const gridValues = Array.from({length: 5}, (_, i) => yMax - (yMax - yMin) * i / 4)
  const gridLines = gridValues.map(v => '<path d="M' + left + ' ' + chartY(v) + 'H' + right + '"/>').join('')
  const band = trace.window
    ? '<rect class="trace-band" x="' + chartX(trace.window[0]) + '" y="' + top + '" width="' + (chartX(trace.window[1]) - chartX(trace.window[0])) + '" height="' + (bottom - top) + '"/>'
    : ''
  const clipId = 'trace-played-' + video.id
  const curves = series.map((line, i) =>
    '<path class="trace-curve trace-curve-' + i + '" d="' + coordinates(line) + '"/>'
  ).reverse().join('')
  content.insertAdjacentHTML('beforeend',
    '<div class="trace-plot"><div class="trace-legend">' + series.map(line => '<span><i></i>' + line.label + '</span>').join('') +
    (trace.window ? '<span><i></i>Practice window</span>' : '') + '</div>' +
    '<div class="trace-axis-title">' + trace.axis + '</div>' +
    '<div class="trace-chart"><div class="trace-scale" aria-hidden="true">' +
    gridValues.map(v => '<span>' + (Math.abs(v) < .005 ? 0 : Number(v.toFixed(2))) + '</span>').join('') + '</div>' +
    '<svg viewBox="0 0 800 200" preserveAspectRatio="none" role="img" aria-label="' + trace.axis + ' over the rollout">' +
    '<defs><clipPath id="' + clipId + '"><rect class="trace-played" x="' + left + '" y="0" width="0" height="200"/></clipPath></defs>' +
    band + '<g class="trace-grid">' + gridLines + '</g>' +
    frames.map(frame => '<line class="trace-marker" x1="' + chartX(frame.x) + '" x2="' + chartX(frame.x) + '" y1="' + top + '" y2="' + bottom + '"/>').join('') +
    '<g class="trace-context">' + curves + '</g><g clip-path="url(#' + clipId + ')">' + curves + '</g>' +
    '<line class="trace-cursor" y1="' + top + '" y2="' + bottom + '"/>' +
    series.map((line, i) => '<circle class="trace-dot trace-curve-' + i + '" r="5"/>').join('') +
    '</svg></div><div class="trace-ticks" aria-hidden="true">' +
    Array.from({length:5}, (_, i) => '<span>' + Math.round(displayEnd * i / 4) + '</span>').join('') +
    '</div><input class="trace-slider" type="range" min="0" max="' + playbackEnd +
    '" step="' + (trace.stepped ? '1' : 'any') + '" aria-label="Seek to rollout ' + (trace.stepped ? 'step' : 'time') + '">' +
    '<p class="trace-readout"></p></div>' +
    '<div class="trace-frames" role="group" aria-label="Trajectory keyframes"></div>')
  const slider = content.querySelector('input')
  const frameRow = content.querySelector('.trace-frames')
  const cursor = content.querySelector('.trace-cursor')
  const playedArea = content.querySelector('.trace-played')
  const dots = [...content.querySelectorAll('.trace-dot')]
  const readout = content.querySelector('.trace-readout')
  const stamp = value => trace.stepped ? 'Step ' + value : Number(value).toFixed(1) + ' s'
  function setTime(time, frameSelected = false) {
    slider.value = time
    slider.setAttribute('aria-valuetext', stamp(time))
    // A milestone on a chunk boundary is credited to the chunk ending there.
    const sampleTime = trace.stepped && frameSelected && time > 0 ? time - 1 : time
    const previous = Math.max(0, x.findLastIndex(t => t <= sampleTime))
    const t0 = x[previous], t1 = x[previous + 1]
    const fraction = trace.stepped || !t1 ? 0 : (time - t0) / (t1 - t0)
    const results = series.map(line => {
      const value = line.values[previous]
      return fraction ? value + fraction * (line.values[previous + 1] - value) : value
    })
    const xx = chartX(time)
    playedArea.setAttribute('width', xx - left)
    cursor.setAttribute('x1', xx)
    cursor.setAttribute('x2', xx)
    dots.forEach((dot, i) => {
      dot.setAttribute('cx', xx)
      dot.setAttribute('cy', chartY(results[i]))
    })
    const active = frames.findLastIndex(frame => frame.x <= time + .005)
    setPressed(frameRow, active)
    Array.from(frameRow.children).forEach((item, i) => item.classList.toggle('is-reached', i <= active))
    const chunk = trace.stepped ? ' · Action chunk ' + t0 + '–' + (t1 ?? displayEnd) : ''
    readout.textContent = stamp(time) + chunk + ' · ' + series.map((line, i) => line.label + ' ' + results[i].toFixed(3)).join(' · ')
  }
  let selectedKeyframe = null
  function seek(time, keyframe = false) {
    selectedKeyframe = keyframe ? time : null
    video.currentTime = time / stepsPerSecond
    setTime(time, keyframe)
  }
  function updateFromVideo() {
    const time = Math.min(playbackEnd, trace.stepped
      ? Math.floor(video.currentTime * stepsPerSecond + 0.00001)
      : video.currentTime)
    if (time !== selectedKeyframe) selectedKeyframe = null
    setTime(time, selectedKeyframe !== null)
  }
  frameRow.replaceChildren(...frames.map(frame => {
    const item = button(frame.label, false, () => seek(frame.x, true))
    item.innerHTML = '<img src="' + frame.src + '" loading="lazy" alt=""><b>' + frame.label + '</b><small>' + stamp(frame.x) + '</small>'
    return item
  }))
  slider.addEventListener('input', () => seek(Number(slider.value)))
  for (const event of ['loadedmetadata', 'timeupdate', 'seeking', 'seeked', 'ended']) {
    video.addEventListener(event, updateFromVideo)
  }
  updateFromVideo()
}

document.querySelectorAll('[data-trace]').forEach(story => {
  const cases = trajectoryData[story.dataset.trace]
  story.querySelectorAll('.trace-content').forEach(plot => {
    renderTrajectory(plot, cases[Number(plot.dataset.traceIndex || 0)])
  })
})

// Task-level excerpts from round3_context.json's archived intervention_history.
// Evaluation counts use the recorded checkpoints at updates 75, 80, and 100.
const historyExamples = [
  {
    task: 'Store Leftovers in Bowl',
    archiveTask: 'StoreLeftoversInBowl',
    entry: 'Both foods in bowl',
    target: 'Bowl in Fridge',
    budget: 600,
    evidence: 'Vegetable in bowl at step 156 and chicken in bowl at step 708. The rollout reached its 2,900-step limit with the fridge placement still unverified.',
    costs: [[84, 43266, 41500], [30, 43732, 15950], [39, 83798, 0]],
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
    costs: [[120, 36209, 76550], [50, 39546, 32050], [58, 91678, 0]],
    evaluations: [[4, 5], [5, 5], [5, 5]],
    delta: 20
  }
]
const historyOptions = document.querySelector('[data-history-options]')
const historyRecord = document.querySelector('[data-history-record]')
let selectedHistory = 0
const historyCycle = createTabCycle(() => renderHistory((selectedHistory + 1) % historyExamples.length))
const historyNumber = new Intl.NumberFormat('en-US')
const archivedModes = ['Local window', 'Suffix', 'Global']
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
  const { archiveTask, entry, target, budget, evidence, costs, evaluations, delta } = historyExamples[index]
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
        <h4>Realized rollout costs</h4>
        <table aria-label="Realized rollout costs by mode in control steps">
          <thead><tr><th scope="col">Mode</th><th scope="col">Rollouts</th><th scope="col">Fresh steps</th><th scope="col">Replay steps</th></tr></thead>
          <tbody>${costs.map((row, i) => `
            <tr><th scope="row">${archivedModes[i]}</th>${row.map(value => `<td>${count(value)}</td>`).join('')}</tr>
          `).join('')}</tbody>
        </table>
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
