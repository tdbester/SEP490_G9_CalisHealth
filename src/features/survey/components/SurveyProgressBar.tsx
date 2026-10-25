interface SurveyProgressBarProps {
  /** 1-based current step (1–4) */
  currentStep: number;
  totalSteps?: number;
}

/**
 * Horizontal 4-segment progress bar for the survey flow.
 * Active segments are purple-gradient; inactive segments are dim.
 * The step label sits ABOVE the bar, right-aligned (matches the Figma frame).
 */
export function SurveyProgressBar({ currentStep, totalSteps = 4 }: SurveyProgressBarProps) {
  return (
    <div className="w-full">
      {/* Step label */}
      <p className="text-right text-base font-medium select-none" style={{ color: '#b4a0e5' }}>
        Step {currentStep} of {totalSteps}
      </p>

      {/* Segment bars */}
      <div className="flex gap-2 mt-3 w-full max-w-[494px]">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isActive = step <= currentStep;
          return (
            <div
              key={step}
              className="h-[7px] flex-1 rounded-full transition-all duration-500"
              style={{ background: isActive ? '#a78bfa' : '#33254f' }}
            />
          );
        })}
      </div>
    </div>
  );
}
