
import { useState } from 'react'
import {
  Activity, Brain, CheckCircle2, ChevronDown, CirclePlay,
  Clock3, Code2, Copy, Download, FlaskConical, Gauge,
  Layers3, LoaderCircle, MessageSquare, RotateCcw,
  Settings2, Sparkles, Target, Zap
} from 'lucide-react'

const samples = {
  'Sentiment Analysis': {
    system: 'You are a sentiment analysis assistant. Classify text as Positive, Negative, or Neutral and explain briefly.',
    task: 'Analyze the sentiment of this review: "The delivery was quick, the product quality is excellent, and I am very happy with my purchase."',
    target: 'Positive. The customer expresses satisfaction with delivery speed and product quality.'
  },
  'Python Code Debugging': {
    system: 'You are an expert Python programmer. Identify bugs and provide corrected code with a short explanation.',
    task: 'Debug this Python code:\n\ndef calculate_average(numbers):\n    total = 0\n    for n in numbers:\n        total += n\n    return total / len(number)\n\nprint(calculate_average([10, 20, 30]))',
    target: 'The variable name is incorrect. The function uses len(number), but the parameter is numbers. Replace it with len(numbers).'
  },
  'Math Word Problem': {
    system: 'You are a mathematics tutor. Solve problems accurately and explain the method.',
    task: 'A shopkeeper buys 5 notebooks for ₹40 each and sells each for ₹50. Calculate the total profit and profit percentage.',
    target: 'Cost price = ₹200. Selling price = ₹250. Profit = ₹50. Profit percentage = 25%.'
  }
}

const models = ['GPT-4o', 'GPT-4o Mini', 'Gemini 2.5 Flash', 'Claude 3.5 Sonnet']

const techniques = [
  { id: 'zero', name: 'Zero-Shot', subtitle: 'Direct instruction without examples', icon: MessageSquare },
  { id: 'few', name: 'Few-Shot', subtitle: 'Instruction supported by examples', icon: Layers3 },
  { id: 'cot', name: 'Chain-of-Thought', subtitle: 'Encourages step-by-step reasoning', icon: Brain }
]

function buildPrompt(id, system, task) {
  if (id === 'few') {
    return `${system}\n\nExamples:\nInput: "This product is amazing!"\nOutput: Positive\n\nInput: "Very disappointing experience."\nOutput: Negative\n\nNow complete this task:\n${task}`
  }
  if (id === 'cot') {
    return `${system}\n\n${task}\n\nLet's think step-by-step before providing the final answer.`
  }
  return `${system}\n\n${task}`
}

function generateMock(id, task, target) {
  const lower = task.toLowerCase()

  if (lower.includes('sentiment') || lower.includes('review:')) {
    if (id === 'few') return 'Positive\n\nThe review contains positive expressions such as "excellent" and "very happy". Based on the examples, the sentiment is Positive.'
    if (id === 'cot') return 'Step 1: Identify the overall tone of the review.\nStep 2: Notice positive phrases such as "quick", "excellent", and "very happy".\nStep 3: Determine the sentiment.\n\nFinal Answer: Positive. The customer is satisfied with the product and delivery.'
    return 'Sentiment: Positive\n\nThe review expresses satisfaction with the delivery speed and product quality.'
  }

  if (lower.includes('debug') || lower.includes('calculate_average')) {
    if (id === 'few') return 'The bug is in the return statement. The function parameter is named "numbers", but the code uses "number".\n\nCorrected line:\nreturn total / len(numbers)'
    if (id === 'cot') return 'Step 1: Inspect the function parameter: numbers.\nStep 2: Inspect the return statement: len(number).\nStep 3: The variable "number" is undefined.\n\nFix:\nreturn total / len(numbers)\n\nThis resolves the NameError.'
    return 'The code contains a variable-name error. Replace len(number) with len(numbers) in the return statement. This fixes the NameError.'
  }

  if (lower.includes('notebook') || lower.includes('profit percentage')) {
    if (id === 'few') return 'Total cost = 5 × ₹40 = ₹200.\nTotal selling price = 5 × ₹50 = ₹250.\nProfit = ₹250 − ₹200 = ₹50.\nProfit percentage = (50 / 200) × 100 = 25%.'
    if (id === 'cot') return 'Step 1: Calculate total cost: 5 × 40 = ₹200.\nStep 2: Calculate total selling price: 5 × 50 = ₹250.\nStep 3: Profit = 250 − 200 = ₹50.\nStep 4: Profit percentage = (50 / 200) × 100 = 25%.\n\nFinal Answer: ₹50 profit and 25% profit percentage.'
    return 'Total Cost Price = 5 × ₹40 = ₹200.\nTotal Selling Price = 5 × ₹50 = ₹250.\nTotal Profit = ₹250 − ₹200 = ₹50.\nProfit Percentage = (50 / ₹200) × 100 = 25%.'
  }

  return `${id === 'cot' ? 'Step 1: Understand the task.\nStep 2: Identify the key requirements.\nStep 3: Formulate a response.\n\n' : ''}${target || 'This is a simulated response generated for demonstration purposes. Connect a language model API to receive a real response.'}`
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(text.length / 4))
}

