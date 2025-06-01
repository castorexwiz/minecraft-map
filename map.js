const canvas = document.getElementById("mapCanvas");
canvas.width = 800;  // マップ表示範囲(横)
canvas.height = 800; // マップ表示範囲(縦)

const ctx = canvas.getContext("2d");
let offsetX = 0;
let offsetZ = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let customPoint = null;


// 列名の定数マッピング(CSVの列名を変更した時はここを修正)
const COL_LOC_NAME = "location_name";
const COL_X = "posX";
const COL_Z = "posZ";
const COL_COMMENT = "comment";

// HTMLに表示する一覧表の列名をここで設定
const HEADER_MAP = {
  [COL_LOC_NAME]: "場所",
  [COL_X]: "X座標",
  [COL_Z]: "Z座標",
  [COL_COMMENT]: "メモ"
};

// タッチ操作用
let lastTouchDist = null;
let lastTouchMid = null;
let isTouchDragging = false;

function toCanvasX(worldX) {
  return canvas.width / 2 + (worldX + offsetX) * scale; // Xが増えると右(東)
}
function toCanvasZ(worldZ) {
  return canvas.height / 2 + (worldZ + offsetZ) * scale; // Zが増えると下(南)
}

function getGridSpacing() {
  const input = document.getElementById("gridSpacingInput");
  const value = parseInt(input?.value || "200");
  return isNaN(value) ? 200 : value;
}

