import pngToIco from 'png-to-ico';
import { writeFileSync } from 'fs';

const buf = await pngToIco('assets/icon.png');
writeFileSync('assets/icon.ico', buf);
console.log('icon.ico written:', buf.length, 'bytes');
