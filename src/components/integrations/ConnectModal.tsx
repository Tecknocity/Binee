import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Check, Loader2 } from 'lucide-react';
import type { Integration } from '@/data/mock/integrations';

const CATEGORY_PERMISSIONS: Record<string, string[]> = {
  'CRM & Sales': [
    'Read contacts and company data',
    'Read deals and pipeline stages',
    'Read activity history and notes',
    'Read custom properties and fields',
  ],
  'Finance & Payments': [
    'Read transactions and payment history',
    'Read subscription and billing data',
    'Read invoice and expense records',
    'Read revenue and financial reports',
  ],
  'Project Management': [
    'Read tasks, projects, and workspaces',
    'Read team member assignments',
    'Read sprint and milestone data',
    'Read time tracking entries',
  ],
  Communication: [
    'Read message metadata and timestamps',
    'Read channel and thread information',
    'Read calendar events and schedules',
    'Read contact and participant data',
  ],
};

interface ConnectModalProps {
  integration: Integration | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (slug: string) => void;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  integration,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const permissions = integration
    ? CATEGORY_PERMISSIONS[integration.category] || []
    : [];

  const handleConnect = () => {
    if (!integration) return;

    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setIsComplete(true);
      onConfirm(integration.slug);
      setTimeout(() => {
        setIsComplete(false);
        onClose();
      }, 1000);
    }, 2000);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isConnecting) {
      setIsComplete(false);
      onClose();
    }
  };

  if (!integration) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            Connect {integration.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {integration.description}
          </DialogDescription>
        </DialogHeader>

        {/* Data Access Section */}
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield size={16} className="text-primary" />
            <span className="font-medium">Binee will access the following data:</span>
          </div>

          <div className="space-y-2.5">
            {permissions.map((permission, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 text-sm text-foreground"
              >
                <div className="w-5 h-5 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                  <Check size={12} className="text-success" />
                </div>
                <span>{permission}</span>
              </div>
            ))}
          </div>

          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10"
          >
            Read-only access
          </Badge>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isConnecting}
          >
            Cancel
          </Button>
          <Button
            className="gradient-primary text-white hover:opacity-90"
            onClick={handleConnect}
            disabled={isConnecting || isComplete}
          >
            {isComplete ? (
              <>
                <Check size={16} className="mr-2" />
                Connected
              </>
            ) : isConnecting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>Connect with {integration.name}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectModal;
