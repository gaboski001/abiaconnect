import { useEffect, useState } from 'react'
import { Mic, Radio, Speaker } from 'lucide-react'
import { callManager, type CallDiagnostics } from '@/lib/webrtcCall'
import { cn } from '@/lib/utils'

/**
 * Live low-level call diagnostics. Polls `callManager.getDiagnostics()` while
 * mounted so support can confirm the mic is live, remote tracks are arriving,
 * and the <audio> sink is actually bound to the remote MediaStream.
 */
export function CallDiagnosticsPanel() {
  const [diag, setDiag] = useState<CallDiagnostics>(() => callManager.getDiagnostics())

  useEffect(() => {
    setDiag(callManager.getDiagnostics())
    const id = window.setInterval(() => setDiag(callManager.getDiagnostics()), 750)
    return () => window.clearInterval(id)
  }, [])

  const rows: Array<{ icon: typeof Mic; title: string; items: Array<[string, string, 'ok' | 'warn' | 'bad' | 'muted']> }> = [
    {
      icon: Mic,
      title: 'Local mic',
      items: [
        ['Track', diag.localMicPresent ? 'present' : 'absent', diag.localMicPresent ? 'ok' : 'bad'],
        ['State', diag.localMicReadyState ?? '—', diag.localMicReadyState === 'live' ? 'ok' : diag.localMicReadyState ? 'warn' : 'muted'],
        ['Enabled', diag.localMicEnabled ? 'yes' : 'no', diag.localMicEnabled ? 'ok' : 'warn'],
        ['Muted (user)', diag.localMicMuted ? 'yes' : 'no', diag.localMicMuted ? 'warn' : 'ok'],
        ['Device', diag.localMicLabel || '—', 'muted'],
      ],
    },
    {
      icon: Radio,
      title: 'Remote tracks',
      items: [
        ['PC state', diag.peerConnectionState, diag.peerConnectionState === 'connected' ? 'ok' : diag.peerConnectionState === 'failed' ? 'bad' : 'warn'],
        ['ICE state', diag.iceConnectionState, diag.iceConnectionState === 'connected' || diag.iceConnectionState === 'completed' ? 'ok' : diag.iceConnectionState === 'failed' ? 'bad' : 'warn'],
        ['Received', String(diag.remoteTrackCount), diag.remoteTrackCount > 0 ? 'ok' : 'bad'],
        ['Live', `${diag.remoteTracksLive}/${diag.remoteTrackCount || 0}`, diag.remoteTracksLive > 0 ? 'ok' : 'warn'],
      ],
    },
    {
      icon: Speaker,
      title: 'Audio sink',
      items: [
        ['Element bound', diag.audioElementBound ? 'yes' : 'no', diag.audioElementBound ? 'ok' : 'bad'],
        ['srcObject attached', diag.audioSrcObjectAttached ? 'yes' : 'no', diag.audioSrcObjectAttached ? 'ok' : 'bad'],
        ['Sink tracks', String(diag.audioSinkTrackCount), diag.audioSinkTrackCount > 0 ? 'ok' : 'bad'],
        ['Playing', diag.audioElementPaused ? 'paused' : 'playing', diag.audioElementPaused ? 'warn' : 'ok'],
        ['Element muted', diag.audioElementMuted ? 'yes' : 'no', diag.audioElementMuted ? 'bad' : 'ok'],
        ['Volume', diag.audioElementVolume.toFixed(2), diag.audioElementVolume > 0 ? 'ok' : 'bad'],
      ],
    },
  ]

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-[11px] font-mono">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold uppercase tracking-[0.16em] text-slate-300/80">Diagnostics</span>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px]', diag.hasPeerConnection ? 'bg-emerald-400/15 text-emerald-200' : 'bg-slate-400/15 text-slate-300')}>
          {diag.hasPeerConnection ? 'session active' : 'no session'}
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((section) => {
          const Icon = section.icon
          return (
            <div key={section.title}>
              <div className="mb-1 flex items-center gap-1.5 text-slate-300/80">
                <Icon className="h-3.5 w-3.5" />
                <span className="font-semibold">{section.title}</span>
              </div>
              <ul className="space-y-0.5 pl-5">
                {section.items.map(([label, value, tone]) => (
                  <li key={label} className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">{label}</span>
                    <span
                      className={cn(
                        'truncate text-right',
                        tone === 'ok' && 'text-emerald-300',
                        tone === 'warn' && 'text-yellow-300',
                        tone === 'bad' && 'text-rose-300',
                        tone === 'muted' && 'text-slate-400',
                      )}
                      title={value}
                    >
                      {value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CallDiagnosticsPanel