function getScale() {
  const input = document.getElementById("blockRangeInput");
  const halfRange = parseInt(input?.value || "1000"); // ±ブロック範囲として入力
  const totalRange = halfRange * 2;
  return isNaN(totalRange) || totalRange <= 0
    ? 0.35
    : canvas.width / totalRange;
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let fontSize = window.innerWidth < 820 ? 22 : 14; // PCとスマホのフォント設定
  ctx.font = `${fontSize}px sans-serif`;
const gridSpacing = getGridSpacing();
  const numLines = Math.ceil(50000 / gridSpacing); //最大グリッド配置範囲

  // X方向グリッド線
  for (let i = -numLines; i <= numLines; i++) {
    const worldX = i * gridSpacing;
    const canvasX = toCanvasX(worldX);
    ctx.strokeStyle = "#eee";
    ctx.beginPath();
    ctx.moveTo(canvasX, 0);
    ctx.lineTo(canvasX, canvas.height);
    ctx.stroke();
    ctx.fillStyle = "#888";
    ctx.fillText(worldX.toString(), canvasX + 2, toCanvasZ(0) + 12);
  }

  // Z方向グリッド線
  for (let i = -numLines; i <= numLines; i++) {
    const worldZ = i * gridSpacing;
    const canvasZ = toCanvasZ(worldZ);
    ctx.strokeStyle = "#eee";
    ctx.beginPath();
    ctx.moveTo(0, canvasZ);
    ctx.lineTo(canvas.width, canvasZ);
    ctx.stroke();
    ctx.fillStyle = "#888";
    ctx.fillText(worldZ.toString(), toCanvasX(0) + 4, canvasZ - 4);
  }

  // 中心軸
  const xAxisZ = toCanvasZ(0);
  const zAxisX = toCanvasX(0);
  ctx.strokeStyle = "#888";
  ctx.beginPath();
  ctx.moveTo(0, xAxisZ);
  ctx.lineTo(canvas.width, xAxisZ);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(zAxisX, 0);
  ctx.lineTo(zAxisX, canvas.height);
  ctx.stroke();

  // 軸ラベル(エスケープ済み)
  ctx.fillStyle = "blue";
  ctx.fillText("X\u304C\u5897\u3048\u308B (\u6771) \u2192", canvas.width - 130, toCanvasZ(0) - 10); // Xが増える（東） →
  ctx.fillText("\u2190 X\u304C\u6E1B\u308B (\u897F)", 10, toCanvasZ(0) - 10);                       // ← Xが減る（西）
  ctx.fillText("\u2193 Z\u304C\u5897\u3048\u308B (\u5357)", toCanvasX(0) + 10, canvas.height - 10); // ↓ Zが増える（南）
  ctx.fillText("\u2191 Z\u304C\u6E1B\u308B (\u5317)", toCanvasX(0) + 10, 20);                       // ↑ Zが減る（北）

  // --- 原点が見えてないときの軸ラベル補完(エスケープ済み) ---
  const zeroX = toCanvasX(0);
  const zeroZ = toCanvasZ(0);
  ctx.fillStyle = "blue";

  // X軸（Z=0）が見えない場合 → 上 or 下に表示
  if (zeroZ < 0) {
    ctx.fillText("X\u304C\u5897\u3048\u308B (\u6771) \u2192", canvas.width - 130, 20); // Xが増える（東） →
    ctx.fillText("\u2190 X\u304C\u6E1B\u308B (\u897F)", 10, 20);                       // ← Xが減る（西）
  } else if (zeroZ > canvas.height) {
    ctx.fillText("X\u304C\u5897\u3048\u308B (\u6771) \u2192", canvas.width - 130, canvas.height - 10);
    ctx.fillText("\u2190 X\u304C\u6E1B\u308B (\u897F)", 10, canvas.height - 10);
  }

  // Z軸（X=0）が見えない場合 → 左 or 右に表示
  if (zeroX < 0) {
    ctx.fillText("\u2191 Z\u304C\u6E1B\u308B (\u5317)", 10, 20);                       // ↑ Zが減る（北）
    ctx.fillText("\u2193 Z\u304C\u5897\u3048\u308B (\u5357)", 10, canvas.height - 10); // ↓ Zが増える（南）
  } else if (zeroX > canvas.width) {
    ctx.fillText("\u2191 Z\u304C\u6E1B\u308B (\u5317)", canvas.width - 130, 20);
    ctx.fillText("\u2193 Z\u304C\u5897\u3048\u308B (\u5357)", canvas.width - 130, canvas.height - 10);
  }

  // --- 原点が見えてないときの補助線と数値表示（数字は端に寄せる） ---
  ctx.strokeStyle = "#aaa";
  ctx.fillStyle = "#888";
  ctx.lineWidth = 1;

  // 補助X軸（Z=0）線
  if (zeroZ < 0 || zeroZ > canvas.height) {
    const axisY = (zeroZ < 0) ? 0 : canvas.height - 0; // 上に消えたら上端、下に消えたら下端
    ctx.beginPath();
    ctx.moveTo(0, axisY);
    ctx.lineTo(canvas.width, axisY);
    ctx.stroke();

    for (let i = -numLines; i <= numLines; i++) {
      const worldX = i * gridSpacing;
      const canvasX = toCanvasX(worldX);
      if (canvasX >= 0 && canvasX <= canvas.width) {
        ctx.fillText(worldX.toString(), canvasX + 2, axisY + ((zeroZ < 0) ? 12 : -2));
      }
    }
  }

  // 補助Z軸（X=0）線
  if (zeroX < 0 || zeroX > canvas.width) {
    const axisX = (zeroX < 0) ? 0 : canvas.width - 1; // 左に消えたら左端、右に消えたら右端
    ctx.beginPath();
    ctx.moveTo(axisX, 0);
    ctx.lineTo(axisX, canvas.height);
    ctx.stroke();
  
    for (let i = -numLines; i <= numLines; i++) {
      const worldZ = i * gridSpacing;
      const canvasZ = toCanvasZ(worldZ);
      if (canvasZ >= 0 && canvasZ <= canvas.height) {
        const label = worldZ.toString();
        let textX;
        if (zeroX < 0) {
          // 左端：右に少し余白とって表示
          textX = axisX + 4;
        } else {
          // 右端：左にずらして表示（文字幅×文字数でざっくり補正）
          textX = axisX - ctx.measureText(label).width - 4;
        }
        ctx.fillText(label, textX, canvasZ - 4);
      }
    }
  }

}

