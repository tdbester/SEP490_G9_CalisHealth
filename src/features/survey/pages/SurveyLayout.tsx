import { Outlet } from 'react-router-dom';
import { SurveyProvider } from '../context/SurveyContext';

/**
 * Layout wrapper for all survey steps.
 * Provides SurveyContext so all steps can share collected data.
 * Renders the matched child route via <Outlet />.
 */
export function SurveyLayout() {
  return (
    <SurveyProvider>
      <Outlet />
    </SurveyProvider>
  );
}
