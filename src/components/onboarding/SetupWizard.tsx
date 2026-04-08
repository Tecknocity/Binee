'use client';

import { useState } from 'react';
import { Check, PartyPopper, AlertTriangle, RefreshCw, Link2, BarChart3, MessageSquare, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSetup } from '@/hooks/useSetup';
import type { SetupStep } from '@/hooks/useSetup';
import { ClickUpConnectStep } from './ClickUpConnectStep';
import { WorkspaceAnalysis } from './WorkspaceAnalysis';
import { BusinessProfileForm } from './BusinessProfileForm';
import { BusinessChatStep } from './BusinessChatStep';
import { StructurePreview } from './StructurePreview';
import { ExecutionProgress } from './ExecutionProgress';
import { ManualStepsGuide } from './ManualStepsGuide';

const STEPS = [
  { label: 'Connect', number: 0 },
  { label: 'Analyze', number: 1 },
  { label: 'Describe', number: 2 },
  { label: 'Review', number: 3 },
  { label: 'Build', number: 4 },
  { label: 'Finish', number: 5 },
] as const;

// Labels for the redo buttons per step
const REDO_LABELS: Record<number, { label: string; icon: typeof RefreshCw }> = {
  0: { label: 'Choose Another Workspace', icon: Link2 },
  1: { label: 'Re-analyze Workspace', icon: BarChart3 },
  2: { label: 'Restart Discussion', icon: MessageSquare },
  3: { label: 'Regenerate Structure', icon: RefreshCw },
};

