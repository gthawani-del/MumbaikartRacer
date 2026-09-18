const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const inputPath = path.resolve(process.argv[2]);
const outputPath = path.resolve(process.argv[3]);
const source = fs.readFileSync(inputPath);
if (source.toString("utf8", 0, 4) !== "glTF") throw new Error("Input is not a binary GLB");

const jsonLength = source.readUInt32LE(12);
const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString().trim());
const binaryStart = 20 + jsonLength + 8;
const replacements = new Map();

async function optimize() {
  for (const image of json.images || []) {
    if (image.bufferView === undefined || image.mimeType !== "image/jpeg") continue;
    const view = json.bufferViews[image.bufferView];
    const bytes = source.subarray(
      binaryStart + (view.byteOffset || 0),
      binaryStart + (view.byteOffset || 0) + view.byteLength,
    );
    const optimized = await sharp(bytes)
      .resize(1024, 1024, { fit: "fill" })
      .jpeg({ quality: 86, chromaSubsampling: "4:4:4", progressive: true })
      .toBuffer();
    replacements.set(image.bufferView, optimized);
  }

  const chunks = [];
  let offset = 0;
  for (let index = 0; index < json.bufferViews.length; index++) {
    const view = json.bufferViews[index];
    const original = source.subarray(
      binaryStart + (view.byteOffset || 0),
      binaryStart + (view.byteOffset || 0) + view.byteLength,
    );
    const bytes = replacements.get(index) || Buffer.from(original);
    const padding = (4 - (offset % 4)) % 4;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      offset += padding;
    }
    view.byteOffset = offset;
    view.byteLength = bytes.length;
    chunks.push(bytes);
    offset += bytes.length;
  }
  const binaryPadding = (4 - (offset % 4)) % 4;
  if (binaryPadding) chunks.push(Buffer.alloc(binaryPadding));
  const binary = Buffer.concat(chunks);
  json.buffers[0].byteLength = binary.length;

  json.scenes[0].name = "Mumbai Racing Auto";
  json.nodes[0].name = "AutoKartRoot";
  json.meshes[0].name = "AutoKartMesh";
  json.materials[0].name = "AutoKartPBR";
  json.asset.generator = `${json.asset.generator}; optimized for Mumbai Auto Rush`;
  json.asset.extras = {
    ...(json.asset.extras || {}),
    forwardAxis: "+Z after runtime rotation",
    sourceForwardAxis: "-X",
    wheelAnimation: false,
  };

  let jsonBytes = Buffer.from(JSON.stringify(json));
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPadding) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);

  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + binary.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(outputPath, Buffer.concat([header, jsonHeader, jsonBytes, binaryHeader, binary]));
}

optimize().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
