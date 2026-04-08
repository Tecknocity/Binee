'use client';

import { useState, useRef } from 'react';
import {
  Building2,
  Users,
  Briefcase,
  Wrench,
  ArrowRight,
  Loader2,
  ChevronDown,
  Layout,
  Upload,
  FileSpreadsheet,
  FileText,
  X,
} from 'lucide-react';
import type { ProfileFormData } from '@/hooks/useSetup';
import { parseFile, getFileError, isFileSupported, formatAttachmentsForAI } from '@/lib/file-parser';
import type { FileAttachment } from '@/lib/file-parser';

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

const INDUSTRIES = [
  'Marketing & Advertising',
  'Software & Technology',
  'E-commerce & Retail',
  'Consulting & Professional Services',
  'Healthcare & Wellness',
  'Education & Training',
  'Finance & Accounting',
  'Real Estate & Property Management',
  'Manufacturing & Logistics',
  'Media & Entertainment',
  'Legal Services',
  'Architecture & Engineering',
  'Food & Hospitality',
  'Travel & Tourism',
  'Insurance',
  'Automotive',
  'Agriculture & Farming',
  'Energy & Utilities',
  'Construction',
  'Nonprofit & Social Impact',
  'Government & Public Sector',
  'Telecommunications',
  'Sports & Fitness',
  'Beauty & Fashion',
  'Other',
] as const;

