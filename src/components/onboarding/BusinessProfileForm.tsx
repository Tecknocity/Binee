'use client';

import { useState } from 'react';
import {
  Building2,
  Users,
  Briefcase,
  Wrench,
  ArrowRight,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import type { ProfileFormData } from '@/hooks/useSetup';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BusinessProfileFormProps {
  onSubmit: (data: ProfileFormData) => void;
  isSubmitting: boolean;
  initialData?: ProfileFormData | null;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const BUSINESS_CATEGORIES = [
  'Marketing & Advertising',
  'Software & Technology',
  'E-commerce & Retail',
  'Consulting & Professional Services',
  'Healthcare & Wellness',
  'Education & Training',
  'Finance & Accounting',
  'Real Estate',
  'Manufacturing & Logistics',
  'Media & Entertainment',
  'Nonprofit & Social Impact',
  'Other',
] as const;

const COMPANY_TYPES = [
  'Agency',
  'Startup',
  'Small Business',
  'Enterprise',
  'Freelancer / Solo',
  'Consulting Firm',
  'SaaS Company',
  'E-commerce Store',
  'Nonprofit',
  'Other',
] as const;

const TEAM_SIZES = [
  'Just me',
  '2-5 people',
  '6-15 people',
  '16-50 people',
  '50+ people',
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BusinessProfileForm({
  onSubmit,
  isSubmitting,
  initialData,
}: BusinessProfileFormProps) {
  const [businessCategory, setBusinessCategory] = useState(initialData?.businessCategory ?? '');
  const [companyType, setCompanyType] = useState(initialData?.companyType ?? '');
  const [services, setServices] = useState(initialData?.services ?? '');
  const [teamSize, setTeamSize] = useState(initialData?.teamSize ?? '');

  const isValid = businessCategory && companyType && services.trim() && teamSize;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    onSubmit({ businessCategory, companyType, services: services.trim(), teamSize });
  };

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto px-4 pb-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="py-6 sm:py-8 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-accent/15 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-accent" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary">Tell us about your business</h2>
          <p className="text-sm sm:text-base text-text-secondary mt-2 max-w-md mx-auto">
            Fill in the basics so we can design the perfect workspace structure for you.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Industry / Category */}
          <FormField
            icon={<Briefcase className="w-4 h-4" />}
            label="Industry"
            hint="What industry is your business in?"
          >
            <SelectField
              value={businessCategory}
              onChange={setBusinessCategory}
              placeholder="Select your industry..."
              options={BUSINESS_CATEGORIES}
            />
          </FormField>

          {/* Company Type */}
          <FormField
            icon={<Building2 className="w-4 h-4" />}
            label="Company type"
            hint="What kind of company do you run?"
          >
            <SelectField
              value={companyType}
              onChange={setCompanyType}
              placeholder="Select company type..."
              options={COMPANY_TYPES}
            />
          </FormField>

          {/* Services */}
          <FormField
            icon={<Wrench className="w-4 h-4" />}
            label="Services / Products"
            hint="What does your business offer?"
          >
            <textarea
              value={services}
              onChange={(e) => setServices(e.target.value)}
              placeholder="e.g., Social media management, content creation, paid advertising, SEO..."
              rows={3}
              className="w-full bg-navy-base/50 border border-border rounded-xl px-4 py-3 text-sm text-text-primary
                placeholder:text-text-muted/50 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
                transition-all resize-none"
            />
          </FormField>

          {/* Team Size */}
          <FormField
            icon={<Users className="w-4 h-4" />}
            label="Team size"
            hint="How many people are on your team?"
          >
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TEAM_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setTeamSize(size)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    teamSize === size
                      ? 'bg-accent/15 border-accent/40 text-accent'
                      : 'bg-surface border-border text-text-secondary hover:border-accent/20 hover:text-text-primary'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </FormField>

          {/* Progress indicator */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted">Profile completeness</span>
              <span className="text-xs font-medium text-accent">
                {[businessCategory, companyType, services.trim(), teamSize].filter(Boolean).length}/4
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                style={{
                  width: `${([businessCategory, companyType, services.trim(), teamSize].filter(Boolean).length / 4) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-center pt-4">
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="flex items-center gap-2.5 px-8 py-3.5 bg-accent text-white font-semibold text-base rounded-xl
                hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  Continue to Discussion
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FormField({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-accent">{icon}</span>
        <label className="text-sm font-semibold text-text-primary">{label}</label>
      </div>
      <p className="text-xs text-text-muted mb-2">{hint}</p>
      {children}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  options: readonly string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none bg-navy-base/50 border border-border rounded-xl px-4 py-3 text-sm
          outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all pr-10
          ${value ? 'text-text-primary' : 'text-text-muted/50'}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
    </div>
  );
}