function drawPoint(x, z, name) {
  const drawX = toCanvasX(x);
  const drawZ = toCanvasZ(z);
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(drawX, drawZ, 3, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = "black";
  ctx.fillText(`${name} (${x}, ${z})`, drawX + 4, drawZ - 4);
}

function drawCustomPoint(x, z) {
  const drawX = toCanvasX(x);
  const drawZ = toCanvasZ(z);
  ctx.fillStyle = "gold";
  ctx.beginPath();
  ctx.arc(drawX, drawZ, 8, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = "orange";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = "black";
  ctx.fillText(`(${x}, ${z})`, drawX + 10, drawZ);
}

function render(data) {
  drawGrid();
  data.forEach(row => {
    const x = parseInt(row[COL_X]);
    const z = parseInt(row[COL_Z]);
    const name = row[COL_LOC_NAME];
    if (!isNaN(x) && !isNaN(z)) {
      drawPoint(x, z, name);
    }
  });
  if (customPoint) {
    drawCustomPoint(customPoint.x, customPoint.z);
  }
}

function applySettings() {
  scale = getScale();          // ユーザー入力から更新
  offsetX = 0;                 // 中央に戻す
  offsetZ = 0;
  render(globalData);          // そのうえで描画
}

function markCustomPoint() {
  const x = parseInt(document.getElementById("inputX").value);
  const z = parseInt(document.getElementById("inputZ").value);
  if (!isNaN(x) && !isNaN(z)) {
    customPoint = { x, z };
    render(globalData);
  }
}

function displayTable(data) {
  const wrapper = document.createElement("div");
  wrapper.id = "tableContainer";

  const toggleBtn = document.createElement("button");
  toggleBtn.id = "tableToggleBtn";
  toggleBtn.textContent = "▼ 座標リストを表示";
  toggleBtn.addEventListener("click", () => {
    tableWrapper.classList.toggle("open");
    toggleBtn.textContent = tableWrapper.classList.contains("open")
      ? "▲ 座標リストを非表示"
      : "▼ 座標リストを表示";
  });

  const tableWrapper = document.createElement("div");
  tableWrapper.id = "coordTableWrapper";

  const title = document.createElement("h2");
  title.textContent = "座標リスト";
  tableWrapper.appendChild(title);

  const table = document.createElement("table");
  table.border = "1";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  [COL_LOC_NAME, COL_X, COL_Z, COL_COMMENT].forEach(col => {
    const th = document.createElement("th");
    th.textContent = HEADER_MAP[col];
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  data.forEach(row => {
    if (row[COL_LOC_NAME] && row[COL_X] && row[COL_Z]) {
      const tr = document.createElement("tr");
      [row[COL_LOC_NAME], row[COL_X], row[COL_Z], row[COL_COMMENT] || ""].forEach(text => {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
  });
  table.appendChild(tbody);
  tableWrapper.appendChild(table);

  wrapper.appendChild(toggleBtn);
  wrapper.appendChild(tableWrapper);
  document.body.appendChild(wrapper);

  const tableArea = document.getElementById("tableArea");
  tableArea.appendChild(wrapper);
}

// データ読み込み -> マップ描画 -> 表の表示
let globalData = [];

Papa.parse("location_data.csv", {
  download: true,
  header: true,
  complete: function(results) {
    globalData = results.data;
    applySettings();         // ← ここで scale 設定と初回描画
    displayTable(globalData);
  }
});

// --- PC向けマウスイベント ---
canvas.addEventListener("wheel", function(event) {
  event.preventDefault();
  const zoomSpeed = 0.02; // マウスホイールのスピード調整
  const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
  scale = Math.max(0.01, scale + delta);
  render(globalData);
}, { passive: false }); // ページ同時スクロール帽子

canvas.addEventListener("mousedown", function(event) {
  isDragging = true;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
});
canvas.addEventListener("mousemove", function(event) {
  if (isDragging) {
    const dx = event.clientX - lastMouseX;
    const dy = event.clientY - lastMouseY;
    offsetX += dx / scale;
    offsetZ += dy / scale;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    render(globalData);
  }
});
canvas.addEventListener("mouseup", () => isDragging = false);
canvas.addEventListener("mouseleave", () => isDragging = false);

// --- モバイル向けタッチイベント ---
canvas.addEventListener("touchstart", function(e) {
  if (e.touches.length === 1) {
    isTouchDragging = true;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    lastTouchDist = Math.hypot(dx, dy);
    lastTouchMid = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2
    };
  }
}, { passive: false });

canvas.addEventListener("touchmove", function(e) {
  e.preventDefault();
  if (e.touches.length === 1 && isTouchDragging) {
    const dx = e.touches[0].clientX - lastMouseX;
    const dy = e.touches[0].clientY - lastMouseY;
    offsetX += dx / scale;
    offsetZ += dy / scale;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
    render(globalData);
  } else if (e.touches.length === 2 && lastTouchDist) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const newDist = Math.hypot(dx, dy);
    const delta = newDist - lastTouchDist;
    scale = Math.max(0.01, scale + delta * 0.001); // 調整係数
    lastTouchDist = newDist;
    render(globalData);
  }
}, { passive: false });

canvas.addEventListener("touchend", function(e) {
  isTouchDragging = false;
  lastTouchDist = null;
}, { passive: false });
