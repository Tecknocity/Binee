'use client';

import { Check, PartyPopper } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSetup } from '@/hooks/useSetup';
import { ClickUpConnectStep } from './ClickUpConnectStep';
import { BusinessChatStep } from './BusinessChatStep';
import { StructurePreview } from './StructurePreview';
import { ExecutionProgress } from './ExecutionProgress';

const STEPS = [
  { label: 'Connect', number: 0 },
  { label: 'Describe', number: 1 },
  { label: 'Review', number: 2 },
  { label: 'Build', number: 3 },
  { label: 'Finish', number: 4 },
] as const;

export default function SetupWizard() {
  const setup = useSetup();
  const router = useRouter();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 pt-8 pb-6">
        {STEPS.map((step, i) => {
          const isActive = setup.currentStep === step.number;
          const isDone = setup.currentStep > step.number;
          return (
            <div key={step.label} className="flex items-center">
              {i > 0 && (
                <div
                  className={`w-16 h-0.5 ${isDone ? 'bg-accent' : 'bg-border'}`}
                />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                    isDone
                      ? 'bg-accent border-accent text-white'
                      : isActive
                        ? 'bg-accent border-accent text-white'
                        : 'bg-surface border-border text-text-secondary'
                  }`}
                >
                  {isDone ? <Check className="w-5 h-5" /> : step.number + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
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
      <div className="flex-1 px-4 pb-8">
        {setup.currentStep === 0 && (
          <ClickUpConnectStep
            connected={setup.clickUpConnected}
            loading={setup.clickUpLoading}
            onConnect={setup.handleClickUpConnect}
            onRefresh={setup.refreshClickUpStatus}
          />
        )}

        {setup.currentStep === 1 && (
          <BusinessChatStep
            messages={setup.chatMessages}
            isSending={setup.isSending}
            messageCount={setup.chatMessages.filter((m) => m.role === 'user').length}
            businessProfile={setup.businessProfile}
            onSendMessage={setup.sendMessage}
            onSelectTemplate={setup.selectTemplate}
          />
        )}

        {setup.currentStep === 2 && setup.proposedPlan && (
          <StructurePreview
            plan={setup.proposedPlan}
            onApprove={setup.approvePlan}
            onEdit={() => setup.requestChanges('I want to make changes to the proposed structure.')}
            onReject={setup.restartSetup}
          />
        )}

        {setup.currentStep === 3 && (
          <ExecutionProgress
            progress={setup.executionProgress}
            result={setup.executionResult}
            plan={setup.proposedPlan}
          />
        )}

        {setup.currentStep === 4 && (
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
