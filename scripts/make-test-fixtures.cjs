// Deterministic local media fixtures for original viewer integration tests.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../work/demo');fs.mkdirSync(root,{recursive:true});
const objects=[
 '<< /Type /Catalog /Pages 2 0 R >>',
 '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
 null,
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
 null,
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
];
for(const [index,text] of [[3,'Artifacts PDF review: select this sentence.'],[5,'Page two: review feedback stays on this page.']]){
 const stream=`BT /F1 22 Tf 50 700 Td (${text}) Tj ET\n0.2 0.5 0.8 rg 50 450 450 120 re f\n`;
 objects[index]=`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`;
}
let pdf='%PDF-1.4\n',offsets=[0];
objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
const start=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
fs.writeFileSync(path.join(root,'review.pdf'),pdf);
const rate=8000,samples=rate*2,wav=Buffer.alloc(44+samples*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(2*Math.PI*220*i/rate)*1500),44+i*2);
fs.writeFileSync(path.join(root,'review.wav'),wav);
fs.writeFileSync(path.join(root,'interactive.html'),'<!doctype html><html><head><meta charset="utf-8"><style>body{font:18px system-ui;padding:30px;background:#202329;color:#eee}button{font:inherit;padding:10px}</style></head><body><h1>Interactive artifact</h1><p id="count">0</p><button onclick="document.getElementById(\'count\').textContent=Number(document.getElementById(\'count\').textContent)+1">Add one</button></body></html>');
console.log('Created PDF, WAV and HTML fixtures in',root);
