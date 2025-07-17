// script_func.js

// 📌 Biến toàn cục
let hkdData = {};
let hkdOrder = [];
let currentTaxCode = null;
let tonkhoEditing = { taxCode: '', type: '', index: -1 };
let exportInventoryData = [];

// 📥 Xử lý khi người dùng chọn file ZIP
async function handleFiles() {
  const input = document.getElementById("zipFile");
  const files = Array.from(input.files);

  for (const file of files) {
    if (!file.name.endsWith('.zip')) continue;

    const invoice = await extractInvoiceFromZip(file);
    const taxCode = invoice?.buyerInfo?.taxCode?.trim() || 'UNKNOWN';
    const mccqt = (invoice.invoiceInfo?.mccqt || '').toUpperCase();

    // Check MCCQT trùng
    const exists = (hkdData[taxCode]?.invoices || []).some(inv => (inv.invoiceInfo?.mccqt || '') === mccqt);
    if (exists) {
      toast(`⚠️ Bỏ qua MCCQT trùng: ${mccqt}`, 3000);
      continue;
    }

    // Khởi tạo dữ liệu nếu lần đầu
    if (!hkdData[taxCode]) {
      hkdData[taxCode] = { tonkhoMain: [], tonkhoCK: [], tonkhoKM: [], invoices: [] };
      hkdOrder.push(taxCode);
    }

    // Lưu hóa đơn
    hkdData[taxCode].invoices.push(invoice);

    // Đưa sản phẩm vào kho đúng loại
    invoice.products.forEach(p => {
      const entry = JSON.parse(JSON.stringify(p));
      const arr = entry.category === 'hang_hoa' ? 'tonkhoMain' :
                  entry.category === 'KM' ? 'tonkhoKM' : 'tonkhoCK';
      hkdData[taxCode][arr].push(entry);
    });

    logAction(`Đã nhập hóa đơn ${invoice.invoiceInfo.number}`, JSON.parse(JSON.stringify(hkdData)));
  }

  renderHKDList();
  toast('✅ Đã nhập xong hóa đơn', 2000);
}

// 📤 Đọc file zip, trích XML
async function extractInvoiceFromZip(zipFile) {
  const zip = await JSZip.loadAsync(zipFile);
  const xmlFile = Object.values(zip.files).find(f => f.name.endsWith('.xml'));
  if (!xmlFile) throw new Error("Không tìm thấy file XML trong ZIP");
  const xmlContent = await xmlFile.async('text');
  const invoice = parseXmlInvoice(xmlContent);
  invoice._taxCode = invoice?.buyerInfo?.taxCode?.trim() || 'UNKNOWN';
  return invoice;
}

// 📊 Hiển thị danh sách MST đã nhập
function renderHKDList() {
  const ul = document.getElementById('businessList');
  ul.innerHTML = '';
  hkdOrder.forEach(tax => {
    const li = document.createElement('li');
    li.textContent = tax;
    li.onclick = () => renderHKDTab(tax);
    ul.appendChild(li);
  });
}

// 📁 Hiển thị giao diện của 1 MST
function renderHKDTab(taxCode) {
  const hkd = hkdData[taxCode];
  currentTaxCode = taxCode;

  const totalHang = hkd.tonkhoMain.reduce((s, i) => s + (i.amount || 0), 0);
  const totalCK = hkd.tonkhoCK.reduce((s, i) => s + (i.amount || 0), 0);
  const totalAmountMain = totalHang - Math.abs(totalCK); // chuẩn kế toán

  mainContent.innerHTML = `
    <div>
      <div class="tabs">
        <div class="tab active" onclick="openTab(event, '${taxCode}-tonkho')">📦 Tồn kho</div>
      </div>

      <div id="${taxCode}-tonkho" class="tab-content active">
        <h4>📦 Danh sách tồn kho</h4>
        <div>
          <button onclick="openExportPopup('${taxCode}')">📤 Xuất Excel tồn kho</button>
          <button onclick="renderTonKhoTab('${taxCode}', 'main')">📦 Hàng hóa</button>
          <button onclick="renderTonKhoTab('${taxCode}', 'km')">🎁 KM</button>
          <button onclick="renderTonKhoTab('${taxCode}', 'ck')">🔻 CK</button>
        </div>
        <div style="margin-top:10px">
          <b>Tổng hàng:</b> <span id="total-tonkho-main">${totalAmountMain.toLocaleString()} đ</span> |
          <b>KM:</b> <span id="total-tonkho-km">...</span> |
          <b>CK:</b> <span id="total-tonkho-ck">...</span>
        </div>
        <div id="tonKho-main"></div>
        <div id="tonKho-km" style="display:none"></div>
        <div id="tonKho-ck" style="display:none"></div>
      </div>
    </div>`;
  
  renderTonKhoTab(taxCode, 'main');
}

// 🧩 Tab chuyển đổi
function openTab(e, tabId) {
  document.querySelectorAll(".tab").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));

  e.target.classList.add("active");
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add("active");
}