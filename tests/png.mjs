import zlib from 'node:zlib';
// PNG RGBA, sem biblioteca externa. Usado somente nos resultados dos testes.
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function chunk(type,data){const name=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);let c=0xffffffff;for(const b of Buffer.concat([name,data]))c=table[(c^b)&255]^(c>>>8);crc.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([len,name,data,crc])}
export function png(width,height,pixels){const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;const rows=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++){rows[y*(width*4+1)]=0;Buffer.from(pixels.buffer,pixels.byteOffset+y*width*4,width*4).copy(rows,y*(width*4+1)+1)}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))])}
