// script_core.js

// Hàm phân tích XML hóa đơn điện tử chuẩn TT78
function parseXmlInvoice(xmlContent) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  const getText = (path, parent = xmlDoc) => {
    const node = parent.querySelector(path);
    return node ? node.textContent.trim() : '';
  };

  const getAdditionalInfo = (fieldName) => {
    const ttKhacNode = xmlDoc.querySelector('HDon > DLHDon > NDHDon > TToan > TTKhac');
    if (ttKhacNode) {
      const nodes = ttKhacNode.querySelectorAll('TTin');
      for (const node of nodes) {
        const field = node.querySelector('TTruong');
        if (field && field.textContent.trim() === fieldName) {
          return node.querySelector('DLieu')?.textContent.trim() || '';
        }
      }
    }
    return '';
  };

  const invoiceInfo = {
    title: getText('HDon > DLHDon > TTChung > THDon'),
    template: getText('HDon > DLHDon > TTChung > KHHDon'),
    symbol: getText('HDon > DLHDon > TTChung > KHMSHDon'),
    number: getText('HDon > DLHDon > TTChung > SHDon'),
    date: getText('HDon > DLHDon > TTChung > NLap'),
    paymentMethod: getText('HDon > DLHDon > TTChung > HTTToan'),
    paymentStatus: getAdditionalInfo('Trạng thái thanh toán'),
    amountInWords: getAdditionalInfo('TotalAmountInWordsByENG') || '',
    mccqt: getText('HDon > MCCQT')?.toUpperCase() || ''
  };

  const sellerInfo = {
    name: getText('HDon > DLHDon > NDHDon > NBan > Ten'),
    taxCode: getText('HDon > DLHDon > NDHDon > NBan > MST'),
    address: getText('HDon > DLHDon > NDHDon > NBan > DChi'),
    phone: getText('HDon > DLHDon > NDHDon > NBan > SDThoai'),
    email: getText('HDon > DLHDon > NDHDon > NBan > DCTDTu')
  };

  const buyerInfo = {
    name: getText('HDon > DLHDon > NDHDon > NMua > Ten'),
    taxCode: getText('HDon > DLHDon > NDHDon > NMua > MST'),
    address: getText('HDon > DLHDon > NDHDon > NMua > DChi'),
    customerCode: getText('HDon > DLHDon > NDHDon > NMua > MKHang'),
    idNumber: getText('HDon > DLHDon > NDHDon > NMua > CCCDan')
  };

  const products = [];
  const productNodes = xmlDoc.querySelectorAll('HHDVu');
  let totalManual = 0;

  productNodes.forEach((node, index) => {
    const stt = index + 1;

    const tchat = parseInt(getText('TChat', node) || '1');
    const name = getText('THHDVu', node) || '';
    const code = getText('MaSP', node) || '';
    const unit = getText('DVTinh', node) || '';
    const quantity = parseFloat(getText('SLuong', node) || '0');
    const price = parseFloat(getText('DGia', node) || '0');
    const discount = parseFloat(getText('CKhau', node) || '0');
    const taxRate = parseFloat(getText('ThueSuat', node) || '0');
    const xmlThTien = parseFloat(getText('ThTien', node) || '0');

    let amount = quantity * price;
    if (amount === 0 && xmlThTien !== 0) {
      amount = xmlThTien;
    }

    // ✅ Phân loại: hàng hóa – chiết khấu – khuyến mại
    let category = 'KM';
    const lowerName = name.toLowerCase();
    const isCKText = lowerName.includes('chiết khấu') || lowerName.includes('ck');
    const isChietKhau = (quantity === 0 && tchat === 3 && amount < 0) ||
      (quantity === 0 && tchat === 3 && amount > 0 && isCKText);

    if (quantity === 0 && amount === 0) {
      category = 'KM';
    } else if (isChietKhau) {
      category = 'chiet_khau';
    } else if (quantity > 0 && amount > 0) {
      category = 'hang_hoa';
    }

    if (category === 'chiet_khau' && amount > 0) {
      amount = -Math.abs(amount);
    }

    totalManual += amount;

    products.push({
      stt,
      code,
      name,
      unit,
      quantity: quantity.toString(),
      price: price.toString(),
      discount: discount.toString(),
      amount,
      taxRate: taxRate.toString(),
      category,
      tchat,
      __diff: Math.abs(amount - xmlThTien) >= 1,
      xmlAmount: Math.round(xmlThTien),
      isFree: price === 0
    });
  });

  const ttCKTMai = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TTCKTMai') || '0');
  const tgTThue = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TgTThue') || '0');
  const tgTTTBSo = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TgTTTBSo') || '0');
  const tgTCThue = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TgTCThue') || '0');

  const totals = {
    beforeTax: totalManual,
    tax: Math.round(tgTThue),
    fee: 0,
    discount: Math.round(ttCKTMai),
    total: Math.round(totalManual + tgTThue),
    xmlDeclared: Math.round(tgTTTBSo),
    TgTCThue: Math.round(tgTCThue)
  };

  return { invoiceInfo, sellerInfo, buyerInfo, products, totals };
}