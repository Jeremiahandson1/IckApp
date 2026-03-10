import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';
import { getSubscriptionStatus } from '../middleware/subscription.js';

const router = express.Router();
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Helper: check if user is owner or admin of a group ──
async function requireGroupAdmin(userId, groupId) {
  const result = await pool.query(
    `SELECT role FROM family_members WHERE group_id = $1 AND user_id = $2 AND role IN ('owner','admin') AND status = 'active'`,
    [groupId, userId]
  );
  return result.rows.length > 0;
}

// ── Helper: get user's group ──
async function getUserGroup(userId) {
  const result = await pool.query(
    `SELECT fg.* FROM family_groups fg
     JOIN family_members fm ON fm.group_id = fg.id
     WHERE fm.user_id = $1 AND fm.status = 'active'
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

// ── POST /create — create a family group ──
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name required' });

    // Check if user already owns or belongs to a group
    const existing = await getUserGroup(req.user.id);
    if (existing) return res.status(409).json({ error: 'You already belong to a family group' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const group = await client.query(
        `INSERT INTO family_groups (name, owner_id) VALUES ($1, $2) RETURNING *`,
        [name, req.user.id]
      );

      // Add owner as first member
      await client.query(
        `INSERT INTO family_members (group_id, user_id, status, role, joined_at)
         VALUES ($1, $2, 'active', 'owner', NOW())`,
        [group.rows[0].id, req.user.id]
      );

      await client.query('COMMIT');
      res.status(201).json(group.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create family group error:', err);
    res.status(500).json({ error: 'Failed to create family group' });
  }
});

// ── POST /invite — invite a member ──
router.post('/invite', authenticateToken, async (req, res) => {
  try {
    const { email, phone, method } = req.body;
    if (!method) return res.status(400).json({ error: 'Invite method required' });

    const group = await getUserGroup(req.user.id);
    if (!group) return res.status(404).json({ error: 'You do not belong to a family group' });

    const isAdmin = await requireGroupAdmin(req.user.id, group.id);
    if (!isAdmin) return res.status(403).json({ error: 'Only owners and admins can invite members' });

    // Check member count (max 10)
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM family_members WHERE group_id = $1',
      [group.id]
    );
    if (parseInt(countResult.rows[0].count) >= 10) {
      return res.status(400).json({ error: 'Maximum 10 family members reached' });
    }

    // Check for duplicate invite
    if (email) {
      const dup = await pool.query(
        `SELECT id FROM family_members WHERE group_id = $1 AND invite_email = $2 AND status != 'declined'`,
        [group.id, email.toLowerCase()]
      );
      if (dup.rows.length > 0) return res.status(409).json({ error: 'Already invited' });
    }

    const member = await pool.query(
      `INSERT INTO family_members (group_id, invite_email, invite_phone, status, role)
       VALUES ($1, $2, $3, 'pending', 'member')
       RETURNING *`,
      [group.id, email?.toLowerCase() || null, phone || null]
    );

    const inviteMember = member.rows[0];
    const joinUrl = `${APP_URL}/join/${inviteMember.invite_token}`;

    // Send invite based on method
    if (method === 'email' && email) {
      try {
        const { sendFamilyInviteEmail } = await import('../services/email.js');
        const user = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
        await sendFamilyInviteEmail({
          to: email,
          inviterName: user.rows[0]?.name || 'Someone',
          groupName: group.name,
          joinUrl,
        });
      } catch (e) {
        console.warn('[Family] Email invite failed (non-fatal):', e.message);
      }
    } else if (method === 'sms' && phone) {
      try {
        const { sendFamilyInviteSMS } = await import('../services/sms.js');
        const user = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
        await sendFamilyInviteSMS({
          to: phone,
          inviterName: user.rows[0]?.name || 'Someone',
          joinUrl,
        });
      } catch (e) {
        console.warn('[Family] SMS invite failed (non-fatal):', e.message);
      }
    }
    // method === 'link' or 'qr' — just return the token/url, frontend handles display

    res.status(201).json({
      member: inviteMember,
      invite_url: joinUrl,
    });
  } catch (err) {
    console.error('Family invite error:', err);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// ── GET /join/:token — preview invite (no auth required for this one) ──
router.get('/join/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await pool.query(
      `SELECT fm.*, fg.name AS group_name, u.name AS owner_name
       FROM family_members fm
       JOIN family_groups fg ON fg.id = fm.group_id
       JOIN users u ON u.id = fg.owner_id
       WHERE fm.invite_token = $1 AND fm.status = 'pending'`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found or already used' });
    }
    const invite = result.rows[0];
    res.json({
      group_name: invite.group_name,
      owner_name: invite.owner_name,
      invite_token: token,
    });
  } catch (err) {
    console.error('Join preview error:', err);
    res.status(500).json({ error: 'Failed to load invite' });
  }
});

// ── POST /join/:token — accept invite ──
router.post('/join/:token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;

    // Check user doesn't already belong to a group
    const existingGroup = await getUserGroup(req.user.id);
    if (existingGroup) {
      return res.status(409).json({ error: 'You already belong to a family group' });
    }

    const invite = await pool.query(
      `SELECT * FROM family_members WHERE invite_token = $1 AND status = 'pending'`,
      [token]
    );
    if (invite.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found or already used' });
    }

    const member = invite.rows[0];

    await pool.query(
      `UPDATE family_members SET user_id = $1, status = 'active', joined_at = NOW()
       WHERE id = $2`,
      [req.user.id, member.id]
    );

    res.json({ joined: true, group_id: member.group_id });
  } catch (err) {
    console.error('Join family error:', err);
    res.status(500).json({ error: 'Failed to join family group' });
  }
});

// ── GET /group — fetch my group + members ──
router.get('/group', authenticateToken, async (req, res) => {
  try {
    const group = await getUserGroup(req.user.id);
    if (!group) return res.json({ group: null, members: [] });

    const members = await pool.query(
      `SELECT fm.id, fm.user_id, fm.invite_email, fm.invite_phone, fm.status, fm.role,
              fm.invite_token, fm.joined_at, fm.created_at,
              u.name AS user_name, u.email AS user_email
       FROM family_members fm
       LEFT JOIN users u ON u.id = fm.user_id
       WHERE fm.group_id = $1
       ORDER BY fm.role = 'owner' DESC, fm.joined_at ASC`,
      [group.id]
    );

    // Fetch profiles for each member
    const memberIds = members.rows.map(m => m.id);
    let profiles = [];
    if (memberIds.length > 0) {
      const profileResult = await pool.query(
        `SELECT * FROM family_member_profiles WHERE family_member_id = ANY($1)`,
        [memberIds]
      );
      profiles = profileResult.rows;
    }

    // Check owner's subscription for pantry access
    const ownerSub = await getSubscriptionStatus(group.owner_id);

    const membersWithProfiles = members.rows.map(m => ({
      ...m,
      profiles: profiles.filter(p => p.family_member_id === m.id),
    }));

    res.json({
      group,
      members: membersWithProfiles,
      pantry_access: ownerSub.is_premium,
    });
  } catch (err) {
    console.error('Fetch family group error:', err);
    res.status(500).json({ error: 'Failed to load family group' });
  }
});

// ── PATCH /member/:id — update role or profile ──
router.patch('/member/:id', authenticateToken, async (req, res) => {
  try {
    const memberId = req.params.id;
    const { role, profile } = req.body;

    // Get the member's group
    const memberResult = await pool.query(
      'SELECT * FROM family_members WHERE id = $1',
      [memberId]
    );
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const member = memberResult.rows[0];

    // Check if current user can edit
    const isSelf = member.user_id === req.user.id;
    const isAdmin = await requireGroupAdmin(req.user.id, member.group_id);

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to edit this member' });
    }

    // Only admins can change roles
    if (role && !isAdmin) {
      return res.status(403).json({ error: 'Only owners and admins can change roles' });
    }

    // Cannot change owner role
    if (role && member.role === 'owner') {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    if (role) {
      await pool.query(
        'UPDATE family_members SET role = $1 WHERE id = $2',
        [role, memberId]
      );
    }

    // Update or create health profile (for non-app members like kids)
    if (profile) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only owners and admins can edit member profiles' });
      }

      const { name, diseases, allergies, profile_id } = profile;
      if (profile_id) {
        await pool.query(
          `UPDATE family_member_profiles
           SET name = COALESCE($1, name),
               diseases = COALESCE($2, diseases),
               allergies = COALESCE($3, allergies)
           WHERE id = $4 AND family_member_id = $5`,
          [name, diseases ? JSON.stringify(diseases) : null,
           allergies ? JSON.stringify(allergies) : null,
           profile_id, memberId]
        );
      } else {
        await pool.query(
          `INSERT INTO family_member_profiles (family_member_id, name, diseases, allergies)
           VALUES ($1, $2, $3, $4)`,
          [memberId, name || 'Profile',
           JSON.stringify(diseases || []),
           JSON.stringify(allergies || [])]
        );
      }
    }

    // Return updated member with profiles
    const updated = await pool.query(
      `SELECT fm.*, u.name AS user_name FROM family_members fm
       LEFT JOIN users u ON u.id = fm.user_id WHERE fm.id = $1`,
      [memberId]
    );
    const updatedProfiles = await pool.query(
      'SELECT * FROM family_member_profiles WHERE family_member_id = $1',
      [memberId]
    );

    res.json({
      ...updated.rows[0],
      profiles: updatedProfiles.rows,
    });
  } catch (err) {
    console.error('Update family member error:', err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// ── DELETE /member/:id — remove member ──
router.delete('/member/:id', authenticateToken, async (req, res) => {
  try {
    const memberId = req.params.id;

    const memberResult = await pool.query(
      'SELECT * FROM family_members WHERE id = $1',
      [memberId]
    );
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const member = memberResult.rows[0];

    // Cannot remove owner
    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove the group owner' });
    }

    const isAdmin = await requireGroupAdmin(req.user.id, member.group_id);
    const isSelf = member.user_id === req.user.id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Not authorized to remove this member' });
    }

    // Delete profiles first, then member
    await pool.query('DELETE FROM family_member_profiles WHERE family_member_id = $1', [memberId]);
    await pool.query('DELETE FROM family_members WHERE id = $1', [memberId]);

    res.json({ deleted: true });
  } catch (err) {
    console.error('Remove family member error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
