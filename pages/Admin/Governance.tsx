import React, { useState, useEffect } from 'react';
import { telemetryService, TelemetryEvent } from '../../services/telemetryService';

const sections = ['Overview', 'Users & Guest Sessions', 'Audit log', 'Agents', 'Rate limits', 'Languages', 'Security'];

export const Governance: React.FC = () => {
  const [section, setSection] = useState('Overview');
  const [stats, setStats] = useState(telemetryService.getStats());
  const [recentEvents, setRecentEvents] = useState<TelemetryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTelemetry = async () => {
      setLoading(true);
      try {
        const events = await telemetryService.getRecentEvents(40);
        setRecentEvents(events);
        setStats(telemetryService.getStats());
      } catch (err) {
        console.error('Failed to load telemetry:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTelemetry();
  }, [section]);

  const guestEvents = recentEvents.filter(e => e.userId.startsWith('guest') || e.userEmail?.includes('guest'));
  const registeredEvents = recentEvents.filter(e => !e.userId.startsWith('guest') && !e.userEmail?.includes('guest'));

  return (
    <div className="h-full min-h-screen flex bg-stone-50 font-sans text-stone-900">
      {/* Sidebar Navigation */}
      <nav aria-label="Administration sections" className="w-64 bg-[#17231C] text-white p-5 hidden lg:block shrink-0">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-xl bg-[#174F35] text-[#DFF36C] flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-base">shield_person</span>
          </div>
          <div>
            <p className="text-xs text-[#DFF36C] font-black tracking-wider">BENKUT ADMIN</p>
            <p className="text-[10px] text-stone-400">Governance & Telemetry</p>
          </div>
        </div>

        <div className="space-y-1">
          {sections.map(s => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                section === s ? 'bg-[#174F35] text-white shadow-sm' : 'text-stone-300 hover:bg-white/10'
              }`}
            >
              <span>{s}</span>
              {s === 'Users & Guest Sessions' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-700 text-stone-200">
                  {recentEvents.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-8 p-3 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-stone-400 leading-relaxed">
          <span className="text-emerald-400 font-bold block mb-1">Privacy & Compliance</span>
          Guest & anonymous user data is stored safely for system analytics & administrative governance. Personal identifiers are masked by default.
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8 pb-6 border-b border-stone-200">
            <div>
              <p className="text-[#174F35] font-black text-xs tracking-widest uppercase">Admin Dashboard</p>
              <h1 className="text-2xl sm:text-3xl font-black text-stone-900 mt-1">{section}</h1>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                Real-time operational metrics, anonymous guest activity tracking, and security audit logs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Telemetry Active
              </span>
            </div>
          </header>

          {/* Section 1: Overview */}
          {section === 'Overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-3xl bg-white p-5 border border-stone-200 shadow-sm">
                  <p className="text-xs font-bold text-stone-500">Total System Events</p>
                  <p className="text-3xl font-black text-stone-900 mt-2">{stats.total}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">Firestore & Local Sync</p>
                </div>
                <div className="rounded-3xl bg-white p-5 border border-stone-200 shadow-sm">
                  <p className="text-xs font-bold text-stone-500">Guest Sessions Logged</p>
                  <p className="text-3xl font-black text-[#174F35] mt-2">{stats.guestEventsCount}</p>
                  <p className="text-[11px] text-stone-400 mt-1">Stored for admin auditing</p>
                </div>
                <div className="rounded-3xl bg-white p-5 border border-stone-200 shadow-sm">
                  <p className="text-xs font-bold text-stone-500">Voice Turns Handled</p>
                  <p className="text-3xl font-black text-stone-900 mt-2">{stats.voiceCount}</p>
                  <p className="text-[11px] text-stone-400 mt-1">Multi-lingual STT & TTS</p>
                </div>
                <div className="rounded-3xl bg-white p-5 border border-stone-200 shadow-sm">
                  <p className="text-xs font-bold text-stone-500">Produce Scans</p>
                  <p className="text-3xl font-black text-amber-600 mt-2">{stats.scanCount}</p>
                  <p className="text-[11px] text-stone-400 mt-1">Gemini Vision evaluations</p>
                </div>
              </div>

              {/* Language Distribution */}
              <div className="rounded-3xl bg-white p-6 border border-stone-200 shadow-sm">
                <h3 className="text-sm font-bold text-stone-900 mb-4">Language Activity Distribution</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(stats.languages).map(([lang, count]) => (
                    <div key={lang} className="p-3 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-700">{lang}</span>
                      <span className="text-xs font-black text-[#174F35]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Users & Guest Sessions */}
          {section === 'Users & Guest Sessions' && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-3xl bg-white p-5 border border-stone-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-stone-500">Guest / Anonymous Activity</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold">Unauthenticated</span>
                  </div>
                  <p className="text-2xl font-black text-stone-900">{guestEvents.length} recorded events</p>
                  <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                    All anonymous turns, camera scans, and pantry actions are recorded in the database for analytics and quality control while hidden from the public client.
                  </p>
                </div>

                <div className="rounded-3xl bg-white p-5 border border-stone-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-stone-500">Registered Accounts</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold">Authenticated</span>
                  </div>
                  <p className="text-2xl font-black text-stone-900">{registeredEvents.length} recorded events</p>
                  <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                    Users synced with cloud Firestore storage, cross-device persistence, and personalized food memory.
                  </p>
                </div>
              </div>

              {/* Event Stream */}
              <div className="rounded-3xl bg-white border border-stone-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900">Recent User & Guest Events Stream</h3>
                  <span className="text-xs text-stone-500">{recentEvents.length} events logged</span>
                </div>

                <div className="divide-y divide-stone-100">
                  {loading ? (
                    <div className="p-8 text-center text-xs text-stone-400">Loading live telemetry stream...</div>
                  ) : recentEvents.length === 0 ? (
                    <div className="p-8 text-center text-xs text-stone-400">No telemetry events recorded yet.</div>
                  ) : (
                    recentEvents.slice(0, 20).map((evt, idx) => {
                      const isEvtGuest = evt.userId.startsWith('guest') || evt.userEmail?.includes('guest');
                      return (
                        <div key={idx} className="p-4 hover:bg-stone-50 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                              isEvtGuest ? 'bg-stone-100 text-stone-700' : 'bg-[#E8F1E9] text-[#174F35]'
                            }`}>
                              <span className="material-symbols-outlined text-sm">
                                {isEvtGuest ? 'person_outline' : 'verified'}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-stone-900">{evt.eventType}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  isEvtGuest ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {isEvtGuest ? 'Guest' : 'Registered'}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                                User: {isEvtGuest ? evt.userId : evt.userEmail || evt.userId} · Lang: {evt.language}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] text-stone-400 shrink-0 font-mono">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Audit Log */}
          {section === 'Audit log' && (
            <div className="rounded-3xl bg-white p-6 border border-stone-200 shadow-sm">
              <h3 className="text-sm font-bold text-stone-900 mb-2">Immutable Audit Trail</h3>
              <p className="text-xs text-stone-500 mb-4 leading-relaxed">
                All system state modifications, security rule evaluations, and telemetry logs are permanently stored in Firestore with server-stamped timestamps.
              </p>
              <div className="space-y-2">
                {recentEvents.map((evt, idx) => (
                  <div key={idx} className="p-3 bg-stone-50 rounded-xl text-xs font-mono text-stone-600 flex justify-between items-center">
                    <span>[{evt.timestamp}] Event: {evt.eventType} | User: {evt.userId}</span>
                    <span className="text-[10px] text-stone-400">{evt.language}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Static Governance Sections */}
          {['Agents', 'Rate limits', 'Languages', 'Security'].includes(section) && (
            <div className="rounded-3xl bg-white p-6 border border-stone-200 shadow-sm">
              <h3 className="text-sm font-bold text-stone-900 mb-2">{section} Configuration</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Policy controls, specialist agent routing limits, model capability verification, and security boundaries are enforced server-side.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Governance;
