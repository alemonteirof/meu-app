/** Redimensiona (maior lado <= maxDim) e recomprime a imagem em JPEG, devolvendo data URL.
    Usado nos uploads de foto (App.jsx e AtendimentosNovo.jsx) — a data URL depois sobe
    pro Storage no supabaseAdapter (prepararFotos). */
export function compressImageFile(file, maxDim = 480, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error(`"${file.name}" não é uma imagem.`)); return; }
    if (file.size > 25 * 1024 * 1024) { reject(new Error(`"${file.name}" é muito grande (limite 25 MB).`)); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Não foi possível ler a imagem'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
    reader.readAsDataURL(file);
  });
}
