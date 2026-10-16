/**
 * Minimal ZIP-hantering för att fylla i PowerPoint-mallen (en .pptx är en
 * ZIP-fil med XML). Oförändrade filer kopieras byte för byte, ändrade filer
 * sparas okomprimerade. Använder webbläsarens DecompressionStream, så inget
 * extra bibliotek behövs.
 */

type Entry = {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  data: Uint8Array; // komprimerade (eller lagrade) bytes
};

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export class Zip {
  private entries: Entry[] = [];
  private changed = new Map<string, Uint8Array>();

  static read(buf: ArrayBuffer): Zip {
    const zip = new Zip();
    const bytes = new Uint8Array(buf);
    const view = new DataView(buf);
    // Slutet av den centrala katalogen (EOCD) ligger sist i filen
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("Mallen är ingen giltig PowerPoint-fil");
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    for (let i = 0; i < count; i++) {
      if (view.getUint32(p, true) !== 0x02014b50) throw new Error("Trasig mall");
      const method = view.getUint16(p + 10, true);
      const crc = view.getUint32(p + 16, true);
      const compressedSize = view.getUint32(p + 20, true);
      const size = view.getUint32(p + 24, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const local = view.getUint32(p + 42, true);
      const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      const localStart =
        local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      zip.entries.push({
        name,
        method,
        crc,
        compressedSize,
        size,
        data: bytes.subarray(localStart, localStart + compressedSize),
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return zip;
  }

  names(): string[] {
    return this.entries.map((e) => e.name);
  }

  async text(name: string): Promise<string> {
    const changed = this.changed.get(name);
    if (changed) return new TextDecoder().decode(changed);
    const e = this.entries.find((x) => x.name === name);
    if (!e) throw new Error(`Saknas i mallen: ${name}`);
    const raw = e.method === 0 ? e.data : await inflateRaw(e.data);
    return new TextDecoder().decode(raw);
  }

  setText(name: string, text: string) {
    if (!this.entries.some((e) => e.name === name)) throw new Error(`Saknas i mallen: ${name}`);
    this.changed.set(name, new TextEncoder().encode(text));
  }

  /** Bygg den nya filen. Ändrade filer lagras okomprimerade. */
  toBytes(): Uint8Array<ArrayBuffer> {
    const enc = new TextEncoder();
    const parts: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;
    for (const e of this.entries) {
      const changed = this.changed.get(e.name);
      const data = changed ?? e.data;
      const method = changed ? 0 : e.method;
      const crc = changed ? crc32(changed) : e.crc;
      const size = changed ? changed.length : e.size;
      const name = enc.encode(e.name);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // UTF-8-namn
      local.setUint16(8, method, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, size, true);
      local.setUint16(26, name.length, true);
      parts.push(new Uint8Array(local.buffer), name, data);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, method, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, size, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((n, b) => n + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, this.entries.length, true);
    end.setUint16(10, this.entries.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n, b) => n + b.length, 0));
    let p = 0;
    for (const b of all) {
      out.set(b, p);
      p += b.length;
    }
    return out;
  }
}
