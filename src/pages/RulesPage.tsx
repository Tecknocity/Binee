import React, { useState, useMemo, useCallback } from 'react';
import {
  Shield, Search, Plus, Pencil, RotateCcw, Bell, BellOff, X,
  ArrowUpDown, ChevronDown, Sparkles, Check, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Modal } from '@/components/Dashboard/modals/Modal';
import {
  mockRules,
  CATEGORY_CONFIG,
  SEVERITY_CONFIG,
  type Rule,
  type RuleCategory,
  type RuleSeverity,
} from '@/data/mock/rules';

type FilterCategory = 'all' | RuleCategory;
type SortField = 'severity' | 'category' | 'status' | 'source';

const SEVERITY_ORDER: Record<RuleSeverity, number> = { critical: 0, warning: 1, info: 2 };
const STATUS_ORDER: Record<string, number> = { triggered: 0, monitoring: 1, disabled: 2 };

const FILTER_TABS: { key: FilterCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'operations', label: 'Operations' },
  { key: 'financial_health', label: 'Financial' },
  { key: 'customer', label: 'Customer' },
  { key: 'cross_tool', label: 'Cross-tool' },
];

// --- Threshold Edit Modal ---
const ThresholdModal: React.FC<{
  rule: Rule | null;
  onClose: () => void;
  onSave: (ruleId: string, newThreshold: number) => void;
  onReset: (ruleId: string) => void;
}> = ({ rule, onClose, onSave, onReset }) => {
  const [value, setValue] = useState('');

  React.useEffect(() => {
    if (rule) setValue(String(rule.threshold));
  }, [rule]);

  if (!rule) return null;

  const isModified = rule.threshold !== rule.defaultThreshold;
  const numValue = parseFloat(value);
  const isValid = !isNaN(numValue) && numValue >= 0;

  return (
    <Modal isOpen={!!rule} onClose={onClose} title="Edit Threshold" width="440px">
      <div className="space-y-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">{rule.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Threshold</label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32"
              min={0}
              step={rule.unit === '%' ? 1 : 0.1}
            />
            <span className="text-sm text-muted-foreground">{rule.unit}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Binee default: {rule.defaultThreshold} {rule.unit}
          </p>
        </div>

        {isModified && (
          <button
            onClick={() => {
              onReset(rule.id);
              setValue(String(rule.defaultThreshold));
            }}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <RotateCcw size={12} />
            Reset to default
          </button>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => { if (isValid) { onSave(rule.id, numValue); onClose(); } }}
            disabled={!isValid}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// --- Create Rule Panel ---
const CreateRulePanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rule: Rule) => void;
}> = ({ isOpen, onClose, onConfirm }) => {
  const [input, setInput] = useState('');
  const [showResponse, setShowResponse] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = () => {
    if (input.trim().length > 0) {
      setShowResponse(true);
    }
  };

  const handleConfirm = () => {
    const newRule: Rule = {
      id: `r-custom-${Date.now()}`,
      name: 'Enterprise Deal Cycle Alert',
      category: 'revenue',
      severity: 'warning',
      description: 'Alert when enterprise deals take longer than 45 days',
      metric: 'enterprise_deal_cycle',
      operator: 'greater_than',
      threshold: 45,
      defaultThreshold: 45,
      unit: 'days',
      window: 'current',
      isActive: true,
      notify: true,
      source: 'custom',
      status: 'monitoring',
      suggestedActions: ['Review enterprise pipeline', 'Check for stalled deals', 'Optimize sales process'],
    };
    onConfirm(newRule);
    setConfirmed(true);
    setTimeout(() => {
      setInput('');
      setShowResponse(false);
      setConfirmed(false);
      onClose();
    }, 1200);
  };

  const handleClose = () => {
    setInput('');
    setShowResponse(false);
    setConfirmed(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-lg bg-card border-l border-border shadow-2xl animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Create Custom Rule</h2>
              <p className="text-xs text-muted-foreground">Describe what you want to track</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">What would you like to track?</label>
            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); setShowResponse(false); setConfirmed(false); }}
              placeholder="e.g., Alert me when enterprise deals take longer than 45 days"
              className="w-full h-28 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <Button onClick={handleSubmit} disabled={!input.trim()} className="w-full">
              <Sparkles size={16} className="mr-2" />
              Generate Rule
            </Button>
          </div>

          {showResponse && !confirmed && (
            <div className="glass rounded-xl p-5 space-y-4 animate-fade-in">
              <p className="text-sm text-foreground font-medium">I'll create this rule:</p>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Metric:</span>
                  <span className="text-foreground">Average deal cycle (Enterprise segment)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Trigger:</span>
                  <span className="text-foreground">When it exceeds 45 days</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Severity:</span>
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', SEVERITY_CONFIG.warning.bgClass, SEVERITY_CONFIG.warning.textClass)}>
                    Warning
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Does this look right?</p>
              <div className="flex gap-2">
                <Button onClick={handleConfirm} size="sm">
                  <Check size={14} className="mr-1" /> Confirm
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowResponse(false)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
              </div>
            </div>
          )}

          {confirmed && (
            <div className="glass rounded-xl p-5 text-center animate-scale-in">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-3">
                <Check size={24} className="text-success" />
              </div>
              <p className="text-foreground font-medium">Rule created successfully!</p>
              <p className="text-sm text-muted-foreground mt-1">Your custom rule is now active.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Rule Card ---
const RuleCard: React.FC<{
  rule: Rule;
  onToggleActive: (id: string) => void;
  onToggleNotify: (id: string) => void;
  onEditThreshold: (rule: Rule) => void;
}> = ({ rule, onToggleActive, onToggleNotify, onEditThreshold }) => {
  const catConfig = CATEGORY_CONFIG[rule.category];
  const sevConfig = SEVERITY_CONFIG[rule.severity];
  const isTriggered = rule.status === 'triggered';
  const isDisabled = rule.status === 'disabled';

  return (
    <div
      className={cn(
        'glass rounded-xl p-4 transition-all duration-200',
        isTriggered && 'border-destructive/40 ring-1 ring-destructive/20',
        isDisabled && 'opacity-55',
        !isDisabled && !isTriggered && 'hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      {/* Top row: toggle, name, badges */}
      <div className="flex items-start gap-3">
        <Switch
          checked={rule.isActive}
          onCheckedChange={() => onToggleActive(rule.id)}
          className="mt-0.5 flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{rule.name}</span>
            {rule.source === 'custom' && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-primary/15 text-primary border border-primary/30">
                Custom
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{rule.description}</p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isTriggered && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-destructive/15 text-destructive border border-destructive/30">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              Triggered
            </span>
          )}
          {rule.status === 'monitoring' && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-success/15 text-success border border-success/30">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Monitoring
            </span>
          )}
          {isDisabled && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
              Disabled
            </span>
          )}
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border', catConfig.bgClass, catConfig.textClass, `border-current/30`)}>
          {catConfig.label}
        </span>
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border', sevConfig.bgClass, sevConfig.textClass, `border-current/30`)}>
          {rule.severity === 'critical' && <AlertTriangle size={10} className="mr-1" />}
          {sevConfig.label}
        </span>
      </div>

      {/* Threshold + Notify row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEditThreshold(rule)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono bg-muted/50 hover:bg-muted text-foreground transition-colors group"
          >
            <span>{rule.threshold} {rule.unit}</span>
            <Pencil size={11} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
          {rule.threshold !== rule.defaultThreshold && (
            <span className="text-[10px] text-muted-foreground">
              Default: {rule.defaultThreshold} {rule.unit}
            </span>
          )}
        </div>

        <button
          onClick={() => onToggleNotify(rule.id)}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors',
            rule.notify
              ? 'text-primary bg-primary/10 hover:bg-primary/15'
              : 'text-muted-foreground bg-muted/30 hover:bg-muted/50'
          )}
          title={rule.notify ? 'Notifications on' : 'Notifications off'}
        >
          {rule.notify ? <Bell size={12} /> : <BellOff size={12} />}
          <span className="hidden sm:inline">{rule.notify ? 'On' : 'Off'}</span>
        </button>
      </div>
    </div>
  );
};

// --- Main Page ---
const RulesPage: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>(mockRules);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Stats
  const totalRules = rules.length;
  const activeCount = rules.filter((r) => r.isActive).length;
  const customCount = rules.filter((r) => r.source === 'custom').length;
  const triggeredCount = rules.filter((r) => r.status === 'triggered').length;

  // Filter & sort
  const filteredRules = useMemo(() => {
    let result = rules;

    if (activeFilter !== 'all') {
      result = result.filter((r) => r.category === activeFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortField) {
        case 'severity':
          return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        case 'category':
          return a.category.localeCompare(b.category);
        case 'status':
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        case 'source':
          return a.source.localeCompare(b.source);
        default:
          return 0;
      }
    });

    return result;
  }, [rules, activeFilter, search, sortField]);

  const handleToggleActive = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              isActive: !r.isActive,
              status: r.isActive ? 'disabled' : (r.status === 'disabled' ? 'monitoring' : r.status),
            }
          : r,
      ),
    );
  }, []);

  const handleToggleNotify = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, notify: !r.notify } : r)),
    );
  }, []);

  const handleSaveThreshold = useCallback((ruleId: string, newThreshold: number) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, threshold: newThreshold } : r)),
    );
  }, []);

  const handleResetThreshold = useCallback((ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, threshold: r.defaultThreshold } : r)),
    );
  }, []);

  const handleAddCustomRule = useCallback((rule: Rule) => {
    setRules((prev) => [...prev, rule]);
  }, []);

  // Keep editingRule in sync with latest rules state
  const currentEditingRule = editingRule ? rules.find((r) => r.id === editingRule.id) ?? null : null;

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Shield size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Business Rules</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure how Binee evaluates and monitors your business
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus size={16} />
          <span className="hidden sm:inline">Create Rule</span>
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="glass border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Shield size={18} className="text-primary" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{totalRules}</div>
              <div className="text-xs text-muted-foreground">Total Rules</div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center">
              <Check size={18} className="text-success" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{activeCount}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/15 flex items-center justify-center">
              <AlertTriangle size={18} className="text-destructive" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{triggeredCount}</div>
              <div className="text-xs text-muted-foreground">Triggered</div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-info/15 flex items-center justify-center">
              <Sparkles size={18} className="text-info" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{customCount}</div>
              <div className="text-xs text-muted-foreground">Custom</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        {/* Category tabs */}
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                activeFilter === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rules..."
              className="pl-8 h-9 w-full sm:w-52 text-xs"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <ArrowUpDown size={13} />
              <span className="hidden sm:inline">Sort</span>
              <ChevronDown size={12} />
            </button>
            {sortMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSortMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl py-1 w-40 animate-scale-in">
                  {([
                    { key: 'severity', label: 'Severity' },
                    { key: 'category', label: 'Category' },
                    { key: 'status', label: 'Status' },
                    { key: 'source', label: 'Source' },
                  ] as { key: SortField; label: string }[]).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortField(opt.key); setSortMenuOpen(false); }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs transition-colors',
                        sortField === opt.key
                          ? 'text-primary bg-primary/10 font-medium'
                          : 'text-foreground hover:bg-muted/50',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rules grid */}
      {filteredRules.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Shield size={40} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-foreground font-medium">No rules found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? 'Try adjusting your search term' : 'No rules match the selected filter'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggleActive={handleToggleActive}
              onToggleNotify={handleToggleNotify}
              onEditThreshold={setEditingRule}
            />
          ))}
        </div>
      )}

      {/* Threshold edit modal */}
      <ThresholdModal
        rule={currentEditingRule}
        onClose={() => setEditingRule(null)}
        onSave={handleSaveThreshold}
        onReset={handleResetThreshold}
      />

      {/* Create rule panel */}
      <CreateRulePanel
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onConfirm={handleAddCustomRule}
      />
    </div>
  );
};

export default RulesPage;
