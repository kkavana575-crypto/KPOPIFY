
// Compress product images before sending them to Firebase.
// This helps prevent HTTP 413 request-too-large errors.
function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.size) {
      resolve("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Please select a valid image file."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Could not read the selected image."));
    };

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => {
        reject(new Error("Could not process this image. Try another image."));
      };

      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");

          // Resize large images while keeping their proportions.
          const maxDimension = 600;
          const scale = Math.min(
            1,
            maxDimension / Math.max(image.width, image.height)
          );

          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));

          const context = canvas.getContext("2d");

          if (!context) {
            reject(new Error("Your browser could not process this image."));
            return;
          }

          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);

          context.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
          );

          // Reduce image quality until the Base64 data is small.
          let quality = 0.65;
          let compressed = canvas.toDataURL("image/jpeg", quality);

          while (
            compressed.length > 65000 &&
            quality > 0.20
          ) {
            quality -= 0.10;
            compressed = canvas.toDataURL("image/jpeg", quality);
          }

          if (compressed.length > 65000) {
            reject(
              new Error(
                "This image is still too large. Please choose a smaller image."
              )
            );
            return;
          }

          resolve(compressed);
        } catch (error) {
          reject(
            new Error("Image compression failed. Please try another image.")
          );
        }
      };

      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}
