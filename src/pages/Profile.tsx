import React, { useState } from 'react';
import { PageLayout } from '../components/Layout';
import { theme } from '../styles/theme';
import { User, Camera, Calendar, Building, Briefcase, Mail, Check, X } from 'lucide-react';
import { Input } from '../components/ui/input';

interface ProfileData {
  name: string;
  email: string;
  company: string;
  role: string;
  memberSince: string;
  avatar: string | null;
}

const Profile: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    name: 'John Doe',
    email: 'john@company.com',
    company: 'Acme Corporation',
    role: 'Product Manager',
    memberSince: 'January 2023',
    avatar: null,
  });
  const [editedProfile, setEditedProfile] = useState<ProfileData>(profile);

  const handleEdit = () => {
    setEditedProfile(profile);
    setIsEditing(true);
  };

  const handleSave = () => {
    setProfile(editedProfile);
    setIsEditing(false);
    alert('Profile updated successfully!');
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const cardStyle: React.CSSProperties = {
    background: theme.colors.cardBgSolid,
    borderRadius: theme.borderRadius['2xl'],
    border: theme.colors.cardBorder,
    padding: theme.spacing['2xl'],
  };

  const buttonStyle: React.CSSProperties = {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    background: theme.colors.gradient,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: `all ${theme.transitions.normal}`,
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: 'transparent',
    border: `1px solid ${theme.colors.mutedBorder}`,
    color: theme.colors.textSecondary,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    display: 'block',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  };

  const infoRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    padding: `${theme.spacing.xl} 0`,
    borderBottom: `1px solid ${theme.colors.mutedBorder}`,
  };

  const iconBoxStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.lg,
    background: theme.colors.primaryLight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <PageLayout title="Profile" subtitle="View and manage your profile information">
      <div style={{ maxWidth: '700px' }}>
        {/* Profile Header Card */}
        <div style={{ ...cardStyle, marginBottom: theme.spacing.xl }}>
          <div style={{ display: 'flex', gap: theme.spacing['2xl'], alignItems: 'center' }}>
            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: theme.borderRadius.full,
                  background: theme.colors.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <User size={48} color={theme.colors.text} />
              </div>
              <button
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '36px',
                  height: '36px',
                  borderRadius: theme.borderRadius.full,
                  background: theme.colors.darkSolid,
                  border: `2px solid ${theme.colors.primary}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => alert('Upload avatar functionality coming soon!')}
              >
                <Camera size={16} color={theme.colors.primary} />
              </button>
            </div>

            {/* Name and Email */}
            <div style={{ flex: 1 }}>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                  <div>
                    <label style={labelStyle}>Full Name</label>
                    <Input
                      type="text"
                      value={editedProfile.name}
                      onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                      className="bg-slate-800/80 border-slate-600 text-white text-lg"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <Input
                      type="email"
                      value={editedProfile.email}
                      onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                      className="bg-slate-800/80 border-slate-600 text-white"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h2
                    style={{
                      fontSize: theme.fontSize['4xl'],
                      fontWeight: theme.fontWeight.bold,
                      marginBottom: theme.spacing.sm,
                    }}
                  >
                    {profile.name}
                  </h2>
                  <p style={{ fontSize: theme.fontSize.lg, color: theme.colors.textSecondary }}>
                    {profile.email}
                  </p>
                </>
              )}
            </div>

            {/* Edit Button */}
            {!isEditing && (
              <button style={buttonStyle} onClick={handleEdit}>
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Profile Details Card */}
        <div style={cardStyle}>
          <h3
            style={{
              fontSize: theme.fontSize.xl,
              fontWeight: theme.fontWeight.bold,
              marginBottom: theme.spacing.lg,
            }}
          >
            Profile Details
          </h3>

          {/* Company */}
          <div style={infoRowStyle}>
            <div style={iconBoxStyle}>
              <Building size={18} color={theme.colors.primary} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Company</label>
              {isEditing ? (
                <Input
                  type="text"
                  value={editedProfile.company}
                  onChange={(e) => setEditedProfile({ ...editedProfile, company: e.target.value })}
                  className="bg-slate-800/80 border-slate-600 text-white"
                />
              ) : (
                <div style={valueStyle}>{profile.company}</div>
              )}
            </div>
          </div>

          {/* Role */}
          <div style={infoRowStyle}>
            <div style={iconBoxStyle}>
              <Briefcase size={18} color={theme.colors.primary} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Role / Title</label>
              {isEditing ? (
                <Input
                  type="text"
                  value={editedProfile.role}
                  onChange={(e) => setEditedProfile({ ...editedProfile, role: e.target.value })}
                  className="bg-slate-800/80 border-slate-600 text-white"
                />
              ) : (
                <div style={valueStyle}>{profile.role}</div>
              )}
            </div>
          </div>

          {/* Email (readonly) */}
          <div style={infoRowStyle}>
            <div style={iconBoxStyle}>
              <Mail size={18} color={theme.colors.primary} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Email Address</label>
              <div style={valueStyle}>{isEditing ? editedProfile.email : profile.email}</div>
            </div>
          </div>

          {/* Member Since */}
          <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
            <div style={iconBoxStyle}>
              <Calendar size={18} color={theme.colors.primary} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Member Since</label>
              <div style={valueStyle}>{profile.memberSince}</div>
            </div>
          </div>

          {/* Action Buttons when editing */}
          {isEditing && (
            <div
              style={{
                display: 'flex',
                gap: theme.spacing.md,
                marginTop: theme.spacing['2xl'],
                paddingTop: theme.spacing.xl,
                borderTop: `1px solid ${theme.colors.mutedBorder}`,
              }}
            >
              <button style={buttonStyle} onClick={handleSave}>
                <Check size={16} />
                Save Changes
              </button>
              <button style={secondaryButtonStyle} onClick={handleCancel}>
                <X size={16} />
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Activity Summary Card */}
        <div style={{ ...cardStyle, marginTop: theme.spacing.xl }}>
          <h3
            style={{
              fontSize: theme.fontSize.xl,
              fontWeight: theme.fontWeight.bold,
              marginBottom: theme.spacing.xl,
            }}
          >
            Activity Summary
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: theme.spacing.xl,
            }}
          >
            <div
              style={{
                background: theme.colors.dark,
                borderRadius: theme.borderRadius.xl,
                padding: theme.spacing.xl,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSize['4xl'],
                  fontWeight: theme.fontWeight.bold,
                  background: theme.colors.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: theme.spacing.sm,
                }}
              >
                127
              </div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                Goals Completed
              </div>
            </div>

            <div
              style={{
                background: theme.colors.dark,
                borderRadius: theme.borderRadius.xl,
                padding: theme.spacing.xl,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSize['4xl'],
                  fontWeight: theme.fontWeight.bold,
                  background: theme.colors.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: theme.spacing.sm,
                }}
              >
                4
              </div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                Integrations Active
              </div>
            </div>

            <div
              style={{
                background: theme.colors.dark,
                borderRadius: theme.borderRadius.xl,
                padding: theme.spacing.xl,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSize['4xl'],
                  fontWeight: theme.fontWeight.bold,
                  background: theme.colors.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: theme.spacing.sm,
                }}
              >
                365
              </div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                Days Active
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Profile;
