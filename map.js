const canvas = document.getElementById("mapCanvas");
canvas.width = 800;  // マップ表示範囲(横)
canvas.height = 800; // マップ表示範囲(縦)

const ctx = canvas.getContext("2d");
let offsetX = 0;
let offsetZ = 0;
let scale = 1;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let customPoint = null;


// 列名の定数マッピング(CSVの列名を変更した時はここを修正)
const COL_LOC_NAME = "location_name";
const COL_X = "posX";
const COL_Z = "posZ";
const COL_COMMENT = "comment";
const COL_URL = "url";

// HTMLに表示する一覧表の列名をここで設定
const HEADER_MAP = {
  [COL_LOC_NAME]: "Place/場所",
  [COL_X]: "X",
  [COL_Z]: "Z",
  [COL_COMMENT]: "Memo",
  [COL_URL]: "URL"
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

// 画面サイズに応じたフォントサイズ設定(気持ちばかりのレスポンシブ対応)
function getFontSize() {
  return window.innerWidth < 820 ? 18 : 14;
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height); // キャンバスクリア＆再描画準備
  let fontSize = window.innerWidth < 820 ? 22 : 14; // PCとスマホのフォント設定
  ctx.font = `${getFontSize()}px sans-serif`;       // フォントサイズ取得
  const gridSpacing = getGridSpacing();             // グリッド間隔
  const numLines = Math.ceil(50000 / gridSpacing);  // 最大グリッド配置範囲
  
  // 追加：方角ラベルの固定チェック状態を取得
  const axisToggle = document.getElementById("axisLabelToggle");
  const fixedAxisLabel = axisToggle ? axisToggle.checked : false;

  // X方向グリッド線を描画
  for (let i = -numLines; i <= numLines; i++) {
    const worldX = i * gridSpacing;
    const canvasX = toCanvasX(worldX);
    ctx.strokeStyle = "#eee";
    ctx.beginPath();
    ctx.moveTo(canvasX, 0);
    ctx.lineTo(canvasX, canvas.height);
    ctx.stroke();
    ctx.fillStyle = "#888";    // 座標数値ラベルの色
    ctx.fillText(worldX.toString(), canvasX + 2, toCanvasZ(0) + 12);
  }

  // Z方向グリッド線を描画
  for (let i = -numLines; i <= numLines; i++) {
    const worldZ = i * gridSpacing;
    const canvasZ = toCanvasZ(worldZ);
    ctx.strokeStyle = "#eee";
    ctx.beginPath();
    ctx.moveTo(0, canvasZ);
    ctx.lineTo(canvas.width, canvasZ);
    ctx.stroke();
    ctx.fillStyle = "#888";    // 座標数値ラベルの色
    ctx.fillText(worldZ.toString(), toCanvasX(0) + 4, canvasZ - 4);
  }

  // 中心軸(x=0, z=0)を強調表示
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

  // ===方角ラベルの表示設定(多言語対応)===
  const langSelect = document.getElementById("langSelect");
  const lang = langSelect ? langSelect.value : "ja";
  
  ctx.fillStyle = "blue"; // 方角ラベルの色

  const labels = {
    ja: {
      posX: "X\u304C\u5897\u3048\u308B (\u6771) \u2192",  // Xが増える (東) →
      negX: "\u2190 X\u304C\u6E1B\u308B (\u897F)",        // ← Xが減る (西)
      posZ: "\u2193 Z\u304C\u5897\u3048\u308B (\u5357)",  // ↓ Zが増える (南)
      negZ: "\u2191 Z\u304C\u6E1B\u308B (\u5317)"         // ↑ Zが減る (北)
    },
    en: {
      posX: "positive X (east) \u2192",
      negX: "\u2190 negative X (west)",
      posZ: "\u2193 positive Z (south)",
      negZ: "\u2191 negative Z (north)"
    }
  };
  const label = labels[lang] || labels.ja;

  if (fixedAxisLabel) {
	// --- マップ四辺中央に方角ラベルを固定表示 ---
    ctx.fillText(label.posX, canvas.width - 130, canvas.height / 2 - 10);
    ctx.fillText(label.negX, 10, canvas.height / 2 - 10);
    ctx.fillText(label.posZ, canvas.width / 2 - 40, canvas.height - 10);
    ctx.fillText(label.negZ, canvas.width / 2 - 40, 20);
  } else {
	// --- 原点(0,0)に追従して方角ラベルを表示 ---
    ctx.fillText(label.posX, canvas.width - 130, toCanvasZ(0) - 10);
    ctx.fillText(label.negX, 10, toCanvasZ(0) - 10);
    ctx.fillText(label.posZ, toCanvasX(0) + 10, canvas.height - 10);
    ctx.fillText(label.negZ, toCanvasX(0) + 10, 20);
  }

  // 原点が画面外にある場合の補完（固定ONのときは非表示）
  const zeroX = toCanvasX(0);
  const zeroZ = toCanvasZ(0);
  
  // fixedAxisLabel(固定ON)のときは非表示
  if (!fixedAxisLabel) {
    ctx.fillStyle = "blue";
    
    // X軸(z=0)が画面外 → 上辺または下辺に方角ラベルを残す（←Xが減る / →Xが増える）
    if (zeroZ < 0) {
      ctx.fillText(label.posX, canvas.width - 130, 20);
      ctx.fillText(label.negX, 10, 20);
    } else if (zeroZ > canvas.height) {
      ctx.fillText(label.posX, canvas.width - 130, canvas.height - 10);
      ctx.fillText(label.negX, 10, canvas.height - 10);
    }

    // Z軸(x=0)が画面外 → 左辺または右辺に方角ラベルを残す（↑Zが減る / ↓Zが増える）
    if (zeroX < 0) {
      ctx.fillText(label.negZ, 10, 20);
      ctx.fillText(label.posZ, 10, canvas.height - 10);
    } else if (zeroX > canvas.width) {
      ctx.fillText(label.negZ, canvas.width - 130, 20);
      ctx.fillText(label.posZ, canvas.width - 130, canvas.height - 10);
    }
  }
  // ===方角ラベルの表示設定ここまで===
  
  // ===補助線と軸ラベル(数値メモリ)の表示設定(常に表示)===
  ctx.strokeStyle = "#aaa";
  ctx.fillStyle = "#888";
  ctx.lineWidth = 1;
  
  // 補助X軸（Z=0）が画面外 → 上端 or 下端に補助線とX座標の目盛りを表示
  if (zeroZ < 0 || zeroZ > canvas.height) {
    const axisY = (zeroZ < 0) ? 0 : canvas.height - 0;
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
  
  // 補助Z軸（X=0）が画面外 → 左端 or 右端に補助線とZ座標の目盛りを表示
  if (zeroX < 0 || zeroX > canvas.width) {
    const axisX = (zeroX < 0) ? 0 : canvas.width - 1;
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
          textX = axisX + 4;
        } else {
          textX = axisX - ctx.measureText(label).width - 4;
        }
        ctx.fillText(label, textX, canvasZ - 4);
      }
    }
  }
  // ===補助線と軸ラベル(数値メモリ)の表示設定ここまで===
  
  // 太陽アイコン表示
  const sunToggle = document.getElementById("sunIconToggle");
  const showSunIcon = sunToggle ? sunToggle.checked : false;
  
  if (showSunIcon) {
    // ☀と↖↙ を描画
    const originalFont = ctx.font;
    ctx.font = `${getFontSize() + 6}px sans-serif`;
    ctx.fillStyle = "red";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  
    const baseY = canvas.height / 2 - 80;
    const baseXRight = canvas.width - 20;
    const baseXLeft = 20;
  
    const offsetY = 20;
    const offsetX = 8;
    const arrowShift = 12;
  
    ctx.fillText("☀", baseXRight + offsetX, baseY + offsetY);
    ctx.fillText("↖", baseXRight - arrowShift, baseY);
  
    ctx.fillText("☀", baseXLeft + 10, baseY);
    ctx.fillText("↙", baseXLeft - offsetX - arrowShift + 10, baseY + offsetY);
  
    ctx.font = originalFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

} // function drawGrid() ここまで