function similarity(response, target) {
  if (!response || !target) return 0
  const words = (s) => new Set(s.toLowerCase().match(/[a-z0-9₹]+/g) || [])
  const a = words(response)
  const b = words(target)
  const intersection = [...a].filter(word => b.has(word)).length
  const union = new Set([...a, ...b]).size
  return union ? Math.round((intersection / union) * 100) : 0
}

function App() {
  const [model, setModel] = useState('GPT-4o')
  const [temperature, setTemperature] = useState(0.7)
  const [topP, setTopP] = useState(0.9)
  const [system, setSystem] = useState(samples['Sentiment Analysis'].system)
  const [task, setTask] = useState(samples['Sentiment Analysis'].task)
  const [target, setTarget] = useState(samples['Sentiment Analysis'].target)
  const [sample, setSample] = useState('Sentiment Analysis')
  const [results, setResults] = useState({})
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(false)

  const loadSample = (name) => {
    const item = samples[name]
    setSample(name)
    setSystem(item.system)
    setTask(item.task)
    setTarget(item.target)
    setResults({})
    setCompleted(false)
  }

  const runBenchmark = async () => {
    if (!task.trim()) return
    setRunning(true)
    setCompleted(false)
    setResults({})

    for (let i = 0; i < techniques.length; i++) {
      const technique = techniques[i]
      const prompt = buildPrompt(technique.id, system, task)
      const response = generateMock(technique.id, task, target)
      const latency = 650 + Math.floor(Math.random() * 900)
      setResults(prev => ({
        ...prev,
        [technique.id]: { status: 'running', prompt, response: '', latency: 0 }
      }))
      await new Promise(resolve => setTimeout(resolve, latency))
      setResults(prev => ({
        ...prev,
        [technique.id]: {
          status: 'complete',
          prompt,
          response,
          latency,
          inputTokens: estimateTokens(prompt),
          outputTokens: estimateTokens(response),
          quality: similarity(response, target)
        }
      }))
    }

    setRunning(false)
    setCompleted(true)
  }

  const exportReport = () => {
    const report = {
      project: 'PromptLab - Interactive Prompt Evaluator',
      generatedAt: new Date().toISOString(),
      model,
      settings: { temperature, topP },
      sample,
      simulationNotice: 'All responses are locally simulated. No external model API was called.',
      results: techniques.map(t => ({
        technique: t.name,
        ...(results[t.id] || { status: 'not_run' })
      }))
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'promptlab-benchmark-report.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalTokens = techniques.reduce((sum, t) => {
    const r = results[t.id]
    return sum + (r?.inputTokens || 0) + (r?.outputTokens || 0)
  }, 0)

  const avgQuality = techniques.filter(t => results[t.id]?.status === 'complete')
    .reduce((sum, t, _, arr) => sum + results[t.id].quality / arr.length, 0)

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text) } catch { /* Clipboard permission may be unavailable */ }
  }

  return (
    <div className="min-h-screen bg-[#090d18] text-slate-100">
      <header className="border-b border-white/10 bg-[#0c1220]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-300"><FlaskConical size={25} /></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Prompt<span className="text-violet-400">Lab</span></h1>
              <p className="text-xs text-slate-400">Interactive Prompt Evaluator & Benchmarking Tool</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300">Simulation Mode</span>
            <button onClick={() => { setResults({}); setCompleted(false) }} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"><RotateCcw size={15} /> Reset results</button>
            <button onClick={exportReport} disabled={!completed} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"><Download size={16} /> Export Report</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 px-6 py-7">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          

          <div className="panel">
            <label className="field-label">Language model</label>
            <div className="relative">
              <select value={model} onChange={e => setModel(e.target.value)} className="control w-full appearance-none pr-9">
                {models.map(m => <option key={m}>{m}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-400" size={16} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Model selection is for configuration display only</p>
          </div>
          <div className="panel">
            <div className="flex justify-between"><label className="field-label">Temperature</label><span className="text-sm font-semibold text-violet-300">{temperature.toFixed(1)}</span></div>
            <input type="range" min="0" max="1" step="0.1" value={temperature} onChange={e => setTemperature(Number(e.target.value))} className="mt-4 w-full accent-violet-500" />
            <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Precise</span><span>Creative</span></div>
          </div>
          <div className="panel">
            <div className="flex justify-between"><label className="field-label">Top-P</label><span className="text-sm font-semibold text-violet-300">{topP.toFixed(1)}</span></div>
            <input type="range" min="0" max="1" step="0.1" value={topP} onChange={e => setTopP(Number(e.target.value))} className="mt-4 w-full accent-violet-500" />
            <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Focused</span><span>Diverse</span></div>
          </div>
          <div className="panel">
            <label className="field-label">Sample test cases</label>
            <div className="relative">
              <select value={sample} onChange={e => loadSample(e.target.value)} className="control w-full appearance-none pr-9">
                {Object.keys(samples).map(s => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-400" size={16} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Load a ready-made evaluation task</p>
          </div>
        </section>

        <section className="panel space-y-4">
          <div className="flex items-center gap-2"><Settings2 size={18} className="text-violet-400" /><h2 className="font-semibold">Prompt Configuration</h2></div>
          <div>
            <label className="field-label">System Prompt</label>
            <textarea rows="2" value={system} onChange={e => setSystem(e.target.value)} className="control w-full resize-y" placeholder="Define the role and behavior of the AI..." />
          </div>
          <div>
            <label className="field-label">User Input / Task</label>
            <textarea rows="4" value={task} onChange={e => setTask(e.target.value)} className="control w-full resize-y" placeholder="Enter the task you want to evaluate..." />
          </div>
          <div>
            <label className="field-label">Target / Expected Output <span className="font-normal text-slate-500">(used for approximate comparison)</span></label>
            <textarea rows="2" value={target} onChange={e => setTarget(e.target.value)} className="control w-full resize-y" placeholder="Enter the ideal answer for comparison..." />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <p className="text-xs text-slate-500">All three techniques use the same task and configuration.</p>
            <button onClick={runBenchmark} disabled={running || !task.trim()} className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
              {running ? <LoaderCircle className="animate-spin" size={17} /> : <CirclePlay size={17} />}
              {running ? 'Running benchmark...' : 'Run Benchmark Test'}
            </button>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-lg font-bold">Benchmark Comparison</h2><p className="text-sm text-slate-400">Compare three prompt engineering strategies side by side</p></div>
            {completed && <span className="flex items-center gap-1.5 text-sm text-emerald-400"><CheckCircle2 size={16} /> All tests completed</span>}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {techniques.map((t, index) => {
              const r = results[t.id]
              const Icon = t.icon
              return (
                <article key={t.id} className="panel flex min-w-0 flex-col">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-300"><Icon size={21} /></div>
                      <div><h3 className="font-semibold">{t.name}</h3><p className="text-xs text-slate-500">{t.subtitle}</p></div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${r?.status === 'complete' ? 'bg-emerald-400/10 text-emerald-300' : r?.status === 'running' ? 'bg-amber-400/10 text-amber-300' : 'bg-slate-700/70 text-slate-400'}`}>
                      {r?.status === 'complete' ? 'Complete' : r?.status === 'running' ? 'Running' : 'Ready'}
                    </span>
                  </div>
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between"><span className="field-label mb-0">Constructed Prompt</span><button onClick={() => r && copyText(r.prompt)} disabled={!r} className="text-slate-500 hover:text-white disabled:opacity-30"><Copy size={14} /></button></div>
                    <pre className="code-panel h-36 overflow-auto whitespace-pre-wrap break-words">{r?.prompt || 'Your constructed prompt will appear here after running the benchmark.'}</pre>
                  </div>
                  <div className="mb-4 flex-1">
                    <span className="field-label">Generated Response</span>
                    <div className="code-panel min-h-32 whitespace-pre-wrap break-words">
                      {r?.status === 'running' ? <span className="flex items-center gap-2 text-amber-300"><LoaderCircle size={15} className="animate-spin" /> Generating simulated response...</span> : r?.response || <span className="text-slate-500">Response will appear here after execution.</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                    <Metric icon={Clock3} label="Latency" value={r?.status === 'complete' ? `${r.latency} ms` : '—'} />
                    <Metric icon={Gauge} label="Quality score" value={r?.status === 'complete' ? `${r.quality}%` : '—'} />
                    <Metric icon={Zap} label="Input tokens" value={r?.inputTokens ?? '—'} />
                    <Metric icon={Activity} label="Output tokens" value={r?.outputTokens ?? '—'} />
                  </div>
                  <div className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                    Estimated cost: <span className="font-semibold text-slate-300">Not calculated</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
        <section className="panel space-y-5">
            <div>
              <h2 className="text-lg font-bold">Visual Performance Analysis</h2>
              <p className="text-sm text-slate-400">
                Quality score comparison across prompting techniques
              </p>
            </div>
                
            {techniques.map((t) => {
              const result = results[t.id]
              const score = result?.status === 'complete' ? result.quality : 0
                  
              return (
                <div key={t.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">
                      {t.name}
                    </span>
                    <span className="text-sm font-semibold text-violet-300">
                      {result?.status === 'complete' ? `${score}%` : 'Not tested'}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400 transition-all duration-700"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              )
            })}

            <p className="border-t border-white/10 pt-3 text-xs text-slate-500">
              Scores represent approximate word-overlap similarity with the expected
              output. They should not be interpreted as actual model accuracy.
            </p>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary icon={CheckCircle2} label="Completed tests" value={`${techniques.filter(t => results[t.id]?.status === 'complete').length} / 3`} />
          <Summary icon={Target} label="Average quality score" value={completed ? `${Math.round(avgQuality)}%` : '—'} />
          <Summary icon={Zap} label="Total estimated tokens" value={completed ? totalTokens.toLocaleString() : '—'} />
          <Summary icon={Brain} label="Selected model" value={model} />
        </section>

        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-200/90">
          <div className="flex items-center gap-2 font-semibold"><Sparkles size={16} /> Prototype disclosure</div>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/60">Responses are simulated locally for demonstration. Model selection does not make API calls. Token counts are rough estimates, and the quality score is a simple word-overlap comparison with the target answer—not a true semantic or human evaluation. Real model integration can be added in a future phase.</p>
        </div>
        <footer className="pb-3 text-center text-xs text-slate-600">PromptLab · Prompt Engineering Benchmarking Prototype · Phase 1</footer>
      </main>
    </div>
  )
}

function Metric({ icon: Icon, label, value }) {
  return <div className="rounded-lg bg-white/[0.035] p-2.5"><div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500"><Icon size={12} />{label}</div><div className="text-sm font-semibold text-slate-200">{value}</div></div>
}

function Summary({ icon: Icon, label, value }) {
  return <div className="panel flex items-center gap-3"><div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-300"><Icon size={19} /></div><div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="truncate text-lg font-bold">{value}</p></div></div>
}

export default App
