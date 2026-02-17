import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ArrowRight,
  Loader2,
  Activity,
  MessageSquare,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Industry = 'SaaS' | 'E-commerce' | 'Agency' | 'Consulting' | 'Other';
type CompanySize = 'Just me' | '2-10' | '11-50' | '50+';

interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  color: string;       // Tailwind bg color for the icon circle
  textColor: string;   // Tailwind text color for the initial
  initial: string;
}

interface SourceMapping {
  source: string;
  binee: string;
}

interface ToolMappingConfig {
  label: string;
  mappings: SourceMapping[];
  bineeOptions: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRIES: Industry[] = ['SaaS', 'E-commerce', 'Agency', 'Consulting', 'Other'];
const COMPANY_SIZES: CompanySize[] = ['Just me', '2-10', '11-50', '50+'];

const STEP_LABELS = ['Welcome', 'Connect Tools', 'Map Data', 'Ready'] as const;

const INTEGRATIONS: IntegrationCard[] = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM & marketing automation',
    color: 'bg-orange-500',
    textColor: 'text-white',
    initial: 'H',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payments & subscriptions',
    color: 'bg-purple-600',
    textColor: 'text-white',
    initial: 'S',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Accounting & invoicing',
    color: 'bg-green-600',
    textColor: 'text-white',
    initial: 'Q',
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'Project management & tasks',
    color: 'bg-gradient-to-br from-pink-500 to-violet-500',
    textColor: 'text-white',
    initial: 'C',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email communication',
    color: 'bg-red-500',
    textColor: 'text-white',
    initial: 'G',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Scheduling & events',
    color: 'bg-blue-500',
    textColor: 'text-white',
    initial: 'G',
  },
];

