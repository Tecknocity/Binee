import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
  Unlink,
  Database,
  Clock,
  User,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Integration } from '@/data/mock/integrations';

type SyncStatus = 'Success' | 'Partial' | 'Failed';

interface SyncHistoryEntry {
  id: string;
  date: string;
  status: SyncStatus;
  recordsSynced: number;
  duration: string;
}

const MOCK_SYNC_HISTORY: SyncHistoryEntry[] = [
  {
    id: 'sh1',
    date: '2026-02-17T07:15:00Z',
    status: 'Success',
    recordsSynced: 342,
    duration: '12s',
  },
  {
    id: 'sh2',
    date: '2026-02-17T06:00:00Z',
    status: 'Success',
    recordsSynced: 289,
    duration: '9s',
  },
  {
    id: 'sh3',
    date: '2026-02-17T04:45:00Z',
    status: 'Partial',
    recordsSynced: 156,
    duration: '18s',
  },
  {
    id: 'sh4',
    date: '2026-02-16T22:30:00Z',
    status: 'Success',
    recordsSynced: 410,
    duration: '14s',
  },
  {
    id: 'sh5',
    date: '2026-02-16T18:15:00Z',
    status: 'Failed',
    recordsSynced: 0,
    duration: '3s',
  },
];

const SYNC_FREQUENCIES = [
  { value: '15min', label: 'Every 15 minutes' },
  { value: '30min', label: 'Every 30 minutes' },
  { value: '1hour', label: 'Every 1 hour' },
  { value: '6hours', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
];

function formatSyncFrequency(freq: string): string {
  const found = SYNC_FREQUENCIES.find((f) => f.value === freq);
  return found ? found.label : freq;
}

const STATUS_CONFIG: Record<SyncStatus, { icon: React.ElementType; className: string }> = {
  Success: { icon: CheckCircle, className: 'status-success' },
  Partial: { icon: AlertTriangle, className: 'status-warning' },
  Failed: { icon: XCircle, className: 'status-danger' },
};

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface IntegrationDetailProps {
  integration: Integration | null;
  onDisconnect: (slug: string) => void;
  onSync: (slug: string) => void;
}

export const IntegrationDetail: React.FC<IntegrationDetailProps> = ({
  integration,
  onDisconnect,
  onSync,
}) => {
  const navigate = useNavigate();
  const [syncFrequency, setSyncFrequency] = useState(
    integration?.syncFrequency || 'Every 15 minutes'
  );
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  if (!integration) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground text-lg">Integration not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/integrations')}
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Integrations
        </Button>
      </div>
    );
  }

  const handleSync = () => {
    setIsSyncing(true);
    onSync(integration.slug);
    setTimeout(() => setIsSyncing(false), 2000);
  };

  const handleDisconnect = () => {
    onDisconnect(integration.slug);
    setShowDisconnectConfirm(false);
    navigate('/integrations');
  };

  // Derive a sync freq value for the select, matching SYNC_FREQUENCIES
  const currentFreqValue =
    SYNC_FREQUENCIES.find(
      (f) => f.label === integration.syncFrequency || f.value === integration.syncFrequency
    )?.value || '15min';

  return (
    <div className="space-y-6">
      {/* Back Button + Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/integrations')}
        >
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">{integration.name}</h1>
          {integration.isConnected ? (
            <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/15">
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-muted text-muted-foreground border border-border">
              Not Connected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing || !integration.isConnected}
          >
            <RefreshCw
              size={14}
              className={isSyncing ? 'animate-spin mr-2' : 'mr-2'}
            />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </div>

      {/* Connected Account Info */}
      {integration.isConnected && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Settings size={18} className="text-muted-foreground" />
            Connection Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account</p>
                <p className="text-sm font-medium text-foreground">
                  {integration.connectedAccount || 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center">
                <Database size={16} className="text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data Points</p>
                <p className="text-sm font-medium text-foreground">
                  {integration.datapointsSynced?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-info/15 flex items-center justify-center">
                <Clock size={16} className="text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Synced</p>
                <p className="text-sm font-medium text-foreground">
                  {integration.lastSyncedAt
                    ? formatDateTime(integration.lastSyncedAt)
                    : 'Never'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
                <RefreshCw size={16} className="text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sync Frequency</p>
                <p className="text-sm font-medium text-foreground">
                  {formatSyncFrequency(integration.syncFrequency)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Settings */}
      {integration.isConnected && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Sync Settings</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Sync Frequency</label>
              <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_FREQUENCIES.map((freq) => (
                    <SelectItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/integrations/${integration.slug}/mapping`)
                }
              >
                <MapPin size={14} className="mr-2" />
                Data Mapping
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sync History */}
      {integration.isConnected && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Sync History</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Records Synced</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_SYNC_HISTORY.map((entry) => {
                  const config = STATUS_CONFIG[entry.status];
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-foreground">
                        {formatDateTime(entry.date)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}
                        >
                          <StatusIcon size={12} />
                          {entry.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {entry.recordsSynced.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.duration}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Disconnect */}
      {integration.isConnected && (
        <div className="bg-card rounded-xl border border-destructive/30 p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Danger Zone
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Disconnecting will stop syncing data from {integration.name}. Your
                historical data in Binee will be preserved.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDisconnectConfirm(true)}
            >
              <Unlink size={14} className="mr-2" />
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Dialog */}
      <Dialog
        open={showDisconnectConfirm}
        onOpenChange={setShowDisconnectConfirm}
      >
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Disconnect {integration.name}?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect {integration.name}? Binee will
              stop syncing data from this integration. Your existing data will
              remain available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDisconnectConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisconnect}>
              <Unlink size={14} className="mr-2" />
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntegrationDetail;
