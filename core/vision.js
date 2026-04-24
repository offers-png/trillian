let latestFrame = null;
let frameCount = 0;

function setVisionFrame(base64Image) {
  if (!base64Image) return;
  latestFrame = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
  frameCount++;
  console.log('[VISION] Frame ' + frameCount + ' captured (' + (latestFrame.length / 1024).toFixed(1) + ' KB)');
}

function buildVisionMessages(userText) {
  const content = [{ type: "text", text: userText }];
  if (latestFrame) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: latestFrame }
    });
    console.log('[VISION] Sending frame with message to Claude');
  } else {
    console.log('[VISION] No frame available - camera may not be active');
  }
  return content;
}

function clearFrame() { latestFrame = null; }
function hasVision() { return !!latestFrame; }

module.exports = { setVisionFrame, buildVisionMessages, clearFrame, hasVision };
