import { useNavigate } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import "./BackButton.css";

/** Nút quay lại dạng viên thuốc, vd. "Back to health overview". */
export default function BackButton({ to, children }) {
  const navigate = useNavigate();

  return (
    <button type="button" className="back-btn" onClick={() => navigate(to)}>
      <ArrowBackRoundedIcon />
      {children}
    </button>
  );
}
