import { createContext, useContext, useState, type ReactNode } from 'react';

/* ─── Survey data types ─── */
export interface BodyInfo {
  height: number;
  weight: number;
}

export interface SurveyData {
  body?: BodyInfo;
  // Future steps will be added here:
  // goal?: GoalInfo;
  // fitnessLevel?: FitnessLevelInfo;
  // schedule?: ScheduleInfo;
}

interface SurveyContextType {
  data: SurveyData;
  setBody: (body: BodyInfo) => void;
  resetSurvey: () => void;
}

const SurveyContext = createContext<SurveyContextType | null>(null);

export function SurveyProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SurveyData>({});

  const setBody = (body: BodyInfo) => setData((prev) => ({ ...prev, body }));
  const resetSurvey = () => setData({});

  return (
    <SurveyContext.Provider value={{ data, setBody, resetSurvey }}>
      {children}
    </SurveyContext.Provider>
  );
}

export function useSurvey() {
  const ctx = useContext(SurveyContext);
  if (!ctx) throw new Error('useSurvey must be used within SurveyProvider');
  return ctx;
}
