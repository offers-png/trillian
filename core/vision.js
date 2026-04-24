let latestFrame = null;

function setVisionFrame(base64Image) {
  if (!base64Image) return;
  latestFrame = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
}

function buildVisionMessages(userText) {
  const content = [{ type: "text", text: userText }];
  if (latestFrame) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: latestFrame }
    });
  }
  return content;
}

module.exports = { setVisionFrame, buildVisionMessages };
