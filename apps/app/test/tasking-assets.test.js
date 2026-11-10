import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe,it,expect } from 'vitest';
import { TASKING_DOCUMENT } from '../src/tasking/document.js';
import { TASKING_FAVICON } from '../../../src/tasking-favicon.js';
const root=new URL('../../../',import.meta.url);
describe('assets trasladados',()=>{
 it('conserva el SVG original en la app y en el aviso',()=>{const icon=readFileSync(new URL('public/favicon.svg',root),'utf8');expect(readFileSync(new URL('../public/tareas/favicon.v1.svg',import.meta.url),'utf8')).toBe(icon);expect(TASKING_FAVICON).toBe(icon);});
 it('el inventario coincide con los bytes publicados y todos los recursos del documento existen',()=>{const manifest=JSON.parse(readFileSync(new URL('docs/tasking/assets.json',root),'utf8'));for(const file of manifest.assets){const bytes=readFileSync(new URL('apps/app/public'+file.path,root));expect(createHash('sha256').update(bytes).digest('hex'),file.path).toBe(file.sha256);expect(bytes.length).toBe(file.bytes);}for(const [,path] of TASKING_DOCUMENT.matchAll(/(?:src|href)="(\/tareas\/[^"?]+\.(?:js|css|svg))"/g))expect(manifest.assets.some(f=>f.path===path),path).toBe(true);expect(TASKING_DOCUMENT).not.toMatch(/\sstyle=|<style|<script(?![^>]*\ssrc=)/);});
});
