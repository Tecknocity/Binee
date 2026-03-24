'use client';

import { Check } from 'lucide-react';

export interface OnboardingStepConfig {
  label: string;
  number: number;
}

interface OnboardingStepProps {
  steps: OnboardingStepConfig[];
  currentStep: number;
}

export function OnboardingStepIndicator({ steps, currentStep }: OnboardingStepProps) {
  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-md mx-auto">
      {steps.map((step, i) => {
        const isActive = currentStep === step.number;
        const isDone = currentStep > step.number;

        return (
          <div key={step.number} className="flex items-center flex-1 last:flex-none">
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

            {i < steps.length - 1 && (
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
  );
}
