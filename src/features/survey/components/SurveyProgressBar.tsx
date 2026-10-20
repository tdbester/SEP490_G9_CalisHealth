interface SurveyProgressBarProps {
  /** 1-based current step (1–4) */
  currentStep: number;
  totalSteps?: number;
}

/**
 * Horizontal 4-segment progress bar for the survey flow.
 * Active segments are purple-gradient; inactive segments are dim.
 */
export function SurveyProgressBar({ currentStep, totalSteps = 4 }: SurveyProgressBarProps) {
  return (
    <div className="w-full">
      {/* Step label */}
      <p className="text-right text-xs text-gray-400 mb-2 select-none">
        Step {currentStep} of {totalSteps}
      </p>

      {/* Segment bars */}
      <div className="flex gap-1.5 sm:gap-2">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isActive = step <= currentStep;
          return (
            <div
              key={step}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                isActive
                  ? 'bg-gradient-to-r from-[#9333ea] to-[#7c3aed]'
                  : 'bg-[#2d294d]'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
