import "./BarChart.css";

/**
 * Biểu đồ cột gradient dùng chung (BMI theo tháng, khối lượng tập theo tuần...).
 * data: [{ key, label, sublabel?, value, display?, title? }] — sublabel: dòng chữ nhỏ dưới nhãn (vd. tháng của quý)
 * baseline: giá trị ứng với chiều cao 0 — đặt > 0 khi các giá trị gần nhau (vd. BMI).
 */
export default function BarChart({ data, baseline = 0, height = 120, barWidth = 32, ariaLabel }) {
  const max = Math.max(...data.map((d) => d.value));
  const range = max - baseline || 1;

  return (
    <div className="bar-chart" role="img" aria-label={ariaLabel}>
      {data.map((item) => (
        <div key={item.key ?? item.label} className="bar-chart-col">
          <span className="bar-chart-value">{item.display ?? item.value}</span>
          <div className="bar-chart-track" style={{ height }}>
            <div
              className="bar-chart-bar"
              style={{
                width: barWidth,
                height: `${(Math.max(item.value - baseline, 0) / range) * 100}%`,
              }}
              title={item.title}
            />
          </div>
          <span className="bar-chart-label">
            {item.label}
            {item.sublabel && <small className="bar-chart-sublabel">{item.sublabel}</small>}
          </span>
        </div>
      ))}
    </div>
  );
}
