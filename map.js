const canvas = document.getElementById("mapCanvas");
canvas.width = 800;  // �}�b�v�\���͈�(��)
canvas.height = 800; // �}�b�v�\���͈�(�c)

const ctx = canvas.getContext("2d");
let scale = 0.35; // �����\�������Bcanvas / scale = �\���u���b�N��(�}�g�[�^��)
let offsetX = 0;
let offsetZ = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let customPoint = null;

// �^�b�`����p
let lastTouchDist = null;
let lastTouchMid = null;
let isTouchDragging = false;

function toCanvasX(worldX) {
  return canvas.width / 2 + (worldX + offsetX) * scale; // X��������ƉE(��)
}
function toCanvasZ(worldZ) {
  return canvas.height / 2 + (worldZ + offsetZ) * scale; // Z��������Ɖ�(��)
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let fontSize = window.innerWidth < 820 ? 22 : 14; // PC�ƃX�}�z�̃t�H���g�ݒ�
  ctx.font = `${fontSize}px sans-serif`;
  const gridSpacing = 500; // �O���b�h�\���Ԋu
  const numLines = Math.ceil(50000 / gridSpacing); //�ő�O���b�h�z�u�͈�

  // X�����O���b�h��
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

  // Z�����O���b�h��
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

  // ���S��
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

  // �����x��(�G�X�P�[�v�ς�)
  ctx.fillStyle = "blue";
  ctx.fillText("X\u304C\u5897\u3048\u308B (\u6771) \u2192", canvas.width - 130, toCanvasZ(0) - 10); // X��������i���j ��
  ctx.fillText("\u2190 X\u304C\u6E1B\u308B (\u897F)", 10, toCanvasZ(0) - 10);                       // �� X������i���j
  ctx.fillText("\u2193 Z\u304C\u5897\u3048\u308B (\u5357)", toCanvasX(0) + 10, canvas.height - 10); // �� Z��������i��j
  ctx.fillText("\u2191 Z\u304C\u6E1B\u308B (\u5317)", toCanvasX(0) + 10, 20);                       // �� Z������i�k�j

  // --- ���_�������ĂȂ��Ƃ��̎����x���⊮(�G�X�P�[�v�ς�) ---
  const zeroX = toCanvasX(0);
  const zeroZ = toCanvasZ(0);
  ctx.fillStyle = "blue";

  // X���iZ=0�j�������Ȃ��ꍇ �� �� or ���ɕ\��
  if (zeroZ < 0) {
    ctx.fillText("X\u304C\u5897\u3048\u308B (\u6771) \u2192", canvas.width - 130, 20); // X��������i���j ��
    ctx.fillText("\u2190 X\u304C\u6E1B\u308B (\u897F)", 10, 20);                       // �� X������i���j
  } else if (zeroZ > canvas.height) {
    ctx.fillText("X\u304C\u5897\u3048\u308B (\u6771) \u2192", canvas.width - 130, canvas.height - 10);
    ctx.fillText("\u2190 X\u304C\u6E1B\u308B (\u897F)", 10, canvas.height - 10);
  }

  // Z���iX=0�j�������Ȃ��ꍇ �� �� or �E�ɕ\��
  if (zeroX < 0) {
    ctx.fillText("\u2191 Z\u304C\u6E1B\u308B (\u5317)", 10, 20);                       // �� Z������i�k�j
    ctx.fillText("\u2193 Z\u304C\u5897\u3048\u308B (\u5357)", 10, canvas.height - 10); // �� Z��������i��j
  } else if (zeroX > canvas.width) {
    ctx.fillText("\u2191 Z\u304C\u6E1B\u308B (\u5317)", canvas.width - 130, 20);
    ctx.fillText("\u2193 Z\u304C\u5897\u3048\u308B (\u5357)", canvas.width - 130, canvas.height - 10);
  }

  // --- ���_�������ĂȂ��Ƃ��̕⏕���Ɛ��l�\���i�����͒[�Ɋ񂹂�j ---
  ctx.strokeStyle = "#aaa";
  ctx.fillStyle = "#888";
  ctx.lineWidth = 1;

  // �⏕X���iZ=0�j��
  if (zeroZ < 0 || zeroZ > canvas.height) {
    const axisY = (zeroZ < 0) ? 0 : canvas.height - 0; // ��ɏ��������[�A���ɏ������牺�[
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

  // �⏕Z���iX=0�j��
  if (zeroX < 0 || zeroX > canvas.width) {
    const axisX = (zeroX < 0) ? 0 : canvas.width - 1; // ���ɏ������獶�[�A�E�ɏ�������E�[
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
          // ���[�F�E�ɏ����]���Ƃ��ĕ\��
          textX = axisX + 4;
        } else {
          // �E�[�F���ɂ��炵�ĕ\���i�������~�������ł�������␳�j
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
  container.innerHTML = "<h2>\u5ea7\u6a19\u30ea\u30b9\u30c8</h2>"; // ���W�ꗗ�\
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

// --- PC�����}�E�X�C�x���g ---
canvas.addEventListener("wheel", function(event) {
  event.preventDefault();
  const zoomSpeed = 0.02; // �}�E�X�z�C�[���̃X�s�[�h����
  const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
  scale = Math.max(0.01, scale + delta);
  render(globalData);
}, { passive: false }); // �y�[�W�����X�N���[���X�q

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

// --- ���o�C�������^�b�`�C�x���g ---
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
    scale = Math.max(0.01, scale + delta * 0.001); // �����W��
    lastTouchDist = newDist;
    render(globalData);
  }
}, { passive: false });

canvas.addEventListener("touchend", function(e) {
  isTouchDragging = false;
  lastTouchDist = null;
}, { passive: false });
