'use client';

import { Check, PartyPopper, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSetup } from '@/hooks/useSetup';
import { useWorkspace } from '@/hooks/useWorkspace';
import type { SetupStep } from '@/hooks/useSetup';
import { ClickUpConnectStep } from './ClickUpConnectStep';
import { WorkspaceAnalysis } from './WorkspaceAnalysis';
import { BusinessProfileForm } from './BusinessProfileForm';
import { BusinessChatStep } from './BusinessChatStep';
import { StructurePreview } from './StructurePreview';
import { GeneratingWorkspace } from './GeneratingWorkspace';
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

export default function SetupWizard() {
  const setup = useSetup();
  const router = useRouter();
  const { workspace } = useWorkspace();

  // Build ClickUp workspace URL from team ID
  const clickUpUrl = workspace?.clickup_team_id
    ? `https://app.clickup.com/${workspace.clickup_team_id}`
    : null;

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
    // Can navigate to any previously visited step
    return true;
  };

  // Handle step circle click
  const handleStepClick = (step: number) => {
    if (!canNavigateToStep(step)) return;
    // Just navigate to view the completed stage, no data clearing
    setup.navigateToStep(step as SetupStep);
  };

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
            hasProgress={setup.furthestStep > 0}
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
            onReanalyze={() => setup.resetStage(1 as SetupStep)}
          />
        )}

        {/* Step 2: Business Profile Form (before chat) */}
        {setup.currentStep === 2 && !setup.profileFormCompleted && (
          <BusinessProfileForm
            onSubmit={setup.submitProfileForm}
            isSubmitting={false}
            initialData={setup.profileFormData}
          />
        )}

        {/* Step 2: Business Chat (after form completed) */}
        {setup.currentStep === 2 && setup.profileFormCompleted && (
          <BusinessChatStep
            messages={setup.chatMessages}
            isSending={setup.isSending}
            messageCount={setup.chatMessages.filter((m) => m.role === 'user').length}
            onSendMessage={setup.sendMessage}
            onEditProfile={setup.editProfile}
            pendingImageAttachments={setup.pendingImageAttachments}
            onConsumePendingImages={setup.clearPendingImageAttachments}
            clarifierAsk={setup.lastClarifierAsk}
            clarifierBrief={setup.lastClarifierBrief}
            isReadyForGenerate={setup.isReadyForGenerate}
          />
        )}

        {/* Step 3: Generating takes priority so a stale plan from a prior
            round never flashes while a new one is being built. */}
        {setup.currentStep === 3 && setup.isGenerating && (
          <GeneratingWorkspace />
        )}

        {/* Step 3: Editable Structure Preview */}
        {setup.currentStep === 3 && !setup.isGenerating && setup.proposedPlan && (
          <StructurePreview
            plan={setup.proposedPlan}
            onApprove={setup.approvePlan}
            onEdit={() => setup.navigateToStep(2 as SetupStep)}
            onPlanChange={setup.updatePlan}
            existingStructure={setup.existingStructure}
            planTier={workspace?.clickup_plan_tier ?? undefined}
            itemsToDelete={setup.itemsToDelete}
            existingItemsNotInPlan={setup.existingItemsNotInPlan}
            isLoadingRecommendations={setup.isLoadingRecommendations}
            onApproveWithDeletions={setup.confirmDeletionsAndBuild}
            onApproveSkipDeletions={setup.skipDeletionsAndBuild}
            draftSaveState={setup.draftSaveState}
          />
        )}

        {/* Step 3: Empty state when neither generating nor have a plan */}
        {setup.currentStep === 3 && !setup.isGenerating && !setup.proposedPlan && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-sm text-text-secondary">
              No workspace structure available. Please go back and describe your business.
            </p>
            <button
              onClick={setup.restartSetup}
              className="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              Go Back
            </button>
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
            buildStartedAt={setup.buildStartedAt}
            buildEstimatedCompletionAt={setup.buildEstimatedCompletionAt}
            buildEtaMinutes={setup.buildEtaMinutes}
            buildStatus={setup.buildStatus}
            enrichmentJobs={setup.enrichmentJobs}
            enrichmentSummary={setup.enrichmentSummary}
            onRetryEnrichmentJob={setup.retryEnrichmentJob}
            onRetryAllFailedEnrichment={setup.retryAllFailedEnrichment}
          />
        )}

        {/* Step 5: Manual Steps or Completion */}
        {setup.currentStep === 5 && setup.manualSteps.length > 0 && (
          <ManualStepsGuide
            steps={setup.manualSteps}
            onMarkComplete={setup.markStepComplete}
            onFinish={() => router.push('/chat')}
            clickUpUrl={clickUpUrl}
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
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push('/chat')}
                className="px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl font-medium transition-colors"
              >
                Start Chatting
              </button>
              {clickUpUrl && (
                <a
                  href={clickUpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-3 border border-border text-text-secondary rounded-xl font-medium
                    hover:bg-surface-hover transition-colors"
                >
                  Open ClickUp
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
