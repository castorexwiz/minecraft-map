const canvas = document.getElementById("mapCanvas");
canvas.width = 800;
canvas.height = 800;

const ctx = canvas.getContext("2d");
let scale = 0.13; // 初期表示調整。canvas / scale = 表示ブロック数(±トータル)
let offsetX = 0;
let offsetZ = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

let customPoint = null;

function toCanvasX(worldX) {
  return canvas.width / 2 + (worldX + offsetX) * scale; // Xが増えると右(東)
}
function toCanvasZ(worldZ) {
  return canvas.height / 2 + (worldZ + offsetZ) * scale; // Zが増えると下(南)
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "10px sans-serif";
  const gridSpacing = 500; // グリッド表示間隔
  const numLines = Math.ceil(10000 / gridSpacing); // グリッド表示する範囲

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

  // 軸ラベル（エスケープ済み）
  ctx.fillStyle = "blue";
  ctx.fillText("\u2192 X\u304C\u5897\u3048\u308B (\u6771)", canvas.width - 130, toCanvasZ(0) - 10);
  ctx.fillText("\u2190 X\u304C\u6E1B\u308B (\u897F)", 10, toCanvasZ(0) - 10);
  ctx.fillText("\u2193 Z\u304C\u5897\u3048\u308B (\u5357)", toCanvasX(0) + 10, canvas.height - 10);
  ctx.fillText("\u2191 Z\u304C\u6E1B\u308B (\u5317)", toCanvasX(0) + 10, 20);
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
    const x = parseInt(row.x);
    const z = parseInt(row.z);
    const name = row.name;
    if (!isNaN(x) && !isNaN(z)) {
      drawPoint(x, z, name);
    }
  });
  if (customPoint) {
    drawCustomPoint(customPoint.x, customPoint.z);
  }
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
  const table = document.createElement("table");
  table.border = "1";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["name", "x", "z", "note"].forEach(col => {
    const th = document.createElement("th");
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  data.forEach(row => {
    if (row.name && row.x && row.z) {
      const tr = document.createElement("tr");
      [row.name, row.x, row.z, row.note || ""].forEach(text => {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
  });
  table.appendChild(tbody);

  const container = document.createElement("div");
  container.innerHTML = "<h2>\u5ea7\u6a19\u30ea\u30b9\u30c8</h2>"; // 座標リスト
  document.body.appendChild(container);
  document.body.appendChild(table);
}

let globalData = [];
Papa.parse("location_data.csv", {
  download: true,
  header: true,
  complete: function(results) {
    globalData = results.data;
    render(globalData);
    displayTable(globalData);
  }
});

canvas.addEventListener("wheel", function(event) {
  event.preventDefault();
  const zoomSpeed = 0.02; // ホイールスクロールの速度調整
  const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
  scale = Math.max(0.01, scale + delta);
  render(globalData);
}, { passive: false }); // ページスクロール防止

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

canvas.addEventListener("mouseup", function() {
  isDragging = false;
});
canvas.addEventListener("mouseleave", function() {
  isDragging = false;
});
