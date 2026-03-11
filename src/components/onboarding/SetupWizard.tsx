'use client';

import { Check } from 'lucide-react';
import { useSetup } from '@/hooks/useSetup';
import { ClickUpConnectStep } from './ClickUpConnectStep';
import { BusinessChatStep } from './BusinessChatStep';
import { StructurePreview } from './StructurePreview';
import { ExecutionProgress } from './ExecutionProgress';
import { ManualStepsGuide } from './ManualStepsGuide';
import { SetupComplete } from './SetupComplete';

const STEPS = [
  { label: 'Connect', number: 0 },
  { label: 'Describe', number: 1 },
  { label: 'Review', number: 2 },
  { label: 'Build', number: 3 },
  { label: 'Finish', number: 4 },
] as const;

export default function SetupWizard() {
  const setup = useSetup();

  const allManualDone =
    setup.manualSteps.length > 0 && setup.manualSteps.every((s) => s.completed);

  const showComplete = setup.currentStep === 4 && allManualDone;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Step indicator */}
      <div className="w-full max-w-3xl mx-auto px-6 pt-8 pb-4">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => {
            const isActive = setup.currentStep === step.number;
            const isDone = setup.currentStep > step.number;

            return (
              <div key={step.number} className="flex items-center flex-1 last:flex-none">
                {/* Circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold
                      transition-all duration-300
                      ${isDone ? 'bg-accent text-white' : ''}
                      ${isActive ? 'bg-accent text-white ring-4 ring-accent/20' : ''}
                      ${!isActive && !isDone ? 'bg-surface border border-border text-text-muted' : ''}
                    `}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : step.number + 1}
                  </div>
                  <span
                    className={`mt-1.5 text-xs font-medium ${
                      isActive ? 'text-accent' : isDone ? 'text-text-secondary' : 'text-text-muted'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-3 mb-5">
                    <div
                      className={`h-0.5 rounded-full transition-colors duration-300 ${
                        isDone ? 'bg-accent' : 'bg-border'
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col">
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
            onSendMessage={setup.sendMessage}
            onSelectTemplate={setup.selectTemplate}
          />
        )}

        {setup.currentStep === 2 && setup.proposedPlan && (
          <StructurePreview
            plan={setup.proposedPlan}
            onApprove={setup.approvePlan}
            onRequestChanges={setup.requestChanges}
            onStartOver={setup.restartSetup}
          />
        )}

        {setup.currentStep === 3 && (
          <ExecutionProgress
            progress={setup.executionProgress}
            result={setup.executionResult}
            plan={setup.proposedPlan}
          />
        )}

        {setup.currentStep === 4 && !showComplete && (
          <ManualStepsGuide
            steps={setup.manualSteps}
            executionResult={setup.executionResult}
            onMarkComplete={setup.markStepComplete}
            onDone={setup.goToDashboard}
            onSkipAll={setup.goToDashboard}
          />
        )}

        {showComplete && (
          <SetupComplete
            executionResult={setup.executionResult}
            manualStepsCount={setup.manualSteps.length}
          />
        )}
      </div>
    </div>
  );
}
