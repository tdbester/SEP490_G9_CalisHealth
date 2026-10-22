import { useLocation } from "react-router-dom";
import "./PlaceholderPage.css";

export default function PlaceholderPage({ title, subtitle }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const muscle = params.get("muscle");
  const skill = params.get("skill");
  const tab = params.get("tab");

  const context = muscle
    ? `Muscle group: ${muscle}`
    : skill
      ? `Skill progression: ${skill}`
      : tab
        ? `Tab: ${tab}`
        : null;

  return (
    <div className="placeholder-page">
      <h1 className="placeholder-title">{title}</h1>
      {subtitle ? <p className="placeholder-subtitle">{subtitle}</p> : null}
      {context ? <p className="placeholder-context">{context}</p> : null}
      <p className="placeholder-note">This screen is under construction.</p>
    </div>
  );
}
