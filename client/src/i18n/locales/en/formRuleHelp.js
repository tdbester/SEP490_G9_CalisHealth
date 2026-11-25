/**
 * Giải thích các field của phần "ngưỡng chấm form" (AI Pose Tracking).
 *
 * Dùng chung cho cả Content Manager (`FormRuleEditor`) và Member
 * (`MemberFormRuleSection`), nên tách thành namespace riêng thay vì nhân bản
 * nội dung ở `contentManager` và `member`.
 *
 * Mỗi field có 3 phần:
 *   - `label`   : nhãn hiển thị cạnh ô nhập.
 *   - `help`    : giải thích chi tiết field dùng để làm gì.
 *   - `example` : ví dụ số thực tế, giúp người tạo hình dung được ngay.
 */
export default {
  title: "AI form thresholds",
  caption: "Angles and tolerance used to score the member's form on this exercise.",
  exampleLabel: "Example",
  usedForReps: "Applies to: rep-count exercises (REPS).",
  usedForHold: "Applies to: hold exercises (HOLD).",
  categoryNoticeReps:
    "Counted reps use the top and bottom angle. The min/max angle fields apply to hold exercises.",
  categoryNoticeHold:
    "Hold exercises use the min and max angle. The top/bottom angle fields apply to counted reps.",
  fields: {
    joint: {
      label: "Joint",
      help: "The body joint the camera watches while the member exercises. Choose the joint that matters most for this movement, so the AI scores the right thing.",
      example:
        "For a squat, choose KNEE. The AI then measures how deep the knees bend and whether they drift inward.",
    },
    topAngle: {
      label: "Top angle (deg)",
      help: "The joint angle when the member is at the top of the movement, fully extended. The AI treats this as the starting position of every rep.",
      example:
        "A squat of 165 means the knee must straighten to about 165 degrees before the AI starts counting a new repetition.",
    },
    bottomAngle: {
      label: "Bottom angle (deg)",
      help: "The joint angle at the lowest point of the movement. A rep only counts as clean when the joint actually reaches this depth.",
      example:
        "A squat of 90 means the knee must bend down to 90 degrees or less. Set 70 to demand a much deeper squat.",
    },
    minAngle: {
      label: "Min angle (deg)",
      help: "The lowest angle of the range that counts as the correct position. While holding the exercise, the AI measures the body angle and compares it against this value.",
      example:
        "A plank of 165 means the body must stay at 165 degrees or straighter. Lower numbers are stricter.",
    },
    maxAngle: {
      label: "Max angle (deg)",
      help: "The highest angle of the range that counts as the correct position. It works together with the minimum angle to form an acceptable band.",
      example:
        "A range of 165 to 180 means the body may lean anywhere between straight and slightly bent, and still counts as a good hold.",
    },
    weight: {
      label: "Weight (0-1)",
      help: "How much this joint contributes to the final score of a repetition, compared with the other joints you declared. Use 0 to 1.",
      example:
        "Two rules with weight 0.60 and 0.25 means the first joint counts for 60 percent of the score and the second for 25 percent.",
    },
    tolerance: {
      label: "Tolerance (deg)",
      help: "How far the measured angle may drift from the target before it is treated as a mistake. A wider tolerance is more forgiving.",
      example:
        "A tolerance of 15 means the joint may be off by up to 7.5 degrees and still score perfectly. Set 5 for very strict scoring.",
    },
  },
};
