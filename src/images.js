// Get a picked photo ready to send: shrink big photos (keeps uploads fast on cell data),
// and leave GIFs untouched so they keep animating.
const MAX = 1600

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

export async function prepareImage(file) {
  const previewUrl = URL.createObjectURL(file)
  let img = null
  try { img = await loadImage(previewUrl) } catch { /* format the browser can't show */ }
  const w = img?.naturalWidth || 0
  const h = img?.naturalHeight || 0

  if (file.type === 'image/gif' || !img) {
    const ext = file.type === 'image/gif' ? 'gif' : (file.name.split('.').pop() || 'jpg').toLowerCase()
    return { blob: file, type: file.type || 'image/jpeg', ext, width: w || null, height: h || null, previewUrl }
  }

  const scale = Math.min(1, MAX / Math.max(w, h))
  const cw = Math.round(w * scale), ch = Math.round(h * scale)
  const canvas = document.createElement('canvas')
  canvas.width = cw; canvas.height = ch
  canvas.getContext('2d').drawImage(img, 0, 0, cw, ch)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
  if (!blob || blob.size > file.size && file.type === 'image/jpeg' && scale === 1) {
    return { blob: file, type: file.type, ext: 'jpg', width: w, height: h, previewUrl }
  }
  return { blob, type: 'image/jpeg', ext: 'jpg', width: cw, height: ch, previewUrl: URL.createObjectURL(blob) }
}

export const isGif = (path) => /\.gif$/i.test(path || '')
