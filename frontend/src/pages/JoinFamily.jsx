import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Check, AlertTriangle } from 'lucide-react';
import { familyGroup } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function JoinFamily() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInvite();
  }, [token]);

  const loadInvite = async () => {
    try {
      const data = await familyGroup.getInvite(token);
      setInvite(data);
    } catch (err) {
      setError(err.message || 'Invite not found or expired');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      navigate(`/register`, { state: { returnTo: `/join/${token}` } });
      return;
    }
    try {
      setJoining(true);
      await familyGroup.joinGroup(token);
      toast.success('You joined the family group!');
      navigate('/family');
    } catch (err) {
      toast.error(err.message || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="animate-spin w-8 h-8 border-4 border-[#c8f135] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#0a0a0a' }}>
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--white)' }}>Invite Not Found</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{error}</p>
          <button
            onClick={() => navigate('/scan')}
            className="px-6 py-3 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--ick-green)', color: '#0a0a0a', fontFamily: 'var(--font-mono)' }}
          >
            GO TO APP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#0a0a0a' }}>
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(200,241,53,0.1)' }}>
          <Users className="w-8 h-8" style={{ color: 'var(--ick-green)' }} />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--white)', fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          YOU'RE INVITED
        </h1>
        <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--white)' }}>{invite.owner_name}</strong> invited you to join
        </p>
        <p className="text-lg font-semibold mb-6" style={{ color: 'var(--ick-green)' }}>
          {invite.group_name}
        </p>

        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ background: 'var(--ick-green)', color: '#0a0a0a', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}
        >
          {!user ? 'SIGN UP TO JOIN' : joining ? 'JOINING...' : 'JOIN FAMILY'}
        </button>

        {!user && (
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            Already have an account?{' '}
            <button onClick={() => navigate('/login', { state: { returnTo: `/join/${token}` } })} style={{ color: 'var(--ick-green)' }}>
              Log in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
