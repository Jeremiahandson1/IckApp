// Broadcast — compose email + push announcements to a user segment.

import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { admin } from '../../utils/api';
import { Mail, Bell, Send } from 'lucide-react';
import { SectionHeader } from './shared';

export default function BroadcastSection() {
  const { showToast } = useToast();
  const [segments, setSegments] = useState({});
  const [segment, setSegment] = useState('all');
  const [channels, setChannels] = useState({ email: true, push: false });
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    admin.broadcast.segments().then(r => setSegments(r.segments || {})).catch(() => {});
  }, []);

  const SEGMENT_LABELS = {
    all:      'All users',
    verified: 'Email verified',
    premium:  'Premium (active)',
    trial:    'Active trials',
    free:     'Free users',
  };

  const canSend =
    body.trim() &&
    (channels.email || channels.push) &&
    (!channels.email || subject.trim());

  async function onSend() {
    const channelList = Object.entries(channels).filter(([, v]) => v).map(([k]) => k);
    const targetCount = segments[segment] ?? 0;
    if (!window.confirm(
      `Send to ${targetCount} ${SEGMENT_LABELS[segment]} via ${channelList.join(' + ')}?`
    )) return;

    setSending(true);
    setLastResult(null);
    try {
      const r = await admin.broadcast.send({ subject, body, segment, channels: channelList });
      setLastResult(r);
      showToast(`Sent to ${r.recipients} recipients`, 'success');
      setSubject('');
      setBody('');
    } catch (e) {
      showToast(e.message || 'Broadcast failed', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <SectionHeader title="Broadcast" subtitle="Send a message to a user segment over email and/or push." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4">
            <p className="text-xs uppercase tracking-wider text-[#666] font-mono">Audience</p>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {Object.keys(SEGMENT_LABELS).map(k => (
                <label key={k}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition ${
                    segment === k
                      ? 'border-[#c8f135] bg-[#c8f135]/10'
                      : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                  }`}>
                  <span className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={segment === k}
                      onChange={() => setSegment(k)}
                      className="accent-[#c8f135]"
                    />
                    {SEGMENT_LABELS[k]}
                  </span>
                  <span className="text-xs text-[#888] font-mono">
                    {segments[k] != null ? `${segments[k].toLocaleString()} users` : '…'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4">
            <p className="text-xs uppercase tracking-wider text-[#666] font-mono">Channels</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                channels.email ? 'border-[#c8f135] bg-[#c8f135]/10' : 'border-[#2a2a2a]'
              }`}>
                <input type="checkbox" checked={channels.email}
                  onChange={e => setChannels(c => ({ ...c, email: e.target.checked }))}
                  className="accent-[#c8f135]" />
                <Mail className="w-4 h-4" /> <span className="text-sm">Email</span>
              </label>
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                channels.push ? 'border-[#c8f135] bg-[#c8f135]/10' : 'border-[#2a2a2a]'
              }`}>
                <input type="checkbox" checked={channels.push}
                  onChange={e => setChannels(c => ({ ...c, push: e.target.checked }))}
                  className="accent-[#c8f135]" />
                <Bell className="w-4 h-4" /> <span className="text-sm">Push</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4">
          <p className="text-xs uppercase tracking-wider text-[#666] font-mono">
            Subject {channels.email && <span className="text-[#c8f135]">*</span>}
          </p>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="What's the message about?"
            maxLength={140}
            className="w-full mt-2 px-3 py-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg text-sm focus:border-[#c8f135] outline-none"
          />
          <div className="text-xs text-[#666] mt-1 font-mono">{subject.length}/140</div>

          <p className="text-xs uppercase tracking-wider text-[#666] font-mono mt-4">Body</p>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Plain text. Newlines are preserved."
            rows={10}
            maxLength={4000}
            className="w-full mt-2 px-3 py-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg text-sm focus:border-[#c8f135] outline-none resize-none font-mono"
          />
          <div className="text-xs text-[#666] mt-1 font-mono">{body.length}/4000</div>

          <button
            onClick={onSend}
            disabled={!canSend || sending}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#c8f135] text-[#0a0a0a] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#d4ff48]"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending…' : `Send to ${segments[segment]?.toLocaleString() ?? '…'} users`}
          </button>

          {lastResult && (
            <div className="mt-4 p-3 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg text-xs font-mono text-[#bbb] space-y-1">
              <div>Recipients: {lastResult.recipients}</div>
              {lastResult.email && (
                <div>Email — sent: {lastResult.email.sent}, failed: {lastResult.email.failed}</div>
              )}
              {lastResult.push && (
                <div>
                  Push — sent: {lastResult.push.sent}, expired: {lastResult.push.expired},
                  no-sub: {lastResult.push.no_sub}, failed: {lastResult.push.failed}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
