import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Gender } from '../schemas/body.schema';
import type { HealthGoal, Motivation, Skill, TrainPath } from '../schemas/goal.schema';
import type { DaysPerWeek, SessionMinutes, TrainingExperience } from '../schemas/training.schema';

/* ─── Survey data types ─── */
export interface BodyInfo {
  gender: Gender;
  age: number;
  height: number;
  weight: number;
}

export interface GoalsInfo {
  path: TrainPath;
  healthGoal: HealthGoal | '';
  skills: Skill[];
  motivations: Motivation[];
}

export interface TrainingInfo {
  experience: TrainingExperience;
  daysPerWeek: DaysPerWeek;
  sessionMinutes: SessionMinutes;
}

export interface LevelTestInfo {
  pushUp: number;
  squat: number;
  plank: number;
}

export interface SurveyData {
  body?: BodyInfo;
  goals?: GoalsInfo;
  training?: TrainingInfo;
  levelTest?: LevelTestInfo;
}

interface SurveyContextType {
  data: SurveyData;
  setBody: (body: BodyInfo) => void;
  setGoals: (goals: GoalsInfo) => void;
  setTraining: (training: TrainingInfo) => void;
  setLevelTest: (levelTest: LevelTestInfo) => void;
  resetSurvey: () => void;
}

const SurveyContext = createContext<SurveyContextType | null>(null);

export function SurveyProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SurveyData>({});

  const setBody = (body: BodyInfo) => setData((prev) => ({ ...prev, body }));
  const setGoals = (goals: GoalsInfo) => setData((prev) => ({ ...prev, goals }));
  const setTraining = (training: TrainingInfo) => setData((prev) => ({ ...prev, training }));
  const setLevelTest = (levelTest: LevelTestInfo) => setData((prev) => ({ ...prev, levelTest }));
  const resetSurvey = () => setData({});

  return (
    <SurveyContext.Provider
      value={{ data, setBody, setGoals, setTraining, setLevelTest, resetSurvey }}
    >
      {children}
    </SurveyContext.Provider>
  );
}

export function useSurvey() {
  const ctx = useContext(SurveyContext);
  if (!ctx) throw new Error('useSurvey must be used within SurveyProvider');
  return ctx;
}