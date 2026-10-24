import { useEffect, useRef } from "react";
import "./ModalShell.css";

/**
 * Khung popup dùng chung: lớp phủ mờ, đóng bằng Esc / bấm ra ngoài, khóa cuộn trang.
 * Nội dung và giao diện hộp thoại do component con quyết định qua `className`.
 * `as="form"` để hộp thoại là một form (onSubmit truyền qua props).
 */
export default function ModalShell({ open, onClose, labelledBy, className = "", as: Tag = "div", children, ...rest }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <Tag
        {...rest}
        ref={dialogRef}
        className={`modal-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </Tag>
    </div>
  );
}