const TOOL_MAPPINGS: Record<string, ToolMappingConfig> = {
  hubspot: {
    label: 'HubSpot CRM Stages',
    mappings: [
      { source: 'Appointment Scheduled', binee: 'Qualified' },
      { source: 'Qualified to Buy', binee: 'Qualified' },
      { source: 'Presentation Scheduled', binee: 'Proposal' },
      { source: 'Decision Maker Bought-In', binee: 'Negotiation' },
      { source: 'Contract Sent', binee: 'Negotiation' },
      { source: 'Closed Won', binee: 'Won' },
      { source: 'Closed Lost', binee: 'Lost' },
    ],
    bineeOptions: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
  },
  stripe: {
    label: 'Stripe Payment Statuses',
    mappings: [
      { source: 'Incomplete', binee: 'Pending' },
      { source: 'Active', binee: 'Active' },
      { source: 'Past Due', binee: 'At Risk' },
      { source: 'Canceled', binee: 'Churned' },
    ],
    bineeOptions: ['Pending', 'Active', 'At Risk', 'Churned'],
  },
  quickbooks: {
    label: 'QuickBooks Invoice Statuses',
    mappings: [
      { source: 'Draft', binee: 'Pending' },
      { source: 'Sent', binee: 'Outstanding' },
      { source: 'Overdue', binee: 'At Risk' },
      { source: 'Paid', binee: 'Collected' },
    ],
    bineeOptions: ['Pending', 'Outstanding', 'At Risk', 'Collected'],
  },
  clickup: {
    label: 'ClickUp Task Statuses',
    mappings: [
      { source: 'To Do', binee: 'Planned' },
      { source: 'In Progress', binee: 'Active' },
      { source: 'Review', binee: 'Active' },
      { source: 'Complete', binee: 'Completed' },
    ],
    bineeOptions: ['Planned', 'Active', 'On Hold', 'Completed', 'Cancelled'],
  },
  gmail: {
    label: 'Gmail Labels',
    mappings: [
      { source: 'Inbox', binee: 'Unprocessed' },
      { source: 'Starred', binee: 'Important' },
      { source: 'Sent', binee: 'Sent' },
    ],
    bineeOptions: ['Unprocessed', 'Important', 'Sent', 'Archived'],
  },
  'google-calendar': {
    label: 'Calendar Event Types',
    mappings: [
      { source: 'Meeting', binee: 'Internal Meeting' },
      { source: 'External', binee: 'Client Meeting' },
      { source: 'Focus Time', binee: 'Deep Work' },
    ],
    bineeOptions: ['Internal Meeting', 'Client Meeting', 'Deep Work', 'Admin'],
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Progress indicator at the top of the wizard */
const ProgressIndicator: React.FC<{ currentStep: number; connectedToolIds: string[] }> = ({
  currentStep,
  connectedToolIds,
}) => {
  // If no tools connected, step 3 (Map Data) is skipped so adjust visual
  const skipMapStep = connectedToolIds.length === 0;

  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1;
        const isCompleted = currentStep > stepNum;
        const isActive = currentStep === stepNum;
        const isSkipped = skipMapStep && stepNum === 3;

        return (
          <React.Fragment key={label}>
            {/* Connector line (before step, except first) */}
            {idx > 0 && (
              <div
                className={cn(
                  'h-[2px] w-10 md:w-16 transition-colors duration-300',
                  isSkipped
                    ? 'bg-border/40'
                    : currentStep > idx
                      ? 'bg-success'
                      : 'bg-border',
                )}
              />
            )}

            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                  isSkipped && 'opacity-40',
                  isCompleted && 'bg-success text-success-foreground',
                  isActive && 'gradient-primary text-white shadow-glow-sm',
                  !isCompleted && !isActive && 'bg-muted text-muted-foreground border border-border',
                )}
              >
                {isCompleted ? <Check size={16} /> : stepNum}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium transition-colors duration-300 whitespace-nowrap',
                  isSkipped && 'opacity-40',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step 1: Welcome
// ---------------------------------------------------------------------------

interface Step1Props {
  companyName: string;
  industry: Industry | '';
  companySize: CompanySize | '';
  onCompanyNameChange: (v: string) => void;
  onIndustryChange: (v: Industry) => void;
  onCompanySizeChange: (v: CompanySize) => void;
  onContinue: () => void;
}

const StepWelcome: React.FC<Step1Props> = ({
  companyName,
  industry,
  companySize,
  onCompanyNameChange,
  onIndustryChange,
  onCompanySizeChange,
  onContinue,
}) => {
  const [industryOpen, setIndustryOpen] = useState(false);

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl md:text-4xl font-bold gradient-text mb-3">Welcome to Binee</h2>
      <p className="text-muted-foreground text-base mb-8">
        Your AI-powered business command center. Let's get you set up in 2 minutes.
      </p>

      {/* Company Name */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">Company Name</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => onCompanyNameChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          placeholder="Your company name"
        />
      </div>

      {/* Industry Dropdown */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">Industry</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIndustryOpen(!industryOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          >
            <span className={industry ? 'text-foreground' : 'text-muted-foreground'}>
              {industry || 'Select your industry'}
            </span>
            <ChevronDown
              size={16}
              className={cn(
                'text-muted-foreground transition-transform duration-200',
                industryOpen && 'rotate-180',
              )}
            />
          </button>
          {industryOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-card z-50 overflow-hidden animate-scale-in">
              {INDUSTRIES.map((ind) => (
                <div
                  key={ind}
                  onClick={() => {
                    onIndustryChange(ind);
                    setIndustryOpen(false);
                  }}
                  className={cn(
                    'px-4 py-2.5 text-sm cursor-pointer transition-colors',
                    industry === ind
                      ? 'bg-primary/15 text-primary'
                      : 'text-foreground hover:bg-secondary/50',
                  )}
                >
                  {ind}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Company Size */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-foreground mb-2">Company Size</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {COMPANY_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onCompanySizeChange(size)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200',
                companySize === size
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Continue */}
      <button
        onClick={onContinue}
        disabled={!companyName.trim()}
        className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue
        <ArrowRight size={18} />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step 2: Connect Your Tools
// ---------------------------------------------------------------------------

interface Step2Props {
  connectedIds: string[];
  connectingId: string | null;
  onConnect: (id: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

const StepConnectTools: React.FC<Step2Props> = ({
  connectedIds,
  connectingId,
  onConnect,
  onContinue,
  onSkip,
}) => {
  const connectedCount = connectedIds.length;
  const progressPercent = Math.round((connectedCount / INTEGRATIONS.length) * 100);

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-foreground mb-2">Connect your business tools</h2>
      <p className="text-muted-foreground text-base mb-6">
        We recommend starting with at least 2 tools for the best insights.
      </p>

      {/* Connected Count + Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            {connectedCount} of {INTEGRATIONS.length} connected
          </span>
          <span className="text-xs text-muted-foreground">{progressPercent}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {INTEGRATIONS.map((tool) => {
          const isConnected = connectedIds.includes(tool.id);
          const isConnecting = connectingId === tool.id;

          return (
            <div
              key={tool.id}
              className={cn(
                'bg-background border rounded-xl p-4 transition-all duration-300',
                isConnected ? 'border-success/40' : 'border-border hover:border-primary/30',
              )}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold shrink-0',
                    tool.color,
                    tool.textColor,
                  )}
                >
                  {tool.initial}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate">{tool.name}</h4>
                  <p className="text-xs text-muted-foreground">{tool.description}</p>
                </div>
              </div>

              {isConnected ? (
                <div className="flex items-center gap-2 text-success text-sm font-medium">
                  <Check size={16} />
                  Connected
                </div>
              ) : (
                <button
                  onClick={() => onConnect(tool.id)}
                  disabled={isConnecting}
                  className={cn(
                    'w-full py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                    isConnecting
                      ? 'border-border text-muted-foreground cursor-wait'
                      : 'border-primary/30 text-primary hover:bg-primary/10',
                  )}
                >
                  {isConnecting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    'Connect'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onContinue}
          className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 hover:shadow-glow transition-all"
        >
          Continue
          <ArrowRight size={18} />
        </button>
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step 3: Data Mapping
// ---------------------------------------------------------------------------

interface Step3Props {
  connectedIds: string[];
  mappings: Record<string, SourceMapping[]>;
  onMappingChange: (toolId: string, index: number, newBinee: string) => void;
  onContinue: () => void;
}

const StepDataMapping: React.FC<Step3Props> = ({
  connectedIds,
  mappings,
  onMappingChange,
  onContinue,
}) => {
  const [editingCell, setEditingCell] = useState<{ toolId: string; index: number } | null>(null);

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-foreground mb-2">Map your data to Binee</h2>
      <p className="text-muted-foreground text-base mb-8">
        We'll use smart defaults — you can customize later.
      </p>

      <div className="space-y-6 mb-8">
        {connectedIds.map((toolId) => {
          const config = TOOL_MAPPINGS[toolId];
          if (!config) return null;
          const currentMappings = mappings[toolId] || config.mappings;

          return (
            <div key={toolId} className="bg-background/50 rounded-xl border border-border/50 overflow-hidden">
              {/* Tool heading */}
              <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
                <h4 className="text-sm font-semibold text-foreground">{config.label}</h4>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_40px_1fr] gap-3 px-4 py-2.5 border-b border-border/50 text-xs text-muted-foreground uppercase tracking-wide">
                <div>Source Stage</div>
                <div />
                <div>Binee Stage</div>
              </div>

              {/* Rows */}
              {currentMappings.map((m, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_40px_1fr] gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 items-center"
                >
                  <div className="text-sm text-foreground">{m.source}</div>
                  <div className="text-muted-foreground text-center">→</div>
                  <div className="relative">
                    <button
                      onClick={() =>
                        setEditingCell(
                          editingCell?.toolId === toolId && editingCell?.index === idx
                            ? null
                            : { toolId, index: idx },
                        )
                      }
                      className="flex items-center justify-between gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-lg text-primary text-sm font-medium w-full hover:bg-primary/20 transition-colors"
                    >
                      <span className="truncate">{m.binee}</span>
                      <ChevronDown size={14} className="shrink-0" />
                    </button>

                    {editingCell?.toolId === toolId && editingCell?.index === idx && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-card z-50 overflow-hidden animate-scale-in">
                        {config.bineeOptions.map((opt) => (
                          <div
                            key={opt}
                            onClick={() => {
                              onMappingChange(toolId, idx, opt);
                              setEditingCell(null);
                            }}
                            className={cn(
                              'px-3 py-2 text-sm cursor-pointer transition-colors',
                              m.binee === opt
                                ? 'bg-primary/15 text-primary'
                                : 'text-foreground hover:bg-secondary/50',
                            )}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <button
        onClick={onContinue}
        className="w-full gradient-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 hover:shadow-glow transition-all"
      >
        Continue
        <ArrowRight size={18} />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step 4: Dashboard Ready
// ---------------------------------------------------------------------------

interface Step4Props {
  connectedCount: number;
  onGo: () => void;
}

const StepReady: React.FC<Step4Props> = ({ connectedCount, onGo }) => {
  // Estimate of metrics based on connected tools
  const metricsCount = connectedCount * 4;

  const actions = [
    {
      icon: Activity,
      title: 'Explore your business health score',
      description: 'See a real-time snapshot of your company performance.',
    },
    {
      icon: MessageSquare,
      title: 'Ask AI a question',
      description: 'Get instant insights from your connected data.',
    },
    {
      icon: Target,
      title: 'Set your first goal',
      description: 'Track progress toward what matters most.',
    },
  ];

  return (
    <div className="animate-fade-in text-center">
      {/* Celebratory checkmark */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-glow">
          <Check size={40} className="text-white" strokeWidth={3} />
        </div>
      </div>

      <h2 className="text-3xl font-bold text-foreground mb-2">Your command center is set up!</h2>
      <p className="text-muted-foreground text-base mb-8">
        Connected{' '}
        <span className="font-semibold text-foreground">{connectedCount} tool{connectedCount !== 1 ? 's' : ''}</span>
        , syncing{' '}
        <span className="font-semibold text-foreground">{metricsCount} metrics</span>.
      </p>

      {/* Suggested first actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-left">
        {actions.map((action) => (
          <div
            key={action.title}
            className="bg-background border border-border rounded-xl p-5 card-hover cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center mb-3">
              <action.icon size={20} className="text-primary" />
            </div>
            <h4 className="text-sm font-semibold text-foreground mb-1">{action.title}</h4>
            <p className="text-xs text-muted-foreground">{action.description}</p>
          </div>
        ))}
      </div>

      {/* Go to Dashboard */}
      <button
        onClick={onGo}
        className="w-full gradient-primary text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 hover:opacity-90 hover:shadow-glow-lg transition-all"
      >
        Go to Dashboard
        <ArrowRight size={20} />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();

  // Step state (1-indexed)
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 state
  const [companyName, setCompanyName] = useState('Tecknocity');
  const [industry, setIndustry] = useState<Industry | ''>('');
  const [companySize, setCompanySize] = useState<CompanySize | ''>('');

  // Step 2 state
  const [connectedToolIds, setConnectedToolIds] = useState<string[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Step 3 state – mapping overrides keyed by toolId
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, SourceMapping[]>>({});

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleConnectTool = useCallback(
    (id: string) => {
      if (connectedToolIds.includes(id) || connectingId) return;
      setConnectingId(id);
      setTimeout(() => {
        setConnectedToolIds((prev) => [...prev, id]);
        setConnectingId(null);
        // Initialise mapping overrides from defaults
        const config = TOOL_MAPPINGS[id];
        if (config) {
          setMappingOverrides((prev) => ({
            ...prev,
            [id]: [...config.mappings],
          }));
        }
      }, 1500);
    },
    [connectedToolIds, connectingId],
  );

  const handleMappingChange = useCallback(
    (toolId: string, index: number, newBinee: string) => {
      setMappingOverrides((prev) => {
        const current = prev[toolId] ? [...prev[toolId]] : [...(TOOL_MAPPINGS[toolId]?.mappings || [])];
        current[index] = { ...current[index], binee: newBinee };
        return { ...prev, [toolId]: current };
      });
    },
    [],
  );

  const goToStep = useCallback(
    (step: number) => {
      // If advancing from step 2 with no tools, skip step 3
      if (step === 3 && connectedToolIds.length === 0) {
        setCurrentStep(4);
        return;
      }
      setCurrentStep(step);
    },
    [connectedToolIds],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepWelcome
            companyName={companyName}
            industry={industry}
            companySize={companySize}
            onCompanyNameChange={setCompanyName}
            onIndustryChange={setIndustry}
            onCompanySizeChange={setCompanySize}
            onContinue={() => goToStep(2)}
          />
        );
      case 2:
        return (
          <StepConnectTools
            connectedIds={connectedToolIds}
            connectingId={connectingId}
            onConnect={handleConnectTool}
            onContinue={() => goToStep(3)}
            onSkip={() => goToStep(3)}
          />
        );
      case 3:
        return (
          <StepDataMapping
            connectedIds={connectedToolIds}
            mappings={mappingOverrides}
            onMappingChange={handleMappingChange}
            onContinue={() => goToStep(4)}
          />
        );
      case 4:
        return (
          <StepReady
            connectedCount={connectedToolIds.length}
            onGo={() => navigate('/')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
      {/* Progress indicator */}
      <div className="w-full max-w-2xl">
        <ProgressIndicator currentStep={currentStep} connectedToolIds={connectedToolIds} />
      </div>

      {/* Step content card */}
      <div className="w-full max-w-2xl bg-card rounded-2xl border border-border p-8 shadow-card">
        {renderStep()}
      </div>
    </div>
  );
};

export default OnboardingPage;
