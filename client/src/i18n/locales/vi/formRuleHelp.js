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
  title: "Ngưỡng chấm form (AI)",
  caption: "Góc và dung sai để AI chấm form khi thành viên tập bài này.",
  exampleLabel: "Ví dụ",
  usedForReps: "Dùng cho: bài đếm lần (REPS).",
  usedForHold: "Dùng cho: bài giữ tư thế (HOLD).",
  categoryNoticeReps:
    "Bài đếm lần dùng góc trên và góc đáy. Còn góc nhỏ nhất / góc lớn nhất dùng cho bài giữ tư thế.",
  categoryNoticeHold:
    "Bài giữ tư thế dùng góc nhỏ nhất và góc lớn nhất. Còn góc trên / góc đáy dùng cho bài đếm lần.",
  fields: {
    joint: {
      label: "Khớp",
      help: "Khớp cơ thể mà camera theo dõi khi thành viên tập. Chọn khớp quan trọng nhất với đặc điểm của bài này, để AI chấm đúng thứ cần chấm.",
      example:
        "Với bài Squat, chọn KNEE. Lúc đó AI đo độ sâu gối xuống bao nhiêu và có bị lệch vào trong không.",
    },
    topAngle: {
      label: "Góc trên (độ)",
      help: "Góc của khớp khi thành viên ở vị trí trên cùng, đã duỗi thẳng hết. AI coi đây là vị trí bắt đầu của mỗi lần.",
      example:
        "Góc 165 nghĩa là gối phải duỗi thẳng tới khoảng 165 độ trước khi AI bắt đầu đếm một lần mới.",
    },
    bottomAngle: {
      label: "Góc đáy (độ)",
      help: "Góc của khớp tại vị trí thấp nhất. Một lần chỉ được tính là sạch khi khớp thật sự đi đủ tới đáy sâu này.",
      example:
        "Góc 90 nghĩa là gối phải xuống tới 90 độ trở xuống. Đặt 70 để yêu cầu nhắp sâu hơn nữa.",
    },
    minAngle: {
      label: "Góc nhỏ nhất (độ)",
      help: "Góc nhỏ nhất của dải góc được coi là tư thế đúng. Khi giữ tư thế, AI đo góc thân và so sánh với giá trị này.",
      example:
        "Góc 165 nghĩa là thân phải giữ ở 165 độ trở lên. Số nhỏ hơn thì yêu cầu chặt hơn.",
    },
    maxAngle: {
      label: "Góc lớn nhất (độ)",
      help: "Góc lớn nhất của dải góc được coi là tư thế đúng. Nó đi cùng với góc nhỏ nhất để tạo thành dải góc chấp nhận được.",
      example:
        "Dải 165 đến 180 nghĩa là thân được nghiêng từ thẳng tới hơi cong nhẹ và vẫn tính là giữ tốt.",
    },
    weight: {
      label: "Trọng số (0-1)",
      help: "Khớp này đóng góp bao nhiêu vào điểm cuối cùng của một lần so với các khớp khác bạn đã khai. Nhập từ 0 đến 1.",
      example:
        "Hai rule với trọng số 0.60 và 0.25 nghĩa là khớp đầu chiếm 60 phần trăm điểm, khớp sau chiếm 25 phần trăm.",
    },
    tolerance: {
      label: "Dung sai (độ)",
      help: "Góc đo được phân lệch tối đa bao nhiêu thì mới bị coi là sai. Dung sai rộng thì chấp hơn.",
      example:
        "Dung sai 15 nghĩa là khớp được lệch tối đa 7.5 độ vẫn điểm tuyệt đối. Đặt 5 để chấm rất khổe.",
    },
  },
};
