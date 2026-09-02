import React, { useState, useEffect } from 'react';

interface PromptSet {
  master: string;
  habits: string;
  pantry: string;
  shopping: string;
  chef: string;
}

interface SystemConfig {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  updatedAt?: string;
}

const AgentConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'master' | 'habits' | 'pantry' | 'shopping' | 'chef' | 'config'>('master');
  const [prompts, setPrompts] = useState<PromptSet>({
    master: '',
    habits: '',
    pantry: '',
    shopping: '',
    chef: ''
  });
  const [config, setConfig] = useState<SystemConfig>({
    model: 'gemini-3.7-flash',
    temperature: 0.2,
    maxOutputTokens: 1400
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Interactive Test Simulator State
  const [testSpecialist, setTestSpecialist] = useState<'habits' | 'pantry' | 'shopping' | 'chef'>('chef');
  const [testInput, setTestInput] = useState('');
  const [testHistory, setTestHistory] = useState<Array<{
    role: 'user' | 'assistant';
    text: string;
    specialist?: string;
    pullScreen?: string | null;
    cameraCommand?: string | null;
    feedbackPrompt?: string | null;
    timer?: { label: string; durationSeconds: number } | null;
  }>>([
    {
      role: 'assistant',
      text: "Hello! I am Benkut, your autonomous kitchen copilot. I deduce your needs, inspect produce, manage timers, and coordinate your kitchen. What would you like to cook or check today?",
      specialist: 'chef'
    }
  ]);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/admin/prompts', { credentials: 'include' });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { /* ignore */ }
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch agent prompts');
      if (data.prompts) setPrompts(data.prompts);
      if (data.config) setConfig(data.config);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error loading prompts');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompts, config })
      });
      if (!res.ok) throw new Error('Failed to save agent prompts');
      setStatusMessage('Revised system prompts successfully deployed and active in real-time!');
      setTimeout(() => setStatusMessage(''), 5000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error saving changes');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all agent system prompts and operational boundaries to factory defaults?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/prompts/reset', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Reset failed');
      const data = await res.json();
      if (data.prompts) setPrompts(data.prompts);
      if (data.config) setConfig(data.config);
      setStatusMessage('Reset to factory default prompts.');
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error resetting');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim() || testing) return;
    const userMsg = testInput.trim();
    setTestInput('');
    setTestHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setTesting(true);

    try {
      const res = await fetch('/api/agent/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg,
          specialist: testSpecialist,
          history: testHistory.map(h => ({ role: h.role, text: h.text }))
        })
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { /* ignore */ }
      if (!res.ok) throw new Error(data.error || 'Agent turn failed');
      setTestHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          text: data.speech || data.workspace?.body || 'Understood.',
          specialist: data.specialist || testSpecialist,
          pullScreen: data.pullScreen,
          cameraCommand: data.cameraCommand,
          feedbackPrompt: data.feedbackPrompt,
          timer: data.timer
        }
      ]);
    } catch (err) {
      setTestHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `[Error: ${err instanceof Error ? err.message : 'Turn failed'}]`,
          specialist: testSpecialist
        }
      ]);
    } finally {
      setTesting(false);
    }
  };

  const tabMeta = [
    { key: 'master', label: 'Master Orchestrator', icon: 'hub', color: 'text-indigo-600' },
    { key: 'habits', label: '1. Food Habits', icon: 'favorite', color: 'text-rose-600' },
    { key: 'pantry', label: '2. Pantry Guard', icon: 'kitchen', color: 'text-emerald-600' },
    { key: 'shopping', label: '3. Fresh Shopping', icon: 'shopping_bag', color: 'text-amber-600' },
    { key: 'chef', label: '4. Live Cooking Coach', icon: 'skillet', color: 'text-[#174F35]' },
    { key: 'all', label: 'All Prompts View', icon: 'view_agenda', color: 'text-blue-600' },
    { key: 'config', label: 'Model Parameters', icon: 'settings', color: 'text-stone-600' }
  ];

  return (
    <div id="admin-agent-config-root" className="flex flex-col h-full bg-[#F5F7F3] text-stone-900 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-stone-200 px-6 sm:px-8 py-4 bg-white shadow-xs">
        <div>
          <h2 className="text-xl font-display font-black tracking-tight text-stone-900">
            System Prompts &amp; Autonomous Agent Boundaries
          </h2>
          <p className="text-xs text-stone-500">
            Edit and deploy revised system prompts in real-time. Changes immediately alter live agent behavior, camera commands, intent deduction, and specialist logic.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {statusMessage && (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold animate-fade-in">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            id="admin-reset-prompts-btn"
            onClick={handleReset}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-700 hover:bg-stone-50 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-stone-500">restore</span>
            <span>Reset Defaults</span>
          </button>

          <button
            id="admin-deploy-prompts-btn"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#174F35] text-white text-xs font-bold hover:bg-[#0E3826] active:scale-95 transition shadow-sm cursor-pointer"
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-base">rocket_launch</span>
            )}
            <span>Deploy System Prompts</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col border-r border-stone-200 bg-white overflow-hidden">
          {/* Agent Navigation Tabs */}
          <div className="flex border-b border-stone-200 bg-stone-50 overflow-x-auto px-4 gap-1">
            {tabMeta.map((tab) => (
              <button
                key={tab.key}
                id={`admin-tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  activeTab === tab.key
                    ? 'border-[#174F35] text-[#174F35] bg-white'
                    : 'border-transparent text-stone-500 hover:text-stone-900'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${tab.color}`}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Prompt Textareas */}
          <div className="flex-1 p-6 flex flex-col bg-[#FAFBF9] overflow-y-auto space-y-4">
            {activeTab === 'all' ? (
              /* All Prompts Grid View */
              <div className="space-y-6">
                {(['master', 'habits', 'pantry', 'shopping', 'chef'] as const).map((key) => (
                  <div key={key} className="bg-[#1A1E1B] rounded-2xl border border-stone-800 shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between bg-[#111412] px-4 py-2.5 border-b border-stone-800 text-xs font-mono text-stone-400">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span className="font-bold text-stone-200 uppercase">
                          {key === 'master' ? 'Master Orchestrator & Autonomous Core' : `Specialist: ${key.toUpperCase()}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-500">Editable System Prompt</span>
                    </div>
                    <textarea
                      id={`admin-prompt-all-${key}`}
                      rows={8}
                      className="w-full bg-transparent text-[#E0E7E2] font-mono p-4 resize-y focus:outline-none text-xs leading-relaxed"
                      value={prompts[key] || ''}
                      onChange={(e) => setPrompts(prev => ({ ...prev, [key]: e.target.value }))}
                      spellCheck={false}
                    />
                  </div>
                ))}
              </div>
            ) : activeTab !== 'config' ? (
              /* Single Tab Focused Editor */
              <div className="flex-1 flex flex-col bg-[#1A1E1B] rounded-2xl border border-stone-800 shadow-xl overflow-hidden min-h-[440px]">
                <div className="flex items-center justify-between bg-[#111412] px-4 py-2.5 border-b border-stone-800 text-xs font-mono text-stone-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="font-bold text-stone-200">
                      {activeTab === 'master'
                        ? 'Master Orchestrator & Autonomous Core System Prompt'
                        : `Specialist Prompt: ${activeTab.toUpperCase()}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 uppercase font-bold">Live Execution Mode</span>
                </div>

                <textarea
                  id={`admin-prompt-textarea-${activeTab}`}
                  className="flex-1 w-full bg-transparent text-[#E0E7E2] font-mono p-5 resize-none focus:outline-none text-xs leading-relaxed"
                  value={prompts[activeTab as keyof PromptSet] || ''}
                  onChange={(e) =>
                    setPrompts((prev) => ({
                      ...prev,
                      [activeTab]: e.target.value
                    }))
                  }
                  spellCheck={false}
                  placeholder="Enter system instructions and operational boundaries..."
                />
              </div>
            ) : (
              /* Model Parameters */
              <div className="max-w-xl space-y-6 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                <h3 className="font-display font-bold text-base text-stone-900">Generation Model &amp; Parameters</h3>
                
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Gemini Model</label>
                    <select
                      value={config.model}
                      onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
                      className="w-full rounded-xl border border-stone-300 bg-stone-50 p-2.5 text-xs font-semibold focus:outline-none focus:border-[#174F35]"
                    >
                      <option value="gemini-3.7-flash">Gemini 3.7 Flash (Default - High accuracy, real-time voice & multimodality)</option>
                      <option value="gemini-flash-latest">Gemini Flash Latest</option>
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Ultra-fast low-latency)</option>
                      <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Advanced culinary reasoning & complex recipes)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-stone-700 mb-1">
                      <span>Temperature</span>
                      <span>{config.temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={config.temperature}
                      onChange={(e) => setConfig((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="w-full accent-[#174F35]"
                    />
                    <p className="text-[10px] text-stone-500 mt-1">Lower values ensure strict adherence to prompt rules and factual pantry data.</p>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-stone-700 mb-1">
                      <span>Max Output Tokens</span>
                      <span>{config.maxOutputTokens}</span>
                    </div>
                    <input
                      type="number"
                      min="300"
                      max="4096"
                      step="100"
                      value={config.maxOutputTokens}
                      onChange={(e) => setConfig((prev) => ({ ...prev, maxOutputTokens: parseInt(e.target.value, 10) }))}
                      className="w-full rounded-xl border border-stone-300 bg-stone-50 p-2.5 text-xs focus:outline-none focus:border-[#174F35]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Simulator & Testing Sidebar */}
        <div className="w-[380px] lg:w-[420px] flex flex-col bg-stone-50 border-l border-stone-200">
          <div className="p-4 border-b border-stone-200 bg-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-[#174F35]">play_circle</span>
                Live Prompt Tester
              </h3>
              <select
                value={testSpecialist}
                onChange={(e) => setTestSpecialist(e.target.value as typeof testSpecialist)}
                className="text-[11px] font-bold bg-[#E8F1E9] text-[#174F35] border border-[#174F35]/20 rounded-lg px-2 py-1 focus:outline-none"
              >
                <option value="chef">Test: Cooking Coach</option>
                <option value="habits">Test: Habits</option>
                <option value="pantry">Test: Pantry Guard</option>
                <option value="shopping">Test: Shopping / Inspection</option>
              </select>
            </div>
            <p className="text-[11px] text-stone-500">
              Test how the LLM interprets the system instructions for this specialist in real time.
            </p>
          </div>

          {/* Test Chat Log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {testHistory.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                    msg.role === 'user'
                      ? 'bg-[#174F35] text-white rounded-br-none'
                      : 'bg-white text-stone-900 border border-stone-200 rounded-bl-none space-y-1.5'
                  }`}
                >
                  {msg.specialist && msg.role === 'assistant' && (
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#174F35]">
                        {msg.specialist} Specialist
                      </span>
                      {msg.pullScreen && (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                          Screen: {msg.pullScreen}
                        </span>
                      )}
                    </div>
                  )}

                  <p>{msg.text}</p>

                  {msg.cameraCommand && (
                    <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">photo_camera</span>
                      <span>Camera command: {msg.cameraCommand}</span>
                    </div>
                  )}

                  {msg.timer && (
                    <div className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">timer</span>
                      <span>Timer: {msg.timer.label} ({Math.round(msg.timer.durationSeconds / 60)}m)</span>
                    </div>
                  )}

                  {msg.feedbackPrompt && (
                    <div className="text-[10px] text-stone-600 italic bg-stone-50 p-1.5 rounded border border-stone-200">
                      💬 Feedback check: "{msg.feedbackPrompt}"
                    </div>
                  )}
                </div>
              </div>
            ))}
            {testing && (
              <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-2xl p-2.5 w-20 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce delay-100"></span>
                <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce delay-200"></span>
              </div>
            )}
          </div>

          {/* Test Input Form */}
          <form onSubmit={handleSendTest} className="p-3 bg-white border-t border-stone-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Ask or test a command..."
                className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs focus:outline-none focus:border-[#174F35]"
              />
              <button
                type="submit"
                disabled={testing || !testInput.trim()}
                className="rounded-xl bg-[#174F35] px-3.5 py-2 text-white hover:bg-[#0E3826] disabled:opacity-50 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">send</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AgentConfig;
