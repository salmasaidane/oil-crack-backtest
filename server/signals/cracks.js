/** 1-1-1 product crack vs WTI: $/gal × 42 − crude $/bbl */
function productCrack(productGal, wtiBbl) {
  return productGal * 42 - wtiBbl;
}

module.exports = { productCrack };