// テーブルの表示行をマップ上で強調
function drawPoint(x, z, name, highlight = false) {
  const drawX = toCanvasX(x);
  const drawZ = toCanvasZ(z);

  const label = `${name} (${x}, ${z})`;

  if (highlight) {
    // 点を赤＋少し大きめに
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(drawX, drawZ, 6, 0, 2 * Math.PI);
    ctx.fill();

    // 背景：四角で色を変える（文字の背後に表示）
    ctx.font = `${getFontSize()}px sans-serif`;  // フォントサイズ取得
    const textWidth = ctx.measureText(label).width;
    const padding = 2;
    ctx.fillStyle = "#FFE36C"; // 背景色
    ctx.fillRect(drawX + 4 - padding, drawZ - 18, textWidth + 2 * padding, 16);

    // 文字（標準フォントでOK）
    ctx.fillStyle = "black";
    ctx.fillText(label, drawX + 4, drawZ - 6);
  } else {
    // 通常：赤い小さな点＋テキスト
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(drawX, drawZ, 3, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "black";
    ctx.fillText(label, drawX + 4, drawZ - 4);
  }
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
  ctx.font = `${getFontSize()}px sans-serif`;  // フォントサイズ取得
  ctx.fillText(`(${x}, ${z})`, drawX + 10, drawZ);
}

function render(data) {
  drawGrid();
  data.forEach(row => {
    const x = parseInt(row[COL_X]);
    const z = parseInt(row[COL_Z]);
    const name = row[COL_LOC_NAME];
    if (!isNaN(x) && !isNaN(z)) {
      drawPoint(x, z, name, row.__highlight);
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
  toggleBtn.textContent = "▼ 座標リスト表示 / Show List";
  toggleBtn.addEventListener("click", () => {
    tableWrapper.classList.toggle("open");
    toggleBtn.textContent = tableWrapper.classList.contains("open")
      ? "▲ 座標リスト(詳細)非表示 / Hide List"
      : "▼ 座標リスト(詳細)表示 / Show List";
  });

  const tableWrapper = document.createElement("div");
  tableWrapper.id = "coordTableWrapper";

  const title = document.createElement("h2");
  title.textContent = "座標リスト(詳細) / Coordinate List";
  tableWrapper.appendChild(title);

  const table = document.createElement("table");
  table.border = "1";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  [COL_LOC_NAME, COL_X, COL_Z, COL_COMMENT, COL_URL].forEach(col => {
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

      // 通常列（文字列として表示）
      [COL_LOC_NAME, COL_X, COL_Z, COL_COMMENT].forEach(col => {
        const td = document.createElement("td");
        td.textContent = row[col] || "";
        tr.appendChild(td);
        
        // 表の行にマウスオーバーで対応するマップ上の地点をハイライト
        tr.addEventListener("mouseover", () => {
          globalData.forEach(r => r.__highlight = false);
          row.__highlight = true;
          render(globalData);
        });
        
        // マウスを話したらハイライト解除
        tr.addEventListener("mouseout", () => {
          row.__highlight = false;
          render(globalData);
        });
        
      });
      
      // URL列の処理
      const urlCell = document.createElement("td");
      const urlValue = (row[COL_URL] || "").trim();
      if (urlValue.includes("||")) {
        // 「ラベル||URL」形式
        const [label, link] = urlValue.split("||");
        const a = document.createElement("a");
        a.href = link.trim();
        a.textContent = label.trim() || link.trim();
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        urlCell.appendChild(a);
      } else if (urlValue.startsWith("http")) {
        // URLのみ
        const a = document.createElement("a");
        a.href = urlValue;
        a.textContent = urlValue;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        urlCell.appendChild(a);
      } else {
        // ラベルのみ or 空欄
        urlCell.textContent = urlValue;
      }
  
      tr.appendChild(urlCell);
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

// 簡易座標リスト（ドロワー側）の表示処理
function displayDrawerTable(data) {
  const drawer = document.getElementById("drawerTable");
  drawer.innerHTML = ""; // 初期化

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.fontSize = "12px";

  // テーブルヘッダーの作成
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  [COL_LOC_NAME, COL_X, COL_Z].forEach(col => {
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

      // 各セルを作成（場所名にはリンク処理を加える）
      [COL_LOC_NAME, COL_X, COL_Z].forEach(col => {
        const td = document.createElement("td");

        if (col === COL_LOC_NAME && row[COL_URL]) {
          const urlValue = row[COL_URL].trim();

          if (urlValue.includes("||")) {
            // 「ラベル||URL」形式 → ラベルとリンクの両方表示
            const [label, link] = urlValue.split("||");
            const a = document.createElement("a");
            a.href = link.trim();
            a.textContent = row[COL_LOC_NAME];
            const comment = row[COL_COMMENT]?.trim();
            a.title = label.trim() + (comment ? " / " + comment : "");
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            td.appendChild(a);
            
          } else if (urlValue.startsWith("http")) {
            // URLのみ → 場所名にリンクを張る
            const a = document.createElement("a");
            a.href = urlValue;
            a.textContent = row[COL_LOC_NAME];
            a.title = urlValue;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            td.appendChild(a);
          } else {
            td.textContent = row[COL_LOC_NAME];
          }
        } else {
          // URLもラベルもない → プレーンテキスト表示
          td.textContent = row[col] || "";
        }
        tr.appendChild(td);
      });
      
      // マウスオーバーでマップ上に強調表示（ハイライト）
      tr.addEventListener("mouseover", () => {
        globalData.forEach(r => r.__highlight = false);
        row.__highlight = true;
        render(globalData);
      });

      // マウスアウトでハイライト解除
      tr.addEventListener("mouseout", () => {
        row.__highlight = false;
        render(globalData);
      });

      tbody.appendChild(tr);
    }
  });

  table.appendChild(tbody);
  drawer.appendChild(table);
}

// マウスカーソルに追従表示（座標または方角円）
const tooltip = document.getElementById("coordTooltip");
const compass = document.getElementById("compassOverlay");

// マウス移動時に表示更新
canvas.addEventListener("mousemove", function(event) {
  if (isDragging) return; // ドラッグ中は座標表示をしない

  const modeSelect = document.getElementById("cursorDisplaySelect");
  const mode = modeSelect?.value || "coord"; // select値（"none", "coord", "compass"）

  // キャンバス内のマウス位置を取得（ページ→キャンバス座標系に変換）
  const rect = canvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasZ = event.clientY - rect.top;
  
  // 座標系の数値をワールド座標に変換（スケール＆オフセット補正）
  const worldX = Math.round((canvasX - canvas.width / 2) / scale - offsetX);
  const worldZ = Math.round((canvasZ - canvas.height / 2) / scale - offsetZ);

  // いったん両方非表示に
  tooltip.style.display = "none";
  compass.style.display = "none";

  // 選択モードに応じて表示切り替え
  if (mode === "coord") {
	// 座標のみ表示
    tooltip.textContent = `(${worldX}, ${worldZ})`;
    tooltip.style.left = `${event.pageX + 12}px`;
    tooltip.style.top = `${event.pageY + 12}px`;
    tooltip.style.display = "block";
    
    } else if (mode === "compass") {
      // 描画された実サイズを取得
      requestAnimationFrame(() => {
        const compassWidth = compass.offsetWidth;
        const compassHeight = compass.offsetHeight;
        
        // pageX/pageY でスクロールにも対応
        compass.style.left = `${event.pageX - compassWidth / 2}px`;
        compass.style.top = `${event.pageY - compassHeight / 2}px`;
        compass.style.display = "block";
      });
    }

});

// マウスがキャンバスから離れたときに非表示にする
canvas.addEventListener("mouseleave", function () {
  tooltip.style.display = "none";
  compass.style.display = "none";
});

// データ読み込み -> マップ描画 -> 表の表示
let globalData = [];

Papa.parse("location_data.csv", {
  download: true,
  header: true,
  complete: function(results) {
    globalData = results.data.map(row => ({ ...row, __highlight: false }));
    applySettings();                 // ここで scale 設定と初回描画
    displayTable(globalData);        // メインの座標リスト詳細
    displayDrawerTable(globalData);  // ドロワーの座標リスト簡易
    
    // ☀表示のトグル変更で再描画
    document.getElementById("sunIconToggle").addEventListener("change", () => {
      render(globalData);
    });
    
  }
});

// --- PC向けマウスイベント ---

// ズーム（マウスホイール）
canvas.addEventListener("wheel", function(event) {
  event.preventDefault();
  const zoomSpeed = 0.02; // マウスホイールのスピード調整
  const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
  scale = Math.max(0.01, scale + delta);
  render(globalData);
}, { passive: false }); // ページ同時スクロール帽子

// ドラッグ開始（マウス押下）
canvas.addEventListener("mousedown", function(event) {
  isDragging = true;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
});

// ドラッグ中（マウス移動）
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

canvas.addEventListener("mousemove", function(event) {
  if (isDragging) {
    // 表示だけ非表示に（ドラッグ処理には影響しない）
    tooltip.style.display = "none";
    compass.style.display = "none";
    return;
  }

  const modeSelect = document.getElementById("cursorDisplaySelect");
  const mode = modeSelect?.value || "coord";

  const rect = canvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasZ = event.clientY - rect.top;
  const worldX = Math.round((canvasX - canvas.width / 2) / scale - offsetX);
  const worldZ = Math.round((canvasZ - canvas.height / 2) / scale - offsetZ);

  tooltip.style.display = "none";
  compass.style.display = "none";

  if (mode === "coord") {
    tooltip.textContent = `(${worldX}, ${worldZ})`;
    tooltip.style.left = `${event.pageX + 12}px`;
    tooltip.style.top = `${event.pageY + 12}px`;
    tooltip.style.display = "block";
  } else if (mode === "compass") {
    const radius = 50;
    compass.style.left = `${event.pageX - radius}px`;
    compass.style.top = `${event.pageY - radius}px`;
    compass.style.display = "block";
  }
});

// ドラッグ終了 or マウス画面外に外れる
canvas.addEventListener("mouseup", () => isDragging = false);
canvas.addEventListener("mouseleave", () => isDragging = false);

// ダブルクリックで座標入力＆マーク表示（常時有効）
canvas.addEventListener("dblclick", function(event) {
  const toggle = document.getElementById("mouseCoordToggle");

  const rect = canvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasZ = event.clientY - rect.top;
  const worldX = Math.round((canvasX - canvas.width / 2) / scale - offsetX);
  const worldZ = Math.round((canvasZ - canvas.height / 2) / scale - offsetZ);

  // 入力欄に反映
  document.getElementById("inputX").value = worldX;
  document.getElementById("inputZ").value = worldZ;

  // マーク表示（既存の markCustomPoint() 呼び出しでもOK）
  customPoint = { x: worldX, z: worldZ };
  render(globalData);
});

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