const WORK_STYLES = [
  { value: 'client-based', label: 'Client-based', description: 'We manage work for multiple clients or accounts' },
  { value: 'product-based', label: 'Product-based', description: 'We build and ship products (software, physical, etc.)' },
  { value: 'project-based', label: 'Project-based', description: 'We run discrete projects with clear start and end dates' },
  { value: 'operations-based', label: 'Operations-based', description: 'We manage ongoing processes and recurring workflows' },
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
  const [industry, setIndustry] = useState(initialData?.industry ?? '');
  const [industryCustom, setIndustryCustom] = useState(initialData?.industryCustom ?? '');
  const [workStyle, setWorkStyle] = useState(initialData?.workStyle ?? '');
  const [services, setServices] = useState(initialData?.services ?? '');
  const [teamSize, setTeamSize] = useState(initialData?.teamSize ?? '');

  // File upload state
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveIndustry = industry === 'Other' ? industryCustom.trim() : industry;
  const isValid = effectiveIndustry && workStyle && services.trim() && teamSize;
  const filledCount = [effectiveIndustry, workStyle, services.trim(), teamSize].filter(Boolean).length;

  const handleFiles = async (files: FileList | File[]) => {
    setFileError(null);
    const fileArray = Array.from(files);

    if (attachments.length + fileArray.length > 3) {
      setFileError('Maximum 3 files');
      return;
    }

    for (const file of fileArray) {
      const error = getFileError(file);
      if (error) { setFileError(error); return; }
    }

    setIsParsing(true);
    try {
      const parsed = await Promise.all(
        fileArray.map(async (file) => {
          const result = await parseFile(file);
          return {
            name: result.name,
            type: result.type,
            content: result.content,
            rowCount: result.rowCount,
            columns: result.columns,
          } as FileAttachment;
        }),
      );
      setAttachments((prev) => [...prev, ...parsed]);
    } catch {
      setFileError('Failed to parse file. Please try a different format.');
    } finally {
      setIsParsing(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    onSubmit({
      industry: effectiveIndustry,
      industryCustom: industry === 'Other' ? industryCustom.trim() : '',
      workStyle,
      services: services.trim(),
      teamSize,
      fileContext: attachments.length > 0 ? formatAttachmentsForAI(attachments) : undefined,
    });
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
          {/* Industry */}
          <FormField
            icon={<Briefcase className="w-4 h-4" />}
            label="Industry"
            hint="What industry is your business in?"
            required
          >
            <SelectField
              value={industry}
              onChange={(val) => {
                setIndustry(val);
                if (val !== 'Other') setIndustryCustom('');
              }}
              placeholder="Select your industry..."
              options={INDUSTRIES}
            />
            {industry === 'Other' && (
              <input
                type="text"
                value={industryCustom}
                onChange={(e) => setIndustryCustom(e.target.value)}
                placeholder="Enter your industry..."
                className="mt-2 w-full bg-navy-light border border-border rounded-xl px-4 py-3 text-sm text-text-primary
                  placeholder:text-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
              />
            )}
          </FormField>

          {/* Work Style */}
          <FormField
            icon={<Layout className="w-4 h-4" />}
            label="Work style"
            hint="How is your work structured? This shapes your workspace layout."
            required
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WORK_STYLES.map((ws) => (
                <button
                  key={ws.value}
                  type="button"
                  onClick={() => setWorkStyle(ws.value)}
                  className={`text-left px-4 py-3 rounded-xl border transition-all ${
                    workStyle === ws.value
                      ? 'bg-accent/15 border-accent/40'
                      : 'bg-surface border-border hover:border-accent/20'
                  }`}
                >
                  <p className={`text-sm font-medium ${workStyle === ws.value ? 'text-accent' : 'text-text-primary'}`}>
                    {ws.label}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">{ws.description}</p>
                </button>
              ))}
            </div>
          </FormField>

          {/* Services */}
          <FormField
            icon={<Wrench className="w-4 h-4" />}
            label="Services / Products"
            hint="What does your business offer? List your main services or products."
            required
          >
            <textarea
              value={services}
              onChange={(e) => setServices(e.target.value)}
              placeholder="e.g., Social media management, content creation, paid advertising, SEO..."
              rows={3}
              className="w-full bg-navy-light border border-border rounded-xl px-4 py-3 text-sm text-text-primary
                placeholder:text-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
                transition-all resize-none"
            />
          </FormField>

          {/* Team Size */}
          <FormField
            icon={<Users className="w-4 h-4" />}
            label="Team size"
            hint="How many people are on your team?"
            required
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

          {/* File upload drop zone (optional) */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-accent"><Upload className="w-4 h-4" /></span>
              <label className="text-sm font-semibold text-text-primary">
                Additional context
                <span className="text-text-muted font-normal ml-1">(optional)</span>
              </label>
            </div>
            <p className="text-xs text-text-muted mb-2">
              Have existing Excel files, spreadsheets, or docs with your current workflows? Share them for better results.
            </p>

            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const files = Array.from(e.dataTransfer.files).filter(isFileSupported);
                if (files.length > 0) handleFiles(files);
                else if (e.dataTransfer.files.length > 0) setFileError('Unsupported file type. Use CSV, XLSX, TXT, MD, or JSON.');
              }}
              className={`
                cursor-pointer border-2 border-dashed rounded-xl px-4 py-4 text-center transition-all
                ${isDragOver
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-border hover:border-accent/30 hover:bg-surface/50'
                }
                ${isParsing ? 'opacity-60 pointer-events-none' : ''}
              `}
            >
              {isParsing ? (
                <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing file...
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload className="w-5 h-5 text-text-muted" />
                  <span className="text-sm text-text-secondary">
                    Drop files here or <span className="text-accent font-medium">browse</span>
                  </span>
                  <span className="text-xs text-text-muted">CSV, XLSX, TXT, MD, JSON (max 5MB)</span>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.txt,.md,.json,.tsv"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
                e.target.value = '';
              }}
            />

            {/* File error */}
            {fileError && (
              <p className="mt-1.5 text-xs text-error">{fileError}</p>
            )}

            {/* Attached files list */}
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachments.map((att, i) => {
                  const Icon = att.type === 'csv' || att.type === 'xlsx' ? FileSpreadsheet : FileText;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm"
                    >
                      <Icon className="w-4 h-4 text-accent flex-shrink-0" />
                      <span className="truncate text-text-secondary">{att.name}</span>
                      {att.rowCount !== undefined && (
                        <span className="text-xs text-text-muted flex-shrink-0">
                          {att.rowCount} rows
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeAttachment(i); }}
                        className="ml-auto p-0.5 text-text-muted hover:text-error transition-colors flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Progress indicator */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted">Profile completeness</span>
              <span className="text-xs font-medium text-accent">{filledCount}/4</span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                style={{ width: `${(filledCount / 4) * 100}%` }}
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
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent"
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
  required,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-accent">{icon}</span>
        <label className="text-sm font-semibold text-text-primary">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
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
        className={`w-full appearance-none bg-navy-light border border-border rounded-xl px-4 py-3 text-sm
          outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all pr-10
          ${value ? 'text-text-primary' : 'text-text-muted'}`}
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
