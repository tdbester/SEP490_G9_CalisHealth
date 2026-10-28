const regions = {
  chest: `
    <path d="M143 91 Q160 79 178 87 L176 113 Q158 119 145 108 Z"/>
    <path d="M182 87 Q200 79 217 91 L215 108 Q202 119 184 113 Z"/>
    <path d="M143 83 Q152 75 164 77 L159 91 L144 96 Z"/>
    <path d="M196 77 Q208 75 217 83 L216 96 L201 91 Z"/>
  `,
  back: `
    <path d="M142 87 Q158 77 176 85 L172 120 Q157 128 145 111 Z"/>
    <path d="M184 85 Q202 77 218 87 L215 111 Q203 128 188 120 Z"/>
    <path d="M145 112 Q159 124 176 121 L174 145 L151 141 Z"/>
    <path d="M215 112 Q201 124 184 121 L186 145 L209 141 Z"/>
  `,
  core: `
    <path d="M162 115 Q180 121 198 115 L195 153 Q180 159 165 153 Z"/>
    <path d="M166 157 Q180 161 194 157 L192 174 Q180 178 168 174 Z"/>
  `,
  legs: `
    <path d="M150 148 Q164 153 177 151 L174 194 L155 193 Z"/>
    <path d="M183 151 Q196 153 210 148 L205 193 L186 194 Z"/>
    <path d="M155 198 L174 198 L170 239 L157 239 Z"/>
    <path d="M186 198 L205 198 L203 239 L190 239 Z"/>
  `,
  arms: `
    <path d="M139 82 L151 88 L133 128 L121 123 Z"/>
    <path d="M221 82 L209 88 L227 128 L239 123 Z"/>
    <path d="M121 133 L132 137 L116 169 L105 165 Z"/>
    <path d="M239 133 L228 137 L244 169 L255 165 Z"/>
  `,
};

const fullBody = `${regions.chest}${regions.back}${regions.core}${regions.legs}${regions.arms}`;

function createAnatomyImage(highlights) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 270">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#b9a7e8"/>
          <stop offset="1" stop-color="#7563a8"/>
        </linearGradient>
        <linearGradient id="highlight" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#ff91be"/>
          <stop offset="1" stop-color="#ef4f91"/>
        </linearGradient>
      </defs>
      <g fill="url(#body)" stroke="#d8cff1" stroke-width="2" stroke-linejoin="round">
        <circle cx="180" cy="37" r="20"/>
        <path d="M169 59 L191 59 L196 72 Q215 72 224 87 L214 146 Q203 154 197 154 L202 184 L205 241 L188 241 L180 181 L172 241 L155 241 L158 184 L163 154 Q157 154 146 146 L136 87 Q145 72 164 72 Z"/>
        <path d="M141 78 Q132 73 125 82 L104 132 L116 139 L148 102 Z"/>
        <path d="M219 78 Q228 73 235 82 L256 132 L244 139 L212 102 Z"/>
        <path d="M105 132 L116 139 L109 166 L98 163 Z"/>
        <path d="M255 132 L244 139 L251 166 L262 163 Z"/>
      </g>
      <g fill="url(#highlight)" stroke="#ffd0e3" stroke-width="1" opacity=".96">
        ${highlights}
      </g>
      <text x="180" y="263" text-anchor="middle" fill="#c4b5fd" font-family="Arial, sans-serif" font-size="12">Target muscle groups</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const anatomyImages = {
  chest: createAnatomyImage(regions.chest),
  back: createAnatomyImage(regions.back),
  core: createAnatomyImage(regions.core),
  legs: createAnatomyImage(regions.legs),
  arms: createAnatomyImage(regions.arms),
  fullBody: createAnatomyImage(fullBody),
};

export function getAnatomyImage(muscleGroup) {
  const text = (Array.isArray(muscleGroup) ? muscleGroup.join(" ") : String(muscleGroup || ""))
    .trim()
    .toLowerCase();

  if (/\b(legs?|quads?|quadriceps|glutes?|hamstrings?|calves?|squat)\b/.test(text)) {
    return anatomyImages.legs;
  }
  if (/\b(back|lats?|pull|rhomboids?)\b/.test(text)) {
    return anatomyImages.back;
  }
  if (/\b(core|abs?|abdominals?|obliques?)\b/.test(text)) {
    return anatomyImages.core;
  }
  if (/\b(arms?|biceps?|triceps?|forearms?)\b/.test(text)) {
    return anatomyImages.arms;
  }
  if (/\b(chest|pectorals?|push|shoulders?)\b/.test(text)) {
    return anatomyImages.chest;
  }
  return anatomyImages.fullBody;
}