export default function SetupWizard() {
  const setup = useSetup();
  const router = useRouter();
  const [confirmDialog, setConfirmDialog] = useState<{
    targetStep: number;
    type: 'navigate' | 'redo';
  } | null>(null);

  // Determine if a step has been completed (has data)
  const isStepCompleted = (step: number): boolean => {
    switch (step) {
      case 0: return setup.clickUpConnected;
      case 1: return !!setup.workspaceAnalysis;
      case 2: return setup.profileFormCompleted && setup.chatMessages.length > 1;
      case 3: return !!setup.proposedPlan;
      case 4: return !!setup.executionResult;
      case 5: return !!setup.executionResult;
      default: return false;
    }
  };

  // Can we navigate to this step? (must be within furthest reached step)
  const canNavigateToStep = (step: number): boolean => {
    if (step === setup.currentStep) return false; // Already here
    if (step > setup.furthestStep) return false; // Can't go beyond furthest reached
    // Can navigate to any completed step within range
    return isStepCompleted(step);
  };

  // Handle step circle click
  const handleStepClick = (step: number) => {
    if (!canNavigateToStep(step)) return;
    // Just navigate to view the completed stage, no data clearing
    setup.navigateToStep(step as SetupStep);
  };

  // Handle redo button click - this requires confirmation
  const handleRedoClick = (step: number) => {
    setConfirmDialog({ targetStep: step, type: 'redo' });
  };

  // Confirm the redo action
  const confirmRedo = () => {
    if (!confirmDialog) return;
    if (confirmDialog.targetStep === 0) {
      // Step 0 redo: trigger OAuth flow to connect a different workspace
      setConfirmDialog(null);
      setup.handleClickUpConnect();
    } else {
      setup.resetStage(confirmDialog.targetStep as SetupStep);
      setConfirmDialog(null);
    }
  };

  // Get the warning message for the confirmation dialog
  const getWarningMessage = (step: number): string => {
    const stepsAfter = STEPS.filter((s) => s.number > step).map((s) => s.label);
    if (stepsAfter.length === 0) return 'This action cannot be undone.';
    return `This will reset your progress for ${stepsAfter.join(', ')}. You will need to redo ${stepsAfter.length === 1 ? 'this step' : 'these steps'}.`;
  };

  // Check if current step is being viewed (not the furthest step reached)
  const isViewingPastStep = setup.currentStep < setup.furthestStep;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 px-4 pt-8 pb-6 shrink-0">
        {STEPS.map((step, i) => {
          const isActive = setup.currentStep === step.number;
          const isDone = isStepCompleted(step.number);
          const navigable = canNavigateToStep(step.number);
          return (
            <div key={step.label} className="flex items-center">
              {i > 0 && (
                <div
                  className={`w-8 sm:w-16 lg:w-24 h-0.5 transition-colors ${isDone ? 'bg-accent' : 'bg-border'}`}
                />
              )}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => handleStepClick(step.number)}
                  disabled={!navigable}
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-base font-semibold border-2 transition-all ${
                    isDone && !isActive
                      ? `bg-accent border-accent text-white ${navigable ? 'cursor-pointer hover:ring-4 hover:ring-accent/20' : ''}`
                      : isActive
                        ? 'bg-accent border-accent text-white ring-4 ring-accent/20'
                        : 'bg-surface border-border text-text-muted'
                  } ${navigable ? '' : 'cursor-default'}`}
                >
                  {isDone && !isActive ? <Check className="w-5 h-5" /> : step.number + 1}
                </button>
                <span
                  className={`text-xs sm:text-sm font-medium transition-colors ${
                    isActive ? 'text-accent' : isDone ? 'text-text-primary' : 'text-text-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Viewing past step banner + redo button (also shows redo on current completed step) */}
      {(isViewingPastStep || (isStepCompleted(setup.currentStep) && !!REDO_LABELS[setup.currentStep])) && setup.currentStep <= 4 && (
        <div className="flex items-center justify-between px-4 pb-3 max-w-3xl mx-auto w-full shrink-0">
          {isViewingPastStep ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Eye className="w-4 h-4 text-text-muted" />
              <span>Viewing completed step. You can continue from where you left off.</span>
            </div>
          ) : <div />}
          {REDO_LABELS[setup.currentStep] && (
            <button
              onClick={() => handleRedoClick(setup.currentStep)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warning border border-warning/30 rounded-lg
                hover:bg-warning/10 transition-colors"
            >
              {(() => { const Icon = REDO_LABELS[setup.currentStep].icon; return <Icon className="w-3.5 h-3.5" />; })()}
              {REDO_LABELS[setup.currentStep].label}
            </button>
          )}
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Step 0: Connect ClickUp */}
        {setup.currentStep === 0 && (
          <ClickUpConnectStep
            connected={setup.clickUpConnected}
            loading={setup.clickUpLoading}
            onConnect={setup.handleClickUpConnect}
            onRefresh={setup.refreshClickUpStatus}
            onContinue={setup.continueFromConnect}
            teamName={setup.clickUpTeamName}
            isRevisit={setup.furthestStep > 0}
            isRefreshing={setup.isRefreshingClickUp}
          />
        )}

        {/* Step 1: Workspace Analysis */}
        {setup.currentStep === 1 && (
          <WorkspaceAnalysis
            isAnalyzing={setup.isAnalyzing}
            analysisSummary={setup.workspaceAnalysis}
            counts={setup.workspaceCounts}
            findings={setup.workspaceFindings}
            recommendations={setup.workspaceRecommendations}
            onContinue={setup.continueFromAnalysis}
          />
        )}

        {/* Step 2: Business Profile Form (before chat) */}
        {setup.currentStep === 2 && !setup.profileFormCompleted && (
          <BusinessProfileForm
            onSubmit={setup.submitProfileForm}
            isSubmitting={setup.isSending}
            initialData={setup.profileFormData}
          />
        )}

        {/* Step 2: Business Chat (after form completed) */}
        {setup.currentStep === 2 && setup.profileFormCompleted && (
          <BusinessChatStep
            messages={setup.chatMessages}
            isSending={setup.isSending}
            messageCount={setup.chatMessages.filter((m) => m.role === 'user').length}
            profileFormData={setup.profileFormData}
            onSendMessage={setup.sendMessage}
            onSelectTemplate={setup.selectTemplate}
            onEditProfile={setup.editProfile}
          />
        )}

        {/* Step 3: Editable Structure Preview */}
        {setup.currentStep === 3 && setup.proposedPlan && (
          <StructurePreview
            plan={setup.proposedPlan}
            onApprove={setup.approvePlan}
            onEdit={() => setup.requestChanges('I want to make changes to the proposed structure.')}
            onReject={setup.restartSetup}
            onPlanChange={setup.updatePlan}
            existingStructure={setup.existingStructure}
          />
        )}

        {/* Step 3: Loading state when plan is being generated */}
        {setup.currentStep === 3 && !setup.proposedPlan && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {setup.isSending ? (
              <>
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-text-secondary">Generating your workspace structure...</p>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary">
                  No workspace structure available. Please go back and describe your business.
                </p>
                <button
                  onClick={setup.restartSetup}
                  className="text-sm text-accent hover:text-accent-hover transition-colors"
                >
                  Go Back
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 4: Build / Execution Progress */}
        {setup.currentStep === 4 && (
          <ExecutionProgress
            progress={setup.executionProgress}
            result={setup.executionResult}
            plan={setup.proposedPlan}
            executionItems={setup.executionItems}
            isExecuting={setup.isExecuting}
            onRetry={setup.retryFailedItems}
            onContinue={() => setup.navigateToStep(5 as SetupStep)}
          />
        )}

        {/* Step 5: Manual Steps or Completion */}
        {setup.currentStep === 5 && setup.manualSteps.length > 0 && (
          <ManualStepsGuide
            steps={setup.manualSteps}
            onMarkComplete={setup.markStepComplete}
            onFinish={() => router.push('/chat')}
          />
        )}

        {/* Step 5: No manual steps - show completion */}
        {setup.currentStep === 5 && setup.manualSteps.length === 0 && (
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-6">
              <PartyPopper className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-2xl font-semibold text-text-primary mb-3">
              Workspace Ready!
            </h2>
            <p className="text-text-secondary mb-8">
              Your ClickUp workspace has been set up. You can now start chatting
              with Binee to manage your tasks and projects.
            </p>
            <button
              onClick={() => router.push('/chat')}
              className="px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl font-medium transition-colors"
            >
              Start Chatting
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Reset progress?
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  {getWarningMessage(confirmDialog.targetStep)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg
                  hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRedo}
                className="px-4 py-2 text-sm font-medium text-white bg-warning rounded-lg
                  hover:bg-warning/90 transition-colors"
              >
                Yes, reset and redo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
