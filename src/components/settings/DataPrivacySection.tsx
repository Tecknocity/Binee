import React, { useState } from 'react';
import { AlertTriangle, Download, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const DataPrivacySection: React.FC = () => {
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleExportData = () => {
    setExportDialogOpen(false);
    toast.success('Your data export has been initiated. You will receive an email when it is ready.');
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleteDialogOpen(false);
    setDeleteConfirmText('');
    toast.success('Account deletion requested. You will receive a confirmation email.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Data & Privacy</h2>
        <p className="text-sm text-muted-foreground">
          Manage your data, exports, and account deletion
        </p>
      </div>

      {/* Export My Data */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Export My Data</h3>
            <p className="text-sm text-muted-foreground">
              Download a copy of all your data in JSON format. This includes your profile,
              settings, and all business data.
            </p>
          </div>
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-5 py-2.5 gradient-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap">
                <Download size={16} />
                Export Data
              </button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Export Your Data</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  We will compile all your data and send a download link to your email address.
                  This may take a few minutes depending on the amount of data.
                </DialogDescription>
              </DialogHeader>
              <div className="p-4 bg-background rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">
                  The export will include:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    Profile information
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    Account settings and preferences
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    Business data and metrics
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    Integration configurations
                  </li>
                </ul>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <button className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors">
                    Cancel
                  </button>
                </DialogClose>
                <button
                  onClick={handleExportData}
                  className="px-4 py-2 text-sm font-medium gradient-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                >
                  Confirm Export
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Data Retention */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Data Retention</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            We retain your data for as long as your account is active or as needed to provide you
            with our services. Here is a summary of our data retention policies:
          </p>
          <ul className="space-y-2 ml-1">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">Account data:</strong> Retained for the lifetime of
                your account. Deleted within 30 days of account closure.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">Business metrics:</strong> Retained for up to 24
                months of historical data. Older data is archived and aggregated.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">Integration data:</strong> Synced data is refreshed
                on each sync cycle. Previous sync data is overwritten.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">Audit logs:</strong> Retained for 12 months for
                security and compliance purposes.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Delete Account */}
      <div className="bg-card rounded-xl border border-destructive/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-destructive flex items-center gap-2 mb-1">
              <AlertTriangle size={18} />
              Delete Account
            </h3>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and all associated data.
              This action cannot be undone.
            </p>
          </div>
          <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDeleteConfirmText('');
          }}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-5 py-2.5 border border-destructive text-destructive font-medium rounded-lg hover:bg-destructive/10 transition-colors whitespace-nowrap">
                <Trash2 size={16} />
                Delete Account
              </button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle size={20} />
                  Delete Your Account
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  This action is permanent and cannot be undone. All your data, settings,
                  integrations, and business metrics will be permanently deleted.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm text-destructive font-medium">
                    Warning: This will permanently delete:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>- Your profile and account settings</li>
                    <li>- All business data and metrics history</li>
                    <li>- All integration connections</li>
                    <li>- All goals and tracked progress</li>
                  </ul>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Type <span className="font-bold text-destructive">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-destructive/50 outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <button className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors">
                    Cancel
                  </button>
                </DialogClose>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE'}
                  className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Permanently Delete Account
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default DataPrivacySection;
