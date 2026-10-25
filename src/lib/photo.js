// Turn a picked file into a JPEG for the AI and a small thumbnail to store.

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
}

function drawScaled(img, max) {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// Same photo → same fingerprint, so it gets the same answer.
function fingerprint(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + str.length.toString(36);
}

export async function preparePhoto(file) {
  const { img, url } = await loadImage(file);
  const big = drawScaled(img, 1280);
  const jpeg = big.toDataURL("image/jpeg", 0.85);
  const thumb = drawScaled(img, 480).toDataURL("image/jpeg", 0.72);
  return { previewUrl: url, base64: jpeg.split(",")[1], thumb, hash: fingerprint(thumb), bytes: Math.round(jpeg.length * 0.75) };
}
