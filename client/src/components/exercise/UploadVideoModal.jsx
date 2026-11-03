import { useEffect, useRef, useState } from "react";
import Modal from "../Modal";
import "./ExerciseModals.css";

const MAX_BYTES = 500 * 1024 * 1024;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime"];
const ACCEPTED_EXT = /\.(mp4|mov)$/i;

const UploadIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

function formatSize(bytes) {
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const total = Math.round(seconds);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function readDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (value) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done(NaN);
    video.src = url;
  });
}

function validate(file) {
  if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXT.test(file.name)) {
    return `${file.name}: only MP4 or MOV files are supported.`;
  }
  if (file.size > MAX_BYTES) return `${file.name}: larger than 500 MB.`;
  return null;
}

/**
 * Popup chọn video để phân tích bằng MediaPipe Pose.
 * `onAnalyze(files)` nhận mảng File; việc upload / chạy MediaPipe do component cha xử lý.
 */
export default function UploadVideoModal({ initialFiles = [], onAnalyze, onClose }) {
  const inputRef = useRef(null);
  const nextId = useRef(0);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const addFiles = (fileList) => {
    const errors = [];
    const accepted = [];
    [...fileList].forEach((file) => {
      const problem = validate(file);
      if (problem) errors.push(problem);
      else accepted.push({ id: nextId.current++, file, duration: null });
    });
    setError(errors.join(" "));
    if (accepted.length === 0) return;
    setItems((current) => [...current, ...accepted]);
    accepted.forEach((item) => {
      readDuration(item.file).then((duration) => {
        if (!mounted.current) return;
        setItems((current) =>
          current.map((entry) => (entry.id === item.id ? { ...entry, duration } : entry)),
        );
      });
    });
  };

  useEffect(() => {
    if (initialFiles.length > 0) addFiles(initialFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = (id) => setItems((current) => current.filter((item) => item.id !== id));

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  };

  const count = items.length;

  return (
    <Modal title="Upload video" titleIcon={UploadIcon} onClose={onClose} width={560}>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div
        className={`exm-dropzone${dragging ? " exm-dropzone--active" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <svg viewBox="0 0 40 28" aria-hidden="true" className="exm-dropzone-icon">
          <path d="M10 22a7 7 0 0 1-.5-13.98A10 10 0 0 1 29 7a8 8 0 0 1 1 15" />
          <path d="M20 26V14M15 18l5-5 5 5" />
        </svg>
        <p className="exm-dropzone-title">Select video to analyze</p>
        <p className="exm-dropzone-hint">MP4, MOV · max 500 MB</p>
      </div>

      <button type="button" className="mdl-secondary exm-browse-btn" onClick={() => inputRef.current?.click()}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
        </svg>
        Browse file
      </button>

      {error && (
        <p className="exm-error" role="alert">
          {error}
        </p>
      )}

      {count > 0 && (
        <>
          <p className="exm-files-label">Selected ({count})</p>
          <ul className="exm-files">
            {items.map((item) => (
              <li key={item.id} className="exm-file">
                <span className="exm-file-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="6" width="14" height="12" rx="2" />
                    <path d="M17 10l4-2v8l-4-2z" />
                  </svg>
                </span>
                <span className="exm-file-meta">
                  <span className="exm-file-name" title={item.file.name}>
                    {item.file.name}
                  </span>
                  <span className="exm-file-info">
                    {formatDuration(item.duration)} · {formatSize(item.file.size)}
                  </span>
                </span>
                <button
                  type="button"
                  className="exm-file-remove"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => remove(item.id)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        type="button"
        className="mdl-primary"
        disabled={count === 0}
        onClick={() => onAnalyze?.(items.map((item) => item.file))}
      >
        {count > 0 ? `Analyze ${count} video${count > 1 ? "s" : ""}` : "Analyze videos"}
      </button>
    </Modal>
  );
}
