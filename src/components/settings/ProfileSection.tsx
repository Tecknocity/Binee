import React, { useRef, useState } from 'react';
import { User, Camera, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
];

const ProfileSection: React.FC = () => {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState('John Doe');
  const [email] = useState('john@company.com');
  const [company, setCompany] = useState('Binee Inc.');
  const [role, setRole] = useState('CEO & Founder');
  const [timezone, setTimezone] = useState('America/New_York');

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    toast.success('Settings saved!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Manage your personal information and preferences
        </p>
      </div>

      {/* Avatar Upload */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Profile Photo</h3>
        <div className="flex items-center gap-6">
          <div className="relative">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <div
              className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center overflow-hidden cursor-pointer ring-4 ring-background shadow-lg"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-primary-foreground" />
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-card border-2 border-primary flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
            >
              <Camera size={14} className="text-primary" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Upload a new photo</p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG or GIF. Max size 2MB.
            </p>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Personal Information</h3>
        <div className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-foreground mb-1.5">
              Full Name
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-foreground mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                id="profile-email"
                type="email"
                value={email}
                readOnly
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/50 outline-none pr-24"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-medium text-emerald-500">
                <CheckCircle size={14} />
                Verified
              </span>
            </div>
          </div>

          {/* Company Name */}
          <div>
            <label htmlFor="profile-company" className="block text-sm font-medium text-foreground mb-1.5">
              Company Name
            </label>
            <input
              id="profile-company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>

          {/* Role / Title */}
          <div>
            <label htmlFor="profile-role" className="block text-sm font-medium text-foreground mb-1.5">
              Role / Title
            </label>
            <input
              id="profile-role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>

          {/* Timezone */}
          <div>
            <label htmlFor="profile-timezone" className="block text-sm font-medium text-foreground mb-1.5">
              Timezone
            </label>
            <select
              id="profile-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/50 outline-none appearance-none cursor-pointer"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 gradient-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default ProfileSection;
