'use client';

import { Check, PartyPopper } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSetup } from '@/hooks/useSetup';
import { ClickUpConnectStep } from './ClickUpConnectStep';
import { WorkspaceAnalysis } from './WorkspaceAnalysis';
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

export default function SetupWizard() {
  const setup = useSetup();
  const router = useRouter();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 pt-6 pb-4 shrink-0">
        {STEPS.map((step, i) => {
          const isActive = setup.currentStep === step.number;
          const isDone = setup.currentStep > step.number;
          return (
            <div key={step.label} className="flex items-center">
              {i > 0 && (
                <div
                  className={`w-12 h-0.5 ${isDone ? 'bg-accent' : 'bg-border'}`}
                />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                    isDone
                      ? 'bg-accent border-accent text-white'
                      : isActive
                        ? 'bg-accent border-accent text-white'
                        : 'bg-surface border-border text-text-secondary'
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : step.number + 1}
                </div>
                <span
                  className={`text-[10px] font-medium ${
                    isActive || isDone ? 'text-text-primary' : 'text-text-muted'
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

        {/* Step 2: Business Chat */}
        {setup.currentStep === 2 && (
          <BusinessChatStep
            messages={setup.chatMessages}
            isSending={setup.isSending}
            messageCount={setup.chatMessages.filter((m) => m.role === 'user').length}
            businessProfile={setup.businessProfile}
            onSendMessage={setup.sendMessage}
            onSelectTemplate={setup.selectTemplate}
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

        {/* Step 5: No manual steps — show completion */}
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
    </div>
  );
}
