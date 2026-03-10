import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Crown, Shield, User, Mail, Phone,
  Link2, QrCode, Copy, Check, X, ChevronDown, ChevronUp,
  Trash2, Edit3, RefreshCw, AlertTriangle
} from 'lucide-react';
import { familyGroup } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function Family() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [pantryAccess, setPantryAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteTab, setInviteTab] = useState('link');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editProfile, setEditProfile] = useState({ name: '', diseases: '', allergies: '' });
  const [expandedMember, setExpandedMember] = useState(null);

  const myMember = members.find(m => m.user_id === user?.id);
  const isAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';

  useEffect(() => { loadGroup(); }, []);

  const loadGroup = async () => {
    try {
      setLoading(true);
      const data = await familyGroup.getGroup();
      setGroup(data.group);
      setMembers(data.members || []);
      setPantryAccess(data.pantry_access);
    } catch (err) {
      toast.error('Failed to load family group');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    try {
      setCreating(true);
      await familyGroup.create(groupName.trim());
      toast.success('Family group created!');
      await loadGroup();
      setGroupName('');
    } catch (err) {
      toast.error(err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (method) => {
    const payload = { method };
    if (method === 'email') {
      if (!inviteEmail.trim()) return;
      payload.email = inviteEmail.trim();
    } else if (method === 'sms') {
      if (!invitePhone.trim()) return;
      payload.phone = invitePhone.trim();
    }

    try {
      setInviting(true);
      const result = await familyGroup.invite(payload);
      setInviteUrl(result.invite_url);
      if (method === 'email') {
        toast.success('Invite email sent!');
        setInviteEmail('');
      } else if (method === 'sms') {
        toast.success('Invite SMS sent!');
        setInvitePhone('');
      }
      if (method === 'link' || method === 'qr') {
        setInviteTab(method);
      }
      await loadGroup();
    } catch (err) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveMember = async (id) => {
    if (!confirm('Remove this member from the family group?')) return;
    try {
      await familyGroup.removeMember(id);
      toast.success('Member removed');
      await loadGroup();
    } catch (err) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  const handleResendInvite = async (member) => {
    const method = member.invite_email ? 'email' : member.invite_phone ? 'sms' : 'link';
    const payload = { method };
    if (member.invite_email) payload.email = member.invite_email;
    if (member.invite_phone) payload.phone = member.invite_phone;
    try {
      await familyGroup.invite(payload);
      toast.success('Invite resent!');
    } catch (err) {
      toast.error('Failed to resend');
    }
  };

  const handleSaveProfile = async (memberId) => {
    try {
      const diseases = editProfile.diseases ? editProfile.diseases.split(',').map(s => s.trim()).filter(Boolean) : [];
      const allergies = editProfile.allergies ? editProfile.allergies.split(',').map(s => s.trim()).filter(Boolean) : [];

      await familyGroup.updateMember(memberId, {
        profile: {
          name: editProfile.name,
          diseases,
          allergies,
          profile_id: editProfile.profile_id || undefined,
        },
      });
      toast.success('Profile updated');
      setEditingMember(null);
      await loadGroup();
    } catch (err) {
      toast.error('Failed to save profile');
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await familyGroup.updateMember(memberId, { role: newRole });
      toast.success('Role updated');
      await loadGroup();
    } catch (err) {
      toast.error(err.message || 'Failed to change role');
    }
  };

  const startEditProfile = (member) => {
    const p = member.profiles?.[0];
    setEditProfile({
      name: p?.name || member.user_name || '',
      diseases: (p?.diseases || []).join(', '),
      allergies: (p?.allergies || []).join(', '),
      profile_id: p?.id || null,
    });
    setEditingMember(member.id);
  };

  const roleIcon = (role) => {
    if (role === 'owner') return <Crown className="w-3.5 h-3.5 text-yellow-400" />;
    if (role === 'admin') return <Shield className="w-3.5 h-3.5 text-blue-400" />;
    return <User className="w-3.5 h-3.5 text-[#888]" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#c8f135] border-t-transparent rounded-full" />
      </div>
    );
  }

  // No group yet — show create form
  if (!group) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-7 h-7" style={{ color: 'var(--ick-green)' }} />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '2px', color: 'var(--white)' }}>
            FAMILY
          </h1>
        </div>

        <div className="rounded-xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--white)' }}>
            Create a Family Group
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            Add your family members so everyone can scan food with their own health profiles, allergies, and conditions.
          </p>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              placeholder="Family name (e.g. The Smiths)"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm"
              style={{ background: '#0a0a0a', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: 'var(--font-body)' }}
            />
            <button
              type="submit"
              disabled={creating || !groupName.trim()}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ background: 'var(--ick-green)', color: '#0a0a0a', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}
            >
              {creating ? 'CREATING...' : 'CREATE GROUP'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Has group — show members + management
  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7" style={{ color: 'var(--ick-green)' }} />
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '2px', color: 'var(--white)' }}>
              {group.name.toUpperCase()}
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
              {members.length} MEMBER{members.length !== 1 ? 'S' : ''}
              {pantryAccess && ' \u2022 SHARED PANTRY'}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--ick-green)', color: '#0a0a0a', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}
          >
            <UserPlus className="w-4 h-4" />
            INVITE
          </button>
        )}
      </div>

      {/* Members list */}
      <div className="space-y-3">
        {members.map((member) => {
          const isExpanded = expandedMember === member.id;
          const isPending = member.status === 'pending';
          const displayName = member.user_name || member.invite_email || member.invite_phone || 'Invited';

          return (
            <div
              key={member.id}
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              {/* Member row */}
              <button
                onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {roleIcon(member.role)}
                  <div className="text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--white)' }}>
                        {displayName}
                      </span>
                      {member.user_id === user?.id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(200,241,53,0.1)', color: 'var(--ick-green)', fontFamily: 'var(--font-mono)' }}>
                          YOU
                        </span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: isPending ? '#f59e0b' : 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
                      {isPending ? 'PENDING' : member.role.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.profiles?.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                      {member.profiles[0].allergies?.length || 0} allergies
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[#888]" /> : <ChevronDown className="w-4 h-4 text-[#888]" />}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                  {/* Profiles (diseases/allergies) */}
                  {member.profiles?.length > 0 && (
                    <div className="pt-3">
                      {member.profiles.map((p) => (
                        <div key={p.id} className="space-y-1">
                          {p.diseases?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-[10px] font-semibold" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>CONDITIONS:</span>
                              {p.diseases.map((d, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                                  {d}
                                </span>
                              ))}
                            </div>
                          )}
                          {p.allergies?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="text-[10px] font-semibold" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>ALLERGIES:</span>
                              {p.allergies.map((a, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                                  {a}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Edit profile form */}
                  {editingMember === member.id ? (
                    <div className="space-y-2 pt-2">
                      <input
                        type="text"
                        placeholder="Name"
                        value={editProfile.name}
                        onChange={e => setEditProfile(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{ background: '#0a0a0a', border: '1px solid var(--border)', color: 'var(--white)' }}
                      />
                      <input
                        type="text"
                        placeholder="Conditions (comma separated)"
                        value={editProfile.diseases}
                        onChange={e => setEditProfile(p => ({ ...p, diseases: e.target.value }))}
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{ background: '#0a0a0a', border: '1px solid var(--border)', color: 'var(--white)' }}
                      />
                      <input
                        type="text"
                        placeholder="Allergies (comma separated)"
                        value={editProfile.allergies}
                        onChange={e => setEditProfile(p => ({ ...p, allergies: e.target.value }))}
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{ background: '#0a0a0a', border: '1px solid var(--border)', color: 'var(--white)' }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveProfile(member.id)}
                          className="flex-1 py-2 rounded text-xs font-semibold"
                          style={{ background: 'var(--ick-green)', color: '#0a0a0a', fontFamily: 'var(--font-mono)' }}
                        >
                          SAVE
                        </button>
                        <button
                          onClick={() => setEditingMember(null)}
                          className="px-4 py-2 rounded text-xs"
                          style={{ background: '#2a2a2a', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}
                        >
                          CANCEL
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-2">
                      {isAdmin && (
                        <button
                          onClick={() => startEditProfile(member)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs"
                          style={{ background: '#2a2a2a', color: 'var(--white)', fontFamily: 'var(--font-mono)' }}
                        >
                          <Edit3 className="w-3 h-3" /> EDIT PROFILE
                        </button>
                      )}
                      {isAdmin && member.role !== 'owner' && (
                        <button
                          onClick={() => handleRoleChange(member.id, member.role === 'admin' ? 'member' : 'admin')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs"
                          style={{ background: '#2a2a2a', color: 'var(--white)', fontFamily: 'var(--font-mono)' }}
                        >
                          <Shield className="w-3 h-3" /> {member.role === 'admin' ? 'DEMOTE' : 'MAKE ADMIN'}
                        </button>
                      )}
                      {isPending && isAdmin && (
                        <button
                          onClick={() => handleResendInvite(member)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs"
                          style={{ background: '#2a2a2a', color: '#f59e0b', fontFamily: 'var(--font-mono)' }}
                        >
                          <RefreshCw className="w-3 h-3" /> RESEND
                        </button>
                      )}
                      {isAdmin && member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', fontFamily: 'var(--font-mono)' }}
                        >
                          <Trash2 className="w-3 h-3" /> REMOVE
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowInvite(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--white)' }}>Invite to Family</h2>
              <button onClick={() => setShowInvite(false)}>
                <X className="w-5 h-5 text-[#888]" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
              {[
                { key: 'link', icon: Link2, label: 'Link' },
                { key: 'qr', icon: QrCode, label: 'QR' },
                { key: 'email', icon: Mail, label: 'Email' },
                { key: 'sms', icon: Phone, label: 'SMS' },
              ].map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setInviteTab(key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs transition-colors"
                  style={{
                    color: inviteTab === key ? 'var(--ick-green)' : 'var(--muted)',
                    borderBottom: inviteTab === key ? '2px solid var(--ick-green)' : '2px solid transparent',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '1px',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-5 space-y-4">
              {(inviteTab === 'link' || inviteTab === 'qr') && !inviteUrl && (
                <div className="text-center">
                  <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
                    Generate a shareable invite link{inviteTab === 'qr' ? ' with QR code' : ''}.
                  </p>
                  <button
                    onClick={() => handleInvite(inviteTab)}
                    disabled={inviting}
                    className="px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--ick-green)', color: '#0a0a0a', fontFamily: 'var(--font-mono)' }}
                  >
                    {inviting ? 'GENERATING...' : 'GENERATE LINK'}
                  </button>
                </div>
              )}

              {inviteTab === 'link' && inviteUrl && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#0a0a0a', border: '1px solid var(--border)' }}>
                    <input
                      type="text"
                      readOnly
                      value={inviteUrl}
                      className="flex-1 text-xs bg-transparent outline-none"
                      style={{ color: 'var(--white)', fontFamily: 'var(--font-mono)' }}
                    />
                    <button onClick={copyLink} className="shrink-0">
                      {copied
                        ? <Check className="w-4 h-4 text-green-400" />
                        : <Copy className="w-4 h-4 text-[#888]" />
                      }
                    </button>
                  </div>
                  <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
                    Share this link with anyone to invite them.
                  </p>
                </div>
              )}

              {inviteTab === 'qr' && inviteUrl && (
                <div className="space-y-3 text-center">
                  <div className="inline-block p-4 rounded-xl bg-white">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}`}
                      alt="QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    Scan this QR code to join the family group.
                  </p>
                </div>
              )}

              {inviteTab === 'email' && (
                <div className="space-y-3">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm"
                    style={{ background: '#0a0a0a', border: '1px solid var(--border)', color: 'var(--white)' }}
                  />
                  <button
                    onClick={() => handleInvite('email')}
                    disabled={inviting || !inviteEmail.trim()}
                    className="w-full py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--ick-green)', color: '#0a0a0a', fontFamily: 'var(--font-mono)' }}
                  >
                    {inviting ? 'SENDING...' : 'SEND EMAIL INVITE'}
                  </button>
                </div>
              )}

              {inviteTab === 'sms' && (
                <div className="space-y-3">
                  <input
                    type="tel"
                    placeholder="Phone number (e.g. +1234567890)"
                    value={invitePhone}
                    onChange={e => setInvitePhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm"
                    style={{ background: '#0a0a0a', border: '1px solid var(--border)', color: 'var(--white)' }}
                  />
                  <button
                    onClick={() => handleInvite('sms')}
                    disabled={inviting || !invitePhone.trim()}
                    className="w-full py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--ick-green)', color: '#0a0a0a', fontFamily: 'var(--font-mono)' }}
                  >
                    {inviting ? 'SENDING...' : 'SEND SMS INVITE'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
